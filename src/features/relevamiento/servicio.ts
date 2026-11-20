// Lógica del portal de relevamiento. Cada función recibe la consulta `q` (una
// transacción): así se prueba contra PGlite sin Next (tests/integracion/).
import type { Consulta } from "@/lib/db";
import { estadoPrueba, type EstadoPrueba } from "@/domain/estado-prueba";
import { claveNombre, normalizarNombre } from "@/domain/nombres";
import type { Prioridad } from "@/domain/prioridades";
import { requiereExplicacion, type Resultado } from "@/domain/resultados";
import { ErrorDominio } from "@/lib/errores";

// ---------------------------------------------------------------------------
// Identificación
// ---------------------------------------------------------------------------

export interface Candidato {
  id: string;
  nombre: string;
  ultimoIngreso: Date;
  ejecuciones: number;
}

export type Identificacion =
  | { tipo: "listo"; sesionId: string; relevadorId: string; nombre: string; nuevo: boolean }
  | { tipo: "confirmar"; nombre: string; candidatos: Candidato[] };

async function crearSesion(q: Consulta, relevadorId: string) {
  const [s] = await q<{ id: string }>("insert into sesiones_relevador (relevador_id) values ($1) returning id", [relevadorId]);
  await q("update relevadores set ultimo_ingreso_at = now() where id = $1", [relevadorId]);
  return s.id;
}

async function crearRelevador(q: Consulta, nombre: string) {
  const [r] = await q<{ id: string }>("insert into relevadores (nombre, nombre_clave) values ($1, $2) returning id", [
    nombre,
    claveNombre(nombre),
  ]);
  return r.id;
}

/**
 * Ingreso con nombre y apellido.
 *  - Nadie con ese nombre (ignorando mayúsculas, espacios y tildes): se crea el perfil.
 *  - Alguien con ese nombre que ya ingresó desde este navegador: es la misma persona.
 *  - Alguien con ese nombre desde otro lado: se pregunta («¿Sos vos?»). No se fusiona solo.
 */
export async function identificar(q: Consulta, nombreEscrito: string, conocidos: string[]): Promise<Identificacion> {
  const nombre = normalizarNombre(nombreEscrito);
  const candidatos = await buscarCandidatos(q, nombre);
  const conocido = candidatos.find((c) => conocidos.includes(c.id));
  if (conocido) {
    return { tipo: "listo", sesionId: await crearSesion(q, conocido.id), relevadorId: conocido.id, nombre: conocido.nombre, nuevo: false };
  }
  if (candidatos.length === 0) {
    const id = await crearRelevador(q, nombre);
    return { tipo: "listo", sesionId: await crearSesion(q, id), relevadorId: id, nombre, nuevo: true };
  }
  return { tipo: "confirmar", nombre, candidatos };
}

async function buscarCandidatos(q: Consulta, nombre: string): Promise<Candidato[]> {
  const filas = await q<{ id: string; nombre: string; ultimo_ingreso_at: Date; ejecuciones: number }>(
    `select r.id, r.nombre, r.ultimo_ingreso_at,
            (select count(*)::int from ejecuciones e where e.relevador_id = r.id) as ejecuciones
       from relevadores r where r.nombre_clave = $1
      order by r.ultimo_ingreso_at desc limit 5`,
    [claveNombre(nombre)],
  );
  return filas.map((f) => ({ id: f.id, nombre: f.nombre, ultimoIngreso: f.ultimo_ingreso_at, ejecuciones: f.ejecuciones }));
}

