// Lecturas del panel de administración. Todo se calcula sobre la base real.
import type { Consulta } from "@/lib/db";
import { ESTADOS_ABIERTOS, ESTADOS_ACTIVOS, type EstadoIncidencia } from "@/domain/incidencias";
import type { Prioridad } from "@/domain/prioridades";
import type { Resultado } from "@/domain/resultados";
import type { Rol } from "@/domain/permisos";

const activos = [...ESTADOS_ACTIVOS];
const abiertos = [...ESTADOS_ABIERTOS];

/** Normaliza un texto de búsqueda para compararlo sin tildes ni mayúsculas. */
export function patronBusqueda(texto: string | undefined): string | null {
  const t = (texto ?? "").trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").slice(0, 100);
  return t ? `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
}
const SIN_TILDES = (col: string) => `translate(lower(${col}), 'áéíóúüñ', 'aeiouun')`;

// ---------------------------------------------------------------------------
// Tablero
// ---------------------------------------------------------------------------

export interface Metricas {
  total: number;
  evaluadas: number;
  pendientes: number;
  funciona: number;
  parcial: number;
  no_funciona: number;
  no_probado: number;
  ejecuciones: number;
  relevadores: number;
  incidencias_abiertas: number;
  incidencias_corregidas: number;
  incidencias_por_validar: number;
  incidencias_criticas: number;
  incidencias_descartadas: number;
  observaciones_sin_revisar: number;
  revalidaciones_pendientes: number;
}

export async function metricas(q: Consulta): Promise<Metricas> {
  const [m] = await q<Metricas>(
    `with ultima as (
       select distinct on (prueba_codigo) prueba_codigo, resultado
         from ejecuciones order by prueba_codigo, creada_at desc, numero desc
     )
     select (select count(*)::int from pruebas) as total,
            (select count(*)::int from ultima) as evaluadas,
            (select count(*)::int from pruebas p where not exists (select 1 from ultima u where u.prueba_codigo = p.codigo)) as pendientes,
            (select count(*)::int from ultima where resultado = 'funciona') as funciona,
            (select count(*)::int from ultima where resultado = 'parcial') as parcial,
            (select count(*)::int from ultima where resultado = 'no_funciona') as no_funciona,
            (select count(*)::int from ultima where resultado = 'no_probado') as no_probado,
            (select count(*)::int from ejecuciones) as ejecuciones,
            (select count(distinct relevador_id)::int from ejecuciones) as relevadores,
            (select count(*)::int from incidencias where estado = any($1::text[])) as incidencias_abiertas,
            (select count(*)::int from incidencias where estado = 'cerrada') as incidencias_corregidas,
            (select count(*)::int from incidencias where estado = 'corregida') as incidencias_por_validar,
            (select count(*)::int from incidencias where prioridad = 'P0' and estado = any($2::text[])) as incidencias_criticas,
            (select count(*)::int from incidencias where estado = 'descartada') as incidencias_descartadas,
            (select count(*)::int from ejecuciones e where btrim(e.observaciones) <> ''
               and not exists (select 1 from revisiones_observacion r where r.ejecucion_id = e.id)) as observaciones_sin_revisar,
            (select count(*)::int from revalidaciones where ejecucion_id is null and cancelada_at is null) as revalidaciones_pendientes`,
    [abiertos, activos],
  );
  return m;
}

export interface Actividad {
  tipo: "ejecucion" | "incidencia";
  fecha: Date;
  quien: string;
  codigo: string;
  detalle: string;
  valor: string | null;
  numero: number | null;
  revalidacion: boolean;
}

export async function actividadReciente(q: Consulta, limite = 12): Promise<Actividad[]> {
  return q<Actividad>(
    `select * from (
       (select 'ejecucion' as tipo, e.creada_at as fecha, e.relevador_nombre as quien, e.prueba_codigo as codigo,
               e.resultado as detalle, null::text as valor, null::int as numero, e.es_revalidacion as revalidacion
          from ejecuciones e order by e.creada_at desc limit $1)
       union all
       (select 'incidencia', ev.creado_at, ev.usuario_nombre, i.prueba_codigo, ev.tipo, ev.valor_nuevo, i.numero, false
          from incidencia_eventos ev join incidencias i on i.id = ev.incidencia_id order by ev.creado_at desc limit $1)
     ) a order by fecha desc limit $1`,
    [limite],
  );
}

export interface IncidenciaPorPrioridad {
  prioridad: Prioridad;
  activas: number;
}

export async function incidenciasActivasPorPrioridad(q: Consulta): Promise<IncidenciaPorPrioridad[]> {
  return q<IncidenciaPorPrioridad>(
    `select p.prioridad, count(i.id)::int as activas
       from (values ('P0'), ('P1'), ('P2'), ('P3')) as p(prioridad)
       left join incidencias i on i.prioridad = p.prioridad and i.estado = any($1::text[])
      group by p.prioridad order by p.prioridad`,
    [activos],
  );
}

// ---------------------------------------------------------------------------
// Opciones para filtros
// ---------------------------------------------------------------------------

export interface Opcion {
  valor: string;
  etiqueta: string;
}

export async function opcionesModulos(q: Consulta): Promise<Opcion[]> {
  const filas = await q<{ codigo: string; nombre: string }>("select codigo, nombre from modulos order by orden");
  return filas.map((f) => ({ valor: f.codigo, etiqueta: `${f.codigo} · ${f.nombre}` }));
}

/** Relevadores con al menos una ejecución. Si dos se llaman igual, se distinguen por un sufijo del id. */
export async function opcionesRelevadores(q: Consulta): Promise<Opcion[]> {
  const filas = await q<{ id: string; nombre: string; repetido: boolean }>(
    `select r.id, r.nombre, count(*) over (partition by r.nombre_clave) > 1 as repetido
       from relevadores r where exists (select 1 from ejecuciones e where e.relevador_id = r.id)
      order by r.nombre`,
  );
  return filas.map((f) => ({ valor: f.id, etiqueta: f.repetido ? `${f.nombre} · #${f.id.slice(0, 4)}` : f.nombre }));
}

