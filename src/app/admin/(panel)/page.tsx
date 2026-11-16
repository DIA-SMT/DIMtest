import Link from "next/link";
import { Activity, ArrowRight, CircleCheck, CircleX, ClipboardCheck, ClipboardList, Clock, FileSpreadsheet, Flame, Hourglass, ListChecks, MessageSquareText, RotateCcw, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  AccesoRapido,
  BarraResultados,
  CLASE_PORTADA_PRINCIPAL,
  CLASE_PORTADA_SECUNDARIA,
  CONTENEDOR,
  Indicador,
  InsigniaPrioridad,
  InsigniaResultado,
  LeyendaResultados,
  Portada,
  Tarjeta,
  TituloSeccion,
} from "@/components/ui";
import { primerNombre } from "@/domain/nombres";
import { NOMBRE_ESTADO, esEstadoIncidencia } from "@/domain/incidencias";
import { NOMBRE_PRIORIDAD } from "@/domain/prioridades";
import { esResultado, NOMBRE_RESULTADO } from "@/domain/resultados";
import { actividadReciente, incidenciasActivasPorPrioridad, metricas } from "@/features/admin/consultas";
import { estadoDePruebas, listarModulos, resumirPorModulo } from "@/features/relevamiento/servicio";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { antiguedad, fechaHora } from "@/lib/fechas";
import { numeroIncidencia, porcentaje } from "@/lib/formato";

export const metadata = { title: "Tablero" };

function textoActividad(a: Awaited<ReturnType<typeof actividadReciente>>[number]) {
  if (a.tipo === "ejecucion") {
    const r = esResultado(a.detalle) ? NOMBRE_RESULTADO[a.detalle] : a.detalle;
    return `${a.revalidacion ? "revalidó" : "probó"} ${a.codigo}: ${r}`;
  }
  const inc = a.numero ? numeroIncidencia(a.numero) : "";
  switch (a.detalle) {
    case "creada":
      return `creó ${inc} (${a.codigo})`;
    case "estado":
      return `pasó ${inc} a «${a.valor && esEstadoIncidencia(a.valor) ? NOMBRE_ESTADO[a.valor] : a.valor}»`;
    case "prioridad":
      return `cambió la prioridad de ${inc} a ${a.valor}`;
    case "responsable":
      return a.valor ? `asignó ${inc} a ${a.valor}` : `dejó ${inc} sin responsable`;
    case "comentario":
      return `comentó ${inc}`;
    case "solucion":
      return `registró la solución de ${inc}`;
    case "evidencia":
      return `adjuntó evidencias a ${inc}`;
    case "revalidacion":
      return a.valor === "pedida" ? `pidió revalidar ${a.codigo} (${inc})` : `revalidó ${a.codigo} para ${inc}`;
    default:
      return `actualizó ${inc}`;
  }
}

