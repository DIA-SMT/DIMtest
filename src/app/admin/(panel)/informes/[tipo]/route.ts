import { adminConPermiso } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { diaIso } from "@/lib/fechas";
import { log } from "@/lib/log";
import { armarInforme, esTipoInforme } from "@/features/informes/datos";
import { generarExcel } from "@/features/informes/excel";
import { generarPdf } from "@/features/informes/pdf";

/** Descarga de informes: /admin/informes/<tipo>?formato=xlsx|pdf. Solo el equipo. */
export async function GET(pedido: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const admin = await adminConPermiso("informes.exportar");
  if (!admin) return new Response("Se venció tu sesión. Ingresá de nuevo.", { status: 401 });
  const { tipo } = await params;
  if (!esTipoInforme(tipo)) return new Response("No encontrado", { status: 404 });
  const formato = new URL(pedido.url).searchParams.get("formato") === "pdf" ? "pdf" : "xlsx";

  const informe = await conBase((q) => armarInforme(q, tipo));
  const generado = new Date();
  const datos = formato === "pdf" ? await generarPdf(informe, generado) : await generarExcel(informe, generado);
  log("informe.generado", { tipo, formato, filas: informe.filas.length });

  const nombre = `dim360-${tipo}-${diaIso(generado)}.${formato}`;
  return new Response(new Uint8Array(datos), {
    headers: {
      "Content-Type": formato === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
