// Conexión a la base para los scripts (`db:migrar`, `db:semilla`, `admin:crear`).
// Importan los mismos módulos que la app (src/lib/db/esquema.ts, src/lib/auth/clave.ts)
// gracias al soporte nativo de TypeScript de Node (22.18 o más nuevo).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function leerCatalogo() {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, "src", "domain", "catalogo", "catalogo-dim360.json"), "utf8"));
}

/**
 * Producción: DIRECT_URL (conexión directa, puerto 5432) o, si falta, DATABASE_URL.
 * Sin ninguna de las dos, los scripts no tocan la base local: la app la prepara sola al arrancar.
 */
export async function conectar() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "Falta DATABASE_URL (o DIRECT_URL). En modo local no hace falta correr este script: `npm run dev` crea la base, aplica las migraciones y carga el catálogo solo.",
    );
    process.exit(1);
  }
  const { default: postgres } = await import("postgres");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const ssl = process.env.DATABASE_SSL === "desactivado" || (local && process.env.DATABASE_SSL !== "requerido") ? false : "require";
  const sql = postgres(url, { max: 1, ssl, onnotice: () => {} });
  const { ejecutorPostgres } = await import("../src/lib/db/adaptadores.ts");
  return { db: ejecutorPostgres(sql), cerrar: () => sql.end({ timeout: 5 }) };
}

export function argumento(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