/** Respuesta al «¿Sos vos?»: una persona existente con ese mismo nombre, o «soy otra persona». */
export async function confirmarIdentidad(q: Consulta, nombreEscrito: string, eleccion: string): Promise<Identificacion> {
  const nombre = normalizarNombre(nombreEscrito);
  if (eleccion === "nuevo") {
    const id = await crearRelevador(q, nombre);
    return { tipo: "listo", sesionId: await crearSesion(q, id), relevadorId: id, nombre, nuevo: true };
  }
  // Solo se puede elegir a alguien con el mismo nombre que se escribió.
  const candidato = (await buscarCandidatos(q, nombre)).find((c) => c.id === eleccion);
  if (!candidato) return identificar(q, nombre, []);
  return { tipo: "listo", sesionId: await crearSesion(q, candidato.id), relevadorId: candidato.id, nombre: candidato.nombre, nuevo: false };
}

export interface Conocido {
  id: string;
  nombre: string;
}

/** Quienes ya ingresaron desde este navegador (ids de la cookie del dispositivo), el más reciente primero. */
export async function relevadoresConocidos(q: Consulta, ids: string[]): Promise<Conocido[]> {
  if (ids.length === 0) return [];
  return q<Conocido>("select id, nombre from relevadores where id = any($1::uuid[]) order by ultimo_ingreso_at desc", [ids]);
}

/**
 * Segundo ingreso: la persona elige su nombre de la lista de este navegador. Solo vale un id
 * que esté en la cookie del dispositivo: la lista no permite tomar el perfil de otra persona.
 */
export async function ingresarConocido(q: Consulta, id: string, conocidos: string[]): Promise<Identificacion | null> {
  if (!conocidos.includes(id)) return null;
  const [r] = await relevadoresConocidos(q, [id]);
  if (!r) return null;
  return { tipo: "listo", sesionId: await crearSesion(q, r.id), relevadorId: r.id, nombre: r.nombre, nuevo: false };
}

export type BorradoRelevador =
  | { tipo: "borrado"; sesiones: number }
  | { tipo: "con_pruebas"; ejecuciones: number }
  | { tipo: "con_sugerencias"; sugerencias: number }
  | { tipo: "inexistente" };

/**
 * Borra un relevador que **no registró ninguna prueba** (por ejemplo, alguien del equipo que
 * entró a mirar el portal): sus sesiones, su reserva vigente y su perfil. Si registró pruebas,
 * no se borra: el historial es solo inserción y cada ejecución apunta a su perfil. Tampoco si
 * dejó sugerencias: son suyas y el equipo las está mirando.
 */
export async function borrarRelevador(q: Consulta, id: string): Promise<BorradoRelevador> {
  // Bloquea la fila: una ejecución nueva de esta persona espera a que termine el borrado (y después falla).
  const [r] = await q<{ ejecuciones: number; incidencias: number; sugerencias: number }>(
    `select (select count(*)::int from ejecuciones e where e.relevador_id = r.id) as ejecuciones,
            (select count(*)::int from incidencias i where i.reportada_por_relevador_id = r.id) as incidencias,
            (select count(*)::int from sugerencias s where s.relevador_id = r.id) as sugerencias
       from relevadores r where r.id = $1 for update`,
    [id],
  );
  if (!r) return { tipo: "inexistente" };
  if (r.ejecuciones > 0 || r.incidencias > 0) return { tipo: "con_pruebas", ejecuciones: r.ejecuciones };
  if (r.sugerencias > 0) return { tipo: "con_sugerencias", sugerencias: r.sugerencias };
  await q("delete from reservas where relevador_id = $1", [id]);
  const sesiones = await q("delete from sesiones_relevador where relevador_id = $1 returning id", [id]);
  await q("delete from relevadores where id = $1", [id]);
  return { tipo: "borrado", sesiones: sesiones.length };
}

export async function cerrarSesion(q: Consulta, sesionId: string) {
  await q("delete from reservas where sesion_id = $1", [sesionId]);
  await q("update sesiones_relevador set cerrada_at = now() where id = $1 and cerrada_at is null", [sesionId]);
}

// ---------------------------------------------------------------------------
// Estado del catálogo
// ---------------------------------------------------------------------------

