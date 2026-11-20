import { describe, expect, it } from "vitest";
import { cambioSemanal, estimarSemanas, type SemanaAvance } from "./avance";

const semana = (funciona: number, total = 217): SemanaAvance => ({
  inicio: "2026-11-02",
  enCurso: false,
  total,
  funciona,
  parcial: 0,
  noFunciona: 0,
  noProbado: 0,
  pasaronAFuncionar: 0,
  dejaronDeFuncionar: 0,
  incidenciasAbiertas: 0,
  incidenciasNuevas: 0,
  incidenciasCerradas: 0,
  correccionesAgente: 0,
});

describe("avance hacia el 100 %", () => {
  it("estima con el ritmo de las últimas semanas", () => {
    // 10 → 50 en 4 semanas: 10 por semana; faltan 167 → 17 semanas.
    const s = [5, 10, 20, 30, 40, 50].map((f) => semana(f));
    expect(estimarSemanas(s)).toEqual({ ritmo: 10, semanas: 4, semanasRestantes: 17 });
    // Con menos semanas que la ventana usa las que hay.
    expect(estimarSemanas([semana(10), semana(31)])).toEqual({ ritmo: 21, semanas: 1, semanasRestantes: 9 });
  });

  it("no estima sin historia o sin avance, y da 0 si ya funciona todo", () => {
    expect(estimarSemanas([semana(10)])).toBeNull();
    expect(estimarSemanas([semana(40), semana(38)])?.semanasRestantes).toBeNull();
    expect(estimarSemanas([semana(40), semana(40)])?.semanasRestantes).toBeNull();
    expect(estimarSemanas([semana(200), semana(217)])?.semanasRestantes).toBe(0);
  });

  it("calcula el cambio contra la semana anterior", () => {
    const s = [semana(10), semana(14), semana(12)];
    expect([0, 1, 2].map((k) => cambioSemanal(s, k))).toEqual([null, 4, -2]);
  });
});
