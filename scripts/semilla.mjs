// Carga (o actualiza) el catálogo de pruebas del PDF en la base. No crea resultados.
//   npm run db:semilla
// En modo local la app lo hace sola al crear la base; en producción lo hace `npm run db:migrar`.
// Este script sirve para recargarlo a mano después de `npm run catalogo:extraer`.
import { sembrarCatalogo } from "../src/lib/db/esquema.ts";
import { conectar, leerCatalogo } from "./lib.mjs";

const { db, cerrar } = await conectar();
try {
  const catalogo = leerCatalogo();
  const r = await sembrarCatalogo(db, catalogo);
  console.log(`Catálogo: ${r.totalPruebas} pruebas en la base (${r.pruebasNuevas} nuevas, ${r.pruebasActualizadas} actualizadas).`);
  if (r.totalPruebas !== catalogo.totalSegunPdf) {
    console.error(`Atención: el PDF tiene ${catalogo.totalSegunPdf} pruebas y la base ${r.totalPruebas}.`);
    process.exitCode = 1;
  }
} finally {
  await cerrar();
}
