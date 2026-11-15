import Link from "next/link";
import { Activity, ArrowRight, CircleCheck, CircleX, ClipboardCheck, Clock, Flame, Hourglass, ListChecks, MessageSquareText, RotateCcw, ShieldAlert, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { BarraResultados, EncabezadoPagina, InsigniaPrioridad, InsigniaResultado, LeyendaResultados, Tarjeta } from "@/components/ui";
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

function Indicador({
  titulo,
  valor,
  detalle,
  icono: Icono,
  tono = "neutro",
  href,
}: {
  titulo: string;
  valor: number;
  detalle?: string;
  icono: LucideIcon;
  tono?: "neutro" | "exito" | "advertencia" | "error" | "info";
  href?: string;
}) {
  const color = { neutro: "text-texto-secundario", exito: "text-exito", advertencia: "text-advertencia", error: "text-error", info: "text-primario" }[tono];
  const contenido = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-texto-secundario">{titulo}</p>
        <Icono aria-hidden="true" className={`size-5 ${color}`} />
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{valor}</p>
      {detalle ? <p className="mt-1 text-xs text-texto-secundario">{detalle}</p> : null}
    </>
  );
  const clase = "block rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta";
  return href ? (
    <Link href={href} className={`${clase} transition-colors hover:border-primario`}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

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
  await exigirAdmin();
  const datos = await conBase(async (q) => ({
    m: await metricas(q),
    actividad: await actividadReciente(q, 14),
    prioridades: await incidenciasActivasPorPrioridad(q),
    modulos: resumirPorModulo(await listarModulos(q), await estadoDePruebas(q)),
  }));
  const { m, actividad, prioridades, modulos } = datos;
  const porResultado = { funciona: m.funciona, parcial: m.parcial, no_funciona: m.no_funciona, no_probado: m.no_probado };

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo="Relevamiento funcional de DIM360"
        titulo="Tablero"
        descripcion={`${m.ejecuciones} ejecuciones registradas por ${m.relevadores} ${m.relevadores === 1 ? "relevador" : "relevadores"}. Todos los valores salen de la base, en vivo.`}
      />

      <section aria-labelledby="titulo-pruebas" className="space-y-3">
        <h2 id="titulo-pruebas" className="text-base font-bold">
          Pruebas
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Indicador titulo="Catálogo" valor={m.total} detalle="del checklist oficial" icono={ListChecks} href="/admin/pruebas?vista=catalogo" />
          <Indicador titulo="Evaluadas" valor={m.evaluadas} detalle={`${porcentaje(m.evaluadas, m.total)} % del total`} icono={ClipboardCheck} tono="info" href="/admin/pruebas?ultima=1" />
          <Indicador titulo="Pendientes" valor={m.pendientes} detalle="sin ninguna ejecución" icono={Hourglass} tono="neutro" href="/admin/pruebas?vista=catalogo&estado=pendientes" />
          <Indicador titulo="Satisfactorias" valor={m.funciona} detalle="último resultado: funciona" icono={CircleCheck} tono="exito" href="/admin/pruebas?ultima=1&resultado=funciona" />
          <Indicador titulo="Parciales" valor={m.parcial} icono={TriangleAlert} tono="advertencia" href="/admin/pruebas?ultima=1&resultado=parcial" />
          <Indicador titulo="Fallidas" valor={m.no_funciona} detalle="último resultado: no funciona" icono={CircleX} tono="error" href="/admin/pruebas?ultima=1&resultado=no_funciona" />
          <Indicador titulo="No realizadas" valor={m.no_probado} detalle="por falta de condiciones" icono={Clock} href="/admin/pruebas?ultima=1&resultado=no_probado" />
        </div>
        <Tarjeta className="p-4">
          <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-semibold">Resultado de las {m.total} pruebas</span>
            <span className="text-texto-secundario">{m.revalidaciones_pendientes} revalidaciones pedidas sin hacer</span>
          </div>
          <BarraResultados total={m.total} porResultado={porResultado} etiqueta="Resultado general" alta />
          <div className="mt-2">
            <LeyendaResultados />
          </div>
        </Tarjeta>
      </section>

      <section aria-labelledby="titulo-incidencias" className="space-y-3">
        <h2 id="titulo-incidencias" className="text-base font-bold">
          Incidencias y correcciones
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Indicador titulo="Abiertas" valor={m.incidencias_abiertas} detalle="reportadas, en análisis o en corrección" icono={ShieldAlert} tono="advertencia" href="/admin/incidencias?estado=abiertas" />
          <Indicador titulo="Críticas (P0)" valor={m.incidencias_criticas} detalle="sin cerrar" icono={Flame} tono="error" href="/admin/prioridades" />
          <Indicador titulo="Pendientes de validación" valor={m.incidencias_por_validar} detalle="corregidas, esperan la DIM" icono={RotateCcw} tono="info" href="/admin/incidencias?estado=corregida" />
          <Indicador titulo="Corregidas y validadas" valor={m.incidencias_corregidas} icono={ShieldCheck} tono="exito" href="/admin/incidencias?estado=cerrada" />
          <Indicador titulo="Observaciones sin revisar" valor={m.observaciones_sin_revisar} icono={MessageSquareText} href="/admin/observaciones?clasificacion=sin_revisar" />
        </div>
        <Tarjeta className="p-4">
          <p className="mb-3 text-sm font-semibold">Incidencias activas por prioridad</p>
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
              <h2 id="titulo-avance" className="text-base font-bold">
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
              <h2 id="titulo-actividad" className="text-base font-bold">
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
  );
}
