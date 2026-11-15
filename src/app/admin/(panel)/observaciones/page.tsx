import Link from "next/link";
import { Info, MessageSquareText, Paperclip, Plus, Undo2 } from "lucide-react";
import { CLASE_BOTON_COMPACTO } from "@/components/formulario";
import { EncabezadoPagina, EstadoVacio, InsigniaPrioridad, InsigniaResultado, Tarjeta } from "@/components/ui";
import { RESULTADOS, NOMBRE_RESULTADO, esResultado } from "@/domain/resultados";
import { clasificarObservacionAccion } from "@/features/admin/actions";
import { listarObservaciones, opcionesModulos, opcionesRelevadores, ORDENES_OBSERVACIONES, type OrdenObservaciones } from "@/features/admin/consultas";
import { aBusqueda, BarraFiltros, FiltroSelect, FiltroTexto, Paginacion, param } from "@/features/admin/components/filtros";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { numeroIncidencia } from "@/lib/formato";

export const metadata = { title: "Observaciones" };
const POR_PAGINA = 30;
const CLASIFICACIONES = [
  { valor: "sin_revisar", etiqueta: "Sin revisar" },
  { valor: "informativa", etiqueta: "Comentario informativo" },
  { valor: "incidencia", etiqueta: "Convertida en incidencia" },
] as const;
const ORDENES: { valor: OrdenObservaciones; etiqueta: string }[] = [
  { valor: "recientes", etiqueta: "Más recientes primero" },
  { valor: "antiguas", etiqueta: "Más antiguas primero" },
  { valor: "codigo", etiqueta: "Por código de prueba" },
  { valor: "resultado", etiqueta: "Por resultado (fallas primero)" },
];

