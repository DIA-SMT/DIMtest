import Link from "next/link";
import { ClipboardList, Download, Paperclip, RotateCcw } from "lucide-react";
import { EncabezadoPagina, EstadoVacio, InsigniaEstadoIncidencia, InsigniaEstadoPrueba, InsigniaPrioridad, InsigniaResultado, Tarjeta } from "@/components/ui";
import { ESTADOS_INCIDENCIA, NOMBRE_ESTADO, esEstadoIncidencia } from "@/domain/incidencias";
import { PRIORIDADES, NOMBRE_PRIORIDAD, esPrioridad } from "@/domain/prioridades";
import { RESULTADOS, NOMBRE_RESULTADO, esResultado } from "@/domain/resultados";
import { listarEjecuciones, listarIncidencias, opcionesModulos, opcionesRelevadores } from "@/features/admin/consultas";
import { aBusqueda, BarraFiltros, CLASE_TABLA, CLASE_TD, CLASE_TH, CLASE_THEAD, FiltroSelect, FiltroTexto, Paginacion, param } from "@/features/admin/components/filtros";
import { estadoDePruebas } from "@/features/relevamiento/servicio";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { fechaHora, inicioDelDia } from "@/lib/fechas";
import { resumir } from "@/lib/formato";
import { ESTADOS_ACTIVOS } from "@/domain/incidencias";

export const metadata = { title: "Pruebas" };
const POR_PAGINA = 50;

type SP = Record<string, string | string[] | undefined>;

export default async function PaginaPruebas({ searchParams }: { searchParams: Promise<SP> }) {
  await exigirAdmin();
  const sp = await searchParams;
  const vista = param(sp, "vista") === "catalogo" ? "catalogo" : "ejecuciones";

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        antetitulo="Administración de pruebas"
        titulo="Pruebas"
        descripcion="Todas las ejecuciones registradas por la DIM, sin sobrescribir ninguna. Abrí una prueba para ver su historial completo."
        acciones={
          <nav aria-label="Vista" className="flex rounded-control border border-borde bg-superficie p-1">
            {[
              { v: "ejecuciones", t: "Ejecuciones" },
              { v: "catalogo", t: "Catálogo (217)" },
            ].map((o) => (
              <Link
                key={o.v}
                href={o.v === "catalogo" ? "/admin/pruebas?vista=catalogo" : "/admin/pruebas"}
                aria-current={vista === o.v ? "page" : undefined}
                className={`rounded-[0.375rem] px-3 py-1.5 text-sm font-semibold ${vista === o.v ? "bg-primario text-white" : "text-texto-secundario hover:bg-fondo"}`}
              >
                {o.t}
              </Link>
            ))}
          </nav>
        }
      />
      {vista === "catalogo" ? <VistaCatalogo sp={sp} /> : <VistaEjecuciones sp={sp} />}
    </div>
  );
}

