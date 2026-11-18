// Lo que ve un relevador cuando el equipo (o el agente) corrigió algo y le pide volver a probarlo.

/**
 * La solución aplicada, en el idioma del relevador: sin enlaces a GitHub ni direcciones
 * (son internas del equipo) y cortada en una frase razonable. Vacío si no queda nada.
 */
export function solucionParaRelevador(texto: string | null | undefined, largo = 280): string {
  const limpio = (texto ?? "")
    // «(PR #12: https://…)» o «(PR #12: https://… · PR #3: https://…)», como los deja el agente.
    .replace(/\s*\([^()]*https?:\/\/[^()]*\)/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (limpio.length <= largo) return limpio;
  const corte = limpio.slice(0, largo);
  const espacio = corte.lastIndexOf(" ");
  return `${(espacio > largo * 0.6 ? corte.slice(0, espacio) : corte).replace(/[\s.,;:·-]+$/, "")}…`;
}
