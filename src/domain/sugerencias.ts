// Sugerencias de los relevadores (D-017): qué le falta a DIM360 según quienes lo usan.

export const TIPOS_SUGERENCIA = ["nueva_funcion", "mejora", "otra"] as const;
export type TipoSugerencia = (typeof TIPOS_SUGERENCIA)[number];

export const NOMBRE_TIPO_SUGERENCIA: Record<TipoSugerencia, string> = {
  nueva_funcion: "Función nueva",
  mejora: "Mejora de algo que ya existe",
  otra: "Otra idea",
};

/** La ayuda de cada tipo en el formulario del portal. */
export const AYUDA_TIPO_SUGERENCIA: Record<TipoSugerencia, string> = {
  nueva_funcion: "Algo que DIM360 no hace y te haría falta en tu trabajo.",
  mejora: "Algo que ya está pero se podría hacer más simple, más rápido o más claro.",
  otra: "Cualquier otra cosa que quieras que sepamos.",
};

export const ESTADOS_SUGERENCIA = ["nueva", "en_evaluacion", "planificada", "hecha", "descartada"] as const;
export type EstadoSugerencia = (typeof ESTADOS_SUGERENCIA)[number];

/** Cómo lo ve el equipo en el panel. */
export const NOMBRE_ESTADO_SUGERENCIA: Record<EstadoSugerencia, string> = {
  nueva: "Nueva",
  en_evaluacion: "En evaluación",
  planificada: "Planificada",
  hecha: "Hecha",
  descartada: "Descartada",
};

/** Cómo lo ve el relevador en el portal. */
export const ESTADO_SUGERENCIA_RELEVADOR: Record<EstadoSugerencia, string> = {
  nueva: "Recibida",
  en_evaluacion: "La estamos evaluando",
  planificada: "Se va a hacer",
  hecha: "Ya está hecha",
  descartada: "Por ahora no",
};

export const TITULO_SUGERENCIA_MAX = 120;
export const DETALLE_SUGERENCIA_MAX = 2000;
export const RESPUESTA_SUGERENCIA_MAX = 2000;
/** Cuántas puede mandar una persona por hora: frena un formulario enviado de más, no a quien tiene ideas. */
export const SUGERENCIAS_POR_HORA = 10;

export function esTipoSugerencia(v: unknown): v is TipoSugerencia {
  return typeof v === "string" && (TIPOS_SUGERENCIA as readonly string[]).includes(v);
}

export function esEstadoSugerencia(v: unknown): v is EstadoSugerencia {
  return typeof v === "string" && (ESTADOS_SUGERENCIA as readonly string[]).includes(v);
}

/** Las que el equipo todavía tiene que mirar o resolver. */
export const ESTADOS_SUGERENCIA_ABIERTOS: readonly EstadoSugerencia[] = ["nueva", "en_evaluacion", "planificada"];

/** Pasar a «Descartada» exige explicarle al relevador por qué. */
export function problemaRespuesta(estado: EstadoSugerencia, respuesta: string): string | null {
  if (respuesta.length > RESPUESTA_SUGERENCIA_MAX) return `Hasta ${RESPUESTA_SUGERENCIA_MAX} caracteres.`;
  if (estado === "descartada" && !respuesta.trim()) return "Contale a quien la propuso por qué no va por ahora.";
  return null;
}
