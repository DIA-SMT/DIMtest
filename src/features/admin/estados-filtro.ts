import { ESTADOS_ABIERTOS, ESTADOS_ACTIVOS, ESTADOS_INCIDENCIA, NOMBRE_ESTADO, esEstadoIncidencia, type EstadoIncidencia } from "@/domain/incidencias";

/** Grupos de estado para los filtros, además de cada estado suelto. */
export function estadosDeFiltro(valor: string | undefined): EstadoIncidencia[] | undefined {
  if (valor === "abiertas") return [...ESTADOS_ABIERTOS];
  if (valor === "activas") return [...ESTADOS_ACTIVOS];
  if (esEstadoIncidencia(valor)) return [valor];
  return undefined;
}

export const OPCIONES_ESTADO = [
  { valor: "activas", etiqueta: "Activas (sin cerrar)" },
  { valor: "abiertas", etiqueta: "Abiertas (sin corregir)" },
  ...ESTADOS_INCIDENCIA.map((e) => ({ valor: e, etiqueta: NOMBRE_ESTADO[e] })),
];
