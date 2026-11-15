export const PRIORIDADES = ["P0", "P1", "P2", "P3"] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const NOMBRE_PRIORIDAD: Record<Prioridad, string> = {
  P0: "Crítica",
  P1: "Alta",
  P2: "Media",
  P3: "Baja",
};

export const AYUDA_PRIORIDAD: Record<Prioridad, string> = {
  P0: "Bloquea la operación o da un resultado económico incorrecto.",
  P1: "Afecta una función importante y no hay alternativa razonable.",
  P2: "Afecta una función, pero hay una alternativa o pasa en pocos casos.",
  P3: "Detalle menor, sin impacto en el resultado.",
};

export function esPrioridad(valor: unknown): valor is Prioridad {
  return typeof valor === "string" && (PRIORIDADES as readonly string[]).includes(valor);
}

/** P0 antes que P3. */
export function compararPrioridad(a: Prioridad, b: Prioridad) {
  return PRIORIDADES.indexOf(a) - PRIORIDADES.indexOf(b);
}

/** La más urgente de una lista, o null. */
export function prioridadMaxima(lista: readonly Prioridad[]): Prioridad | null {
  return lista.length ? [...lista].sort(compararPrioridad)[0] : null;
}

/** «P1 · Alta» */
export const etiquetaPrioridad = (p: Prioridad) => `${p} · ${NOMBRE_PRIORIDAD[p]}`;