export interface FilaPrueba {
  codigo: string;
  moduloCodigo: string;
  numero: number;
  perfil: string;
  queProbar: string;
  resultadoEsperado: string;
  estado: EstadoPrueba;
  ejecuciones: number;
  ultima: { resultado: Resultado; relevador: string; fecha: Date; observaciones: string } | null;
  reserva: { relevadorId: string; relevador: string; desde: Date; vence: Date } | null;
}

/** Todas las pruebas (o las de un módulo) con su último resultado, reserva y revalidación. */
export async function estadoDePruebas(q: Consulta, modulo?: string): Promise<FilaPrueba[]> {
  const filas = await q<{
    codigo: string;
    modulo_codigo: string;
    numero: number;
    perfil: string;
    que_probar: string;
    resultado_esperado: string;
    ejecuciones: number;
    u_resultado: Resultado | null;
    u_relevador: string | null;
    u_fecha: Date | null;
    u_observaciones: string | null;
    r_relevador_id: string | null;
    r_relevador: string | null;
    r_desde: Date | null;
    r_vence: Date | null;
    revalidar: boolean;
  }>(
    `with ultima as (
       select distinct on (prueba_codigo) prueba_codigo, resultado, relevador_nombre, creada_at, observaciones
         from ejecuciones order by prueba_codigo, creada_at desc, numero desc
     ), conteo as (
       select prueba_codigo, count(*)::int as n from ejecuciones group by prueba_codigo
     )
     select p.codigo, p.modulo_codigo, p.numero, p.perfil, p.que_probar, p.resultado_esperado,
            coalesce(c.n, 0) as ejecuciones,
            u.resultado as u_resultado, u.relevador_nombre as u_relevador, u.creada_at as u_fecha, u.observaciones as u_observaciones,
            r.relevador_id as r_relevador_id, r.relevador_nombre as r_relevador, r.desde as r_desde, r.vence_at as r_vence,
            exists (select 1 from revalidaciones v where v.prueba_codigo = p.codigo and v.ejecucion_id is null and v.cancelada_at is null) as revalidar
       from pruebas p
       join modulos m on m.codigo = p.modulo_codigo
       left join ultima u on u.prueba_codigo = p.codigo
       left join conteo c on c.prueba_codigo = p.codigo
       left join reservas r on r.prueba_codigo = p.codigo and r.vence_at > now()
      where ($1::text is null or p.modulo_codigo = $1)
      order by m.orden, p.numero`,
    [modulo ?? null],
  );
  return filas.map((f) => ({
    codigo: f.codigo,
    moduloCodigo: f.modulo_codigo,
    numero: f.numero,
    perfil: f.perfil,
    queProbar: f.que_probar,
    resultadoEsperado: f.resultado_esperado,
    ejecuciones: f.ejecuciones,
    estado: estadoPrueba({ tieneEjecucion: f.ejecuciones > 0, reservaVigente: !!f.r_relevador_id, revalidacionPendiente: f.revalidar }),
    ultima: f.u_resultado
      ? { resultado: f.u_resultado, relevador: f.u_relevador ?? "", fecha: f.u_fecha!, observaciones: f.u_observaciones ?? "" }
      : null,
    reserva: f.r_relevador_id ? { relevadorId: f.r_relevador_id, relevador: f.r_relevador!, desde: f.r_desde!, vence: f.r_vence! } : null,
  }));
}

export interface Modulo {
  codigo: string;
  nombre: string;
  descripcion: string;
  orden: number;
}

export async function listarModulos(q: Consulta): Promise<Modulo[]> {
  return q<Modulo>("select codigo, nombre, descripcion, orden from modulos order by orden");
}

export interface ResumenModulo extends Modulo {
  total: number;
  realizadas: number;
  porEstado: Record<EstadoPrueba, number>;
  porResultado: Record<Resultado, number>;
}

