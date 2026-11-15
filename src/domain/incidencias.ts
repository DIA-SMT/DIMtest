// Ciclo de vida de una incidencia. El estado de la incidencia NO es el resultado de la
// prueba: marcarla como corregida no cambia ningún resultado, pide una nueva validación.

export const ESTADOS_INCIDENCIA = [
  "reportada",
  "en_analisis",
  "pendiente_correccion",
  "en_correccion",
  "corregida",
  "cerrada",
  "reabierta",
  "descartada",
] as const;
export type EstadoIncidencia = (typeof ESTADOS_INCIDENCIA)[number];

export const NOMBRE_ESTADO: Record<EstadoIncidencia, string> = {
  reportada: "Reportada",
  en_analisis: "En análisis",
  pendiente_correccion: "Pendiente de corrección",
  en_correccion: "En corrección",
  corregida: "Corregida, pendiente de validar",
  cerrada: "Validada y cerrada",
  reabierta: "Reabierta",
  descartada: "Descartada",
};

/** Sin resolver: alguien del equipo tiene que hacer algo. */
export const ESTADOS_ABIERTOS: readonly EstadoIncidencia[] = [
  "reportada",
  "en_analisis",
  "pendiente_correccion",
  "en_correccion",
  "reabierta",
];
/** Todavía no terminó: abiertas más las corregidas que esperan la validación. */
export const ESTADOS_ACTIVOS: readonly EstadoIncidencia[] = [...ESTADOS_ABIERTOS, "corregida"];
export const ESTADOS_FINALES: readonly EstadoIncidencia[] = ["cerrada", "descartada"];

export function esEstadoIncidencia(v: unknown): v is EstadoIncidencia {
  return typeof v === "string" && (ESTADOS_INCIDENCIA as readonly string[]).includes(v);
}
export const estaAbierta = (e: EstadoIncidencia) => ESTADOS_ABIERTOS.includes(e);
export const estaActiva = (e: EstadoIncidencia) => ESTADOS_ACTIVOS.includes(e);

/** Qué hace falta escribir para pasar a cada estado. */
export type Requisito = "solucion" | "justificacion" | "comentario" | null;

interface Accion {
  etiqueta: string;
  ayuda: string;
  requiere: Requisito;
}

/** La acción que lleva a cada estado, como se muestra en la ficha de la incidencia. */
export const ACCION_HACIA: Record<EstadoIncidencia, Accion> = {
  reportada: { etiqueta: "Reportada", ayuda: "", requiere: null },
  en_analisis: { etiqueta: "Pasar a análisis", ayuda: "El equipo la está revisando.", requiere: null },
  pendiente_correccion: {
    etiqueta: "Confirmar que hay que corregir",
    ayuda: "Es un problema real y queda en la fila de correcciones.",
    requiere: null,
  },
  en_correccion: { etiqueta: "Empezar la corrección", ayuda: "Alguien del equipo la está corrigiendo.", requiere: null },
  corregida: {
    etiqueta: "Marcar como corregida y enviar a revalidación",
    ayuda: "Registrá la solución. La prueba vuelve al relevamiento para que la DIM la valide; el resultado original no cambia.",
    requiere: "solucion",
  },
  cerrada: {
    etiqueta: "Cerrar: la validación fue satisfactoria",
    ayuda: "Después de que la nueva prueba confirme que funciona. Si no hubo revalidación, explicá por qué se cierra.",
    requiere: null,
  },
  reabierta: { etiqueta: "Reabrir: el error continúa", ayuda: "Contá qué sigue fallando.", requiere: "comentario" },
  descartada: {
    etiqueta: "Descartar",
    ayuda: "No es un error o no corresponde corregirlo. La justificación es obligatoria.",
    requiere: "justificacion",
  },
};

const TRANSICIONES: Record<EstadoIncidencia, readonly EstadoIncidencia[]> = {
  reportada: ["en_analisis", "pendiente_correccion", "descartada"],
  en_analisis: ["pendiente_correccion", "en_correccion", "descartada"],
  pendiente_correccion: ["en_correccion", "en_analisis", "descartada"],
  en_correccion: ["corregida", "pendiente_correccion"],
  corregida: ["cerrada", "reabierta"],
  cerrada: ["reabierta"],
  reabierta: ["en_analisis", "pendiente_correccion", "en_correccion", "descartada"],
  descartada: ["reabierta"],
};

export function transicionesDesde(estado: EstadoIncidencia): readonly EstadoIncidencia[] {
  return TRANSICIONES[estado];
}

export interface PedidoTransicion {
  desde: EstadoIncidencia;
  hacia: EstadoIncidencia;
  comentario?: string;
  solucion?: string;
  justificacion?: string;
  /** Resultado de la última revalidación de esta incidencia, si hubo. */
  ultimaRevalidacion?: "funciona" | "no_funciona" | "parcial" | "no_probado" | null;
}

/** Clave de error estable (src/lib/errores.ts) o null si la transición vale. */
export function validarTransicion(p: PedidoTransicion): string | null {
  if (p.desde === p.hacia) return "transicion_invalida";
  if (!TRANSICIONES[p.desde].includes(p.hacia)) return "transicion_invalida";
  const requisito = ACCION_HACIA[p.hacia].requiere;
  if (requisito === "solucion" && !p.solucion?.trim()) return "falta_solucion";
  if (requisito === "justificacion" && !p.justificacion?.trim()) return "falta_justificacion";
  if (requisito === "comentario" && !p.comentario?.trim()) return "falta_comentario";
  // Cerrar sin una revalidación satisfactoria exige dejar asentado por qué.
  if (p.hacia === "cerrada" && p.ultimaRevalidacion !== "funciona" && !p.comentario?.trim()) return "cierre_sin_validacion";
  return null;
}

/** ¿Pasar a este estado abre un pedido de revalidación de la prueba? */
export const pideRevalidacion = (hacia: EstadoIncidencia) => hacia === "corregida";
/** ¿Pasar a este estado cancela los pedidos de revalidación pendientes? */
export const cancelaRevalidacion = (hacia: EstadoIncidencia) =>
  hacia === "cerrada" || hacia === "descartada" || hacia === "reabierta";
