// Agente Claude (D-015): la cola de trabajo, lo que informa y a quién se avisa.
// Funciones sobre `q` (una transacción), probadas en tests/integracion/agente.test.ts.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Consulta } from "@/lib/db";
import {
  caminoHastaCorregida,
  incidenciaElegible,
  NOMBRE_RESULTADO_AGENTE,
  pedirAutomaticamente,
  resultadoPublica,
  type ConfigAgente,
  type EstadoTrabajo,
  type ResultadoAgente,
} from "@/domain/agente";
import { esEstadoIncidencia, type EstadoIncidencia } from "@/domain/incidencias";
import { esPrioridad, type Prioridad } from "@/domain/prioridades";
import { cambiarEstado, type Actor } from "@/features/incidencias/servicio";
import { ErrorDominio } from "@/lib/errores";
import { numeroIncidencia } from "@/lib/formato";

/** Un trabajo en curso sin señales por más de esto se da por abandonado. */
export const MINUTOS_SIN_SENALES = 45;

// ---------------------------------------------------------------------------
// Configuración y token
// ---------------------------------------------------------------------------

export interface EstadoConfig extends ConfigAgente {
  tieneToken: boolean;
  tokenCreadoAt: Date | null;
  ultimoContactoAt: Date | null;
  /** Dio señales en los últimos MINUTOS_SIN_SENALES. */
  conectado: boolean;
  actualizadoPor: string;
  actualizadoAt: Date;
}

export async function leerConfig(q: Consulta): Promise<EstadoConfig> {
  const [c] = await q<{
    activo: boolean;
    automatico: boolean;
    prioridades_automaticas: string[];
    publicar: boolean;
    token_hash: string | null;
    token_creado_at: Date | null;
    ultimo_contacto_at: Date | null;
    conectado: boolean;
    actualizado_por: string;
    actualizado_at: Date;
  }>("select *, coalesce(ultimo_contacto_at > now() - make_interval(mins => $1), false) as conectado from agente_config", [MINUTOS_SIN_SENALES]);
  return {
    activo: c.activo,
    automatico: c.automatico,
    prioridadesAutomaticas: c.prioridades_automaticas.filter(esPrioridad),
    publicar: c.publicar,
    tieneToken: !!c.token_hash,
    tokenCreadoAt: c.token_creado_at,
    ultimoContactoAt: c.ultimo_contacto_at,
    conectado: c.conectado,
    actualizadoPor: c.actualizado_por,
    actualizadoAt: c.actualizado_at,
  };
}

