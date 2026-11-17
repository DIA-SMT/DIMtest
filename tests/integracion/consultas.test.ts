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
  observacionDetalle,
  opcionesPruebas,
  opcionesRelevadores,
} from "@/features/admin/consultas";
import { cambiarEstado, crearIncidencia } from "@/features/incidencias/servicio";
import { armarInforme, TIPOS_INFORME, type TipoInforme } from "@/features/informes/datos";
import ExcelJS from "exceljs";
import { generarExcel } from "@/features/informes/excel";
import { generarPdf } from "@/features/informes/pdf";
import { guardarEjecucion, identificar, tomarPrueba } from "@/features/relevamiento/servicio";
import { baseDePrueba, crearAdmin } from "./base";

let base: Awaited<ReturnType<typeof baseDePrueba>>;
const SITIO = "https://dim360.test";
// Un PNG real de 1 px: el anexo del PDF lo pasa por sharp.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64");
const leerFalso = async () => PNG;
const EVIDENCIAS = [
  { nombre: "pantalla-error.png", mime: "image/png", tamano: PNG.length, ruta: "2026-11/11111111-1111-4111-8111-111111111111.png" },
  { nombre: "constancia.pdf", mime: "application/pdf", tamano: 100, ruta: "2026-11/22222222-2222-4222-8222-222222222222.pdf" },
];

