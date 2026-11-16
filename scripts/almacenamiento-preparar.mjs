// Crea (o ajusta) el bucket privado de Supabase Storage para las evidencias y lo prueba (D-011).
//   npm run almacenamiento:preparar
// Usa SUPABASE_URL, SUPABASE_SECRET_KEY y SUPABASE_BUCKET (por defecto «evidencias») de .env.local.
// Es idempotente: si el bucket existe, le vuelve a poner privado, el tamaño máximo y los tipos.
// Al final sube un PNG de 1 px, lo lee, lo compara y lo borra.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { MAX_BYTES, TIPOS_MIME } from "../src/domain/evidencias.ts";

const url = process.env.SUPABASE_URL;
const clave = process.env.SUPABASE_SECRET_KEY;
const bucket = process.env.SUPABASE_BUCKET || "evidencias";
if (!url || !clave) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SECRET_KEY (en .env.local o en el entorno). Ver README, «Evidencias».");
  process.exit(1);
}

const supabase = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
const opciones = { public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: [...TIPOS_MIME] };

const existente = await supabase.storage.getBucket(bucket);
if (existente.data) {
  const { error } = await supabase.storage.updateBucket(bucket, opciones);
  if (error) fallar("No se pudo ajustar el bucket", error);
  console.log(`Bucket «${bucket}» ya existía: quedó privado, con ${MAX_BYTES / 1024 / 1024} MB por archivo y ${TIPOS_MIME.length} tipos.`);
} else {
  const { error } = await supabase.storage.createBucket(bucket, opciones);
  if (error) fallar("No se pudo crear el bucket", error);
  console.log(`Bucket «${bucket}» creado: privado, ${MAX_BYTES / 1024 / 1024} MB por archivo, ${TIPOS_MIME.join(", ")}.`);
}

const { data: info, error: errorInfo } = await supabase.storage.getBucket(bucket);
if (errorInfo || !info) fallar("No se pudo leer el bucket", errorInfo);
if (info.public) fallar("El bucket quedó público y tiene que ser privado", null);

// Prueba de ida y vuelta con un PNG de 1 px.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64");
const ruta = `_control/${randomUUID()}.png`;
const subida = await supabase.storage.from(bucket).upload(ruta, png, { contentType: "image/png", upsert: false });
if (subida.error) fallar("No se pudo subir el archivo de prueba", subida.error);
const bajada = await supabase.storage.from(bucket).download(ruta);
const iguales = !bajada.error && bajada.data && Buffer.from(await bajada.data.arrayBuffer()).equals(png);
const borrado = await supabase.storage.from(bucket).remove([ruta]);
if (!iguales) fallar("El archivo de prueba no volvió igual", bajada.error);
if (borrado.error) fallar("No se pudo borrar el archivo de prueba", borrado.error);
console.log("Prueba: subir, leer y borrar un archivo funcionó. El bucket está listo.");

function fallar(mensaje, error) {
  console.error(`${mensaje}${error ? `: ${error.message}` : "."}`);
  process.exit(1);
}
