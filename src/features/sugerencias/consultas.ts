// Lo que ve el equipo en Panel → Sugerencias. Probado en tests/integracion/sugerencias.test.ts.
import type { Consulta } from "@/lib/db";
import { patronBusqueda, SIN_TILDES } from "@/features/admin/consultas";
import { ESTADOS_SUGERENCIA_ABIERTOS, type EstadoSugerencia, type TipoSugerencia } from "@/domain/sugerencias";

export interface FiltrosSugerencias {
  /** Un estado, o «abiertas» (nueva, en evaluación y planificada). */
  estado?: EstadoSugerencia | "abiertas";
  tipo?: TipoSugerencia;
  modulo?: string;
  busqueda?: string;
  pagina: number;
  porPagina: number;
}

export interface FilaSugerencia {
  id: string;
  numero: number;
  relevador_id: string;
  relevador_nombre: string;
  tipo: TipoSugerencia;
  modulo_codigo: string | null;
  modulo: string | null;
  titulo: string;
  detalle: string;
  estado: EstadoSugerencia;
  respuesta: string;
  respondida_por: string | null;
  respondida_at: Date | null;
  creada_at: Date;
  total: number;
}

export async function listarSugerencias(q: Consulta, f: FiltrosSugerencias): Promise<FilaSugerencia[]> {
  const patron = patronBusqueda(f.busqueda);
  const estados = f.estado === "abiertas" ? [...ESTADOS_SUGERENCIA_ABIERTOS] : f.estado ? [f.estado] : null;
  return q<FilaSugerencia>(
    `select s.id, s.numero, s.relevador_id, s.relevador_nombre, s.tipo, s.modulo_codigo, m.nombre as modulo,
            s.titulo, s.detalle, s.estado, s.respuesta, s.respondida_por, s.respondida_at, s.creada_at,
            count(*) over ()::int as total
       from sugerencias s left join modulos m on m.codigo = s.modulo_codigo
      where ($1::text[] is null or s.estado = any($1::text[]))
        and ($2::text is null or s.tipo = $2)
        and ($3::text is null or s.modulo_codigo = $3)
        and ($4::text is null or ${SIN_TILDES("s.titulo || ' ' || s.detalle || ' ' || s.relevador_nombre || ' ' || coalesce(m.nombre, '')")} like $4
             or 'sug-' || lpad(s.numero::text, 4, '0') like $4)
      order by (s.estado = 'nueva') desc, s.creada_at desc, s.numero desc
      limit $5 offset $6`,
    [estados, f.tipo ?? null, f.modulo ?? null, patron, f.porPagina, (f.pagina - 1) * f.porPagina],
  );
}

export interface ResumenSugerencias {
  total: number;
  nuevas: number;
  en_evaluacion: number;
  planificadas: number;
  hechas: number;
  descartadas: number;
  relevadores: number;
}

export async function resumenSugerencias(q: Consulta): Promise<ResumenSugerencias> {
  const [r] = await q<ResumenSugerencias>(
    `select count(*)::int as total,
            count(*) filter (where estado = 'nueva')::int as nuevas,
            count(*) filter (where estado = 'en_evaluacion')::int as en_evaluacion,
            count(*) filter (where estado = 'planificada')::int as planificadas,
            count(*) filter (where estado = 'hecha')::int as hechas,
            count(*) filter (where estado = 'descartada')::int as descartadas,
            count(distinct relevador_id)::int as relevadores
       from sugerencias`,
  );
  return r;
}
