import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { EncabezadoPagina, InsigniaEstadoIncidencia, InsigniaPrioridad } from "@/components/ui";
import { AYUDA_PRIORIDAD, NOMBRE_PRIORIDAD, PRIORIDADES } from "@/domain/prioridades";
import { listarIncidencias, opcionesModulos, opcionesResponsables } from "@/features/admin/consultas";
import { BarraFiltros, FiltroSelect, param } from "@/features/admin/components/filtros";
import { PrioridadRapida } from "@/features/admin/components/prioridad-rapida";
import { estadosDeFiltro, OPCIONES_ESTADO } from "@/features/admin/estados-filtro";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { antiguedad, fechaHora } from "@/lib/fechas";
import { numeroIncidencia, resumir } from "@/lib/formato";

export const metadata = { title: "Prioridades" };

const TITULO: Record<string, string> = {
  P0: "Problemas críticos",
  P1: "Problemas de prioridad alta",
  P2: "Problemas medios",
  P3: "Problemas bajos",
};
const BORDE: Record<string, string> = {
  P0: "border-t-error",
  P1: "border-t-error-borde",
  P2: "border-t-amarillo",
  P3: "border-t-borde-control",
};

export default async function Prioridades({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirAdmin();
  const sp = await searchParams;
  const modulo = param(sp, "modulo");
  const responsable = param(sp, "responsable");
  const estado = param(sp, "estado") ?? "activas";

  const { filas, modulos, responsables } = await conBase(async (q) => ({
    filas: await listarIncidencias(q, {
      modulo: modulo && /^[A-Z]{2,4}$/.test(modulo) ? modulo : undefined,
      responsable: responsable === "sin_asignar" || (responsable && /^[0-9a-f-]{36}$/.test(responsable)) ? responsable : undefined,
      estados: estadosDeFiltro(estado),
    }),
    modulos: await opcionesModulos(q),
    responsables: await opcionesResponsables(q),
  }));

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        antetitulo="Gestión de correcciones"
        titulo="Prioridades"
        descripcion="Lo más urgente primero. Cambiá la prioridad desde acá: queda registrado quién la cambió y cuándo."
      />
      <BarraFiltros accion="/admin/prioridades" limpiar="/admin/prioridades">
        <FiltroSelect nombre="modulo" etiqueta="Módulo" opciones={modulos} valor={modulo} />
        <FiltroSelect nombre="responsable" etiqueta="Responsable" opciones={[{ valor: "sin_asignar", etiqueta: "Sin asignar" }, ...responsables]} valor={responsable} />
        <FiltroSelect nombre="estado" etiqueta="Estado" opciones={OPCIONES_ESTADO.filter((o) => o.valor !== "activas")} valor={estado === "activas" ? undefined : estado} todas="Activas (sin cerrar)" />
      </BarraFiltros>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        {PRIORIDADES.map((p) => {
          const grupo = filas.filter((f) => f.prioridad === p);
          return (
            <section key={p} id={p} aria-labelledby={`titulo-${p}`} className={`scroll-mt-6 rounded-tarjeta border border-t-4 border-borde bg-superficie shadow-tarjeta ${BORDE[p]}`}>
              <header className="flex items-start justify-between gap-2 border-b border-borde p-4">
                <div>
                  <h2 id={`titulo-${p}`} className="flex items-center gap-2 font-bold">
                    <InsigniaPrioridad prioridad={p} corta />
                    {TITULO[p]}
                  </h2>
                  <p className="mt-1 text-xs text-texto-secundario">{AYUDA_PRIORIDAD[p]}</p>
                </div>
                <span className="text-2xl font-bold tabular-nums" aria-label={`${grupo.length} incidencias ${NOMBRE_PRIORIDAD[p]}`}>
                  {grupo.length}
                </span>
              </header>
              {grupo.length === 0 ? (
                <p className="p-4 text-sm text-texto-secundario">Sin incidencias.</p>
              ) : (
                <ul className="divide-y divide-borde">
                  {grupo.map((i) => (
                    <li key={i.id} className="space-y-2 p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/admin/incidencias/${i.numero}`} className="font-mono font-bold text-primario-oscuro hover:underline">
                          {numeroIncidencia(i.numero)}
                        </Link>
                        <PrioridadRapida id={i.id} numero={i.numero} prioridad={i.prioridad} />
                      </div>
                      <p className="font-medium">{resumir(i.descripcion, 140)}</p>
                      <p className="text-xs text-texto-secundario">
                        <Link href={`/admin/pruebas/${i.prueba_codigo}`} className="font-mono font-semibold hover:underline">
                          {i.prueba_codigo}
                        </Link>{" "}
                        · {resumir(i.que_probar, 80)} · {i.modulo}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <InsigniaEstadoIncidencia estado={i.estado} />
                        {i.revalidacion_pendiente ? (
                          <span className="inline-flex items-center gap-1 text-xs text-institucional">
                            <RotateCcw aria-hidden="true" className="size-3" />
                            Esperando revalidación
                          </span>
                        ) : null}
                      </div>
                      <dl className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <dt className="text-texto-secundario">Reportó</dt>
                          <dd className="font-medium">{i.reportada_por}</dd>
                        </div>
                        <div>
                          <dt className="text-texto-secundario">Responsable</dt>
                          <dd className="font-medium">{i.responsable ?? "Sin asignar"}</dd>
                        </div>
                        <div>
                          <dt className="text-texto-secundario">Antigüedad</dt>
                          <dd className="font-medium" title={fechaHora(i.reportada_at)}>
                            {antiguedad(i.reportada_at)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
