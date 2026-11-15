import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { entorno } from "@/lib/entorno";
import { ErrorDominio } from "@/lib/errores";

/**
 * Evidencias en disco (CARPETA_ARCHIVOS; en modo local, .local/archivos). Se valida el
 * tipo real por la firma de bytes, no por la extensión. Las fotos pasan por sharp:
 * orientación corregida y 2000 px como máximo (estándar DIA 02 §7).
 */
export const MAX_ARCHIVOS = 5;
export const MAX_BYTES = 8 * 1024 * 1024;
export const TIPOS_ACEPTADOS = "image/jpeg,image/png,image/webp,application/pdf";

type Mime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
const EXTENSION: Record<Mime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

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

/** Escribe el archivo y devuelve la ruta relativa que se guarda en la base. */
export async function guardarArchivo(archivo: ArchivoListo): Promise<string> {
  const mes = new Date().toISOString().slice(0, 7);
  const relativa = `${mes}/${randomUUID()}.${EXTENSION[archivo.mime]}`;
  const destino = resolver(relativa);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, archivo.datos, { flag: "wx" });
  return relativa;
}

export async function leerArchivo(relativa: string): Promise<Buffer> {
  return fs.readFile(resolver(relativa));
}

export async function borrarArchivos(relativas: string[]) {
  await Promise.all(relativas.map((r) => fs.rm(resolver(r), { force: true }).catch(() => {})));
}

function resolver(relativa: string): string {
  const base = entorno.carpetaArchivos;
  const destino = path.resolve(base, relativa);
  if (!destino.startsWith(base + path.sep)) throw new Error("ruta_invalida");
  return destino;
}