/** Las 217 pruebas en el orden del PDF, para elegir a mano al crear una incidencia. */
export async function opcionesPruebas(q: Consulta): Promise<Opcion[]> {
  const filas = await q<{ codigo: string; que_probar: string }>(
    "select p.codigo, p.que_probar from pruebas p join modulos m on m.codigo = p.modulo_codigo order by m.orden, p.numero",
  );
  return filas.map((p) => ({ valor: p.codigo, etiqueta: `${p.codigo} · ${p.que_probar}` }));
}

export async function opcionesResponsables(q: Consulta): Promise<Opcion[]> {
  const filas = await q<{ id: string; nombre: string; rol: string }>("select id, nombre, rol from usuarios_admin where activo and not es_agente order by nombre");
  return filas.map((f) => ({ valor: f.id, etiqueta: f.nombre }));
}

// ---------------------------------------------------------------------------
// Ejecuciones (administración de pruebas)
// ---------------------------------------------------------------------------

export interface FiltrosEjecuciones {
  modulo?: string;
  relevador?: string;
  resultado?: Resultado;
  prioridad?: Prioridad;
  desde?: Date;
  hasta?: Date;
  correccion?: EstadoIncidencia | "sin_incidencias";
  soloUltima?: boolean;
  pagina: number;
  porPagina: number;
}

export interface FilaEjecucion {
  id: string;
  numero: number;
  prueba_codigo: string;
  que_probar: string;
  modulo_codigo: string;
  modulo: string;
  relevador_id: string;
  relevador_nombre: string;
  creada_at: Date;
  resultado: Resultado;
  observaciones: string;
  caso_usado: string;
  es_revalidacion: boolean;
  repetida: boolean;
  incidencias: number;
  prioridad_max: Prioridad | null;
  estado_correccion: EstadoIncidencia | null;
  evidencias: number;
  total: number;
}

const CTE_INCIDENCIAS = `inc as (
  select prueba_codigo,
         count(*)::int as cantidad,
         min(prioridad) filter (where estado = any($11::text[])) as prioridad_max,
         (array_agg(estado order by (estado = any($11::text[])) desc, prioridad, creada_at desc))[1] as estado_principal,
         array_agg(distinct estado) as estados
    from incidencias group by prueba_codigo
)`;

