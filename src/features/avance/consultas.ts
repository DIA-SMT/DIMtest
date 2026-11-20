// Avance de DIM360 hacia el 100 %, semana a semana. Todo se reconstruye del historial
// (ejecuciones, eventos y trabajos son solo inserción), así que no hace falta guardar fotos.
// Probado en tests/integracion/avance.test.ts.
import type { Consulta } from "@/lib/db";
import { ESTADOS_ABIERTOS } from "@/domain/incidencias";
import type { SemanaAvance } from "@/domain/avance";

const ZONA = "America/Argentina/Tucuman";

/**
 * Una fila por semana (lunes a domingo, hora de Tucumán) desde la primera ejecución hasta la
 * semana en curso, con el estado de las pruebas al cierre (el último resultado de cada una
 * hasta ese momento) y lo que pasó con las incidencias y el agente en la semana.
 */
export async function avanceSemanal(q: Consulta): Promise<SemanaAvance[]> {
  const filas = await q<{
    inicio: string;
    en_curso: boolean;
    total: number;
    funciona: number;
    parcial: number;
    no_funciona: number;
    no_probado: number;
    pasaron: number;
    dejaron: number;
    abiertas: number;
    nuevas: number;
    cerradas: number;
    agente: number;
  }>(
    `with semanas as (
       select to_char(s, 'YYYY-MM-DD') as inicio,
              s at time zone '${ZONA}' as desde,
              (s + interval '1 week') at time zone '${ZONA}' as hasta
         from generate_series(
                date_trunc('week', (select min(creada_at) from ejecuciones) at time zone '${ZONA}'),
                date_trunc('week', now() at time zone '${ZONA}'),
                interval '1 week') s
     ), estado as (
       select w.inicio, p.codigo,
              (select e.resultado from ejecuciones e
                where e.prueba_codigo = p.codigo and e.creada_at < w.hasta
                order by e.creada_at desc, e.numero desc limit 1) as resultado
         from semanas w cross join pruebas p
     ), cambio as (
       select inicio, resultado, lag(resultado) over (partition by codigo order by inicio) as previo from estado
     ), pruebas_semana as (
       select inicio,
              count(*)::int as total,
              count(*) filter (where resultado = 'funciona')::int as funciona,
              count(*) filter (where resultado = 'parcial')::int as parcial,
              count(*) filter (where resultado = 'no_funciona')::int as no_funciona,
              count(*) filter (where resultado = 'no_probado')::int as no_probado,
              count(*) filter (where resultado = 'funciona' and previo is distinct from 'funciona')::int as pasaron,
              count(*) filter (where previo = 'funciona' and resultado <> 'funciona')::int as dejaron
         from cambio group by inicio
     )
     select w.inicio, w.hasta > now() as en_curso, ps.total, ps.funciona, ps.parcial, ps.no_funciona, ps.no_probado, ps.pasaron, ps.dejaron,
            (select count(*)::int from incidencias i
              where i.creada_at < w.hasta
                and coalesce((select ev.valor_nuevo from incidencia_eventos ev
                               where ev.incidencia_id = i.id and ev.tipo = 'estado' and ev.creado_at < w.hasta
                               order by ev.creado_at desc, ev.id desc limit 1), 'reportada') = any($1::text[])) as abiertas,
            (select count(*)::int from incidencias i where i.creada_at >= w.desde and i.creada_at < w.hasta) as nuevas,
            (select count(*)::int from incidencia_eventos ev
              where ev.tipo = 'estado' and ev.valor_nuevo = 'cerrada' and ev.creado_at >= w.desde and ev.creado_at < w.hasta) as cerradas,
            (select count(*)::int from trabajos_agente t
              where t.resultado in ('desplegado', 'ya_resuelto') and t.terminado_at >= w.desde and t.terminado_at < w.hasta) as agente
       from semanas w join pruebas_semana ps on ps.inicio = w.inicio
      order by w.inicio`,
    [[...ESTADOS_ABIERTOS]],
  );
  return filas.map((f) => ({
    inicio: f.inicio,
    enCurso: f.en_curso,
    total: f.total,
    funciona: f.funciona,
    parcial: f.parcial,
    noFunciona: f.no_funciona,
    noProbado: f.no_probado,
    pasaronAFuncionar: f.pasaron,
    dejaronDeFuncionar: f.dejaron,
    incidenciasAbiertas: f.abiertas,
    incidenciasNuevas: f.nuevas,
    incidenciasCerradas: f.cerradas,
    correccionesAgente: f.agente,
  }));
}

/** Pruebas que hoy no funcionan pero ya tienen una corrección esperando que la DIM la vuelva a probar. */
export async function enCaminoAFuncionar(q: Consulta): Promise<number> {
  const [r] = await q<{ n: number }>(
    `select count(distinct v.prueba_codigo)::int as n
       from revalidaciones v
      where v.ejecucion_id is null and v.cancelada_at is null
        and coalesce((select e.resultado from ejecuciones e where e.prueba_codigo = v.prueba_codigo
                       order by e.creada_at desc, e.numero desc limit 1), '') <> 'funciona'`,
  );
  return r?.n ?? 0;
}
