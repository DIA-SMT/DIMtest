// Estado de una prueba en el portal de relevamiento, para no duplicar trabajo.
export const ESTADOS_PRUEBA = ["sin_realizar", "en_ejecucion", "realizada", "revalidar"] as const;
export type EstadoPrueba = (typeof ESTADOS_PRUEBA)[number];

export const NOMBRE_ESTADO_PRUEBA: Record<EstadoPrueba, string> = {
  sin_realizar: "Sin realizar",
  en_ejecucion: "En ejecución",
  realizada: "Realizada",
  revalidar: "Requiere nueva validación",
};

export interface DatosEstado {
  tieneEjecucion: boolean;
  /** Hay una reserva vigente (de esta persona o de otra). */
  reservaVigente: boolean;
  revalidacionPendiente: boolean;
}

/**
 * Si alguien la está probando, eso manda (evita que dos trabajen en lo mismo).
 * Después, un pedido de revalidación del equipo; después, si ya tiene resultado.
 */
export function estadoPrueba(d: DatosEstado): EstadoPrueba {
  if (d.reservaVigente) return "en_ejecucion";
  if (d.revalidacionPendiente) return "revalidar";
  if (d.tieneEjecucion) return "realizada";
  return "sin_realizar";
}

/** Lo que conviene tomar primero: sin hacer o pedido de nuevo por el equipo. */
export function estaDisponible(estado: EstadoPrueba): boolean {
  return estado === "sin_realizar" || estado === "revalidar";
}