export async function listarEjecuciones(q: Consulta, f: FiltrosEjecuciones): Promise<FilaEjecucion[]> {
  return q<FilaEjecucion>(
    `with ${CTE_INCIDENCIAS}
     select e.id, e.numero, e.prueba_codigo, p.que_probar, m.codigo as modulo_codigo, m.nombre as modulo,
            e.relevador_id, e.relevador_nombre, e.creada_at, e.resultado, e.observaciones, e.caso_usado,
            e.es_revalidacion, e.repetida,
            coalesce(inc.cantidad, 0) as incidencias, inc.prioridad_max, inc.estado_principal as estado_correccion,
            (select count(*)::int from evidencias v where v.ejecucion_id = e.id) as evidencias,
            (count(*) over ())::int as total
       from ejecuciones e
       join pruebas p on p.codigo = e.prueba_codigo
       join modulos m on m.codigo = p.modulo_codigo
       left join inc on inc.prueba_codigo = e.prueba_codigo
      where ($1::text is null or m.codigo = $1)
        and ($2::uuid is null or e.relevador_id = $2)
        and ($3::text is null or e.resultado = $3)
        and ($4::text is null or inc.prioridad_max = $4)
        and ($5::timestamptz is null or e.creada_at >= $5)
        and ($6::timestamptz is null or e.creada_at < $6)
        and ($7::text is null or ($7 = 'sin_incidencias' and inc.cantidad is null) or $7 = any(inc.estados))
        and (not $8::boolean or e.id in (
              select distinct on (prueba_codigo) id from ejecuciones order by prueba_codigo, creada_at desc, numero desc))
      order by e.creada_at desc, e.numero desc
      limit $9 offset $10`,
    [
      f.modulo ?? null,
      f.relevador ?? null,
      f.resultado ?? null,
      f.prioridad ?? null,
      f.desde ?? null,
      f.hasta ?? null,
      f.correccion ?? null,
      !!f.soloUltima,
      f.porPagina,
      (f.pagina - 1) * f.porPagina,
      activos,
    ],
  );
}

// ---------------------------------------------------------------------------
// Detalle de una prueba (todas sus ejecuciones, incidencias y revalidaciones)
// ---------------------------------------------------------------------------

export interface PruebaAdmin {
  codigo: string;
  modulo_codigo: string;
  modulo: string;
  numero: number;
  perfil: string;
  que_probar: string;
  resultado_esperado: string;
  pagina: number | null;
}

export async function pruebaAdmin(q: Consulta, codigo: string): Promise<PruebaAdmin | null> {
  const [p] = await q<PruebaAdmin>(
    `select p.codigo, p.modulo_codigo, m.nombre as modulo, p.numero, p.perfil, p.que_probar, p.resultado_esperado, p.pagina
       from pruebas p join modulos m on m.codigo = p.modulo_codigo where p.codigo = $1`,
    [codigo],
  );
  return p ?? null;
}

export interface IncidenciaResumen {
  id: string;
  numero: number;
  prueba_codigo: string;
  que_probar: string;
  modulo_codigo: string;
  modulo: string;
  descripcion: string;
  reportada_por: string;
  reportada_at: Date;
  prioridad: Prioridad;
  prioridad_sugerida: Prioridad | null;
  estado: EstadoIncidencia;
  responsable_id: string | null;
  responsable: string | null;
  creada_at: Date;
  actualizada_at: Date;
  revalidacion_pendiente: boolean;
}

export interface FiltrosIncidencias {
  prioridades?: Prioridad[];
  modulo?: string;
  responsable?: string; // uuid o "sin_asignar"
  estados?: EstadoIncidencia[];
  prueba?: string;
  busqueda?: string;
}

/** Ordenadas de mayor a menor prioridad y, dentro de cada una, de la más vieja a la más nueva. */
export async function listarIncidencias(q: Consulta, f: FiltrosIncidencias): Promise<IncidenciaResumen[]> {
  return q<IncidenciaResumen>(
    `select i.id, i.numero, i.prueba_codigo, p.que_probar, m.codigo as modulo_codigo, m.nombre as modulo, i.descripcion,
            i.reportada_por, i.reportada_at, i.prioridad, i.prioridad_sugerida, i.estado, i.responsable_id, u.nombre as responsable,
            i.creada_at, i.actualizada_at,
            exists (select 1 from revalidaciones v where v.incidencia_id = i.id and v.ejecucion_id is null and v.cancelada_at is null) as revalidacion_pendiente
       from incidencias i
       join pruebas p on p.codigo = i.prueba_codigo
       join modulos m on m.codigo = p.modulo_codigo
       left join usuarios_admin u on u.id = i.responsable_id
      where ($1::text[] is null or i.prioridad = any($1))
        and ($2::text is null or m.codigo = $2)
        and ($3::text is null or ($3 = 'sin_asignar' and i.responsable_id is null) or i.responsable_id::text = $3)
        and ($4::text[] is null or i.estado = any($4))
        and ($5::text is null or i.prueba_codigo = $5)
        and ($6::text is null or ${SIN_TILDES("i.descripcion")} like $6 or ${SIN_TILDES("p.que_probar")} like $6
             or lower(i.prueba_codigo) like $6 or ${SIN_TILDES("i.reportada_por")} like $6)
      order by i.prioridad, i.reportada_at, i.numero`,
    [
      f.prioridades?.length ? f.prioridades : null,
      f.modulo ?? null,
      f.responsable ?? null,
      f.estados?.length ? f.estados : null,
      f.prueba ?? null,
      patronBusqueda(f.busqueda),
    ],
  );
}

