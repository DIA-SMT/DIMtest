import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, CircleDot, FileText, Image as ImagenIcono, RotateCcw } from "lucide-react";
import { Aviso, EncabezadoPagina, InsigniaEstadoIncidencia, InsigniaPrioridad, InsigniaResultado, Tarjeta } from "@/components/ui";
import { incidenciaElegible, NOMBRE_RESULTADO_AGENTE } from "@/domain/agente";
import { esEstadoIncidencia, NOMBRE_ESTADO } from "@/domain/incidencias";
import { puede } from "@/domain/permisos";
import { esResultado, NOMBRE_RESULTADO } from "@/domain/resultados";
import { CambioEstado, CambioPrioridad, CambioResponsable, NuevoComentario } from "@/features/admin/components/gestion-incidencia";
import { eventosIncidencia, evidenciasIncidencia, incidenciaPorNumero, opcionesResponsables, revalidacionesDePrueba, type EventoIncidencia } from "@/features/admin/consultas";
import { PedirAgente } from "@/features/agente/components/formularios";
import { ListaTrabajos } from "@/features/agente/components/lista-trabajos";
import { leerConfig, listarTrabajos } from "@/features/agente/servicio";
import { ultimaRevalidacion } from "@/features/incidencias/servicio";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { antiguedad, fechaHora } from "@/lib/fechas";
import { numeroIncidencia, tamanoArchivo } from "@/lib/formato";

export async function generateMetadata({ params }: { params: Promise<{ numero: string }> }) {
  return { title: numeroIncidencia(Number((await params).numero) || 0) };
}

/** Lo que registra el agente (D-015), por el valor del evento. */
const AGENTE_DICE: Record<string, string> = {
  pedido: "Pedido al agente",
  cancelado: "Canceló el pedido al agente",
  en_curso: "El agente empezó a trabajar",
  avance: "Avance del agente",
  fallido: "El agente no pudo terminar",
  ...NOMBRE_RESULTADO_AGENTE,
};

function describirEvento(e: EventoIncidencia): string {
  const estado = (v: string | null) => (v && esEstadoIncidencia(v) ? NOMBRE_ESTADO[v] : (v ?? "—"));
  switch (e.tipo) {
    case "creada":
      return "Creó la incidencia";
    case "estado":
      return `Cambió el estado: ${estado(e.valor_anterior)} → ${estado(e.valor_nuevo)}`;
    case "prioridad":
      return `Cambió la prioridad: ${e.valor_anterior} → ${e.valor_nuevo}`;
    case "responsable":
      return e.valor_nuevo ? `Asignó a ${e.valor_nuevo}${e.valor_anterior ? ` (antes: ${e.valor_anterior})` : ""}` : `Quitó el responsable (${e.valor_anterior ?? "—"})`;
    case "comentario":
      return "Comentó";
    case "solucion":
      return "Registró la solución aplicada";
    case "evidencia":
      return "Adjuntó evidencias";
    case "revalidacion":
      return e.valor_nuevo === "pedida"
        ? "Pidió una nueva validación a la DIM"
        : `Revalidó la prueba: ${e.valor_nuevo && esResultado(e.valor_nuevo) ? NOMBRE_RESULTADO[e.valor_nuevo] : e.valor_nuevo}`;
    case "agente":
      return AGENTE_DICE[e.valor_nuevo ?? ""] ?? "Agente";
    default:
      return e.tipo;
  }
}