export default async function Tablero() {
  const admin = await exigirAdmin();
  const datos = await conBase(async (q) => ({
    m: await metricas(q),
    actividad: await actividadReciente(q, 14),
    prioridades: await incidenciasActivasPorPrioridad(q),
    modulos: resumirPorModulo(await listarModulos(q), await estadoDePruebas(q)),
  }));
  const { m, actividad, prioridades, modulos } = datos;
  const porResultado = { funciona: m.funciona, parcial: m.parcial, no_funciona: m.no_funciona, no_probado: m.no_probado };

  return (
    <>
      <Portada
        antetitulo="Dirección de Impuestos Municipales"
        titulo="Relevamiento"
        remate="DIM360"
        acciones={
          <>
            <Link href="/admin/observaciones?clasificacion=sin_revisar" className={CLASE_PORTADA_PRINCIPAL}>
              <MessageSquareText aria-hidden="true" className="size-[18px]" />
              Revisar observaciones
              <ArrowRight aria-hidden="true" className="size-[17px]" />
            </Link>
            <Link href="/admin/informes" className={CLASE_PORTADA_SECUNDARIA}>
              <FileSpreadsheet aria-hidden="true" className="size-[18px]" />
              Descargar informes
            </Link>
          </>
        }
      >
        <p>
          Hola, {primerNombre(admin.nombre)}. {m.evaluadas} de {m.total} pruebas evaluadas ({porcentaje(m.evaluadas, m.total)} %) con {m.ejecuciones}{" "}
          {m.ejecuciones === 1 ? "ejecución" : "ejecuciones"} de {m.relevadores} {m.relevadores === 1 ? "relevador" : "relevadores"}. Los valores salen de la base, en vivo.
        </p>
      </Portada>

      <div className={`${CONTENEDOR} space-y-9 pb-10`}>
        <nav aria-label="Accesos rápidos" className="relative z-[4] mt-2 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <AccesoRapido href="/admin/observaciones?clasificacion=sin_revisar" titulo="Observaciones" detalle={`${m.observaciones_sin_revisar} sin revisar`} icono={MessageSquareText} tono="azul" />
          <AccesoRapido href="/admin/prioridades" titulo="Prioridades" detalle={`${m.incidencias_criticas} críticas sin cerrar`} icono={Flame} tono="amarillo" />
          <AccesoRapido href="/admin/incidencias?estado=corregida" titulo="Por validar" detalle={`${m.incidencias_por_validar} corregidas esperan a la DIM`} icono={RotateCcw} tono="celeste" />
          <AccesoRapido href="/admin/pruebas" titulo="Pruebas" detalle="Ejecuciones e historial" icono={ClipboardList} tono="verde" />
        </nav>

        <section aria-labelledby="titulo-pruebas" className="space-y-4">
          <TituloSeccion id="titulo-pruebas">Pruebas</TituloSeccion>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Indicador titulo="Catálogo" valor={m.total} detalle="del checklist oficial" icono={ListChecks} href="/admin/pruebas?vista=catalogo" />
            <Indicador titulo="Evaluadas" valor={m.evaluadas} detalle={`${porcentaje(m.evaluadas, m.total)} % del total`} icono={ClipboardCheck} tono="info" href="/admin/pruebas?ultima=1" />
            <Indicador titulo="Pendientes" valor={m.pendientes} detalle="sin ninguna ejecución" icono={Hourglass} tono="neutro" href="/admin/pruebas?vista=catalogo&estado=pendientes" />
            <Indicador titulo="Satisfactorias" valor={m.funciona} detalle="último resultado: funciona" icono={CircleCheck} tono="exito" href="/admin/pruebas?ultima=1&resultado=funciona" />
            <Indicador titulo="Parciales" valor={m.parcial} icono={TriangleAlert} tono="advertencia" href="/admin/pruebas?ultima=1&resultado=parcial" />
            <Indicador titulo="Fallidas" valor={m.no_funciona} detalle="último resultado: no funciona" icono={CircleX} tono="error" href="/admin/pruebas?ultima=1&resultado=no_funciona" />
            <Indicador titulo="No realizadas" valor={m.no_probado} detalle="por falta de condiciones" icono={Clock} href="/admin/pruebas?ultima=1&resultado=no_probado" />
            <Indicador titulo="Por revalidar" valor={m.revalidaciones_pendientes} detalle="pedidas a la DIM, sin hacer" icono={RotateCcw} tono="info" href="/admin/incidencias?estado=corregida" />
          </div>
          <Tarjeta className="p-5">
            <div className="mb-3 flex flex-wrap justify-between gap-2 text-sm">
              <span className="font-display text-base font-bold text-institucional">Resultado de las {m.total} pruebas</span>
              <span className="text-texto-secundario">{m.revalidaciones_pendientes} revalidaciones pedidas sin hacer</span>
            </div>
            <BarraResultados total={m.total} porResultado={porResultado} etiqueta="Resultado general" alta />
            <div className="mt-2">
              <LeyendaResultados />
            </div>
          </Tarjeta>
        </section>

        <section aria-labelledby="titulo-incidencias" className="space-y-4">
          <TituloSeccion id="titulo-incidencias">Incidencias y correcciones</TituloSeccion>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Indicador titulo="Abiertas" valor={m.incidencias_abiertas} detalle="reportadas, en análisis o en corrección" icono={ShieldAlert} tono="advertencia" href="/admin/incidencias?estado=abiertas" />
            <Indicador titulo="Críticas (P0)" valor={m.incidencias_criticas} detalle="sin cerrar" icono={Flame} tono="error" href="/admin/prioridades" />
            <Indicador titulo="Pendientes de validación" valor={m.incidencias_por_validar} detalle="corregidas, esperan la DIM" icono={RotateCcw} tono="info" href="/admin/incidencias?estado=corregida" />
            <Indicador titulo="Corregidas y validadas" valor={m.incidencias_corregidas} icono={ShieldCheck} tono="exito" href="/admin/incidencias?estado=cerrada" />
            <Indicador titulo="Observaciones sin revisar" valor={m.observaciones_sin_revisar} icono={MessageSquareText} href="/admin/observaciones?clasificacion=sin_revisar" />
          </div>
          <Tarjeta className="p-5">
            <p className="mb-3 font-display text-base font-bold text-institucional">Incidencias activas por prioridad</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {prioridades.map((p) => (
                <li key={p.prioridad}>
                  <Link href={`/admin/prioridades#${p.prioridad}`} className="flex items-center justify-between gap-2 rounded-control border border-borde px-3 py-2 hover:border-primario">
                    <span className="flex items-center gap-2 text-sm">
                      <InsigniaPrioridad prioridad={p.prioridad} corta />
                      {NOMBRE_PRIORIDAD[p.prioridad]}
                    </span>
                    <span className="text-lg font-bold tabular-nums">{p.activas}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section aria-labelledby="titulo-avance">
            <Tarjeta className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde p-4">
                <h2 id="titulo-avance" className="text-lg font-bold text-institucional">
                  Avance por módulo
                </h2>
                <LeyendaResultados />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Avance y resultados por módulo</caption>
                  <thead className="bg-fondo text-left text-xs text-texto-secundario uppercase">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-semibold">Módulo</th>
                      <th scope="col" className="w-40 px-4 py-2 font-semibold">Avance</th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold" title="Funciona">F</th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold" title="Parcial">P</th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold" title="No funciona">NF</th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold" title="No probado">NP</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Evaluadas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {modulos.map((mod) => (
                      <tr key={mod.codigo} className="hover:bg-fondo">
                        <th scope="row" className="px-4 py-2 text-left font-medium">
                          <Link href={`/admin/pruebas?modulo=${mod.codigo}&vista=catalogo`} className="hover:text-primario-oscuro hover:underline">
                            <span className="font-mono text-xs text-primario-oscuro">{mod.codigo}</span> {mod.nombre}
                          </Link>
                        </th>
                        <td className="px-4 py-2">
                          <BarraResultados total={mod.total} porResultado={mod.porResultado} etiqueta={`Avance de ${mod.nombre}`} />
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{mod.porResultado.funciona || "—"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{mod.porResultado.parcial || "—"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{mod.porResultado.no_funciona || "—"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{mod.porResultado.no_probado || "—"}</td>
                        <td className="px-4 py-2 text-right whitespace-nowrap tabular-nums">
                          {mod.realizadas}/{mod.total} <span className="text-texto-secundario">({porcentaje(mod.realizadas, mod.total)} %)</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Tarjeta>
          </section>

          <section aria-labelledby="titulo-actividad">
            <Tarjeta>
              <div className="flex items-center gap-2 border-b border-borde p-4">
                <Activity aria-hidden="true" className="size-5 text-primario" />
                <h2 id="titulo-actividad" className="text-lg font-bold text-institucional">
                  Actividad reciente
                </h2>
              </div>
              {actividad.length === 0 ? (
                <p className="p-4 text-sm text-texto-secundario">Todavía no hay actividad. Cuando la DIM empiece a probar, aparece acá.</p>
              ) : (
                <ol className="divide-y divide-borde">
                  {actividad.map((a, i) => (
                    <li key={i} className="flex items-start gap-3 px-4 py-3 text-sm">
                      {a.tipo === "ejecucion" && esResultado(a.detalle) ? (
                        <InsigniaResultado resultado={a.detalle} />
                      ) : (
                        <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-texto-secundario" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p>
                          <strong>{a.quien}</strong> {textoActividad(a)}
                        </p>
                        <p className="text-xs text-texto-secundario" title={fechaHora(a.fecha)}>
                          {antiguedad(a.fecha)}
                        </p>
                      </div>
                      <Link
                        href={a.tipo === "ejecucion" ? `/admin/pruebas/${a.codigo}` : `/admin/incidencias/${a.numero}`}
                        className="shrink-0 rounded-control p-1 text-primario-oscuro hover:bg-superficie-azul"
                        aria-label={`Ver ${a.tipo === "ejecucion" ? a.codigo : numeroIncidencia(a.numero ?? 0)}`}
                      >
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </Tarjeta>
          </section>
        </div>
      </div>
    </>
  );
}