export interface RevalidacionAdmin {
  id: string;
  incidencia_numero: number;
  solicitada_at: Date;
  solicitada_por: string;
  resuelta_at: Date | null;
  cancelada_at: Date | null;
  resultado: Resultado | null;
  relevador: string | null;
}

export async function revalidacionesDePrueba(q: Consulta, codigo: string): Promise<RevalidacionAdmin[]> {
  return q<RevalidacionAdmin>(
    `select v.id, i.numero as incidencia_numero, v.solicitada_at, v.solicitada_por, v.resuelta_at, v.cancelada_at,
            e.resultado, e.relevador_nombre as relevador
       from revalidaciones v join incidencias i on i.id = v.incidencia_id left join ejecuciones e on e.id = v.ejecucion_id
      where v.prueba_codigo = $1 order by v.solicitada_at desc`,
    [codigo],
  );
}

// ---------------------------------------------------------------------------
// Observaciones
// ---------------------------------------------------------------------------

export const ORDENES_OBSERVACIONES = {
  recientes: "e.creada_at desc, e.numero desc",
  antiguas: "e.creada_at asc, e.numero asc",
  codigo: "m.orden, p.numero, e.creada_at desc",
  resultado: "array_position(array['no_funciona','parcial','no_probado','funciona'], e.resultado), e.creada_at desc",
} as const;
export type OrdenObservaciones = keyof typeof ORDENES_OBSERVACIONES;

export interface FiltrosObservaciones {
  modulo?: string;
  relevador?: string;
  resultado?: Resultado;
  clasificacion?: "sin_revisar" | "informativa" | "incidencia";
  busqueda?: string;
  orden: OrdenObservaciones;
  pagina: number;
  porPagina: number;
}

export interface FilaObservacion {
  id: string;
  numero: number;
  prueba_codigo: string;
  que_probar: string;
  modulo_codigo: string;
  modulo: string;
  relevador_nombre: string;
  creada_at: Date;
  resultado: Resultado;
  observaciones: string;
  caso_usado: string;
  prioridad_sugerida: Prioridad | null;
  clasificacion: "sin_revisar" | "informativa" | "incidencia";
  revisada_por: string | null;
  incidencia_numero: number | null;
  evidencias: number;
  total: number;
}

export async function listarObservaciones(q: Consulta, f: FiltrosObservaciones): Promise<FilaObservacion[]> {
  return q<FilaObservacion>(
    `select e.id, e.numero, e.prueba_codigo, p.que_probar, m.codigo as modulo_codigo, m.nombre as modulo, e.relevador_nombre,
            e.creada_at, e.resultado, e.observaciones, e.caso_usado, e.prioridad_sugerida,
            coalesce(r.clasificacion, 'sin_revisar') as clasificacion, r.revisada_por, i.numero as incidencia_numero,
            (select count(*)::int from evidencias v where v.ejecucion_id = e.id) as evidencias,
            (count(*) over ())::int as total
       from ejecuciones e
       join pruebas p on p.codigo = e.prueba_codigo
       join modulos m on m.codigo = p.modulo_codigo
       left join revisiones_observacion r on r.ejecucion_id = e.id
       left join incidencias i on i.id = r.incidencia_id
      where btrim(e.observaciones) <> ''
        and ($1::text is null or m.codigo = $1)
        and ($2::uuid is null or e.relevador_id = $2)
        and ($3::text is null or e.resultado = $3)
        and ($4::text is null or coalesce(r.clasificacion, 'sin_revisar') = $4)
        and ($5::text is null or ${SIN_TILDES("e.observaciones")} like $5 or ${SIN_TILDES("e.caso_usado")} like $5
             or lower(e.prueba_codigo) like $5 or ${SIN_TILDES("e.relevador_nombre")} like $5 or ${SIN_TILDES("p.que_probar")} like $5)
      order by ${ORDENES_OBSERVACIONES[f.orden]}
      limit $6 offset $7`,
    [f.modulo ?? null, f.relevador ?? null, f.resultado ?? null, f.clasificacion ?? null, patronBusqueda(f.busqueda), f.porPagina, (f.pagina - 1) * f.porPagina],
  );
}

