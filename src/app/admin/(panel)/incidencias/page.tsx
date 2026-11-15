import Link from "next/link";
import { Plus, RotateCcw, ShieldCheck } from "lucide-react";
import { CLASE_BOTON_PRIMARIO } from "@/components/formulario";
import { EncabezadoPagina, EstadoVacio, InsigniaEstadoIncidencia, InsigniaPrioridad, Tarjeta } from "@/components/ui";
import { estadosDeFiltro, OPCIONES_ESTADO } from "@/features/admin/estados-filtro";
import { PRIORIDADES, NOMBRE_PRIORIDAD, esPrioridad } from "@/domain/prioridades";
import { listarIncidencias, opcionesModulos, opcionesResponsables } from "@/features/admin/consultas";
import { BarraFiltros, CLASE_TABLA, CLASE_TD, CLASE_TH, CLASE_THEAD, FiltroSelect, FiltroTexto, param } from "@/features/admin/components/filtros";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { antiguedad, fechaHora } from "@/lib/fechas";
import { numeroIncidencia, resumir } from "@/lib/formato";

export const metadata = { title: "Incidencias" };

export default async function ListaIncidencias({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirAdmin();
  const sp = await searchParams;
  const prioridad = param(sp, "prioridad");
  const modulo = param(sp, "modulo");
  const responsable = param(sp, "responsable");
  const estado = param(sp, "estado") ?? "todas";
  const busqueda = param(sp, "q");

  const { filas, modulos, responsables } = await conBase(async (q) => ({
    filas: await listarIncidencias(q, {
      prioridades: esPrioridad(prioridad) ? [prioridad] : undefined,
      modulo: modulo && /^[A-Z]{2,4}$/.test(modulo) ? modulo : undefined,
      responsable: responsable === "sin_asignar" || (responsable && /^[0-9a-f-]{36}$/.test(responsable)) ? responsable : undefined,
      estados: estadosDeFiltro(estado),
      busqueda,
    }),
    modulos: await opcionesModulos(q),
    responsables: await opcionesResponsables(q),
  }));

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        antetitulo="Gestión de correcciones"
        titulo="Incidencias"
        descripcion="Ordenadas de mayor a menor prioridad y, dentro de cada prioridad, de la más antigua a la más nueva."
        acciones={
          <Link href="/admin/incidencias/nueva" className={CLASE_BOTON_PRIMARIO}>
            <Plus aria-hidden="true" className="size-4" />
            Nueva incidencia
          </Link>
        }
      />
      <BarraFiltros accion="/admin/incidencias" limpiar="/admin/incidencias">
        <FiltroTexto nombre="q" etiqueta="Buscar" tipo="search" valor={busqueda} placeholder="Descripción, código o relevador" />
        <FiltroSelect nombre="prioridad" etiqueta="Prioridad" opciones={PRIORIDADES.map((p) => ({ valor: p, etiqueta: `${p} · ${NOMBRE_PRIORIDAD[p]}` }))} valor={prioridad} todas="Todas" />
        <FiltroSelect nombre="modulo" etiqueta="Módulo" opciones={modulos} valor={modulo} />
        <FiltroSelect nombre="responsable" etiqueta="Responsable" opciones={[{ valor: "sin_asignar", etiqueta: "Sin asignar" }, ...responsables]} valor={responsable} />
        <FiltroSelect nombre="estado" etiqueta="Estado" opciones={OPCIONES_ESTADO} valor={estado === "todas" ? undefined : estado} todas="Todos" />
      </BarraFiltros>
      <p className="text-sm text-texto-secundario">{filas.length} incidencias</p>

      {filas.length === 0 ? (
        <EstadoVacio icono={ShieldCheck} titulo="No hay incidencias con estos filtros" ayuda="Las incidencias se crean desde la bandeja de observaciones o desde una prueba." />
      ) : (
        <Tarjeta className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className={CLASE_TABLA}>
              <caption className="sr-only">Incidencias</caption>
              <thead className={CLASE_THEAD}>
                <tr>
                  <th scope="col" className={CLASE_TH}>N.º</th>
                  <th scope="col" className={CLASE_TH}>Prioridad</th>
                  <th scope="col" className={CLASE_TH}>Prueba</th>
                  <th scope="col" className={CLASE_TH}>Descripción</th>
                  <th scope="col" className={CLASE_TH}>Reportó</th>
                  <th scope="col" className={CLASE_TH}>Responsable</th>
                  <th scope="col" className={CLASE_TH}>Estado</th>
                  <th scope="col" className={CLASE_TH}>Antigüedad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {filas.map((i) => (
                  <tr key={i.id} className="hover:bg-fondo">
                    <td className={CLASE_TD}>
                      <Link href={`/admin/incidencias/${i.numero}`} className="font-mono font-bold whitespace-nowrap text-primario-oscuro hover:underline">
                        {numeroIncidencia(i.numero)}
                      </Link>
                    </td>
                    <td className={CLASE_TD}>
                      <InsigniaPrioridad prioridad={i.prioridad} />
                    </td>
                    <td className={`${CLASE_TD} whitespace-nowrap`}>
                      <Link href={`/admin/pruebas/${i.prueba_codigo}`} className="font-mono hover:underline">
                        {i.prueba_codigo}
                      </Link>
                      <span className="block text-xs text-texto-secundario">{i.modulo_codigo}</span>
                    </td>
                    <td className={`${CLASE_TD} min-w-72`}>
                      {resumir(i.descripcion, 110)}
                      <span className="block text-xs text-texto-secundario">{resumir(i.que_probar, 70)}</span>
                    </td>
                    <td className={`${CLASE_TD} whitespace-nowrap`}>{i.reportada_por}</td>
                    <td className={`${CLASE_TD} whitespace-nowrap`}>{i.responsable ?? <span className="text-texto-secundario">Sin asignar</span>}</td>
                    <td className={CLASE_TD}>
                      <div className="flex flex-col items-start gap-1">
                        <InsigniaEstadoIncidencia estado={i.estado} />
                        {i.revalidacion_pendiente ? (
                          <span className="inline-flex items-center gap-1 text-xs text-institucional">
                            <RotateCcw aria-hidden="true" className="size-3" />
                            Esperando revalidación
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={`${CLASE_TD} whitespace-nowrap text-texto-secundario`} title={fechaHora(i.reportada_at)}>
                      {antiguedad(i.reportada_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
