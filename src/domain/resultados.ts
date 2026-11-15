// Los cuatro resultados del checklist original (PDF, «Qué significa cada casilla»).
export const RESULTADOS = ["funciona", "no_funciona", "parcial", "no_probado"] as const;
export type Resultado = (typeof RESULTADOS)[number];

export const NOMBRE_RESULTADO: Record<Resultado, string> = {
  funciona: "Funciona",
  no_funciona: "No funciona",
  parcial: "Parcial",
  no_probado: "No probado",
};

export const AYUDA_RESULTADO: Record<Resultado, string> = {
  funciona: "Se hizo la prueba y el resultado coincide con el esperado y con lo que muestra el sistema de origen.",
  no_funciona: "Da error, no deja hacerlo o el resultado no es el correcto. Anotá el caso y lo que se vio.",
  parcial: "Funciona con algunos casos y con otros no, o falta una parte del resultado. Anotá cuál.",
  no_probado: "No se pudo probar (falta de datos, permisos o tiempo) o la DIM no lo usa. Anotá el motivo.",
};

/** Qué tiene que explicar el relevador según el resultado. */
export const PEDIDO_EXPLICACION: Record<Resultado, string> = {
  funciona: "Observaciones (opcional)",
  no_funciona: "¿Qué pasó? Contá el error o lo que se vio",
  parcial: "¿Qué parte funciona y cuál no?",
  no_probado: "¿Por qué no se pudo probar?",
};

export function esResultado(valor: unknown): valor is Resultado {
  return typeof valor === "string" && (RESULTADOS as readonly string[]).includes(valor);
}

/** Fallida, parcial o no probada: la explicación es obligatoria (también lo exige la base). */
export function requiereExplicacion(resultado: Resultado): boolean {
  return resultado !== "funciona";
}

/** Resultados que pueden originar una incidencia y admiten prioridad sugerida. */
export function admitePrioridad(resultado: Resultado): boolean {
  return resultado === "no_funciona" || resultado === "parcial";
}
