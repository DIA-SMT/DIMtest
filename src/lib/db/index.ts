import "server-only";
import { connection } from "next/server";
import { entorno, modoLocal } from "@/lib/entorno";
import { log, resumenError } from "@/lib/log";
import catalogo from "@/domain/catalogo/catalogo-dim360.json";
import type { CatalogoJson, Ejecutor } from "./esquema";
import { sembrarCatalogo } from "./esquema";

/**
 * Acceso a Postgres. Toda operación corre en una transacción (`conBase`).
 *   * Modo local (sin DATABASE_URL): PGlite en .local/pgdata, con migraciones y catálogo al crearse.
 *   * Producción: postgres.js. Las migraciones se aplican con `npm run db:migrar` antes del deploy;
 *     el catálogo se asegura también al arrancar (idempotente), así nunca falta.
 *
 * Fechas: llegan como Date. Conteos: castear a ::int (postgres.js devuelve bigint como texto).
 * Parámetros jsonb: `$1::text::jsonb` con JSON.stringify(valor).
 */
export type Consulta = <T = Record<string, unknown>>(texto: string, params?: unknown[]) => Promise<T[]>;

let base: Promise<Ejecutor> | undefined;

async function crearLocal(): Promise<Ejecutor> {
  const { baseLocal } = await import("./local");
  return baseLocal();
}

async function crearPostgres(): Promise<Ejecutor> {
  const { default: postgres } = await import("postgres");
  const { ejecutorPostgres } = await import("./adaptadores");
  const url = entorno.DATABASE_URL!;
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const ssl = entorno.DATABASE_SSL === "desactivado" || (local && entorno.DATABASE_SSL !== "requerido") ? false : "require";
  const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, ssl, onnotice: () => {} });
  const db = ejecutorPostgres(sql);
  try {
    const r = await sembrarCatalogo(db, catalogo as CatalogoJson);
    log("catalogo.asegurado", { total: r.totalPruebas, nuevas: r.pruebasNuevas, actualizadas: r.pruebasActualizadas });
  } catch (error) {
    // Sin tablas todavía: faltan las migraciones (npm run db:migrar).
    log("catalogo.no_asegurado", { error: resumenError(error) });
  }
  return db;
}

function baseActual() {
  base ??= (modoLocal ? crearLocal() : crearPostgres()).catch((error) => {
    base = undefined;
    throw error;
  });
  return base;
}

/** Ejecuta `fn` dentro de una transacción. */
export async function conBase<R>(fn: (q: Consulta) => Promise<R>): Promise<R> {
  await connection();
  const db = await baseActual();
  return db.transaccion((tx) => fn(tx.query));
}

/** Atajo para una sola consulta. */
export function consultar<T = Record<string, unknown>>(texto: string, params?: unknown[]) {
  return conBase((q) => q<T>(texto, params));
}
