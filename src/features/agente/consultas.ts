// Correcciones del agente Claude (D-015): todo lo que terminó, con cómo salió la
// revalidación que pidió al publicar. Solo lectura; probado en tests/integracion/correcciones.test.ts.
import type { Consulta } from "@/lib/db";
import type { CierreAgente, RevalidacionAgente } from "@/domain/agente";
import type { EstadoIncidencia } from "@/domain/incidencias";
import type { Prioridad } from "@/domain/prioridades";
import type { Resultado } from "@/domain/resultados";
import { patronBusqueda, SIN_TILDES } from "@/features/admin/consultas";

export interface FiltrosCorrecciones {
  cierres?: CierreAgente[];
  revalidacion?: RevalidacionAgente;
  modulo?: string;
  prioridad?: Prioridad;
  busqueda?: string;
  pagina: number;
  porPagina: number;
}

export interface FilaCorreccion {
  numero: number;
  cierre: CierreAgente;
  origen: "manual" | "automatico";
  pedido_por: string;
  pedido_at: Date;
  tomado_at: Date | null;
  terminado_at: Date;
  resumen: string;
  enlaces: { texto: string; url: string }[];
  incidencia_numero: number;
  incidencia_estado: EstadoIncidencia;
  prioridad: Prioridad;
  prueba_codigo: string;
  que_probar: string;
  modulo: string;
  revalidacion: RevalidacionAgente | null;
  revalidacion_pedida_at: Date | null;
  revalidacion_resuelta_at: Date | null;
  revalidacion_resultado: Resultado | null;
  revalidacion_relevador: string | null;
  total: number;
}

/**
 * Un trabajo terminado (o fallido) con su incidencia, su prueba y la revalidación que se pidió
 * al publicar: la primera de esa incidencia desde que el agente terminó (se crean en la misma
 * transacción, así que comparten la hora).
 */
const CORRECCIONES = `
  select t.numero, coalesce(t.resultado, 'fallido') as cierre, t.origen, t.pedido_por, t.pedido_at, t.tomado_at, t.terminado_at,
         t.resumen, t.enlaces,
         i.numero as incidencia_numero, i.estado as incidencia_estado, i.prioridad, i.prueba_codigo, i.descripcion,
         p.que_probar, m.codigo as modulo_codigo, m.nombre as modulo,
         case when v.id is null then null
              when v.cancelada_at is not null then 'cancelada'
              when v.ejecucion_id is null then 'pendiente'
              when e.resultado = 'funciona' then 'confirmada'
              when e.resultado = 'no_probado' then 'sin_probar'
              else 'volvio_a_fallar' end as revalidacion,
         v.solicitada_at as revalidacion_pedida_at, v.resuelta_at as revalidacion_resuelta_at,
         e.resultado as revalidacion_resultado, e.relevador_nombre as revalidacion_relevador
    from trabajos_agente t
    join incidencias i on i.id = t.incidencia_id
    join pruebas p on p.codigo = i.prueba_codigo
    join modulos m on m.codigo = p.modulo_codigo
    left join lateral (
      select r.* from revalidaciones r
       where t.resultado in ('desplegado', 'ya_resuelto') and r.incidencia_id = t.incidencia_id and r.solicitada_at >= t.terminado_at
       order by r.solicitada_at limit 1
    ) v on true
    left join ejecuciones e on e.id = v.ejecucion_id
   where t.estado in ('terminado', 'fallido')`;