async function VistaEjecuciones({ sp }: { sp: SP }) {
  const modulo = param(sp, "modulo");
  const relevador = param(sp, "relevador");
  const resultado = param(sp, "resultado");
  const prioridad = param(sp, "prioridad");
  const correccion = param(sp, "correccion");
  const desde = param(sp, "desde");
  const hasta = param(sp, "hasta");
  const soloUltima = param(sp, "ultima") === "1";
  const pagina = Math.max(1, Number(param(sp, "pagina")) || 1);
  const fecha = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);

  const { filas, modulos, relevadores } = await conBase(async (q) => ({
    filas: await listarEjecuciones(q, {
      modulo: modulo && /^[A-Z]{2,4}$/.test(modulo) ? modulo : undefined,
      relevador: relevador && /^[0-9a-f-]{36}$/.test(relevador) ? relevador : undefined,
      resultado: esResultado(resultado) ? resultado : undefined,
      prioridad: esPrioridad(prioridad) ? prioridad : undefined,
      correccion: correccion === "sin_incidencias" || esEstadoIncidencia(correccion) ? correccion : undefined,
      desde: fecha(desde) ? inicioDelDia(desde!) : undefined,
      hasta: fecha(hasta) ? new Date(inicioDelDia(hasta!).getTime() + 86_400_000) : undefined,
      soloUltima,
      pagina,
      porPagina: POR_PAGINA,
    }),
    modulos: await opcionesModulos(q),
    relevadores: await opcionesRelevadores(q),
  }));
  const total = filas[0]?.total ?? 0;
  const busqueda = aBusqueda(sp);

  return (
    <>
      <BarraFiltros accion="/admin/pruebas" limpiar="/admin/pruebas">
        <FiltroSelect nombre="modulo" etiqueta="Módulo" opciones={modulos} valor={modulo} />
        <FiltroSelect nombre="relevador" etiqueta="Relevador" opciones={relevadores} valor={relevador} />
        <FiltroSelect nombre="resultado" etiqueta="Resultado" opciones={RESULTADOS.map((r) => ({ valor: r, etiqueta: NOMBRE_RESULTADO[r] }))} valor={resultado} />
        <FiltroSelect nombre="prioridad" etiqueta="Prioridad pendiente" opciones={PRIORIDADES.map((p) => ({ valor: p, etiqueta: `${p} · ${NOMBRE_PRIORIDAD[p]}` }))} valor={prioridad} todas="Todas" />
        <FiltroSelect
          nombre="correccion"
          etiqueta="Estado de corrección"
          opciones={[{ valor: "sin_incidencias", etiqueta: "Sin incidencias" }, ...ESTADOS_INCIDENCIA.map((e) => ({ valor: e, etiqueta: NOMBRE_ESTADO[e] }))]}
          valor={correccion}
        />
        <div className="grid grid-cols-2 gap-2">
          <FiltroTexto nombre="desde" etiqueta="Desde" tipo="date" valor={desde} />
          <FiltroTexto nombre="hasta" etiqueta="Hasta" tipo="date" valor={hasta} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="ultima" value="1" defaultChecked={soloUltima} className="size-4 accent-primario" />
          Solo la última ejecución de cada prueba
        </label>
      </BarraFiltros>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-texto-secundario">{total} ejecuciones</p>
        <div className="flex gap-2">
          <a href={`/admin/informes/realizadas?formato=xlsx`} className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-borde-control bg-superficie px-3 text-sm font-semibold hover:bg-fondo">
            <Download aria-hidden="true" className="size-4" />
            Excel
          </a>
        </div>
      </div>

      {filas.length === 0 ? (
        <EstadoVacio icono={ClipboardList} titulo="No hay ejecuciones con estos filtros" ayuda="Probá con otros filtros o esperá a que la DIM registre pruebas." />
      ) : (
        <Tarjeta className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className={CLASE_TABLA}>
              <caption className="sr-only">Ejecuciones de pruebas</caption>
              <thead className={CLASE_THEAD}>
                <tr>
                  <th scope="col" className={CLASE_TH}>Código</th>
                  <th scope="col" className={CLASE_TH}>Módulo</th>
                  <th scope="col" className={CLASE_TH}>Función</th>
                  <th scope="col" className={CLASE_TH}>Relevador</th>
                  <th scope="col" className={CLASE_TH}>Fecha</th>
                  <th scope="col" className={CLASE_TH}>Resultado</th>
                  <th scope="col" className={CLASE_TH}>Observaciones</th>
                  <th scope="col" className={`${CLASE_TH} text-right`}>Incid.</th>
                  <th scope="col" className={CLASE_TH}>Prioridad máx.</th>
                  <th scope="col" className={CLASE_TH}>Corrección</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {filas.map((f) => (
                  <tr key={f.id} className="hover:bg-fondo">
                    <td className={CLASE_TD}>
                      <Link href={`/admin/pruebas/${f.prueba_codigo}`} className="font-mono font-bold text-primario-oscuro hover:underline">
                        {f.prueba_codigo}
                      </Link>
                    </td>
                    <td className={`${CLASE_TD} whitespace-nowrap text-texto-secundario`} title={f.modulo}>
                      {f.modulo_codigo}
                    </td>
                    <td className={`${CLASE_TD} min-w-56`}>{resumir(f.que_probar, 90)}</td>
                    <td className={`${CLASE_TD} whitespace-nowrap`}>{f.relevador_nombre}</td>
                    <td className={`${CLASE_TD} whitespace-nowrap tabular-nums`}>{fechaHora(f.creada_at)}</td>
                    <td className={CLASE_TD}>
                      <div className="flex flex-col items-start gap-1">
                        <InsigniaResultado resultado={f.resultado} />
                        {f.es_revalidacion ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-institucional">
                            <RotateCcw aria-hidden="true" className="size-3" />
                            Revalidación
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={`${CLASE_TD} min-w-64 text-texto-secundario`}>
                      {f.observaciones ? resumir(f.observaciones, 120) : "—"}
                      {f.evidencias > 0 ? (
                        <span className="mt-1 flex items-center gap-1 text-xs">
                          <Paperclip aria-hidden="true" className="size-3" />
                          {f.evidencias}
                        </span>
                      ) : null}
                    </td>
                    <td className={`${CLASE_TD} text-right tabular-nums`}>{f.incidencias || "—"}</td>
                    <td className={CLASE_TD}>{f.prioridad_max ? <InsigniaPrioridad prioridad={f.prioridad_max} corta /> : "—"}</td>
                    <td className={CLASE_TD}>{f.estado_correccion ? <InsigniaEstadoIncidencia estado={f.estado_correccion} /> : <span className="text-texto-secundario">Sin incidencias</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
      <Paginacion pagina={pagina} total={total} porPagina={POR_PAGINA} base={busqueda} />
    </>
  );
}

async function VistaCatalogo({ sp }: { sp: SP }) {
  const modulo = param(sp, "modulo");
  const estado = param(sp, "estado");
  const { filas, modulos, incidencias } = await conBase(async (q) => ({
    filas: await estadoDePruebas(q, modulo && /^[A-Z]{2,4}$/.test(modulo) ? modulo : undefined),
    modulos: await opcionesModulos(q),
    incidencias: await listarIncidencias(q, { estados: [...ESTADOS_ACTIVOS] }),
  }));
  const visibles = filas.filter((f) =>
    estado === "pendientes" ? f.ejecuciones === 0 : estado === "evaluadas" ? f.ejecuciones > 0 : estado === "revalidar" ? f.estado === "revalidar" : true,
  );
  const activasPorPrueba = new Map<string, number>();
  for (const i of incidencias) activasPorPrueba.set(i.prueba_codigo, (activasPorPrueba.get(i.prueba_codigo) ?? 0) + 1);

  return (
    <>
      <BarraFiltros accion="/admin/pruebas" limpiar="/admin/pruebas?vista=catalogo">
        <input type="hidden" name="vista" value="catalogo" />
        <FiltroSelect nombre="modulo" etiqueta="Módulo" opciones={modulos} valor={modulo} />
        <FiltroSelect
          nombre="estado"
          etiqueta="Estado"
          opciones={[
            { valor: "pendientes", etiqueta: "Pendientes (sin ejecutar)" },
            { valor: "evaluadas", etiqueta: "Evaluadas" },
            { valor: "revalidar", etiqueta: "Requieren nueva validación" },
          ]}
          valor={estado}
        />
      </BarraFiltros>
      <p className="text-sm text-texto-secundario">
        {visibles.length} de {filas.length} pruebas · códigos originales del checklist de la DIM
      </p>
      <Tarjeta className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className={CLASE_TABLA}>
            <caption className="sr-only">Catálogo de pruebas con su último resultado</caption>
            <thead className={CLASE_THEAD}>
              <tr>
                <th scope="col" className={CLASE_TH}>Código</th>
                <th scope="col" className={CLASE_TH}>Perfil</th>
                <th scope="col" className={CLASE_TH}>Qué probar</th>
                <th scope="col" className={CLASE_TH}>Estado</th>
                <th scope="col" className={CLASE_TH}>Último resultado</th>
                <th scope="col" className={`${CLASE_TH} text-right`}>Ejecuciones</th>
                <th scope="col" className={`${CLASE_TH} text-right`}>Incid. activas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {visibles.map((f) => (
                <tr key={f.codigo} className="hover:bg-fondo">
                  <td className={CLASE_TD}>
                    <Link href={`/admin/pruebas/${f.codigo}`} className="font-mono font-bold text-primario-oscuro hover:underline">
                      {f.codigo}
                    </Link>
                  </td>
                  <td className={`${CLASE_TD} font-mono`}>{f.perfil}</td>
                  <td className={`${CLASE_TD} min-w-72`}>{f.queProbar}</td>
                  <td className={CLASE_TD}>
                    <InsigniaEstadoPrueba estado={f.estado} />
                  </td>
                  <td className={`${CLASE_TD} whitespace-nowrap`}>
                    {f.ultima ? (
                      <span className="flex flex-col items-start gap-1">
                        <InsigniaResultado resultado={f.ultima.resultado} />
                        <span className="text-xs text-texto-secundario">
                          {f.ultima.relevador} · {fechaHora(f.ultima.fecha)}
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`${CLASE_TD} text-right tabular-nums`}>{f.ejecuciones || "—"}</td>
                  <td className={`${CLASE_TD} text-right tabular-nums`}>{activasPorPrueba.get(f.codigo) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </>
  );
}
