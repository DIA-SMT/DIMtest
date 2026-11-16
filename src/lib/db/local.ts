import "server-only";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import catalogo from "@/domain/catalogo/catalogo-dim360.json";
import { hashearClave } from "@/lib/auth/clave";
import { log } from "@/lib/log";
import { ejecutorPglite } from "./adaptadores";
import { aplicarMigraciones, sembrarCatalogo, type CatalogoJson, type Ejecutor } from "./esquema";

/** Usuario de administración de desarrollo: solo existe en modo local (README). */
export const ADMIN_LOCAL = { usuario: "admin@dim360.local", clave: "dim360-local", nombre: "Equipo DIA (local)" } as const;

// Una sola instancia por proceso, también entre recargas del servidor de desarrollo.
const global = globalThis as typeof globalThis & { __dim360BaseLocal?: Promise<Ejecutor> };

export function baseLocal() {
  global.__dim360BaseLocal ??= crear().catch((error) => {
    global.__dim360BaseLocal = undefined;
    throw error;
  });
  return global.__dim360BaseLocal;
}

async function crear(): Promise<Ejecutor> {
  const carpeta = path.join(process.cwd(), ".local", "pgdata");
  fs.mkdirSync(carpeta, { recursive: true });
  const pg = await PGlite.create({ dataDir: carpeta });
  const db = ejecutorPglite(pg);
  const aplicadas = await aplicarMigraciones(db);
  const siembra = await sembrarCatalogo(db, catalogo as CatalogoJson);
  const [{ hay }] = await db.query<{ hay: boolean }>("select exists (select 1 from usuarios_admin) as hay");
  // La contraseña del usuario de desarrollo es pública (README): nunca se crea en producción.
  const crearAdmin = !hay && process.env.NODE_ENV !== "production";
  if (crearAdmin) {
    await db.query(
      `insert into usuarios_admin (usuario, nombre, rol, clave_hash, debe_cambiar_clave) values ($1, $2, 'administrador', $3, false)`,
      [ADMIN_LOCAL.usuario, ADMIN_LOCAL.nombre, await hashearClave(ADMIN_LOCAL.clave)],
    );
  }
  log("base_local.lista", { migraciones: aplicadas.length, pruebas: siembra.totalPruebas, admin_local_creado: crearAdmin });
  return db;
}