export interface EvidenciaDetalle {
  id: string;
  nombre: string;
  mime: string;
  tamano: number;
}

export interface ObservacionDetalle extends Omit<FilaObservacion, "evidencias" | "total"> {
  resultado_esperado: string;
  perfil: string;
  es_revalidacion: boolean;
  repetida: boolean;
  evidencias: EvidenciaDetalle[];
}

/** Una ejecución con todo lo que hace falta para revisarla: la prueba, la observación y sus evidencias. */
export async function observacionDetalle(q: Consulta, numero: number): Promise<ObservacionDetalle | null> {
  const [o] = await q<Omit<ObservacionDetalle, "evidencias"> & { evidencias: string }>(
    `select e.id, e.numero, e.prueba_codigo, p.que_probar, p.resultado_esperado, p.perfil, m.codigo as modulo_codigo, m.nombre as modulo,
            e.relevador_nombre, e.creada_at, e.resultado, e.observaciones, e.caso_usado, e.prioridad_sugerida, e.es_revalidacion, e.repetida,
            coalesce(r.clasificacion, 'sin_revisar') as clasificacion, r.revisada_por, i.numero as incidencia_numero,
            coalesce((select json_agg(json_build_object('id', v.id, 'nombre', v.nombre_original, 'mime', v.tipo_mime, 'tamano', v.tamano_bytes)
                                order by v.creada_at, v.nombre_original)
                        from evidencias v where v.ejecucion_id = e.id)::text, '[]') as evidencias
       from ejecuciones e
       join pruebas p on p.codigo = e.prueba_codigo
       join modulos m on m.codigo = p.modulo_codigo
       left join revisiones_observacion r on r.ejecucion_id = e.id
       left join incidencias i on i.id = r.incidencia_id
      where e.numero = $1`,
    [numero],
  );
  return o ? { ...o, evidencias: JSON.parse(o.evidencias) as EvidenciaDetalle[] } : null;
}

export interface EjecucionParaIncidencia {
  id: string;
  prueba_codigo: string;
  que_probar: string;
  resultado_esperado: string;
  modulo: string;
  relevador_nombre: string;
  creada_at: Date;
  resultado: Resultado;
  observaciones: string;
  caso_usado: string;
  prioridad_sugerida: Prioridad | null;
}

export async function ejecucionParaIncidencia(q: Consulta, id: string): Promise<EjecucionParaIncidencia | null> {
  const [e] = await q<EjecucionParaIncidencia>(
    `select e.id, e.prueba_codigo, p.que_probar, p.resultado_esperado, m.nombre as modulo, e.relevador_nombre, e.creada_at,
            e.resultado, e.observaciones, e.caso_usado, e.prioridad_sugerida
       from ejecuciones e join pruebas p on p.codigo = e.prueba_codigo join modulos m on m.codigo = p.modulo_codigo
      where e.id = $1`,
    [id],
  );
  return e ?? null;
}

// ---------------------------------------------------------------------------
// Detalle de una incidencia
// ---------------------------------------------------------------------------

export interface IncidenciaDetalle extends IncidenciaResumen {
  resultado_esperado: string;
  resultado_observado: string;
  solucion_aplicada: string;
  justificacion_descarte: string;
  ejecucion_id: string | null;
  creada_por: string;
  cerrada_at: Date | null;
  perfil: string;
  esperado_catalogo: string;
}