export async function guardarConfig(q: Consulta, actor: Actor, c: ConfigAgente) {
  await q(
    `update agente_config set activo = $1, automatico = $2, prioridades_automaticas = $3, publicar = $4,
            actualizado_por = $5, actualizado_at = now()`,
    [c.activo, c.automatico, [...c.prioridadesAutomaticas], c.publicar, actor.nombre],
  );
  await auditar(q, actor, "agente.config", { ...c });
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Un token nuevo reemplaza al anterior. Se muestra una sola vez: la base guarda solo su hash. */
export async function generarToken(q: Consulta, actor: Actor): Promise<string> {
  const token = `dimag_${randomBytes(32).toString("base64url")}`;
  await q("update agente_config set token_hash = $1, token_creado_at = now(), actualizado_por = $2, actualizado_at = now()", [
    hash(token),
    actor.nombre,
  ]);
  await auditar(q, actor, "agente.token_generado");
  return token;
}

export async function revocarToken(q: Consulta, actor: Actor) {
  await q("update agente_config set token_hash = null, token_creado_at = null, actualizado_por = $1, actualizado_at = now()", [actor.nombre]);
  await auditar(q, actor, "agente.token_revocado");
}

/** El token que presenta el agente. Si vale, registra el contacto. */
export async function verificarToken(q: Consulta, token: string): Promise<boolean> {
  if (!/^dimag_[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [c] = await q<{ token_hash: string | null }>("select token_hash from agente_config");
  if (!c?.token_hash) return false;
  const ok = timingSafeEqual(Buffer.from(hash(token), "hex"), Buffer.from(c.token_hash, "hex"));
  if (ok) await q("update agente_config set ultimo_contacto_at = now()");
  return ok;
}

async function auditar(q: Consulta, actor: Actor | null, accion: string, detalle: Record<string, unknown> = {}) {
  await q("insert into auditoria (accion, usuario_id, usuario_nombre, detalle) values ($1, $2, $3, $4::text::jsonb)", [
    accion,
    actor?.id ?? null,
    actor?.nombre ?? "sistema",
    JSON.stringify(detalle),
  ]);
}

/** La cuenta con la que el agente firma en el historial (la crea la migración). */
export async function actorAgente(q: Consulta): Promise<Actor> {
  const [a] = await q<Actor>("select id, nombre from usuarios_admin where es_agente order by creado_at limit 1");
  if (!a) throw new Error("Falta la cuenta del agente (migración 20261117120000).");
  return a;
}

async function eventoAgente(q: Consulta, incidenciaId: string, actor: Actor, comentario: string, nuevo: string | null = null) {
  await q(
    `insert into incidencia_eventos (incidencia_id, tipo, valor_nuevo, comentario, usuario_id, usuario_nombre)
     values ($1, 'agente', $2, $3, $4, $5)`,
    [incidenciaId, nuevo, comentario.slice(0, 4000), actor.id, actor.nombre],
  );
  await q("update incidencias set actualizada_at = now() where id = $1", [incidenciaId]);
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

/**
 * Encola un aviso para el responsable de la incidencia y para quienes se anotaron a los
 * avisos del agente (con WhatsApp cargado). El envío lo hace avisos.ts después de la transacción.
 */
export async function encolarAvisos(q: Consulta, incidenciaId: string, trabajoId: string | null, texto: string) {
  const destinos = await q<{ id: string; whatsapp: string }>(
    `select u.id, u.whatsapp from usuarios_admin u
      where u.activo and not u.es_agente and u.whatsapp is not null
        and (u.avisos_agente or u.id = (select responsable_id from incidencias where id = $1))`,
    [incidenciaId],
  );
  for (const d of destinos) {
    await q("insert into notificaciones (usuario_id, destino, texto, incidencia_id, trabajo_id) values ($1, $2, $3, $4, $5)", [
      d.id,
      d.whatsapp,
      texto.slice(0, 1000),
      incidenciaId,
      trabajoId,
    ]);
  }
  return destinos.length;
}

const enlace = (base: string | undefined, numero: number) => (base ? ` ${base.replace(/\/$/, "")}/admin/incidencias/${numero}` : "");

// ---------------------------------------------------------------------------
// La cola
// ---------------------------------------------------------------------------

interface IncidenciaBloqueada {
  id: string;
  numero: number;
  estado: EstadoIncidencia;
  prioridad: Prioridad;
  prueba_codigo: string;
}

async function bloquearIncidencia(q: Consulta, id: string): Promise<IncidenciaBloqueada> {
  const [i] = await q<{ id: string; numero: number; estado: string; prioridad: Prioridad; prueba_codigo: string }>(
    "select id, numero, estado, prioridad, prueba_codigo from incidencias where id = $1 for update",
    [id],
  );
  if (!i || !esEstadoIncidencia(i.estado)) throw new ErrorDominio("incidencia_inexistente");
  return { ...i, estado: i.estado };
}

/** Pedirle al agente que trabaje una incidencia (desde el panel, o solo al crearla). */
export async function pedirTrabajo(
  q: Consulta,
  actor: Actor,
  incidenciaId: string,
  origen: "manual" | "automatico" = "manual",
): Promise<{ numero: number }> {
  const i = await bloquearIncidencia(q, incidenciaId);
  if (!incidenciaElegible(i.estado)) throw new ErrorDominio("agente_no_elegible");
  const [vivo] = await q("select 1 from trabajos_agente where incidencia_id = $1 and estado in ('pendiente', 'en_curso')", [i.id]);
  if (vivo) throw new ErrorDominio("agente_ya_pedido");
  const [t] = await q<{ numero: number }>(
    "insert into trabajos_agente (incidencia_id, origen, pedido_por) values ($1, $2, $3) returning numero",
    [i.id, origen, actor.nombre],
  );
  await eventoAgente(
    q,
    i.id,
    actor,
    origen === "automatico" ? "Se le pidió al agente que la corrija (pedido automático)." : `${actor.nombre} le pidió al agente que la corrija.`,
    "pedido",
  );
  return t;
}

/** Al crear una incidencia: si la configuración lo pide, entra sola a la cola. */
export async function pedirSiCorresponde(q: Consulta, incidenciaId: string): Promise<boolean> {
  const c = await leerConfig(q);
  const i = await bloquearIncidencia(q, incidenciaId);
  if (!pedirAutomaticamente(c, i.prioridad, i.estado)) return false;
  await pedirTrabajo(q, await actorAgente(q), incidenciaId, "automatico");
  return true;
}

export async function cancelarTrabajo(q: Consulta, actor: Actor, numero: number) {
  const [t] = await q<{ id: string; incidencia_id: string; estado: EstadoTrabajo }>(
    "select id, incidencia_id, estado from trabajos_agente where numero = $1 for update",
    [numero],
  );
  if (!t) throw new ErrorDominio("trabajo_inexistente");
  if (t.estado !== "pendiente" && t.estado !== "en_curso") return false;
  await q("update trabajos_agente set estado = 'cancelado', terminado_at = now() where id = $1", [t.id]);
  await eventoAgente(q, t.incidencia_id, actor, `${actor.nombre} canceló el pedido al agente.`, "cancelado");
  return true;
}

/** Trabajos en curso sin señales: el agente se cortó (o la máquina se apagó). */
async function vencerAbandonados(q: Consulta, base?: string) {
  const vencidos = await q<{ id: string; incidencia_id: string; numero_incidencia: number }>(
    `update trabajos_agente t set estado = 'fallido', terminado_at = now(),
            resumen = 'El agente dejó de dar señales y el trabajo se dio por abandonado.'
       from incidencias i
      where i.id = t.incidencia_id and t.estado = 'en_curso' and t.latido_at < now() - make_interval(mins => $1)
      returning t.id, t.incidencia_id, i.numero as numero_incidencia`,
    [MINUTOS_SIN_SENALES],
  );
  if (!vencidos.length) return;
  const agente = await actorAgente(q);
  for (const v of vencidos) {
    await eventoAgente(q, v.incidencia_id, agente, `El agente dejó de dar señales por ${MINUTOS_SIN_SENALES} minutos. Hace falta una persona.`, "fallido");
    await encolarAvisos(
      q,
      v.incidencia_id,
      v.id,
      `⚠️ El agente dejó de dar señales mientras trabajaba en ${numeroIncidencia(v.numero_incidencia)}. Revisá si quedó algo a medio hacer.${enlace(base, v.numero_incidencia)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Lo que recibe el agente
// ---------------------------------------------------------------------------

export interface PaqueteTrabajo {
  trabajo: { numero: number; origen: string; pedidoPor: string; pedidoAt: Date };
  /** Si puede publicar en test desde su rama `agente`, o solo dejar la corrección en el PR «Agente». */
  publicar: boolean;
  incidencia: {
    numero: number;
    codigo: string;
    prioridad: Prioridad;
    estado: EstadoIncidencia;
    descripcion: string;
    resultadoEsperado: string;
    resultadoObservado: string;
    reportadaPor: string;
    reportadaAt: Date;
    responsable: string | null;
  };
  prueba: { codigo: string; modulo: string; perfil: string; queProbar: string; resultadoEsperado: string };
  ejecucion: { relevador: string; fecha: Date; resultado: string; observaciones: string; casoUsado: string } | null;
  historial: { fecha: Date; quien: string; tipo: string; texto: string }[];
  evidencias: { id: string; nombre: string; mime: string; tamano: number; origen: "ejecucion" | "incidencia" }[];
}

async function armarPaquete(q: Consulta, trabajoId: string, publicar: boolean): Promise<PaqueteTrabajo> {
  const [f] = await q<{
    t_numero: number;
    origen: string;
    pedido_por: string;
    pedido_at: Date;
    id: string;
    numero: number;
    prueba_codigo: string;
    prioridad: Prioridad;
    estado: EstadoIncidencia;
    descripcion: string;
    resultado_esperado: string;
    resultado_observado: string;
    reportada_por: string;
    reportada_at: Date;
    responsable: string | null;
    ejecucion_id: string | null;
    modulo: string;
    perfil: string;
    que_probar: string;
    p_esperado: string;
  }>(
    `select t.numero as t_numero, t.origen, t.pedido_por, t.pedido_at,
            i.id, i.numero, i.prueba_codigo, i.prioridad, i.estado, i.descripcion, i.resultado_esperado, i.resultado_observado,
            i.reportada_por, i.reportada_at, u.nombre as responsable, i.ejecucion_id,
            m.codigo || ' · ' || m.nombre as modulo, p.perfil, p.que_probar, p.resultado_esperado as p_esperado
       from trabajos_agente t
       join incidencias i on i.id = t.incidencia_id
       join pruebas p on p.codigo = i.prueba_codigo
       join modulos m on m.codigo = p.modulo_codigo
       left join usuarios_admin u on u.id = i.responsable_id
      where t.id = $1`,
    [trabajoId],
  );
  const [e] = f.ejecucion_id
    ? await q<{ relevador_nombre: string; creada_at: Date; resultado: string; observaciones: string; caso_usado: string }>(
        "select relevador_nombre, creada_at, resultado, observaciones, caso_usado from ejecuciones where id = $1",
        [f.ejecucion_id],
      )
    : [];
  const historial = await q<{ fecha: Date; quien: string; tipo: string; texto: string }>(
    `select creado_at as fecha, usuario_nombre as quien, tipo,
            coalesce(nullif(comentario, ''), concat_ws(' → ', valor_anterior, valor_nuevo)) as texto
       from incidencia_eventos where incidencia_id = $1 order by creado_at, id`,
    [f.id],
  );
  const evidencias = await q<{ id: string; nombre: string; mime: string; tamano: number; origen: "ejecucion" | "incidencia" }>(
    `select id, nombre_original as nombre, tipo_mime as mime, tamano_bytes as tamano,
            case when incidencia_id is not null then 'incidencia' else 'ejecucion' end as origen
       from evidencias where incidencia_id = $1 or ($2::uuid is not null and ejecucion_id = $2)
      order by creada_at, nombre_original`,
    [f.id, f.ejecucion_id],
  );
  return {
    trabajo: { numero: f.t_numero, origen: f.origen, pedidoPor: f.pedido_por, pedidoAt: f.pedido_at },
    publicar,
    incidencia: {
      numero: f.numero,
      codigo: numeroIncidencia(f.numero),
      prioridad: f.prioridad,
      estado: f.estado,
      descripcion: f.descripcion,
      resultadoEsperado: f.resultado_esperado,
      resultadoObservado: f.resultado_observado,
      reportadaPor: f.reportada_por,
      reportadaAt: f.reportada_at,
      responsable: f.responsable,
    },
    prueba: { codigo: f.prueba_codigo, modulo: f.modulo, perfil: f.perfil, queProbar: f.que_probar, resultadoEsperado: f.p_esperado },
    ejecucion: e
      ? { relevador: e.relevador_nombre, fecha: e.creada_at, resultado: e.resultado, observaciones: e.observaciones, casoUsado: e.caso_usado }
      : null,
    historial,
    evidencias,
  };
}

/**
 * El agente pide trabajo. Apagado, no recibe nada. Toma el pendiente más urgente
 * (P0 primero, después el más viejo) y avisa a las personas que corresponde.
 */
export async function tomarTrabajo(q: Consulta, base?: string): Promise<PaqueteTrabajo | null> {
  const c = await leerConfig(q);
  if (!c.activo) return null;
  await vencerAbandonados(q, base);
  const [t] = await q<{ id: string; incidencia_id: string }>(
    `select t.id, t.incidencia_id from trabajos_agente t join incidencias i on i.id = t.incidencia_id
      where t.estado = 'pendiente' order by i.prioridad, t.pedido_at limit 1 for update of t skip locked`,
  );
  if (!t) return null;
  const i = await bloquearIncidencia(q, t.incidencia_id);
  if (!incidenciaElegible(i.estado)) {
    // Una persona la resolvió mientras esperaba en la cola.
    await q("update trabajos_agente set estado = 'cancelado', terminado_at = now(), resumen = 'La incidencia ya estaba resuelta.' where id = $1", [t.id]);
    return tomarTrabajo(q, base);
  }
  await q("update trabajos_agente set estado = 'en_curso', tomado_at = now(), latido_at = now() where id = $1", [t.id]);
  const agente = await actorAgente(q);
  await eventoAgente(q, i.id, agente, "El agente empezó a trabajar en la incidencia.", "en_curso");
  await encolarAvisos(
    q,
    i.id,
    t.id,
    `🤖 El agente Claude empezó a trabajar en ${numeroIncidencia(i.numero)} (${i.prueba_codigo}, ${i.prioridad}). Si estás tocando ese código, avisá para no pisarse.${enlace(base, i.numero)}`,
  );
  return armarPaquete(q, t.id, c.publicar);
}

async function trabajoEnCurso(q: Consulta, numero: number) {
  const [t] = await q<{ id: string; incidencia_id: string; estado: EstadoTrabajo }>(
    "select id, incidencia_id, estado from trabajos_agente where numero = $1 for update",
    [numero],
  );
  if (!t) throw new ErrorDominio("trabajo_inexistente");
  return t;
}

/**
 * Señal de vida y, si trae texto, una nota en el historial. Le contesta al agente si
 * tiene que seguir (lo cancelaron o apagaron el interruptor) y si puede publicar.
 */
export async function informarAvance(q: Consulta, numero: number, mensaje = ""): Promise<{ seguir: boolean; publicar: boolean }> {
  const t = await trabajoEnCurso(q, numero);
  const c = await leerConfig(q);
  if (t.estado !== "en_curso") return { seguir: false, publicar: false };
  await q("update trabajos_agente set latido_at = now() where id = $1", [t.id]);
  if (mensaje.trim()) await eventoAgente(q, t.incidencia_id, await actorAgente(q), mensaje.trim(), "avance");
  return { seguir: c.activo, publicar: c.activo && c.publicar };
}

export interface Cierre {
  resultado: ResultadoAgente;
  /** Qué encontró y qué hizo, para una persona. Si publicó, es la «solución aplicada». */
  resumen: string;
  enlaces?: { texto: string; url: string }[];
}

const textoEnlaces = (enlaces: Cierre["enlaces"]) => (enlaces?.length ? ` (${enlaces.map((e) => `${e.texto}: ${e.url}`).join(" · ")})` : "");

/**
 * El agente terminó. Si publicó en test (o ya estaba en el código y lo publicó), la
 * incidencia pasa a «corregida» por el ciclo de siempre: se pide la revalidación a la DIM.
 */
export async function terminarTrabajo(q: Consulta, numero: number, cierre: Cierre, base?: string) {
  const t = await trabajoEnCurso(q, numero);
  if (t.estado !== "en_curso") throw new ErrorDominio("trabajo_no_en_curso");
  const c = await leerConfig(q);
  if (resultadoPublica(cierre.resultado) && !c.publicar) throw new ErrorDominio("agente_sin_publicar");

  const enlaces = (cierre.enlaces ?? []).slice(0, 10);
  const resumen = cierre.resumen.trim().slice(0, 3500) || NOMBRE_RESULTADO_AGENTE[cierre.resultado];
  await q(
    `update trabajos_agente set estado = 'terminado', terminado_at = now(), latido_at = now(),
            resultado = $2, resumen = $3, enlaces = $4::text::jsonb where id = $1`,
    [t.id, cierre.resultado, resumen, JSON.stringify(enlaces)],
  );
  const agente = await actorAgente(q);
  const i = await bloquearIncidencia(q, t.incidencia_id);
  await eventoAgente(q, i.id, agente, `${NOMBRE_RESULTADO_AGENTE[cierre.resultado]}. ${resumen}${textoEnlaces(enlaces)}`, cierre.resultado);

  let corregida = false;
  if (resultadoPublica(cierre.resultado)) {
    const camino = caminoHastaCorregida(i.estado);
    for (const [k, hacia] of camino.entries()) {
      const ultimo = k === camino.length - 1;
      await cambiarEstado(q, agente, i.id, {
        hacia,
        ...(ultimo ? { solucion: `${resumen}${textoEnlaces(enlaces)}`.slice(0, 4000) } : {}),
      });
    }
    corregida = camino.length > 0;
  }

  const codigo = numeroIncidencia(i.numero);
  const textos: Record<ResultadoAgente, string> = {
    desplegado: `✅ El agente corrigió ${codigo} (${i.prueba_codigo}) y lo publicó en test.${corregida ? " Se pidió la revalidación a la DIM." : ""} ${resumen}`,
    ya_resuelto: `✅ ${codigo} (${i.prueba_codigo}) ya estaba corregida en el código: el agente la publicó en test.${corregida ? " Se pidió la revalidación a la DIM." : ""} ${resumen}`,
    pr_abierto: `👀 El agente dejó lista la corrección de ${codigo} (${i.prueba_codigo}) para revisar. ${resumen}`,
    requiere_ok: `✋ ${codigo} (${i.prueba_codigo}) necesita un cambio de datos: el agente lo preparó y espera el OK de una persona. ${resumen}`,
    bloqueado: `⚠️ El agente no pudo corregir ${codigo} (${i.prueba_codigo}): hace falta una persona. ${resumen}`,
  };
  await encolarAvisos(q, i.id, t.id, `${textos[cierre.resultado]}${textoEnlaces(enlaces)}${enlace(base, i.numero)}`);
  return { corregida };
}

/** El agente no pudo terminar por un error suyo (no de la incidencia). */
export async function fallarTrabajo(q: Consulta, numero: number, motivo: string, base?: string) {
  const t = await trabajoEnCurso(q, numero);
  if (t.estado !== "en_curso") throw new ErrorDominio("trabajo_no_en_curso");
  const texto = motivo.trim().slice(0, 2000) || "Error sin detalle.";
  await q("update trabajos_agente set estado = 'fallido', terminado_at = now(), resumen = $2 where id = $1", [t.id, texto]);
  const [i] = await q<{ numero: number; prueba_codigo: string }>("select numero, prueba_codigo from incidencias where id = $1", [t.incidencia_id]);
  await eventoAgente(q, t.incidencia_id, await actorAgente(q), `El agente no pudo terminar: ${texto}`, "fallido");
  await encolarAvisos(
    q,
    t.incidencia_id,
    t.id,
    `⚠️ El agente no pudo terminar ${numeroIncidencia(i!.numero)} (${i!.prueba_codigo}): ${texto}${enlace(base, i!.numero)}`,
  );
}

// ---------------------------------------------------------------------------
// Para el panel
// ---------------------------------------------------------------------------

export interface FilaTrabajo {
  numero: number;
  estado: EstadoTrabajo;
  origen: string;
  pedido_por: string;
  pedido_at: Date;
  tomado_at: Date | null;
  terminado_at: Date | null;
  resultado: ResultadoAgente | null;
  resumen: string;
  enlaces: { texto: string; url: string }[];
  incidencia_numero: number;
  prueba_codigo: string;
  prioridad: Prioridad;
}

export async function listarTrabajos(q: Consulta, f: { incidenciaId?: string; limite?: number } = {}): Promise<FilaTrabajo[]> {
  return q<FilaTrabajo>(
    `select t.numero, t.estado, t.origen, t.pedido_por, t.pedido_at, t.tomado_at, t.terminado_at, t.resultado, t.resumen, t.enlaces,
            i.numero as incidencia_numero, i.prueba_codigo, i.prioridad
       from trabajos_agente t join incidencias i on i.id = t.incidencia_id
      where ($1::uuid is null or t.incidencia_id = $1)
      order by (t.estado in ('pendiente', 'en_curso')) desc, t.pedido_at desc
      limit $2`,
    [f.incidenciaId ?? null, f.limite ?? 50],
  );
}

export interface FilaAviso {
  id: number;
  destinatario: string | null;
  texto: string;
  estado: "pendiente" | "enviada" | "fallida" | "sin_canal";
  error: string | null;
  creada_at: Date;
  enviada_at: Date | null;
}

export async function avisosRecientes(q: Consulta, limite = 20): Promise<FilaAviso[]> {
  return q<FilaAviso>(
    `select n.id, u.nombre as destinatario, n.texto, n.estado, n.error, n.creada_at, n.enviada_at
       from notificaciones n left join usuarios_admin u on u.id = n.usuario_id
      order by n.creada_at desc, n.id desc limit $1`,
    [limite],
  );
}

export async function guardarWhatsapp(q: Consulta, usuarioId: string, whatsapp: string | null, avisos: boolean) {
  await q("update usuarios_admin set whatsapp = $2, avisos_agente = $3 where id = $1 and not es_agente", [usuarioId, whatsapp, avisos && !!whatsapp]);
}

export async function whatsappDe(q: Consulta, usuarioId: string) {
  const [u] = await q<{ whatsapp: string | null; avisos_agente: boolean }>("select whatsapp, avisos_agente from usuarios_admin where id = $1", [usuarioId]);
  return u ?? { whatsapp: null, avisos_agente: false };
}
