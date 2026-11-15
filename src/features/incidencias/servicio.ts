// Gestión de incidencias y correcciones. Funciones sobre `q` (una transacción),
// probadas en tests/integracion/. Todo cambio deja un evento en incidencia_eventos.
import type { Consulta } from "@/lib/db";
import {
  cancelaRevalidacion,
  esEstadoIncidencia,
  pideRevalidacion,
  validarTransicion,
  type EstadoIncidencia,
} from "@/domain/incidencias";
import type { Prioridad } from "@/domain/prioridades";
import type { Resultado } from "@/domain/resultados";
import { ErrorDominio } from "@/lib/errores";

export interface Actor {
  id: string;
  nombre: string;
}

async function evento(
  q: Consulta,
  incidenciaId: string,
  actor: Actor,
  tipo: string,
  datos: { anterior?: string | null; nuevo?: string | null; comentario?: string },
) {
  await q(
    `insert into incidencia_eventos (incidencia_id, tipo, valor_anterior, valor_nuevo, comentario, usuario_id, usuario_nombre)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [incidenciaId, tipo, datos.anterior ?? null, datos.nuevo ?? null, (datos.comentario ?? "").slice(0, 4000), actor.id, actor.nombre],
  );
}

export async function auditar(q: Consulta, actor: Actor | null, accion: string, detalle: Record<string, unknown> = {}) {
  await q("insert into auditoria (accion, usuario_id, usuario_nombre, detalle) values ($1, $2, $3, $4::text::jsonb)", [
    accion,
    actor?.id ?? null,
    actor?.nombre ?? "sistema",
    JSON.stringify(detalle),
  ]);
}

export interface NuevaIncidencia {
  pruebaCodigo: string;
  ejecucionId: string | null;
  descripcion: string;
  resultadoEsperado: string;
  resultadoObservado: string;
  prioridad: Prioridad;
  responsableId: string | null;
}

/** Crea una incidencia, por lo general a partir de la observación de una ejecución. */
export async function crearIncidencia(q: Consulta, actor: Actor, d: NuevaIncidencia): Promise<{ id: string; numero: number }> {
  let reportadaPor = actor.nombre;
  let reportadaPorId: string | null = null;
  let reportadaAt: Date | null = null;
  let sugerida: Prioridad | null = null;
  let codigo = d.pruebaCodigo;

  if (d.ejecucionId) {
    const [e] = await q<{ prueba_codigo: string; relevador_nombre: string; relevador_id: string; creada_at: Date; prioridad_sugerida: Prioridad | null }>(
      "select prueba_codigo, relevador_nombre, relevador_id, creada_at, prioridad_sugerida from ejecuciones where id = $1",
      [d.ejecucionId],
    );
    if (!e) throw new ErrorDominio("ejecucion_inexistente");
    codigo = e.prueba_codigo;
    reportadaPor = e.relevador_nombre;
    reportadaPorId = e.relevador_id;
    reportadaAt = e.creada_at;
    sugerida = e.prioridad_sugerida;
  }
  const [existe] = await q("select 1 from pruebas where codigo = $1", [codigo]);
  if (!existe) throw new ErrorDominio("prueba_inexistente");

  const [i] = await q<{ id: string; numero: number }>(
    `insert into incidencias (prueba_codigo, ejecucion_id, descripcion, resultado_esperado, resultado_observado, reportada_por,
                              reportada_por_relevador_id, reportada_at, prioridad, prioridad_sugerida, responsable_id, creada_por)
     values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, now()), $9, $10, $11, $12) returning id, numero`,
    [
      codigo,
      d.ejecucionId,
      d.descripcion.trim(),
      d.resultadoEsperado.trim(),
      d.resultadoObservado.trim(),
      reportadaPor,
      reportadaPorId,
      reportadaAt,
      d.prioridad,
      sugerida,
      d.responsableId,
      actor.id,
    ],
  );
  await evento(q, i.id, actor, "creada", { nuevo: "reportada", comentario: `Prioridad ${d.prioridad}` });
  if (d.responsableId) {
    const [r] = await q<{ nombre: string }>("select nombre from usuarios_admin where id = $1", [d.responsableId]);
    await evento(q, i.id, actor, "responsable", { nuevo: r?.nombre ?? null });
  }
  if (d.ejecucionId) {
    await q(
      `insert into revisiones_observacion (ejecucion_id, clasificacion, incidencia_id, revisada_por) values ($1, 'incidencia', $2, $3)
       on conflict (ejecucion_id) do update set clasificacion = 'incidencia', incidencia_id = excluded.incidencia_id,
         revisada_por = excluded.revisada_por, revisada_at = now()`,
      [d.ejecucionId, i.id, actor.nombre],
    );
  }
  return i;
}

async function bloquear(q: Consulta, id: string) {
  const [i] = await q<{ id: string; estado: string; prioridad: Prioridad; prueba_codigo: string; responsable_id: string | null }>(
    "select id, estado, prioridad, prueba_codigo, responsable_id from incidencias where id = $1 for update",
    [id],
  );
  if (!i || !esEstadoIncidencia(i.estado)) throw new ErrorDominio("incidencia_inexistente");
  return { ...i, estado: i.estado as EstadoIncidencia };
}

/** Resultado del último pedido de revalidación (null si todavía nadie volvió a probar). */
export async function ultimaRevalidacion(q: Consulta, incidenciaId: string): Promise<Resultado | null> {
  const [r] = await q<{ resultado: Resultado | null }>(
    `select e.resultado from revalidaciones v left join ejecuciones e on e.id = v.ejecucion_id
      where v.incidencia_id = $1 and v.cancelada_at is null order by v.solicitada_at desc limit 1`,
    [incidenciaId],
  );
  return r?.resultado ?? null;
}

export interface CambioEstado {
  hacia: EstadoIncidencia;
  comentario?: string;
  solucion?: string;
  justificacion?: string;
}

/**
 * Cambia el estado de una incidencia. Nunca toca el resultado de la prueba: al marcarla
 * como corregida pide una revalidación, que la prueba muestra en el portal hasta que
 * alguien la vuelva a probar.
 */
export async function cambiarEstado(q: Consulta, actor: Actor, id: string, c: CambioEstado) {
  const i = await bloquear(q, id);
  // Solo cuenta una revalidación posterior al último pedido.
  const ultima = i.estado === "corregida" ? await ultimaRevalidacion(q, id) : null;
  const error = validarTransicion({ ...c, desde: i.estado, ultimaRevalidacion: ultima });
  if (error) throw new ErrorDominio(error);

  await q(
    `update incidencias set estado = $2,
        solucion_aplicada = case when $3::text <> '' then $3 else solucion_aplicada end,
        justificacion_descarte = case when $4::text <> '' then $4 else justificacion_descarte end,
        cerrada_at = case when $2 in ('cerrada', 'descartada') then now() when $2 = 'reabierta' then null else cerrada_at end,
        actualizada_at = now()
      where id = $1`,
    [id, c.hacia, c.solucion?.trim() ?? "", c.justificacion?.trim() ?? ""],
  );
  const comentario = [c.comentario, c.justificacion].map((t) => t?.trim()).filter(Boolean).join(" · ");
  await evento(q, id, actor, "estado", { anterior: i.estado, nuevo: c.hacia, comentario });
  if (c.solucion?.trim()) await evento(q, id, actor, "solucion", { comentario: c.solucion.trim() });

  if (cancelaRevalidacion(c.hacia)) {
    await q("update revalidaciones set cancelada_at = now() where incidencia_id = $1 and ejecucion_id is null and cancelada_at is null", [id]);
  }
  if (pideRevalidacion(c.hacia)) {
    await q("insert into revalidaciones (prueba_codigo, incidencia_id, solicitada_por) values ($1, $2, $3)", [i.prueba_codigo, id, actor.nombre]);
    await evento(q, id, actor, "revalidacion", { nuevo: "pedida", comentario: `Se pidió una nueva validación de ${i.prueba_codigo}.` });
  }
}

export async function cambiarPrioridad(q: Consulta, actor: Actor, id: string, prioridad: Prioridad, comentario = "") {
  const i = await bloquear(q, id);
  if (i.prioridad === prioridad) return false;
  await q("update incidencias set prioridad = $2, actualizada_at = now() where id = $1", [id, prioridad]);
  await evento(q, id, actor, "prioridad", { anterior: i.prioridad, nuevo: prioridad, comentario });
  return true;
}

export async function asignarResponsable(q: Consulta, actor: Actor, id: string, responsableId: string | null) {
  const i = await bloquear(q, id);
  if (i.responsable_id === responsableId) return false;
  const nombres = await q<{ id: string; nombre: string }>("select id, nombre from usuarios_admin where id = any($1::uuid[])", [
    [i.responsable_id, responsableId].filter(Boolean),
  ]);
  const nombre = (x: string | null) => nombres.find((n) => n.id === x)?.nombre ?? null;
  if (responsableId && !nombre(responsableId)) throw new ErrorDominio("sin_permiso");
  await q("update incidencias set responsable_id = $2, actualizada_at = now() where id = $1", [id, responsableId]);
  await evento(q, id, actor, "responsable", { anterior: nombre(i.responsable_id), nuevo: nombre(responsableId) });
  return true;
}

export async function comentar(q: Consulta, actor: Actor, id: string, texto: string) {
  await bloquear(q, id);
  if (!texto.trim()) throw new ErrorDominio("falta_comentario");
  await q("update incidencias set actualizada_at = now() where id = $1", [id]);
  await evento(q, id, actor, "comentario", { comentario: texto.trim() });
}

export async function adjuntarEvidencias(
  q: Consulta,
  actor: Actor,
  id: string,
  archivos: { nombre: string; mime: string; tamano: number; ruta: string }[],
) {
  await bloquear(q, id);
  for (const a of archivos) {
    await q(
      "insert into evidencias (incidencia_id, nombre_original, tipo_mime, tamano_bytes, ruta, subida_por) values ($1, $2, $3, $4, $5, $6)",
      [id, a.nombre, a.mime, a.tamano, a.ruta, actor.nombre],
    );
  }
  await evento(q, id, actor, "evidencia", { comentario: archivos.map((a) => a.nombre).join(", ") });
}

/** Clasifica una observación: informativa (no es un error) o la vuelve a «sin revisar». */
export async function clasificarObservacion(q: Consulta, actor: Actor, ejecucionId: string, clasificacion: "informativa" | "sin_revisar") {
  const [e] = await q("select 1 from ejecuciones where id = $1", [ejecucionId]);
  if (!e) throw new ErrorDominio("ejecucion_inexistente");
  if (clasificacion === "informativa") {
    await q(
      `insert into revisiones_observacion (ejecucion_id, clasificacion, revisada_por) values ($1, 'informativa', $2)
       on conflict (ejecucion_id) do update set clasificacion = 'informativa', incidencia_id = null, revisada_por = excluded.revisada_por, revisada_at = now()
       where revisiones_observacion.clasificacion <> 'incidencia'`,
      [ejecucionId, actor.nombre],
    );
  } else {
    await q("delete from revisiones_observacion where ejecucion_id = $1 and clasificacion = 'informativa'", [ejecucionId]);
  }
  await auditar(q, actor, "observacion.clasificar", { ejecucionId, clasificacion });
}