/** Avance por módulo, calculado sobre las filas de estadoDePruebas. */
export function resumirPorModulo(modulos: Modulo[], filas: FilaPrueba[]): ResumenModulo[] {
  return modulos.map((m) => {
    const propias = filas.filter((f) => f.moduloCodigo === m.codigo);
    const porEstado: Record<EstadoPrueba, number> = { sin_realizar: 0, en_ejecucion: 0, realizada: 0, revalidar: 0 };
    const porResultado: Record<Resultado, number> = { funciona: 0, no_funciona: 0, parcial: 0, no_probado: 0 };
    for (const f of propias) {
      porEstado[f.estado]++;
      if (f.ultima) porResultado[f.ultima.resultado]++;
    }
    return { ...m, total: propias.length, realizadas: propias.filter((f) => f.ejecuciones > 0).length, porEstado, porResultado };
  });
}

// ---------------------------------------------------------------------------
// Detalle e historial de una prueba
// ---------------------------------------------------------------------------

export interface Evidencia {
  id: string;
  nombre: string;
  mime: string;
  tamano: number;
}

export interface EjecucionHistorial {
  id: string;
  numero: number;
  relevadorId: string;
  relevador: string;
  resultado: Resultado;
  observaciones: string;
  casoUsado: string;
  prioridadSugerida: Prioridad | null;
  repetida: boolean;
  esRevalidacion: boolean;
  fecha: Date;
  evidencias: Evidencia[];
}

export async function historialDePrueba(q: Consulta, codigo: string): Promise<EjecucionHistorial[]> {
  const filas = await q<{
    id: string;
    numero: number;
    relevador_id: string;
    relevador_nombre: string;
    resultado: Resultado;
    observaciones: string;
    caso_usado: string;
    prioridad_sugerida: Prioridad | null;
    repetida: boolean;
    es_revalidacion: boolean;
    creada_at: Date;
    evidencias: string;
  }>(
    `select e.id, e.numero, e.relevador_id, e.relevador_nombre, e.resultado, e.observaciones, e.caso_usado,
            e.prioridad_sugerida, e.repetida, e.es_revalidacion, e.creada_at,
            coalesce((select json_agg(json_build_object('id', v.id, 'nombre', v.nombre_original, 'mime', v.tipo_mime, 'tamano', v.tamano_bytes) order by v.creada_at)
                        from evidencias v where v.ejecucion_id = e.id)::text, '[]') as evidencias
       from ejecuciones e where e.prueba_codigo = $1
      order by e.creada_at desc, e.numero desc`,
    [codigo],
  );
  return filas.map((f) => ({
    id: f.id,
    numero: f.numero,
    relevadorId: f.relevador_id,
    relevador: f.relevador_nombre,
    resultado: f.resultado,
    observaciones: f.observaciones,
    casoUsado: f.caso_usado,
    prioridadSugerida: f.prioridad_sugerida,
    repetida: f.repetida,
    esRevalidacion: f.es_revalidacion,
    fecha: f.creada_at,
    evidencias: JSON.parse(f.evidencias) as Evidencia[],
  }));
}

export interface PedidoRevalidacion {
  incidenciaNumero: number;
  solicitadaAt: Date;
  solicitadaPor: string;
  solucion: string;
}

export async function revalidacionesPendientes(q: Consulta, codigo: string): Promise<PedidoRevalidacion[]> {
  const filas = await q<{ numero: number; solicitada_at: Date; solicitada_por: string; solucion_aplicada: string }>(
    `select i.numero, v.solicitada_at, v.solicitada_por, i.solucion_aplicada
       from revalidaciones v join incidencias i on i.id = v.incidencia_id
      where v.prueba_codigo = $1 and v.ejecucion_id is null and v.cancelada_at is null
      order by v.solicitada_at`,
    [codigo],
  );
  return filas.map((f) => ({ incidenciaNumero: f.numero, solicitadaAt: f.solicitada_at, solicitadaPor: f.solicitada_por, solucion: f.solucion_aplicada }));
}