export default async function BandejaObservaciones({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirAdmin("observaciones.clasificar");
  const sp = await searchParams;
  const modulo = param(sp, "modulo");
  const relevador = param(sp, "relevador");
  const resultado = param(sp, "resultado");
  const clasificacion = param(sp, "clasificacion");
  const busqueda = param(sp, "q");
  const ordenParam = param(sp, "orden");
  const orden: OrdenObservaciones = ordenParam && ordenParam in ORDENES_OBSERVACIONES ? (ordenParam as OrdenObservaciones) : "recientes";
  const pagina = Math.max(1, Number(param(sp, "pagina")) || 1);

  const { filas, modulos, relevadores } = await conBase(async (q) => ({
    filas: await listarObservaciones(q, {
      modulo: modulo && /^[A-Z]{2,4}$/.test(modulo) ? modulo : undefined,
      relevador: relevador && /^[0-9a-f-]{36}$/.test(relevador) ? relevador : undefined,
      resultado: esResultado(resultado) ? resultado : undefined,
      clasificacion: CLASIFICACIONES.some((c) => c.valor === clasificacion) ? (clasificacion as "sin_revisar") : undefined,
      busqueda,
      orden,
      pagina,
      porPagina: POR_PAGINA,
    }),
    modulos: await opcionesModulos(q),
    relevadores: await opcionesRelevadores(q),
  }));
  const total = filas[0]?.total ?? 0;

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        antetitulo="Lo que escribieron los relevadores"
        titulo="Observaciones"
        descripcion="Una observación no siempre es un error. Marcala como comentario informativo o convertila en una incidencia que hay que corregir."
      />
      <BarraFiltros accion="/admin/observaciones" limpiar="/admin/observaciones">
        <div className="sm:col-span-2">
          <FiltroTexto nombre="q" etiqueta="Buscar" tipo="search" valor={busqueda} placeholder="Texto, código, caso o relevador" />
        </div>
        <FiltroSelect nombre="modulo" etiqueta="Módulo" opciones={modulos} valor={modulo} />
        <FiltroSelect nombre="relevador" etiqueta="Relevador" opciones={relevadores} valor={relevador} />
        <FiltroSelect nombre="resultado" etiqueta="Resultado" opciones={RESULTADOS.map((r) => ({ valor: r, etiqueta: NOMBRE_RESULTADO[r] }))} valor={resultado} />
        <FiltroSelect nombre="clasificacion" etiqueta="Clasificación" opciones={[...CLASIFICACIONES]} valor={clasificacion} todas="Todas" />
        <FiltroSelect nombre="orden" etiqueta="Ordenar" opciones={ORDENES.filter((o) => o.valor !== "recientes")} valor={orden === "recientes" ? undefined : orden} todas="Más recientes primero" />
      </BarraFiltros>
      <p className="text-sm text-texto-secundario">{total} observaciones</p>

      {filas.length === 0 ? (
        <EstadoVacio icono={MessageSquareText} titulo="No hay observaciones con estos filtros" ayuda="Probá con otra búsqueda." />
      ) : (
        <ul className="space-y-3">
          {filas.map((o) => (
            <li key={o.id}>
              <Tarjeta className={`p-4 ${o.clasificacion === "sin_revisar" ? "border-l-4 border-l-primario" : ""}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link href={`/admin/pruebas/${o.prueba_codigo}`} className="font-mono font-bold text-primario-oscuro hover:underline">
                    {o.prueba_codigo}
                  </Link>
                  <InsigniaResultado resultado={o.resultado} />
                  <span className="text-texto-secundario">
                    <strong className="text-texto">{o.relevador_nombre}</strong> · {fechaHora(o.creada_at)}
                  </span>
                  {o.prioridad_sugerida ? (
                    <span className="flex items-center gap-1 text-xs text-texto-secundario">
                      sugiere <InsigniaPrioridad prioridad={o.prioridad_sugerida} corta />
                    </span>
                  ) : null}
                  {o.evidencias ? (
                    <span className="flex items-center gap-1 text-xs text-texto-secundario">
                      <Paperclip aria-hidden="true" className="size-3" />
                      {o.evidencias}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-texto-secundario">
                  {o.modulo} · {o.que_probar}
                </p>
                <blockquote className="mt-3 border-l-2 border-borde pl-3 text-sm whitespace-pre-line">{o.observaciones}</blockquote>
                {o.caso_usado ? <p className="mt-2 text-xs text-texto-secundario">Caso usado: {o.caso_usado}</p> : null}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borde pt-3">
                  {o.clasificacion === "incidencia" && o.incidencia_numero ? (
                    <Link href={`/admin/incidencias/${o.incidencia_numero}`} className="text-sm font-semibold text-primario-oscuro hover:underline">
                      Convertida en {numeroIncidencia(o.incidencia_numero)} →
                    </Link>
                  ) : (
                    <>
                      <Link href={`/admin/incidencias/nueva?ejecucion=${o.id}`} className={CLASE_BOTON_COMPACTO}>
                        <Plus aria-hidden="true" className="size-3.5" />
                        Convertir en incidencia
                      </Link>
                      <form action={clasificarObservacionAccion}>
                        <input type="hidden" name="ejecucion" value={o.id} />
                        {o.clasificacion === "informativa" ? (
                          <button type="submit" name="clasificacion" value="sin_revisar" className={CLASE_BOTON_COMPACTO}>
                            <Undo2 aria-hidden="true" className="size-3.5" />
                            Volver a «sin revisar»
                          </button>
                        ) : (
                          <button type="submit" name="clasificacion" value="informativa" className={CLASE_BOTON_COMPACTO}>
                            <Info aria-hidden="true" className="size-3.5" />
                            Es un comentario informativo
                          </button>
                        )}
                      </form>
                      <span className="text-xs text-texto-secundario">
                        {o.clasificacion === "informativa" ? `Informativa · revisó ${o.revisada_por}` : "Sin revisar"}
                      </span>
                    </>
                  )}
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
      <Paginacion pagina={pagina} total={total} porPagina={POR_PAGINA} base={aBusqueda(sp)} />
    </div>
  );
}
