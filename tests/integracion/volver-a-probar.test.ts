// Portal: lo que el equipo (o el agente) corrigió y espera que la DIM vuelva a probar.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardarConfig, pedirTrabajo, terminarTrabajo, tomarTrabajo } from "@/features/agente/servicio";
import { crearIncidencia } from "@/features/incidencias/servicio";
import { cuantasParaVolverAProbar, guardarEjecucion, identificar, paraVolverAProbar, tomarPrueba } from "@/features/relevamiento/servicio";
import { baseDePrueba, crearAdmin } from "./base";

let base: Awaited<ReturnType<typeof baseDePrueba>>;
type Relevador = Extract<Awaited<ReturnType<typeof identificar>>, { tipo: "listo" }>;
let romina: Relevador;
let luis: Relevador;

async function relevador(nombre: string) {
  const r = await base.tx((q) => identificar(q, nombre, []));
  if (r.tipo !== "listo") throw new Error("ingreso");
  return r;
}

beforeAll(async () => {
  base = await baseDePrueba();
  const equipo = await crearAdmin(base.tx, "equipo@dim360.test");
  romina = await relevador("Romina Díaz");
  luis = await relevador("Luis Pérez");
  await base.tx((q) => guardarConfig(q, equipo, { activo: true, automatico: false, prioridadesAutomaticas: [], publicar: true }));

  // Romina reportó PAD-01; PAD-02 la cargó el equipo sin observación.
  const reporte = await base.tx((q) =>
    guardarEjecucion(q, romina, { codigo: "PAD-01", resultado: "no_funciona", observaciones: "No trae la ficha.", casoUsado: "", prioridadSugerida: null, evidencias: [] }),
  );
  const conReporte = await base.tx((q) =>
    crearIncidencia(q, equipo, { pruebaCodigo: "PAD-01", ejecucionId: reporte.id, descripcion: "No trae la ficha", resultadoEsperado: "", resultadoObservado: "", prioridad: "P2", responsableId: null }),
  );
  const sinReporte = await base.tx((q) =>
    crearIncidencia(q, equipo, { pruebaCodigo: "PAD-02", ejecucionId: null, descripcion: "Filtro roto", resultadoEsperado: "", resultadoObservado: "", prioridad: "P2", responsableId: null }),
  );

  // El agente corrige y publica las dos: se piden las revalidaciones.
  for (const [i, resumen] of [
    [conReporte, "La búsqueda ignoraba los guiones del CUIT."],
    [sinReporte, "El filtro de períodos no incluía los no prescriptos."],
  ] as const) {
    await base.tx((q) => pedirTrabajo(q, equipo, i.id));
    const t = await base.tx((q) => tomarTrabajo(q));
    await base.tx((q) =>
      terminarTrabajo(q, t!.trabajo.numero, { resultado: "desplegado", resumen, enlaces: [{ texto: "PR #7", url: "https://github.com/dim-desarrollo/x/pull/7" }] }),
    );
  }
});
afterAll(async () => {
  await base.cerrar();
});

describe("pruebas para volver a probar", () => {
  it("le avisa a cada relevador, con lo que reportó primero y qué se corrigió", async () => {
    expect(await base.tx((q) => cuantasParaVolverAProbar(q))).toBe(2);

    const paraRomina = await base.tx((q) => paraVolverAProbar(q, romina.relevadorId));
    expect(paraRomina.map((p) => [p.codigo, p.mia])).toEqual([
      ["PAD-01", true],
      ["PAD-02", false],
    ]);
    expect(paraRomina[0]).toMatchObject({ probandoOtro: null });
    expect(paraRomina[0]!.solucion).toContain("guiones del CUIT");
    expect(paraRomina[0]!.pedidaAt).toBeInstanceOf(Date);

    const paraLuis = await base.tx((q) => paraVolverAProbar(q, luis.relevadorId));
    expect(paraLuis.every((p) => !p.mia)).toBe(true);
  });

  it("dice quién la está probando, y sale de la lista cuando alguien la vuelve a probar", async () => {
    await base.tx((q) => tomarPrueba(q, "PAD-02", luis, { minutos: 30, repetir: false }));
    const paraRomina = await base.tx((q) => paraVolverAProbar(q, romina.relevadorId));
    expect(paraRomina.find((p) => p.codigo === "PAD-02")).toMatchObject({ probandoOtro: "Luis Pérez" });
    expect((await base.tx((q) => paraVolverAProbar(q, luis.relevadorId))).find((p) => p.codigo === "PAD-02")).toMatchObject({ probandoOtro: null });

    const r = await base.tx((q) =>
      guardarEjecucion(q, romina, { codigo: "PAD-01", resultado: "funciona", observaciones: "", casoUsado: "", prioridadSugerida: null, evidencias: [] }),
    );
    expect(r.esRevalidacion).toBe(true);
    expect((await base.tx((q) => paraVolverAProbar(q, romina.relevadorId))).map((p) => p.codigo)).toEqual(["PAD-02"]);
    expect(await base.tx((q) => cuantasParaVolverAProbar(q))).toBe(1);
  });
});
