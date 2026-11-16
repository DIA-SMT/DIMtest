// Las consultas del panel y los informes, sobre datos reales del circuito.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  actividadReciente,
  incidenciasActivasPorPrioridad,
  listarEjecuciones,
  listarIncidencias,
  listarObservaciones,
  listarRelevadores,
  listarUsuarios,
  metricas,
  opcionesPruebas,
  opcionesRelevadores,
} from "@/features/admin/consultas";
import { cambiarEstado, crearIncidencia } from "@/features/incidencias/servicio";
import { armarInforme, TIPOS_INFORME, type TipoInforme } from "@/features/informes/datos";
import { generarExcel } from "@/features/informes/excel";
import { guardarEjecucion, identificar, tomarPrueba } from "@/features/relevamiento/servicio";
import { baseDePrueba, crearAdmin } from "./base";

let base: Awaited<ReturnType<typeof baseDePrueba>>;

beforeAll(async () => {
  base = await baseDePrueba();
  const equipo = await crearAdmin(base.tx);
  const luis = await base.tx((q) => identificar(q, "Luis Pérez", []));
  const ana = await base.tx((q) => identificar(q, "Ana Díaz", []));
  if (luis.tipo !== "listo" || ana.tipo !== "listo") throw new Error("ingreso");
  const registrar = async (quien: typeof luis, codigo: string, resultado: "funciona" | "no_funciona" | "parcial" | "no_probado", obs = "") => {
    await base.tx((q) => tomarPrueba(q, codigo, quien, { minutos: 30, repetir: true }));
    return base.tx((q) => guardarEjecucion(q, quien, { codigo, resultado, observaciones: obs, casoUsado: "", prioridadSugerida: null, evidencias: [] }));
  };
  const e1 = await registrar(luis, "PAD-01", "no_funciona", "No trae la ficha del PGM con el CUIT pedido.");
  await registrar(luis, "PAD-02", "parcial", "Tarda mucho la respuesta de ARCA.");
  await registrar(ana, "TRA-08", "funciona");
  await registrar(ana, "INT-01", "no_probado", "Sin datos de prueba.");
  const i = await base.tx((q) =>
    crearIncidencia(q, equipo, { pruebaCodigo: "PAD-01", ejecucionId: e1.id, descripcion: "Ficha incompleta", resultadoEsperado: "", resultadoObservado: "", prioridad: "P0", responsableId: equipo.id }),
  );
  await base.tx((q) => cambiarEstado(q, equipo, i.id, { hacia: "en_analisis" }));
});
afterAll(async () => {
  await base.cerrar();
});

describe("tablero", () => {
  it("cuenta sobre la base real", async () => {
    const m = await base.tx((q) => metricas(q));
    expect(m).toMatchObject({
      total: 217,
      evaluadas: 4,
      pendientes: 213,
      funciona: 1,
      parcial: 1,
      no_funciona: 1,
      no_probado: 1,
      incidencias_abiertas: 1,
      incidencias_criticas: 1,
      incidencias_corregidas: 0,
      incidencias_por_validar: 0,
      observaciones_sin_revisar: 2,
    });
    expect((await base.tx((q) => incidenciasActivasPorPrioridad(q))).find((p) => p.prioridad === "P0")?.activas).toBe(1);
    expect((await base.tx((q) => actividadReciente(q, 10))).length).toBeGreaterThan(4);
  });
});

describe("opciones", () => {
  it("las 217 pruebas para elegir al crear una incidencia, en el orden del PDF", async () => {
    const pruebas = await base.tx((q) => opcionesPruebas(q));
    expect(pruebas).toHaveLength(217);
    expect(pruebas[0]).toMatchObject({ valor: "ACC-01" });
    expect(pruebas[0].etiqueta.startsWith("ACC-01 · ")).toBe(true);
    expect(pruebas.at(-1)?.valor).toBe("MIG-11");
  });
});

