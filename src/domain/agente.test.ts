import { describe, expect, it } from "vitest";
import {
  caminoHastaCorregida,
  duracionTrabajo,
  cierresDelFiltro,
  esCierreAgente,
  incidenciaElegible,
  normalizarWhatsapp,
  pedirAutomaticamente,
  resultadoPublica,
  textoParaPlantilla,
  type ConfigAgente,
} from "./agente";
import { ESTADOS_INCIDENCIA, transicionesDesde, validarTransicion } from "./incidencias";

const config: ConfigAgente = { activo: true, automatico: true, prioridadesAutomaticas: ["P2", "P3"], publicar: true };

describe("agente: qué incidencias toma", () => {
  it("solo las que siguen sin resolver", () => {
    expect(ESTADOS_INCIDENCIA.filter(incidenciaElegible)).toEqual(["reportada", "en_analisis", "pendiente_correccion", "en_correccion", "reabierta"]);
  });

  it("lo automático respeta el interruptor, el modo y las prioridades elegidas", () => {
    expect(pedirAutomaticamente(config, "P2", "reportada")).toBe(true);
    expect(pedirAutomaticamente(config, "P0", "reportada")).toBe(false);
    expect(pedirAutomaticamente({ ...config, activo: false }, "P3", "reportada")).toBe(false);
    expect(pedirAutomaticamente({ ...config, automatico: false }, "P3", "reportada")).toBe(false);
    expect(pedirAutomaticamente(config, "P3", "corregida")).toBe(false);
  });

  it("solo publicar o encontrarlo ya resuelto manda la prueba a revalidación", () => {
    expect(resultadoPublica("desplegado")).toBe(true);
    expect(resultadoPublica("ya_resuelto")).toBe(true);
    expect(resultadoPublica("pr_abierto")).toBe(false);
    expect(resultadoPublica("requiere_ok")).toBe(false);
    expect(resultadoPublica("bloqueado")).toBe(false);
  });
});

describe("agente: camino hasta «corregida»", () => {
  it("usa solo transiciones válidas y termina en «corregida»", () => {
    for (const desde of ESTADOS_INCIDENCIA.filter(incidenciaElegible)) {
      const camino = caminoHastaCorregida(desde);
      expect(camino.at(-1), desde).toBe("corregida");
      let actual = desde;
      for (const paso of camino) {
        expect(transicionesDesde(actual), `${actual} → ${paso}`).toContain(paso);
        actual = paso;
      }
      // El último paso pide la solución; los anteriores no piden nada.
      expect(validarTransicion({ desde: camino.at(-2) ?? desde, hacia: "corregida", solucion: "Se corrigió X" })).toBeNull();
    }
    expect(caminoHastaCorregida("reportada")).toEqual(["en_analisis", "en_correccion", "corregida"]);
    expect(caminoHastaCorregida("en_correccion")).toEqual(["corregida"]);
  });

  it("una incidencia ya resuelta no se reabre sola", () => {
    for (const e of ["corregida", "cerrada", "descartada"] as const) expect(caminoHastaCorregida(e), e).toEqual([]);
  });
});

describe("agente: avisos por WhatsApp", () => {
  it("normaliza números internacionales y rechaza los que no lo son", () => {
    expect(normalizarWhatsapp("+54 9 381 555-1234")).toBe("+5493815551234");
    expect(normalizarWhatsapp("0054 9 (381) 555 1234")).toBe("+5493815551234");
    expect(normalizarWhatsapp("381 555 1234")).toBeNull();
    expect(normalizarWhatsapp("+0 123")).toBeNull();
    expect(normalizarWhatsapp("")).toBeNull();
  });

  it("deja el texto como lo acepta una plantilla", () => {
    expect(textoParaPlantilla("Línea 1\n\nLínea 2\tfin     x")).toBe("Línea 1 · Línea 2 fin   x");
    expect(textoParaPlantilla("x".repeat(1200))).toHaveLength(1000);
  });
});

describe("agente: correcciones", () => {
  it("cuenta cuánto tardó cada trabajo", () => {
    const t = (min: number) => new Date(Date.UTC(2026, 10, 17, 12, 0) + min * 60_000);
    expect(duracionTrabajo(t(0), t(0))).toBe("menos de 1 min");
    expect(duracionTrabajo(t(0), t(12))).toBe("12 min");
    expect(duracionTrabajo(t(0), t(65))).toBe("1 h 05 min");
    expect(duracionTrabajo(t(0), t(60 * 27))).toBe("1 día 3 h");
    expect(duracionTrabajo(null, t(5))).toBeNull();
  });

  it("los filtros solo aceptan cierres conocidos", () => {
    expect(esCierreAgente("desplegado")).toBe(true);
    expect(esCierreAgente("fallido")).toBe(true);
    expect(esCierreAgente("cancelado")).toBe(false);
    expect(cierresDelFiltro("publicadas")).toEqual(["desplegado", "ya_resuelto"]);
    expect(cierresDelFiltro("persona")).toEqual(["requiere_ok", "bloqueado"]);
    expect(cierresDelFiltro("fallido")).toEqual(["fallido"]);
    expect(cierresDelFiltro("toString")).toBeNull();
    expect(cierresDelFiltro(undefined)).toBeNull();
  });
});
