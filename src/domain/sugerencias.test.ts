import { describe, expect, it } from "vitest";
import { esEstadoSugerencia, esTipoSugerencia, ESTADO_SUGERENCIA_RELEVADOR, ESTADOS_SUGERENCIA, problemaRespuesta, RESPUESTA_SUGERENCIA_MAX } from "./sugerencias";

describe("sugerencias de los relevadores", () => {
  it("reconoce solo los tipos y estados del catálogo", () => {
    expect(esTipoSugerencia("nueva_funcion")).toBe(true);
    expect(esTipoSugerencia("bug")).toBe(false);
    expect(esEstadoSugerencia("planificada")).toBe(true);
    expect(esEstadoSugerencia("cerrada")).toBe(false);
    expect(esEstadoSugerencia(undefined)).toBe(false);
  });

  it("cada estado tiene cómo lo ve el relevador", () => {
    for (const e of ESTADOS_SUGERENCIA) expect(ESTADO_SUGERENCIA_RELEVADOR[e]).toBeTruthy();
  });

  it("descartarla exige explicarle por qué; los demás estados no piden respuesta", () => {
    expect(problemaRespuesta("descartada", "")).toMatch(/por qué/);
    expect(problemaRespuesta("descartada", "No entra en el alcance del traspaso.")).toBeNull();
    expect(problemaRespuesta("en_evaluacion", "")).toBeNull();
    expect(problemaRespuesta("hecha", "x".repeat(RESPUESTA_SUGERENCIA_MAX + 1))).toMatch(/caracteres/);
  });
});