describe("filtros", () => {
  it("ejecuciones por relevador, resultado, prioridad y estado de corrección", async () => {
    const relevadores = await base.tx((q) => opcionesRelevadores(q));
    const luis = relevadores.find((r) => r.etiqueta === "Luis Pérez")!.valor;
    const deLuis = await base.tx((q) => listarEjecuciones(q, { relevador: luis, pagina: 1, porPagina: 50 }));
    expect(deLuis.map((f) => f.prueba_codigo).sort()).toEqual(["PAD-01", "PAD-02"]);
    const fallidas = await base.tx((q) => listarEjecuciones(q, { relevador: luis, resultado: "no_funciona", pagina: 1, porPagina: 50 }));
    expect(fallidas).toHaveLength(1);
    expect(fallidas[0]).toMatchObject({ incidencias: 1, prioridad_max: "P0", estado_correccion: "en_analisis", total: 1 });
    const p0 = await base.tx((q) => listarEjecuciones(q, { prioridad: "P0", pagina: 1, porPagina: 50 }));
    expect(p0.map((f) => f.prueba_codigo)).toEqual(["PAD-01"]);
    const sinInc = await base.tx((q) => listarEjecuciones(q, { correccion: "sin_incidencias", modulo: "PAD", pagina: 1, porPagina: 50 }));
    expect(sinInc.map((f) => f.prueba_codigo)).toEqual(["PAD-02"]);
    const hoy = new Date(Date.now() - 3600_000);
    expect(await base.tx((q) => listarEjecuciones(q, { desde: hoy, soloUltima: true, pagina: 1, porPagina: 50 }))).toHaveLength(4);
  });

  it("observaciones con búsqueda sin tildes y clasificación", async () => {
    const r = await base.tx((q) => listarObservaciones(q, { busqueda: "respuesta de arca", orden: "recientes", pagina: 1, porPagina: 20 }));
    expect(r.map((o) => o.prueba_codigo)).toEqual(["PAD-02"]);
    const convertidas = await base.tx((q) => listarObservaciones(q, { clasificacion: "incidencia", orden: "codigo", pagina: 1, porPagina: 20 }));
    expect(convertidas.map((o) => [o.prueba_codigo, o.incidencia_numero])).toEqual([["PAD-01", 1]]);
    const porAutor = await base.tx((q) => listarObservaciones(q, { busqueda: "diaz", orden: "resultado", pagina: 1, porPagina: 20 }));
    expect(porAutor.map((o) => o.prueba_codigo)).toEqual(["INT-01"]);
  });

  it("incidencias combinando prioridad, módulo, responsable y estado", async () => {
    const r = await base.tx((q) => listarIncidencias(q, { prioridades: ["P0", "P1"], modulo: "PAD", estados: ["en_analisis"], responsable: undefined }));
    expect(r).toHaveLength(1);
    expect(await base.tx((q) => listarIncidencias(q, { responsable: "sin_asignar" }))).toHaveLength(0);
    expect(await base.tx((q) => listarIncidencias(q, { estados: ["cerrada"] }))).toHaveLength(0);
  });

  it("relevadores y equipo", async () => {
    expect((await base.tx((q) => listarRelevadores(q))).map((r) => r.nombre).sort()).toEqual(["Ana Díaz", "Luis Pérez"]);
    expect((await base.tx((q) => listarUsuarios(q)))[0].asignadas).toBe(1);
  });
});

describe("informes", () => {
  it("los ocho informes se arman y se exportan a Excel", async () => {
    for (const tipo of Object.keys(TIPOS_INFORME) as TipoInforme[]) {
      const informe = await base.tx((q) => armarInforme(q, tipo));
      expect(informe.columnas.length, tipo).toBeGreaterThan(3);
      const excel = await generarExcel(informe, new Date());
      expect(excel.subarray(0, 2).toString(), tipo).toBe("PK");
    }
    const pendientes = await base.tx((q) => armarInforme(q, "pendientes"));
    expect(pendientes.filas).toHaveLength(213);
    const avance = await base.tx((q) => armarInforme(q, "avance"));
    expect(avance.filas).toHaveLength(22);
    expect(avance.filas.reduce((a, f) => a + Number(f.total), 0)).toBe(217);
  });
});
