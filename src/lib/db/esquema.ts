// Migraciones y carga del catálogo. Sin `server-only` y sin imports relativos a
// propósito: lo usan la app (modo local y arranque), los tests de integración y los
// scripts de Node (`npm run db:migrar`, `npm run db:semilla`), que lo importan con
// el soporte nativo de TypeScript de Node.
import fs from "node:fs";
import path from "node:path";

/** Lo mínimo que hace falta de un cliente Postgres (PGlite o postgres.js). */
export interface Ejecutor {
  /** Varias sentencias, sin parámetros. */
  exec(sql: string): Promise<unknown>;
  /** Una sentencia con parámetros posicionales ($1, $2…). */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Corre `fn` en una transacción (con su propio ejecutor). */
  transaccion<R>(fn: (tx: Ejecutor) => Promise<R>): Promise<R>;
}

export interface ModuloCatalogo {
  prefijo: string;
  nombre: string;
  descripcion: string;
  orden: number;
  cantidadSegunPdf: number;
  pagina: number;
}

export interface PruebaCatalogo {
  codigo: string;
  modulo: string;
  numero: number;
  perfil: string | null;
  queProbar: string;
  resultadoEsperado: string;
  pagina: number;
}

export interface CatalogoJson {
  fuente: string;
  titulo: string;
  fecha: string;
  totalSegunPdf: number;
  perfiles: Record<string, string>;
  resultados: { clave: string; nombre: string; ayuda: string }[];
  exclusiones: { funcion: string; motivo: string }[];
  modulos: ModuloCatalogo[];
  pruebas: PruebaCatalogo[];
}

export function carpetaMigraciones(raiz = process.cwd()) {
  return path.join(raiz, "supabase", "migrations");
}

export function listarMigraciones(carpeta = carpetaMigraciones()) {
  return fs
    .readdirSync(/*turbopackIgnore: true*/ carpeta)
    .filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f))
    .sort();
}

/** Aplica, en orden y cada una en su transacción, las migraciones que falten. Devuelve las aplicadas. */
export async function aplicarMigraciones(db: Ejecutor, carpeta = carpetaMigraciones()): Promise<string[]> {
  await db.exec(
    "create table if not exists migraciones_aplicadas (nombre text primary key, aplicada_at timestamptz not null default now());" +
      "alter table migraciones_aplicadas enable row level security;",
  );
  const hechas = new Set((await db.query<{ nombre: string }>("select nombre from migraciones_aplicadas")).map((r) => r.nombre));
  const aplicadas: string[] = [];
  for (const archivo of listarMigraciones(carpeta)) {
    if (hechas.has(archivo)) continue;
    const sql = fs.readFileSync(/*turbopackIgnore: true*/ path.join(carpeta, archivo), "utf8");
    await db.transaccion(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into migraciones_aplicadas (nombre) values ($1)", [archivo]);
    });
    aplicadas.push(archivo);
  }
  return aplicadas;
}

export interface ResultadoSiembra {
  modulosNuevos: number;
  pruebasNuevas: number;
  pruebasActualizadas: number;
  totalPruebas: number;
}

/**
 * Carga el catálogo del PDF en la base. Idempotente: inserta lo que falta y
 * actualiza textos si el JSON cambió, siempre por código. Nunca borra pruebas ni
 * toca ejecuciones: los resultados históricos quedan atados al código original.
 */
export async function sembrarCatalogo(db: Ejecutor, catalogo: CatalogoJson): Promise<ResultadoSiembra> {
  return db.transaccion(async (tx) => {
    let modulosNuevos = 0;
    let pruebasNuevas = 0;
    let pruebasActualizadas = 0;
    for (const m of catalogo.modulos) {
      const r = await tx.query<{ nuevo: boolean }>(
        `insert into modulos (codigo, nombre, descripcion, orden, pagina)
         values ($1, $2, $3, $4, $5)
         on conflict (codigo) do update
           set nombre = excluded.nombre, descripcion = excluded.descripcion, orden = excluded.orden, pagina = excluded.pagina
           where (modulos.nombre, modulos.descripcion, modulos.orden, modulos.pagina)
             is distinct from (excluded.nombre, excluded.descripcion, excluded.orden, excluded.pagina)
         returning (xmax = 0) as nuevo`,
        [m.prefijo, m.nombre, m.descripcion, m.orden, m.pagina],
      );
      if (r[0]?.nuevo) modulosNuevos++;
    }
    for (const p of catalogo.pruebas) {
      if (!p.perfil) throw new Error(`catalogo: ${p.codigo} sin perfil`);
      const r = await tx.query<{ nuevo: boolean }>(
        `insert into pruebas (codigo, modulo_codigo, numero, perfil, que_probar, resultado_esperado, pagina)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (codigo) do update
           set modulo_codigo = excluded.modulo_codigo, numero = excluded.numero, perfil = excluded.perfil,
               que_probar = excluded.que_probar, resultado_esperado = excluded.resultado_esperado, pagina = excluded.pagina
           where (pruebas.modulo_codigo, pruebas.numero, pruebas.perfil, pruebas.que_probar, pruebas.resultado_esperado, pruebas.pagina)
             is distinct from (excluded.modulo_codigo, excluded.numero, excluded.perfil, excluded.que_probar, excluded.resultado_esperado, excluded.pagina)
         returning (xmax = 0) as nuevo`,
        [p.codigo, p.modulo, p.numero, p.perfil, p.queProbar, p.resultadoEsperado, p.pagina],
      );
      if (r[0]?.nuevo) pruebasNuevas++;
      else if (r.length) pruebasActualizadas++;
    }
    const [{ total }] = await tx.query<{ total: number }>("select count(*)::int as total from pruebas");
    return { modulosNuevos, pruebasNuevas, pruebasActualizadas, totalPruebas: total };
  });
}
