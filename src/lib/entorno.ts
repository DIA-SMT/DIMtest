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
});

function leer() {
  const r = esquema.safeParse({
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || undefined,
    SESSION_SECRET: process.env.SESSION_SECRET || undefined,
    CARPETA_ARCHIVOS: process.env.CARPETA_ARCHIVOS || undefined,
    DATABASE_SSL: process.env.DATABASE_SSL || undefined,
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
  return {
    ...e,
    produccion,
    modoLocal,
    // Solo fuera de producción hay un valor de desarrollo (es público: está en el repositorio).
    sessionSecret: e.SESSION_SECRET ?? "dim360-qa-secreto-de-desarrollo-local-no-usar",
    // turbopackIgnore: la carpeta es de datos, no de código; que el build no rastree todo el proyecto.
    carpetaArchivos: path.resolve(/*turbopackIgnore: true*/ e.CARPETA_ARCHIVOS ?? path.join(process.cwd(), ".local", "archivos")),
  };
}

export const entorno = leer();
export const modoLocal = entorno.modoLocal;