/** Una prueba que el equipo corrigió y espera que un relevador vuelva a probar. */
export interface ParaVolverAProbar {
  codigo: string;
  queProbar: string;
  modulo: string;
  /** El último pedido de revalidación de esa prueba. */
  pedidaAt: Date;
  /** Qué se corrigió (texto del equipo o del agente, sin limpiar). */
  solucion: string;
  /** La reportó este relevador: su observación dio origen a la incidencia. */
  mia: boolean;
  /** Alguien más la está probando ahora. */
  probandoOtro: string | null;
}

/**
 * Las pruebas con pedido de revalidación pendiente, para avisarle al relevador: primero las
 * que reportó él, después las más recientes. Una prueba aparece una vez aunque tenga varias
 * incidencias corregidas.
 */
export async function paraVolverAProbar(q: Consulta, relevadorId: string): Promise<ParaVolverAProbar[]> {
  const filas = await q<{
    codigo: string;
    que_probar: string;
    modulo: string;
    pedida_at: Date;
    solucion: string | null;
    mia: boolean;
    probando_otro: string | null;
  }>(
    `select v.prueba_codigo as codigo, p.que_probar, m.nombre as modulo,
            max(v.solicitada_at) as pedida_at,
            (array_agg(i.solucion_aplicada order by v.solicitada_at desc))[1] as solucion,
            bool_or(
              exists (select 1 from ejecuciones e where e.id = i.ejecucion_id and e.relevador_id = $1)
              or exists (select 1 from revisiones_observacion r join ejecuciones e on e.id = r.ejecucion_id
                          where r.incidencia_id = i.id and e.relevador_id = $1)
            ) as mia,
            (select r.relevador_nombre from reservas r
              where r.prueba_codigo = v.prueba_codigo and r.vence_at > now() and r.relevador_id <> $1) as probando_otro
       from revalidaciones v
       join incidencias i on i.id = v.incidencia_id
       join pruebas p on p.codigo = v.prueba_codigo
       join modulos m on m.codigo = p.modulo_codigo
      where v.ejecucion_id is null and v.cancelada_at is null
      group by v.prueba_codigo, p.que_probar, m.nombre
      order by mia desc, pedida_at desc, v.prueba_codigo`,
    [relevadorId],
  );
  return filas.map((f) => ({
    codigo: f.codigo,
    queProbar: f.que_probar,
    modulo: f.modulo,
    pedidaAt: f.pedida_at,
    solucion: f.solucion ?? "",
    mia: f.mia,
    probandoOtro: f.probando_otro,
  }));
}