export default async function DetalleIncidencia({ params, searchParams }: { params: Promise<{ numero: string }>; searchParams: Promise<{ creada?: string }> }) {
  const admin = await exigirAdmin();
  const numero = Number((await params).numero);
  const { creada } = await searchParams;
  if (!Number.isInteger(numero) || numero < 1) notFound();
  const d = await conBase(async (q) => {
    const i = await incidenciaPorNumero(q, numero);
    if (!i) return null;
    return {
      i,
      eventos: await eventosIncidencia(q, i.id),
      evidencias: await evidenciasIncidencia(q, i.id, i.ejecucion_id),
      responsables: await opcionesResponsables(q),
      revalidaciones: (await revalidacionesDePrueba(q, i.prueba_codigo)).filter((r) => r.incidencia_numero === i.numero),
      ultima: await ultimaRevalidacion(q, i.id),
      trabajos: await listarTrabajos(q, { incidenciaId: i.id, limite: 10 }),
      agenteActivo: (await leerConfig(q)).activo,
    };
  });
  if (!d) notFound();
  const { i, eventos, evidencias, responsables, revalidaciones, ultima, trabajos, agenteActivo } = d;
  const puedeGestionar = puede(admin.rol, "incidencias.gestionar");
  const trabajoVivo = trabajos.some((t) => t.estado === "pendiente" || t.estado === "en_curso");

  return (
    <div className="space-y-6">
      <Link href="/admin/incidencias" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primario-oscuro hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Incidencias
      </Link>
      {creada ? <Aviso tipo="exito" titulo="Incidencia creada">Asignale un responsable y seguí su corrección desde acá.</Aviso> : null}
      <EncabezadoPagina
        antetitulo={`${i.modulo_codigo} · ${i.modulo}`}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{numeroIncidencia(i.numero)}</span>
            <InsigniaPrioridad prioridad={i.prioridad} />
            <InsigniaEstadoIncidencia estado={i.estado} />
          </span>
        }
        descripcion={
          <>
            Prueba{" "}
            <Link href={`/admin/pruebas/${i.prueba_codigo}`} className="font-mono font-semibold text-primario-oscuro hover:underline">
              {i.prueba_codigo}
            </Link>{" "}
            · {i.que_probar}
          </>
        }
      />

      {i.revalidacion_pendiente ? (
        <Aviso tipo="info" titulo="Esperando la revalidación de la DIM">
          La prueba {i.prueba_codigo} aparece como «Requiere nueva validación» en el portal. El resultado original no se modificó.
        </Aviso>
      ) : i.estado === "corregida" && ultima ? (
        <Aviso tipo={ultima === "funciona" ? "exito" : "advertencia"} titulo={`La revalidación dio: ${esResultado(ultima) ? NOMBRE_RESULTADO[ultima] : ultima}`}>
          {ultima === "funciona" ? "Ya podés cerrarla como validada." : "El error continúa: conviene reabrirla."}
        </Aviso>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <Tarjeta className="space-y-4 p-5">
            <div>
              <p className="text-xs font-semibold text-texto-secundario uppercase">Descripción del problema</p>
              <p className="mt-1 whitespace-pre-line">{i.descripcion}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-texto-secundario uppercase">Resultado esperado</p>
                <p className="mt-1 text-sm whitespace-pre-line">{i.resultado_esperado || i.esperado_catalogo}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-texto-secundario uppercase">Resultado observado</p>
                <p className="mt-1 text-sm whitespace-pre-line">{i.resultado_observado || "—"}</p>
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-3 border-t border-borde pt-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-texto-secundario">Reportó</dt>
                <dd className="font-semibold">{i.reportada_por}</dd>
              </div>
              <div>
                <dt className="text-texto-secundario">Fecha del reporte</dt>
                <dd>
                  {fechaHora(i.reportada_at)} <span className="text-texto-secundario">({antiguedad(i.reportada_at)})</span>
                </dd>
              </div>
              <div>
                <dt className="text-texto-secundario">Prioridad sugerida por el relevador</dt>
                <dd>{i.prioridad_sugerida ? <InsigniaPrioridad prioridad={i.prioridad_sugerida} /> : "—"}</dd>
              </div>
              <div>
                <dt className="text-texto-secundario">Responsable</dt>
                <dd className="font-semibold">{i.responsable ?? "Sin asignar"}</dd>
              </div>
              <div>
                <dt className="text-texto-secundario">Creada por</dt>
                <dd>{i.creada_por}</dd>
              </div>
              <div>
                <dt className="text-texto-secundario">Última actualización</dt>
                <dd>{fechaHora(i.actualizada_at)}</dd>
              </div>
            </dl>
            {i.solucion_aplicada ? (
              <div className="rounded-control border border-exito-borde bg-exito-fondo p-3 text-sm">
                <p className="font-semibold text-exito">Solución aplicada</p>
                <p className="mt-1 whitespace-pre-line">{i.solucion_aplicada}</p>
              </div>
            ) : null}
            {i.justificacion_descarte ? (
              <div className="rounded-control border border-borde bg-neutro-fondo p-3 text-sm">
                <p className="font-semibold">Justificación del descarte</p>
                <p className="mt-1 whitespace-pre-line">{i.justificacion_descarte}</p>
              </div>
            ) : null}
          </Tarjeta>

          <Tarjeta className="p-5">
            <h2 className="text-base font-bold">Evidencias ({evidencias.length})</h2>
            {evidencias.length === 0 ? (
              <p className="mt-2 text-sm text-texto-secundario">Sin evidencias.</p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {evidencias.map((v) => (
                  <li key={v.id}>
                    <a href={`/evidencias/${v.id}`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-control border border-borde p-2 text-sm hover:border-primario">
                      {v.mime === "application/pdf" ? <FileText aria-hidden="true" className="size-4 text-primario" /> : <ImagenIcono aria-hidden="true" className="size-4 text-primario" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{v.nombre}</span>
                        <span className="block text-xs text-texto-secundario">
                          {v.origen === "relevador" ? "Relevador" : "Equipo"}: {v.subida_por} · {tamanoArchivo(v.tamano)}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta className="p-5">
            <h2 className="text-base font-bold">Historial</h2>
            <ol className="mt-4 space-y-4 border-l-2 border-borde pl-4">
              {eventos.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span aria-hidden="true" className="absolute top-1 -left-[23px] grid size-3 place-items-center rounded-full bg-superficie">
                    {e.tipo === "revalidacion" ? <RotateCcw className="size-3 text-institucional" /> : <CircleDot className="size-3 text-primario" />}
                  </span>
                  <p>
                    <strong>{e.usuario_nombre}</strong> · {describirEvento(e)}
                  </p>
                  {e.comentario ? <p className="mt-1 whitespace-pre-line text-texto-secundario">{e.comentario}</p> : null}
                  <p className="mt-0.5 text-xs text-texto-secundario">{fechaHora(e.creado_at)}</p>
                </li>
              ))}
            </ol>
          </Tarjeta>
        </div>

        <div className="space-y-6">
          <Tarjeta className="p-5">
            <h2 className="mb-3 text-base font-bold">Estado de la corrección</h2>
            <CambioEstado id={i.id} numero={i.numero} estado={i.estado} ultimaRevalidacion={ultima} />
          </Tarjeta>
          <Tarjeta className="space-y-5 p-5">
            <CambioPrioridad id={i.id} numero={i.numero} prioridad={i.prioridad} />
            <div className="border-t border-borde pt-5">
              <CambioResponsable id={i.id} numero={i.numero} responsableId={i.responsable_id} responsables={responsables} />
            </div>
          </Tarjeta>
          <Tarjeta className="p-5">
            <NuevoComentario id={i.id} numero={i.numero} />
          </Tarjeta>
          <Tarjeta className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Bot aria-hidden="true" className="size-5 text-primario" />
              Agente Claude
            </h2>
            {puedeGestionar && !trabajoVivo && incidenciaElegible(i.estado) ? (
              <>
                <p className="text-sm text-texto-secundario">
                  Diagnostica la incidencia en el código de DIM360 y, si corresponde, la corrige, la publica en test y pide la revalidación.
                  Avisa por WhatsApp al responsable antes de empezar.
                  {agenteActivo ? "" : " Ahora está apagado: el pedido queda en la cola."}
                </p>
                <PedirAgente incidenciaId={i.id} numero={i.numero} />
              </>
            ) : null}
            {trabajos.length ? <ListaTrabajos trabajos={trabajos} conIncidencia={false} puedeCancelar={puedeGestionar} /> : null}
            {!trabajos.length && !(puedeGestionar && incidenciaElegible(i.estado)) ? (
              <p className="text-sm text-texto-secundario">No se le pidió nada al agente.</p>
            ) : null}
          </Tarjeta>
          {revalidaciones.length ? (
            <Tarjeta className="p-5">
              <h2 className="text-base font-bold">Revalidaciones</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {revalidaciones.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    {r.resultado ? <InsigniaResultado resultado={r.resultado} /> : <span className="text-texto-secundario">{r.cancelada_at ? "Cancelada" : "Pendiente"}</span>}
                    <span className="text-texto-secundario">
                      pedida {fechaHora(r.solicitada_at)}
                      {r.relevador ? ` · ${r.relevador}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          ) : null}
          <p className="text-xs text-texto-secundario">Gestionando como {admin.nombre}. Cada cambio queda en el historial con tu nombre y la hora.</p>
        </div>
      </div>
    </div>
  );
}
