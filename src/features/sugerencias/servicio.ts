// Sugerencias de los relevadores (D-017). Funciones sobre `q` (una transacción), probadas en
// tests/integracion/sugerencias.test.ts. Nunca se loguea el texto: solo número, tipo y estado.
import type { Consulta } from "@/lib/db";
import {
  esEstadoSugerencia,
  problemaRespuesta,
  SUGERENCIAS_POR_HORA,
  type EstadoSugerencia,
  type TipoSugerencia,
} from "@/domain/sugerencias";
import { ErrorDominio } from "@/lib/errores";
import { auditar, type Actor } from "@/features/incidencias/servicio";

export interface NuevaSugerencia {
  tipo: TipoSugerencia;
  moduloCodigo: string | null;
  titulo: string;
  detalle: string;
}

/** La escribe un relevador desde el portal. */
export async function crearSugerencia(q: Consulta, relevador: { relevadorId: string; nombre: string }, s: NuevaSugerencia): Promise<number> {
  const [{ n }] = await q<{ n: number }>(
    "select count(*)::int as n from sugerencias where relevador_id = $1 and creada_at > now() - interval '1 hour'",
    [relevador.relevadorId],
  );
  if (n >= SUGERENCIAS_POR_HORA) throw new ErrorDominio("sugerencias_limite");
  if (s.moduloCodigo) {
    const [m] = await q("select 1 from modulos where codigo = $1", [s.moduloCodigo]);
    if (!m) throw new ErrorDominio("modulo_inexistente");
  }
  const [fila] = await q<{ numero: number }>(
    `insert into sugerencias (relevador_id, relevador_nombre, tipo, modulo_codigo, titulo, detalle)
     values ($1, $2, $3, $4, $5, $6) returning numero`,
    [relevador.relevadorId, relevador.nombre, s.tipo, s.moduloCodigo, s.titulo.trim(), s.detalle.trim()],
  );
  return fila.numero;
}

export interface SugerenciaPropia {
  numero: number;
  tipo: TipoSugerencia;
  modulo: string | null;
  titulo: string;
  detalle: string;
  estado: EstadoSugerencia;
  respuesta: string;
  respondidaAt: Date | null;
  creadaAt: Date;
}

/** Las que escribió un relevador, las más nuevas primero (las ve en el portal con la respuesta del equipo). */
export async function sugerenciasDeRelevador(q: Consulta, relevadorId: string): Promise<SugerenciaPropia[]> {
  const filas = await q<{
    numero: number;
    tipo: TipoSugerencia;
    modulo: string | null;
    titulo: string;
    detalle: string;
    estado: EstadoSugerencia;
    respuesta: string;
    respondida_at: Date | null;
    creada_at: Date;
  }>(
    `select s.numero, s.tipo, m.nombre as modulo, s.titulo, s.detalle, s.estado, s.respuesta, s.respondida_at, s.creada_at
       from sugerencias s left join modulos m on m.codigo = s.modulo_codigo
      where s.relevador_id = $1
      order by s.creada_at desc, s.numero desc`,
    [relevadorId],
  );
  return filas.map((f) => ({
    numero: f.numero,
    tipo: f.tipo,
    modulo: f.modulo,
    titulo: f.titulo,
    detalle: f.detalle,
    estado: f.estado,
    respuesta: f.respuesta,
    respondidaAt: f.respondida_at,
    creadaAt: f.creada_at,
  }));
}

/**
 * El equipo cambia el estado y le contesta al relevador. La respuesta reemplaza a la anterior
 * (es lo que ve el relevador); el cambio queda en la auditoría.
 */
export async function responderSugerencia(q: Consulta, actor: Actor, numero: number, d: { estado: string; respuesta: string }) {
  if (!esEstadoSugerencia(d.estado)) throw new ErrorDominio("transicion_invalida");
  const respuesta = d.respuesta.trim();
  if (problemaRespuesta(d.estado, respuesta)) throw new ErrorDominio("falta_respuesta_sugerencia");
  const [antes] = await q<{ id: string; estado: EstadoSugerencia; respuesta: string }>(
    "select id, estado, respuesta from sugerencias where numero = $1 for update",
    [numero],
  );
  if (!antes) throw new ErrorDominio("sugerencia_inexistente");
  const cambiaRespuesta = respuesta !== antes.respuesta;
  await q(
    `update sugerencias
        set estado = $2, respuesta = $3,
            respondida_por = case when $4 then $5 else respondida_por end,
            respondida_at = case when $4 then now() else respondida_at end
      where id = $1`,
    [antes.id, d.estado, respuesta, cambiaRespuesta, actor.nombre],
  );
  await auditar(q, actor, "sugerencia.respondida", { numero, estado_anterior: antes.estado, estado: d.estado, respuesta: cambiaRespuesta });
}
