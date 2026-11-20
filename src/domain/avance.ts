// Avance de DIM360 hacia el 100 %: cuántas de las pruebas del checklist funcionan, semana a semana.

/** Cómo estaba el sistema al cierre de una semana (lunes a domingo, hora de Tucumán). */
export interface SemanaAvance {
  /** Lunes de la semana, AAAA-MM-DD. */
  inicio: string;
  /** La semana en curso (cierra en el futuro): sus números son «hasta hoy». */
  enCurso: boolean;
  total: number;
  funciona: number;
  parcial: number;
  noFunciona: number;
  noProbado: number;
  /** Pruebas que al cierre funcionaban y al cierre anterior no (o no estaban probadas). */
  pasaronAFuncionar: number;
  /** Pruebas que al cierre anterior funcionaban y ahora no. */
  dejaronDeFuncionar: number;
  incidenciasAbiertas: number;
  incidenciasNuevas: number;
  incidenciasCerradas: number;
  correccionesAgente: number;
}

export interface Estimacion {
  /** Pruebas que se suman a «funciona» por semana (neto), en las semanas consideradas. */
  ritmo: number;
  /** Semanas consideradas para el ritmo. */
  semanas: number;
  /** Semanas que faltarían a ese ritmo. Null si no se puede estimar. */
  semanasRestantes: number | null;
}

/**
 * Al ritmo de las últimas `ventana` semanas, ¿cuánto falta para que funcionen todas? Hace falta
 * al menos una semana de diferencia y un ritmo positivo; si no, no se estima.
 */
export function estimarSemanas(semanas: readonly SemanaAvance[], ventana = 4): Estimacion | null {
  if (semanas.length < 2) return null;
  const ultima = semanas.at(-1)!;
  const desde = semanas[Math.max(0, semanas.length - 1 - ventana)]!;
  const intervalo = semanas.length - 1 - semanas.indexOf(desde);
  const ritmo = (ultima.funciona - desde.funciona) / intervalo;
  const faltan = ultima.total - ultima.funciona;
  return {
    ritmo: Math.round(ritmo * 10) / 10,
    semanas: intervalo,
    semanasRestantes: faltan === 0 ? 0 : ritmo > 0 ? Math.ceil(faltan / ritmo) : null,
  };
}

/** Cambio de una semana a la anterior en pruebas que funcionan. Null en la primera semana. */
export function cambioSemanal(semanas: readonly SemanaAvance[], k: number): number | null {
  return k > 0 ? semanas[k]!.funciona - semanas[k - 1]!.funciona : null;
}
