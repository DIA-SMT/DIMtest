import { describe, expect, it } from "vitest";
import { solucionParaRelevador } from "./revalidaciones";

describe("solución que ve el relevador", () => {
  it("saca los enlaces a GitHub que deja el agente", () => {
    expect(solucionParaRelevador("El filtro de CUIT ignoraba los guiones. (PR #12: https://github.com/x/y/pull/12 · PR #3: https://github.com/x/z/pull/3)")).toBe(
      "El filtro de CUIT ignoraba los guiones.",
    );
    expect(solucionParaRelevador("Ver https://github.com/x/y/pull/9 para el detalle.")).toBe("Ver para el detalle.");
  });

  it("corta los textos largos en una palabra y deja vacío lo que no tiene nada", () => {
    const largo = "Se corrigió la consulta de períodos. ".repeat(20);
    const r = solucionParaRelevador(largo, 80);
    expect(r.length).toBeLessThanOrEqual(81);
    expect(r.endsWith("…")).toBe(true);
    expect(r).not.toMatch(/\s…$/);
    expect(solucionParaRelevador(null)).toBe("");
    expect(solucionParaRelevador("  ")).toBe("");
  });
});
