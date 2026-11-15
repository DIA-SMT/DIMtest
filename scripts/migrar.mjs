// Aplica las migraciones pendientes de supabase/migrations y asegura el catálogo de 217 pruebas.
//   npm run db:migrar
// Va ANTES de cada deploy que traiga una migración nueva. Es idempotente.
import path from "node:path";
import { aplicarMigraciones, sembrarCatalogo } from "../src/lib/db/esquema.ts";
import { conectar, leerCatalogo, RAIZ } from "./lib.mjs";

const { db, cerrar } = await conectar();
try {
  const aplicadas = await aplicarMigraciones(db, path.join(RAIZ, "supabase", "migrations"));
  console.log(aplicadas.length ? `Migraciones aplicadas: ${aplicadas.join(", ")}` : "No había migraciones pendientes.");
  const r = await sembrarCatalogo(db, leerCatalogo());
  console.log(`Catálogo: ${r.totalPruebas} pruebas (${r.pruebasNuevas} nuevas, ${r.pruebasActualizadas} actualizadas, ${r.modulosNuevos} módulos nuevos).`);
} finally {
  await cerrar();
}
