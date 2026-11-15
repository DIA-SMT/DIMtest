// Fechas siempre en hora de Tucumán, sin depender de la zona de la máquina.
const ZONA = "America/Argentina/Tucuman";

const FECHA = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" });
const FECHA_HORA = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const HORA = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const ISO_DIA = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

type Fecha = Date | string | number;
const aDate = (f: Fecha) => (f instanceof Date ? f : new Date(f));

/** 15/03/2026 */
export const fecha = (f: Fecha) => FECHA.format(aDate(f));
/** 15/03/2026 14:05 */
export const fechaHora = (f: Fecha) => FECHA_HORA.format(aDate(f)).replace(",", "");
/** 14:05 */
export const hora = (f: Fecha) => HORA.format(aDate(f));
/** 2026-03-15 (día de Tucumán), para inputs date y nombres de archivo. */
export const diaIso = (f: Fecha) => ISO_DIA.format(aDate(f));

/** Inicio del día (00:00 de Tucumán, UTC-3 sin horario de verano) de un AAAA-MM-DD. */
export function inicioDelDia(dia: string): Date {
  return new Date(`${dia}T00:00:00-03:00`);
}

/** «hace 5 min», «hace 3 h», «hace 2 días»: para la antigüedad de una incidencia. */
export function antiguedad(desde: Fecha, ahora: Date = new Date()): string {
  const ms = ahora.getTime() - aDate(desde).getTime();
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

/** Días completos transcurridos (para ordenar y para los informes). */
export function diasDesde(desde: Fecha, ahora: Date = new Date()): number {
  return Math.max(0, Math.floor((ahora.getTime() - aDate(desde).getTime()) / 86_400_000));
}