export async function incidenciaPorNumero(q: Consulta, numero: number): Promise<IncidenciaDetalle | null> {
  const [i] = await q<IncidenciaDetalle>(
    `select i.id, i.numero, i.prueba_codigo, p.que_probar, p.perfil, p.resultado_esperado as esperado_catalogo,
            m.codigo as modulo_codigo, m.nombre as modulo, i.descripcion,
            i.reportada_por, i.reportada_at, i.prioridad, i.prioridad_sugerida, i.estado, i.responsable_id, u.nombre as responsable,
            i.creada_at, i.actualizada_at, i.resultado_esperado, i.resultado_observado, i.solucion_aplicada, i.justificacion_descarte,
            i.ejecucion_id, c.nombre as creada_por, i.cerrada_at,
            exists (select 1 from revalidaciones v where v.incidencia_id = i.id and v.ejecucion_id is null and v.cancelada_at is null) as revalidacion_pendiente
       from incidencias i
       join pruebas p on p.codigo = i.prueba_codigo
       join modulos m on m.codigo = p.modulo_codigo
       join usuarios_admin c on c.id = i.creada_por
       left join usuarios_admin u on u.id = i.responsable_id
      where i.numero = $1`,
    [numero],
  );
  return i ?? null;
}

export interface EventoIncidencia {
  id: number;
  tipo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  comentario: string;
  usuario_nombre: string;
  creado_at: Date;
}

export async function eventosIncidencia(q: Consulta, id: string): Promise<EventoIncidencia[]> {
  return q<EventoIncidencia>(
    "select id, tipo, valor_anterior, valor_nuevo, comentario, usuario_nombre, creado_at from incidencia_eventos where incidencia_id = $1 order by creado_at desc, id desc",
    [id],
  );
}

export interface EvidenciaAdmin {
  id: string;
  nombre: string;
  mime: string;
  tamano: number;
  subida_por: string;
  creada_at: Date;
  origen: "relevador" | "equipo";
}

/** Las evidencias de la ejecución que la originó y las que subió el equipo. */
export async function evidenciasIncidencia(q: Consulta, id: string, ejecucionId: string | null): Promise<EvidenciaAdmin[]> {
  return q<EvidenciaAdmin>(
    `select v.id, v.nombre_original as nombre, v.tipo_mime as mime, v.tamano_bytes as tamano, v.subida_por, v.creada_at,
            case when v.incidencia_id is null then 'relevador' else 'equipo' end as origen
       from evidencias v where v.incidencia_id = $1 or ($2::uuid is not null and v.ejecucion_id = $2)
      order by v.creada_at`,
    [id, ejecucionId],
  );
}

// ---------------------------------------------------------------------------
// Relevadores y usuarios
// ---------------------------------------------------------------------------

export interface RelevadorAdmin {
  id: string;
  nombre: string;
  nombre_clave: string;
  creado_at: Date;
  ultimo_ingreso_at: Date;
  sesiones: number;
  ejecuciones: number;
  ultima_ejecucion: Date | null;
  homonimos: number;
}

export async function listarRelevadores(q: Consulta): Promise<RelevadorAdmin[]> {
  return q<RelevadorAdmin>(
    `select r.id, r.nombre, r.nombre_clave, r.creado_at, r.ultimo_ingreso_at,
            (select count(*)::int from sesiones_relevador s where s.relevador_id = r.id) as sesiones,
            (select count(*)::int from ejecuciones e where e.relevador_id = r.id) as ejecuciones,
            (select max(e.creada_at) from ejecuciones e where e.relevador_id = r.id) as ultima_ejecucion,
            (count(*) over (partition by r.nombre_clave))::int as homonimos
       from relevadores r order by r.ultimo_ingreso_at desc`,
  );
}

export interface UsuarioAdminFila {
  id: string;
  usuario: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  debe_cambiar_clave: boolean;
  creado_at: Date;
  ultimo_ingreso_at: Date | null;
  asignadas: number;
  whatsapp: string | null;
  avisos_agente: boolean;
}

export async function listarUsuarios(q: Consulta): Promise<UsuarioAdminFila[]> {
  return q<UsuarioAdminFila>(
    `select u.id, u.usuario, u.nombre, u.rol, u.activo, u.debe_cambiar_clave, u.creado_at, u.ultimo_ingreso_at,
            u.whatsapp, u.avisos_agente,
            (select count(*)::int from incidencias i where i.responsable_id = u.id and i.estado = any($1::text[])) as asignadas
       from usuarios_admin u where not u.es_agente order by u.activo desc, u.nombre`,
    [activos],
  );
}
