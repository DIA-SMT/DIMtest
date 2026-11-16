import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EXTENSION, MAX_ARCHIVOS, MAX_BYTES, RE_RUTA, TIPOS_MIME, type Mime } from "@/domain/evidencias";
import { entorno } from "@/lib/entorno";
import { ErrorDominio } from "@/lib/errores";
import { log } from "@/lib/log";

/**
 * Evidencias (fotos y PDF). Se valida el tipo real por la firma de bytes, no por la
 * extensión. Las fotos pasan por sharp: orientación corregida y 2000 px como máximo
 * (estándar DIA 02 §7). Se guardan en un **almacén**:
 *   * Bucket privado de Supabase Storage si están SUPABASE_URL y SUPABASE_SECRET_KEY (D-011):
 *     lo necesario en Vercel, que no tiene disco persistente.
 *   * Disco en los demás casos (CARPETA_ARCHIVOS; en modo local, .local/archivos).
 * La base guarda solo la ruta relativa (`2026-11/<uuid>.jpg`), igual en los dos.
 */
export { MAX_ARCHIVOS, MAX_BYTES };
export const TIPOS_ACEPTADOS = TIPOS_MIME.join(",");

export function tipoPorFirma(b: Uint8Array): Mime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP")
    return "image/webp";
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

export interface ArchivoListo {
  nombre: string;
  mime: Mime;
  datos: Buffer;
}

/** Lee y valida los archivos de un formulario (campo `evidencias`). Ignora los vacíos. */
export async function prepararArchivos(entradas: FormDataEntryValue[]): Promise<ArchivoListo[]> {
  const archivos = entradas.filter((e): e is File => typeof e === "object" && e !== null && "arrayBuffer" in e && e.size > 0);
  if (archivos.length > MAX_ARCHIVOS) throw new ErrorDominio("archivo_cantidad");
  const listos: ArchivoListo[] = [];
  for (const archivo of archivos) {
    if (archivo.size > MAX_BYTES) throw new ErrorDominio("archivo_tamano");
    let datos: Buffer = Buffer.from(await archivo.arrayBuffer());
    const mime = tipoPorFirma(datos);
    if (!mime) throw new ErrorDominio("archivo_tipo");
    if (mime !== "application/pdf") datos = await ajustarImagen(datos, mime);
    const nombre = (archivo.name || `evidencia.${EXTENSION[mime]}`).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 200);
    listos.push({ nombre, mime, datos });
  }
  return listos;
}

async function ajustarImagen(datos: Buffer, mime: Mime): Promise<Buffer> {
  try {
    const { default: sharp } = await import("sharp");
    const img = sharp(datos, { failOn: "error" }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true });
    if (mime === "image/png") return await img.png().toBuffer();
    if (mime === "image/webp") return await img.webp({ quality: 85 }).toBuffer();
    return await img.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  } catch {
    // Firma válida pero contenido roto: se rechaza.
    throw new ErrorDominio("archivo_tipo");
  }
}

// ---------------------------------------------------------------------------
// Almacenes
// ---------------------------------------------------------------------------

export interface Almacen {
  tipo: "disco" | "supabase";
  guardar(ruta: string, datos: Buffer, mime: Mime): Promise<void>;
  leer(ruta: string): Promise<Buffer>;
  borrar(rutas: string[]): Promise<void>;
}

export function almacenDisco(carpeta: string): Almacen {
  const base = path.resolve(carpeta);
  const resolver = (ruta: string) => {
    const destino = path.resolve(base, ruta);
    if (!destino.startsWith(base + path.sep)) throw new Error("ruta_invalida");
    return destino;
  };
  return {
    tipo: "disco",
    async guardar(ruta, datos) {
      const destino = resolver(ruta);
      await fs.mkdir(path.dirname(destino), { recursive: true });
      await fs.writeFile(destino, datos, { flag: "wx" });
    },
    leer: async (ruta) => fs.readFile(resolver(ruta)),
    async borrar(rutas) {
      await Promise.all(rutas.map((r) => fs.rm(resolver(r), { force: true }).catch(() => {})));
    },
  };
}

/** Bucket privado: solo el servidor lo lee y escribe, con la clave secreta. Nunca hay URL pública. */
export function almacenSupabase(cliente: Pick<SupabaseClient, "storage">, bucket: string): Almacen {
  const b = () => cliente.storage.from(bucket);
  return {
    tipo: "supabase",
    async guardar(ruta, datos, mime) {
      const { error } = await b().upload(ruta, datos, { contentType: mime, upsert: false, cacheControl: "300" });
      if (error) throw new Error(`almacen_guardar: ${error.message}`);
    },
    async leer(ruta) {
      const { data, error } = await b().download(ruta);
      if (error || !data) throw new Error(`almacen_leer: ${error?.message ?? "sin datos"}`);
      return Buffer.from(await data.arrayBuffer());
    },
    async borrar(rutas) {
      if (!rutas.length) return;
      const { error } = await b().remove(rutas);
      // Borrar es limpieza después de un error: si falla, queda un archivo huérfano, no un dato roto.
      if (error) log("almacen.borrar_fallo", { cantidad: rutas.length, error: error.message });
    },
  };
}

let actual: Promise<Almacen> | undefined;

function almacenActual(): Promise<Almacen> {
  actual ??= (async () => {
    if (entorno.almacen === "disco") return almacenDisco(entorno.carpetaArchivos);
    const { createClient } = await import("@supabase/supabase-js");
    const cliente = createClient(entorno.SUPABASE_URL!, entorno.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return almacenSupabase(cliente, entorno.SUPABASE_BUCKET);
  })();
  return actual;
}

/** Nueva ruta relativa para un archivo: mes de subida y un id al azar. */
export function nuevaRuta(mime: Mime, fecha = new Date()): string {
  return `${fecha.toISOString().slice(0, 7)}/${randomUUID()}.${EXTENSION[mime]}`;
}

/** Guarda el archivo y devuelve la ruta relativa que va a la base. */
export async function guardarArchivo(archivo: ArchivoListo): Promise<string> {
  const ruta = nuevaRuta(archivo.mime);
  await (await almacenActual()).guardar(ruta, archivo.datos, archivo.mime);
  return ruta;
}

export async function leerArchivo(ruta: string): Promise<Buffer> {
  if (!RE_RUTA.test(ruta)) throw new Error("ruta_invalida");
  return (await almacenActual()).leer(ruta);
}

export async function borrarArchivos(rutas: string[]) {
  await (await almacenActual()).borrar(rutas.filter((r) => RE_RUTA.test(r)));
}
