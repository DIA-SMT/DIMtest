// Base de prueba con las mismas migraciones y el mismo catálogo que producción.
//   * Por defecto: PGlite en memoria (no hace falta nada instalado).
//   * Con PRUEBAS_DATABASE_URL: un Postgres real por postgres.js, el motor de producción.
//     ¡Borra y recrea el esquema public de esa base! Usar solo una base descartable.
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import catalogo from "@/domain/catalogo/catalogo-dim360.json";
import { hashearClave } from "@/lib/auth/clave";
import { ejecutorPglite, ejecutorPostgres } from "@/lib/db/adaptadores";
import { aplicarMigraciones, sembrarCatalogo, type CatalogoJson, type Ejecutor } from "@/lib/db/esquema";
import type { Consulta } from "@/lib/db";

export async function baseDePrueba() {
  const url = process.env.PRUEBAS_DATABASE_URL;
  let db: Ejecutor;
  let cerrar: () => Promise<unknown>;
  if (url) {
    const sql = postgres(url, { max: 1, onnotice: () => {} });
    await sql.unsafe("drop schema public cascade; create schema public;");
    db = ejecutorPostgres(sql);
    cerrar = () => sql.end({ timeout: 5 });
  } else {
    const pg = await PGlite.create();
    db = ejecutorPglite(pg);
    cerrar = () => pg.close();
  }
  await aplicarMigraciones(db);
  const siembra = await sembrarCatalogo(db, catalogo as CatalogoJson);
  /** Corre `fn` en una transacción, como conBase() en la app. */
  const tx = <R>(fn: (q: Consulta) => Promise<R>) => db.transaccion((t) => fn(t.query));
  return { db, tx, siembra, cerrar };
}

export async function crearAdmin(tx: <R>(fn: (q: Consulta) => Promise<R>) => Promise<R>, usuario = "equipo", rol = "administrador") {
  const hash = await hashearClave("una-clave-de-prueba-larga", { N: 1024, r: 8, p: 1 });
  const [u] = await tx((q) =>
    q<{ id: string; nombre: string }>(
      "insert into usuarios_admin (usuario, nombre, rol, clave_hash, debe_cambiar_clave) values ($1, $2, $3, $4, false) returning id, nombre",
      [usuario, `Equipo ${usuario}`, rol, hash],
    ),
  );
  return u;
}
