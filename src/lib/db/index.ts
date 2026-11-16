import "server-only";
import { connection } from "next/server";
import { entorno, modoLocal } from "@/lib/entorno";
import { log, resumenError } from "@/lib/log";
import catalogo from "@/domain/catalogo/catalogo-dim360.json";
import type { CatalogoJson, Ejecutor } from "./esquema";
import { controlarCatalogo } from "./esquema";

/**
 * Acceso a Postgres. Toda operación corre en una transacción (`conBase`).
 *   * Modo local (sin DATABASE_URL): PGlite en .local/pgdata, con migraciones y catálogo al crearse.
 *   * Producción: postgres.js. Las migraciones y el catálogo se cargan con `npm run db:migrar` antes
 *     del deploy; al arrancar solo se controla (una consulta) y se avisa en el log si falta algo.
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
  // Solo controla, no escribe: cargar el catálogo es de `npm run db:migrar`. Antes se sembraba acá
  // y cada arranque en frío de Vercel hacía más de 200 consultas antes de atender el pedido.
  // No se espera: el control corre en paralelo y no demora a nadie.
  void controlarCatalogo(db, catalogo as CatalogoJson)
    .then((r) => {
      if (r.faltantes.length) log("catalogo.incompleto", { esperadas: r.esperadas, faltan: r.faltantes.length, ayuda: "npm run db:migrar" });
    })
    .catch((error) => log("catalogo.no_controlado", { error: resumenError(error) }));
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