/** Cuántas pruebas esperan que alguien las vuelva a probar (para la barra del portal). */
export async function cuantasParaVolverAProbar(q: Consulta): Promise<number> {
  const [r] = await q<{ n: number }>(
    "select count(distinct prueba_codigo)::int as n from revalidaciones where ejecucion_id is null and cancelada_at is null",
  );
  return r?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Reserva temporal
// ---------------------------------------------------------------------------

interface Quien {
  sesionId: string;
  relevadorId: string;
  nombre: string;
}

export type ResultadoTomar =
  | { tipo: "tomada"; vence: Date }
  | { tipo: "ocupada"; por: string; desde: Date; vence: Date }
  | { tipo: "confirmar"; ultima: { relevador: string; fecha: Date; resultado: Resultado } };

/**
 * «Empezar a probar»: reserva la prueba por unos minutos. Si otra persona la tiene
 * reservada, no se puede. Si ya tiene resultado (y nadie pidió revalidarla), se avisa
 * antes: `repetir` confirma que se quiere registrar una nueva evaluación.
 */
export async function tomarPrueba(
  q: Consulta,
  codigo: string,
  quien: Quien,
  opciones: { minutos: number; repetir: boolean },
): Promise<ResultadoTomar> {
  const [prueba] = await q<{ codigo: string }>("select codigo from pruebas where codigo = $1 for update", [codigo]);
  if (!prueba) throw new ErrorDominio("prueba_inexistente");

  const [reserva] = await q<{ relevador_id: string; relevador_nombre: string; desde: Date; vence_at: Date; vigente: boolean }>(
    "select relevador_id, relevador_nombre, desde, vence_at, vence_at > now() as vigente from reservas where prueba_codigo = $1",
    [codigo],
  );
  const esMia = reserva?.relevador_id === quien.relevadorId;
  if (reserva?.vigente && !esMia) {
    return { tipo: "ocupada", por: reserva.relevador_nombre, desde: reserva.desde, vence: reserva.vence_at };
  }

  if (!opciones.repetir && !(reserva?.vigente && esMia)) {
    const [ultima] = await q<{ relevador_nombre: string; creada_at: Date; resultado: Resultado; revalidar: boolean }>(
      `select e.relevador_nombre, e.creada_at, e.resultado,
              exists (select 1 from revalidaciones v where v.prueba_codigo = $1 and v.ejecucion_id is null and v.cancelada_at is null) as revalidar
         from ejecuciones e where e.prueba_codigo = $1 order by e.creada_at desc, e.numero desc limit 1`,
      [codigo],
    );
    if (ultima && !ultima.revalidar) {
      return { tipo: "confirmar", ultima: { relevador: ultima.relevador_nombre, fecha: ultima.creada_at, resultado: ultima.resultado } };
    }
  }

  const [r] = await q<{ vence_at: Date }>(
    `insert into reservas (prueba_codigo, relevador_id, sesion_id, relevador_nombre, vence_at)
     values ($1, $2, $3, $4, now() + make_interval(mins => $5))
     on conflict (prueba_codigo) do update
       set relevador_id = excluded.relevador_id, sesion_id = excluded.sesion_id, relevador_nombre = excluded.relevador_nombre,
           desde = case when reservas.relevador_id = excluded.relevador_id and reservas.vence_at > now() then reservas.desde else now() end,
           vence_at = excluded.vence_at
     returning vence_at`,
    [codigo, quien.relevadorId, quien.sesionId, quien.nombre, opciones.minutos],
  );
  await q("update sesiones_relevador set ultima_actividad_at = now() where id = $1", [quien.sesionId]);
  return { tipo: "tomada", vence: r.vence_at };
}

/** Mientras el formulario está abierto se renueva la reserva. Devuelve el nuevo vencimiento o null si ya no es suya. */
export async function renovarReserva(q: Consulta, codigo: string, relevadorId: string, minutos: number): Promise<Date | null> {
  const [r] = await q<{ vence_at: Date }>(
    `update reservas set vence_at = now() + make_interval(mins => $3)
      where prueba_codigo = $1 and relevador_id = $2 and vence_at > now() returning vence_at`,
    [codigo, relevadorId, minutos],
  );
  return r?.vence_at ?? null;
}

export async function liberarReserva(q: Consulta, codigo: string, relevadorId: string) {
  await q("delete from reservas where prueba_codigo = $1 and relevador_id = $2", [codigo, relevadorId]);
}

/** ¿La reserva vigente de esta prueba es de esta persona? */
export async function reservaPropia(q: Consulta, codigo: string, relevadorId: string): Promise<Date | null> {
  const [r] = await q<{ vence_at: Date }>(
    "select vence_at from reservas where prueba_codigo = $1 and relevador_id = $2 and vence_at > now()",
    [codigo, relevadorId],
  );
  return r?.vence_at ?? null;
}

// ---------------------------------------------------------------------------
// Guardar una ejecución
// ---------------------------------------------------------------------------

export interface DatosEjecucion {
  codigo: string;
  resultado: Resultado;
  observaciones: string;
  casoUsado: string;
  prioridadSugerida: Prioridad | null;
  evidencias: { nombre: string; mime: string; tamano: number; ruta: string }[];
}

export interface EjecucionGuardada {
  id: string;
  numero: number;
  esRevalidacion: boolean;
  repetida: boolean;
}

/**
 * Registra el resultado como una fila nueva (nunca se sobrescribe uno anterior), sus
 * evidencias, resuelve los pedidos de revalidación pendientes y libera la reserva.
 * Si otra persona tiene la prueba reservada, no se guarda.
 */
export async function guardarEjecucion(q: Consulta, quien: Quien, d: DatosEjecucion): Promise<EjecucionGuardada> {
  if (requiereExplicacion(d.resultado) && !d.observaciones.trim()) throw new ErrorDominio("falta_explicacion");
  const [prueba] = await q<{ codigo: string }>("select codigo from pruebas where codigo = $1 for update", [d.codigo]);
  if (!prueba) throw new ErrorDominio("prueba_inexistente");

  const [reserva] = await q<{ relevador_id: string }>(
    "select relevador_id from reservas where prueba_codigo = $1 and vence_at > now()",
    [d.codigo],
  );
  if (reserva && reserva.relevador_id !== quien.relevadorId) throw new ErrorDominio("reservada_por_otro");

  const [previo] = await q<{ repetida: boolean; revalidacion: boolean }>(
    `select exists (select 1 from ejecuciones where prueba_codigo = $1) as repetida,
            exists (select 1 from revalidaciones where prueba_codigo = $1 and ejecucion_id is null and cancelada_at is null) as revalidacion`,
    [d.codigo],
  );

  const [e] = await q<{ id: string; numero: number }>(
    `insert into ejecuciones (prueba_codigo, relevador_id, sesion_id, relevador_nombre, resultado, observaciones, caso_usado,
                              prioridad_sugerida, repetida, es_revalidacion)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id, numero`,
    [
      d.codigo,
      quien.relevadorId,
      quien.sesionId,
      quien.nombre,
      d.resultado,
      d.observaciones.trim(),
      d.casoUsado.trim(),
      d.prioridadSugerida,
      previo.repetida && !previo.revalidacion,
      previo.revalidacion,
    ],
  );

  for (const ev of d.evidencias) {
    await q(
      "insert into evidencias (ejecucion_id, nombre_original, tipo_mime, tamano_bytes, ruta, subida_por) values ($1, $2, $3, $4, $5, $6)",
      [e.id, ev.nombre, ev.mime, ev.tamano, ev.ruta, quien.nombre],
    );
  }

  // La nueva evaluación responde a los pedidos de revalidación: queda en el historial de cada incidencia.
  const resueltas = await q<{ incidencia_id: string }>(
    `update revalidaciones set ejecucion_id = $2, resuelta_at = now()
      where prueba_codigo = $1 and ejecucion_id is null and cancelada_at is null
      returning incidencia_id`,
    [d.codigo, e.id],
  );
  for (const r of resueltas) {
    await q(
      `insert into incidencia_eventos (incidencia_id, tipo, valor_nuevo, comentario, usuario_nombre)
       values ($1, 'revalidacion', $2, $3, $4)`,
      [r.incidencia_id, d.resultado, d.observaciones.trim().slice(0, 4000), `${quien.nombre} (relevador)`],
    );
  }

  await q("delete from reservas where prueba_codigo = $1 and relevador_id = $2", [d.codigo, quien.relevadorId]);
  await q("update sesiones_relevador set ultima_actividad_at = now() where id = $1", [quien.sesionId]);
  return { id: e.id, numero: e.numero, esRevalidacion: previo.revalidacion, repetida: previo.repetida && !previo.revalidacion };
}

/** La próxima prueba disponible del módulo (sin hacer o para revalidar, y sin reserva de otro). */
export async function siguienteDisponible(q: Consulta, modulo: string, despuesDe?: string): Promise<string | null> {
  const filas = (await estadoDePruebas(q, modulo)).filter((f) => f.estado === "sin_realizar" || f.estado === "revalidar");
  const despues = despuesDe ? filas.find((f) => f.codigo > despuesDe && f.codigo.length >= despuesDe.length) : undefined;
  return (despues ?? filas[0])?.codigo ?? null;
}
