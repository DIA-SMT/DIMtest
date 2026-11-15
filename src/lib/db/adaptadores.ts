// Adaptan PGlite (modo local y tests) y postgres.js (producción) a la misma interfaz.
// Sin `server-only` ni imports con valor: lo usan también los scripts de Node.
import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { Sql, TransactionSql } from "postgres";
import type { Ejecutor } from "./esquema";

export function ejecutorPglite(db: PGlite | Transaction, enTransaccion = false): Ejecutor {
  return {
    exec: (sql) => db.exec(sql),
    query: async <T>(sql: string, params?: unknown[]) => (await db.query<T>(sql, params ?? [])).rows,
    transaccion: (fn) =>
      enTransaccion ? fn(ejecutorPglite(db, true)) : (db as PGlite).transaction((tx) => fn(ejecutorPglite(tx, true))),
  };
}

export function ejecutorPostgres(sql: Sql | TransactionSql, enTransaccion = false): Ejecutor {
  return {
    exec: (texto) => sql.unsafe(texto),
    query: async <T>(texto: string, params?: unknown[]) => (await sql.unsafe(texto, (params ?? []) as never[])) as unknown as T[],
    transaccion: (fn) =>
      enTransaccion
        ? fn(ejecutorPostgres(sql, true))
        : ((sql as Sql).begin((tx) => fn(ejecutorPostgres(tx, true))) as Promise<never>),
  };
}
