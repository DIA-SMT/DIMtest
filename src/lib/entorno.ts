import "server-only";
import path from "node:path";
import { z } from "zod";

/**
 * Variables de entorno validadas al arrancar (src/instrumentation.ts).
 * Los mensajes nombran la variable, nunca el valor.
 *
 * Sin DATABASE_URL la app corre en modo local: PGlite en .local/pgdata, archivos en
 * .local/archivos y un usuario de administración de desarrollo (README). Así un
 * `npm run dev` recién clonado funciona sin configurar nada.
 */
const esquema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url("DATABASE_URL tiene que ser una URL postgres://").optional(),
  DATABASE_SSL: z.enum(["requerido", "desactivado"]).optional(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET tiene que tener 32 caracteres o más").optional(),
  CARPETA_ARCHIVOS: z.string().min(1).optional(),
  RESERVA_MINUTOS: z.coerce.number().int().min(5).max(240).default(30),
  // Evidencias en un bucket privado de Supabase Storage (D-011). Sin estas dos, van a disco.
  SUPABASE_URL: z.string().url("SUPABASE_URL tiene que ser la URL del proyecto, https://<ref>.supabase.co").optional(),
  SUPABASE_SECRET_KEY: z.string().min(20, "SUPABASE_SECRET_KEY no parece una clave secreta de Supabase").optional(),
  SUPABASE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,62}$/, "SUPABASE_BUCKET: minúsculas, números, guion o guion bajo").default("evidencias"),
  // Avisos del agente por WhatsApp Cloud API (D-015). Sin token y número, los avisos quedan registrados sin enviarse.
  WHATSAPP_TOKEN: z.string().min(20, "WHATSAPP_TOKEN no parece un token de acceso de Meta").optional(),
  WHATSAPP_NUMERO_ID: z.string().regex(/^\d{5,30}$/, "WHATSAPP_NUMERO_ID es el id numérico del número en Meta").optional(),
  WHATSAPP_PLANTILLA: z.string().regex(/^[a-z0-9_]{1,512}$/, "WHATSAPP_PLANTILLA: minúsculas, números y guion bajo").default("aviso_dim360"),
  WHATSAPP_IDIOMA: z.string().regex(/^[a-z]{2}(_[A-Z]{2})?$/, "WHATSAPP_IDIOMA: por ejemplo es_AR").default("es_AR"),
  WHATSAPP_VERSION_API: z.string().regex(/^v\d+\.\d+$/, "WHATSAPP_VERSION_API: por ejemplo v23.0").default("v23.0"),
});

function leer() {
  const r = esquema.safeParse({
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || undefined,
    SESSION_SECRET: process.env.SESSION_SECRET || undefined,
    CARPETA_ARCHIVOS: process.env.CARPETA_ARCHIVOS || undefined,
    DATABASE_SSL: process.env.DATABASE_SSL || undefined,
    SUPABASE_URL: process.env.SUPABASE_URL || undefined,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined,
    SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || undefined,
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN || undefined,
    WHATSAPP_NUMERO_ID: process.env.WHATSAPP_NUMERO_ID || undefined,
    WHATSAPP_PLANTILLA: process.env.WHATSAPP_PLANTILLA || undefined,
    WHATSAPP_IDIOMA: process.env.WHATSAPP_IDIOMA || undefined,
    WHATSAPP_VERSION_API: process.env.WHATSAPP_VERSION_API || undefined,
  });
  if (!r.success) {
    const variables = r.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join("; ");
    throw new Error(`Entorno mal configurado (${variables}). Revisá .env.example.`);
  }
  const e = r.data;
  const produccion = e.NODE_ENV === "production";
  const modoLocal = !e.DATABASE_URL;
  // En producción siempre, también sin base: el valor de desarrollo está publicado en el repositorio.
  // Menos durante `next build` (también corre con NODE_ENV=production): el build no necesita secretos.
  const construyendo = process.env.NEXT_PHASE === "phase-production-build";
  if (produccion && !e.SESSION_SECRET && !construyendo) {
    throw new Error("Entorno mal configurado: SESSION_SECRET es obligatoria en producción.");
  }
  // Solo importa con una base real: en modo local las evidencias van siempre a disco.
  if (!modoLocal && !e.SUPABASE_URL !== !e.SUPABASE_SECRET_KEY) {
    throw new Error("Entorno mal configurado: SUPABASE_URL y SUPABASE_SECRET_KEY van juntas (o ninguna de las dos).");
  }
  if (!e.WHATSAPP_TOKEN !== !e.WHATSAPP_NUMERO_ID) {
    throw new Error("Entorno mal configurado: WHATSAPP_TOKEN y WHATSAPP_NUMERO_ID van juntas (o ninguna de las dos).");
  }
  return {
    ...e,
    produccion,
    modoLocal,
    // Solo fuera de producción hay un valor de desarrollo (es público: está en el repositorio).
    sessionSecret: e.SESSION_SECRET ?? "dim360-qa-secreto-de-desarrollo-local-no-usar",
    // turbopackIgnore: la carpeta es de datos, no de código; que el build no rastree todo el proyecto.
    /**
     * Dónde van las evidencias: el bucket de Supabase si está configurado y la app usa una base
     * real. En modo local siempre disco, aunque .env.local tenga la clave (la usan los scripts):
     * así las pruebas en la computadora nunca suben archivos al bucket de producción.
     */
    almacen: e.SUPABASE_URL && e.SUPABASE_SECRET_KEY && !modoLocal ? ("supabase" as const) : ("disco" as const),
    carpetaArchivos: path.resolve(/*turbopackIgnore: true*/ e.CARPETA_ARCHIVOS ?? path.join(process.cwd(), ".local", "archivos")),
  };
}

export const entorno = leer();
export const modoLocal = entorno.modoLocal;