export async function listarCorrecciones(q: Consulta, f: FiltrosCorrecciones): Promise<FilaCorreccion[]> {
  return q<FilaCorreccion>(
    `with c as (${CORRECCIONES})
     select c.*, (count(*) over ())::int as total
       from c
      where ($1::text[] is null or c.cierre = any($1::text[]))
        and ($2::text is null or c.revalidacion = $2)
        and ($3::text is null or c.modulo_codigo = $3)
        and ($4::text is null or c.prioridad = $4)
        and ($5::text is null or ${SIN_TILDES("c.resumen")} like $5 or ${SIN_TILDES("c.descripcion")} like $5
             or lower(c.prueba_codigo) like $5 or ${SIN_TILDES("c.que_probar")} like $5
             or ('inc-' || lpad(c.incidencia_numero::text, 4, '0')) like $5
             or exists (select 1 from jsonb_array_elements(c.enlaces) x where lower(x->>'texto') like $5 or lower(x->>'url') like $5))
      order by c.terminado_at desc, c.numero desc
      limit $6 offset $7`,
    [f.cierres ?? null, f.revalidacion ?? null, f.modulo ?? null, f.prioridad ?? null, patronBusqueda(f.busqueda), f.porPagina, (f.pagina - 1) * f.porPagina],
  );
}

export interface ResumenCorrecciones {
  publicadas: number;
  confirmadas: number;
  volvieron_a_fallar: number;
  por_revalidar: number;
  para_revisar: number;
  necesitan_persona: number;
  fallidas: number;
}

/** Los números de arriba de la página: sobre todo lo que hizo el agente, sin filtros. */
export async function resumenCorrecciones(q: Consulta): Promise<ResumenCorrecciones> {
  const [r] = await q<ResumenCorrecciones>(
    `with c as (${CORRECCIONES})
     select count(*) filter (where cierre in ('desplegado', 'ya_resuelto'))::int as publicadas,
            count(*) filter (where revalidacion = 'confirmada')::int as confirmadas,
            count(*) filter (where revalidacion = 'volvio_a_fallar')::int as volvieron_a_fallar,
            count(*) filter (where revalidacion = 'pendiente')::int as por_revalidar,
            count(*) filter (where cierre = 'pr_abierto')::int as para_revisar,
            count(*) filter (where cierre in ('requiere_ok', 'bloqueado'))::int as necesitan_persona,
            count(*) filter (where cierre = 'fallido')::int as fallidas
       from c`,
  );
  return r!;
}

export interface FilaCola {
  numero: number;
  estado: "pendiente" | "en_curso";
  origen: "manual" | "automatico";
  pedido_por: string;
  pedido_at: Date;
  tomado_at: Date | null;
  latido_at: Date | null;
  incidencia_numero: number;
  prioridad: Prioridad;
  prueba_codigo: string;
  que_probar: string;
  modulo: string;
  ultimo_avance: string | null;
  ultimo_avance_at: Date | null;
}

/**
 * Lo que espera el agente, en el orden en que lo va a tomar (el mismo de tomarTrabajo:
 * prioridad y después antigüedad del pedido). Lo que está en curso va primero, con su
 * último aviso de avance.
 */
export async function colaAgente(q: Consulta): Promise<FilaCola[]> {
  return q<FilaCola>(
    `select t.numero, t.estado, t.origen, t.pedido_por, t.pedido_at, t.tomado_at, t.latido_at,
            i.numero as incidencia_numero, i.prioridad, i.prueba_codigo, p.que_probar, m.nombre as modulo,
            a.comentario as ultimo_avance, a.creado_at as ultimo_avance_at
       from trabajos_agente t
       join incidencias i on i.id = t.incidencia_id
       join pruebas p on p.codigo = i.prueba_codigo
       join modulos m on m.codigo = p.modulo_codigo
       left join lateral (
         select e.comentario, e.creado_at from incidencia_eventos e
          where t.estado = 'en_curso' and e.incidencia_id = t.incidencia_id and e.tipo = 'agente'
            and e.valor_nuevo = 'avance' and e.creado_at >= t.tomado_at
          order by e.creado_at desc, e.id desc limit 1
       ) a on true
      where t.estado in ('pendiente', 'en_curso')
      order by (t.estado = 'en_curso') desc, i.prioridad, t.pedido_at, t.numero`,
  );
}