beforeAll(async () => {
  base = await baseDePrueba();
  const equipo = await crearAdmin(base.tx);
  const luis = await base.tx((q) => identificar(q, "Luis Pérez", []));
  const ana = await base.tx((q) => identificar(q, "Ana Díaz", []));
  if (luis.tipo !== "listo" || ana.tipo !== "listo") throw new Error("ingreso");
  const registrar = async (
    quien: typeof luis,
    codigo: string,
    resultado: "funciona" | "no_funciona" | "parcial" | "no_probado",
    obs = "",
    evidencias: typeof EVIDENCIAS = [],
  ) => {
    await base.tx((q) => tomarPrueba(q, codigo, quien, { minutos: 30, repetir: true }));
    return base.tx((q) => guardarEjecucion(q, quien, { codigo, resultado, observaciones: obs, casoUsado: "", prioridadSugerida: null, evidencias }));
  };
  const e1 = await registrar(luis, "PAD-01", "no_funciona", "No trae la ficha del PGM con el CUIT pedido.", EVIDENCIAS);
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

describe("detalle de una observación", () => {
  it("trae la prueba, la observación, su clasificación y sus evidencias", async () => {
    const lista = await base.tx((q) =>
      listarObservaciones(q, { busqueda: "PAD-01", orden: "recientes", pagina: 1, porPagina: 10 }),
    );
    const fila = lista.find((o) => o.prueba_codigo === "PAD-01");
    expect(fila?.evidencias).toBe(2);

    const o = await base.tx((q) => observacionDetalle(q, fila!.numero));
    expect(o).toMatchObject({
      id: fila!.id,
      prueba_codigo: "PAD-01",
      relevador_nombre: "Luis Pérez",
      resultado: "no_funciona",
      observaciones: "No trae la ficha del PGM con el CUIT pedido.",
      clasificacion: "incidencia",
      es_revalidacion: false,
    });
    expect(o?.resultado_esperado.length).toBeGreaterThan(0);
    expect(o?.incidencia_numero).toBeGreaterThan(0);
    expect(o?.evidencias.map((v) => ({ nombre: v.nombre, mime: v.mime }))).toEqual([
      { nombre: "constancia.pdf", mime: "application/pdf" },
      { nombre: "pantalla-error.png", mime: "image/png" },
    ]);
    expect(o?.evidencias[0]?.id).toMatch(/^[0-9a-f-]{36}$/);

    // Una sin evidencias trae la lista vacía, y un número que no existe, nada.
    const [sinArchivos] = await base.tx((q) => listarObservaciones(q, { busqueda: "ARCA", orden: "recientes", pagina: 1, porPagina: 10 }));
    expect(sinArchivos?.prueba_codigo).toBe("PAD-02");
    expect((await base.tx((q) => observacionDetalle(q, sinArchivos!.numero)))?.evidencias).toEqual([]);
    expect(await base.tx((q) => observacionDetalle(q, 999_999))).toBeNull();
  });
});

describe("informes", () => {
  it("los ocho informes se arman y se exportan a Excel", async () => {
    for (const tipo of Object.keys(TIPOS_INFORME) as TipoInforme[]) {
      const informe = await base.tx((q) => armarInforme(q, tipo));
      expect(informe.columnas.length, tipo).toBeGreaterThan(3);
      const excel = await generarExcel(informe, new Date(), { base: SITIO });
      expect(excel.subarray(0, 2).toString(), tipo).toBe("PK");
    }
    const pendientes = await base.tx((q) => armarInforme(q, "pendientes"));
    expect(pendientes.filas).toHaveLength(213);
    const avance = await base.tx((q) => armarInforme(q, "avance"));
    expect(avance.filas).toHaveLength(22);
    expect(avance.filas.reduce((a, f) => a + Number(f.total), 0)).toBe(217);
  });
  it("las evidencias van en los informes que las tienen, alineadas con cada fila", async () => {
    for (const tipo of ["realizadas", "fallidas", "observaciones", "correcciones-pendientes", "prioridades"] as const) {
      const informe = await base.tx((q) => armarInforme(q, tipo));
      expect(informe.evidencias, tipo).toHaveLength(informe.filas.length);
      const i = informe.filas.findIndex((f) => f.codigo === "PAD-01");
      expect(informe.filas[i]?.evidencias, tipo).toBe(2);
      expect(informe.evidencias?.[i]?.archivos.map((a) => a.nombre), tipo).toEqual(["constancia.pdf", "pantalla-error.png"]);
      expect(informe.evidencias?.[i]?.titulo, tipo).toContain("PAD-01");
      // Las filas sin evidencias muestran un guion.
      expect(informe.filas.filter((f) => f.codigo !== "PAD-01").every((f) => f.evidencias === "—"), tipo).toBe(true);
    }
    expect((await base.tx((q) => armarInforme(q, "pendientes"))).evidencias).toBeUndefined();
    expect((await base.tx((q) => armarInforme(q, "avance"))).evidencias).toBeUndefined();
  });

  it("el Excel suma una columna por evidencia con su enlace al panel", async () => {
    const informe = await base.tx((q) => armarInforme(q, "realizadas"));
    const libro = new ExcelJS.Workbook();
    const excel = await generarExcel(informe, new Date(), { base: SITIO });
    await libro.xlsx.load(excel.buffer.slice(excel.byteOffset, excel.byteOffset + excel.byteLength) as ArrayBuffer);
    const hoja = libro.worksheets[0]!;
    const titulos = (hoja.getRow(5).values as unknown[]).filter(Boolean);
    expect(titulos.slice(-2)).toEqual(["Evidencia 1", "Evidencia 2"]);
    const enlaces: { text: string; hyperlink: string }[] = [];
    hoja.eachRow((fila) =>
      fila.eachCell((celda) => {
        const v = celda.value as { hyperlink?: string; text?: string } | null;
        if (v && typeof v === "object" && v.hyperlink) enlaces.push({ text: String(v.text), hyperlink: v.hyperlink });
      }),
    );
    expect(enlaces.map((e) => e.text)).toEqual(["constancia.pdf", "pantalla-error.png"]);
    for (const e of enlaces) expect(e.hyperlink).toMatch(/^https:\/\/dim360\.test\/evidencias\/[0-9a-f-]{36}$/);
  });

  it("el PDF suma un anexo con las imágenes y el enlace a los PDF adjuntos", async () => {
    const informe = await base.tx((q) => armarInforme(q, "fallidas"));
    const leidas: string[] = [];
    const pdf = await generarPdf(informe, new Date(), {
      base: SITIO,
      leer: async (ruta) => {
        leidas.push(ruta);
        return leerFalso();
      },
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    // Solo se lee la imagen: el PDF adjunto va como enlace.
    expect(leidas).toEqual([EVIDENCIAS[0]!.ruta]);
    const texto = pdf.toString("latin1");
    expect(texto.match(/\/Subtype \/Image/g)?.length ?? 0).toBeGreaterThanOrEqual(2); // logo + evidencia
    expect(texto).toMatch(/https:\/\/dim360\.test\/evidencias\/[0-9a-f-]{36}/);

    // Si una imagen no se puede leer, el PDF sale igual.
    const sinArchivos = await generarPdf(informe, new Date(), { base: SITIO, leer: () => Promise.reject(new Error("no está")) });
    expect(sinArchivos.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
