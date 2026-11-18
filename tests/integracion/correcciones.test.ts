// Correcciones del agente (D-015): lo que terminó, filtrado, y cómo salió cada revalidación.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { colaAgente, listarCorrecciones, resumenCorrecciones, type FiltrosCorrecciones } from "@/features/agente/consultas";
import { cancelarTrabajo, fallarTrabajo, guardarConfig, informarAvance, listarTrabajos, pedirTrabajo, terminarTrabajo, tomarTrabajo } from "@/features/agente/servicio";
import { crearIncidencia } from "@/features/incidencias/servicio";
import { guardarEjecucion, identificar } from "@/features/relevamiento/servicio";
import type { Cierre } from "@/features/agente/servicio";
import type { Prioridad } from "@/domain/prioridades";
import type { Resultado } from "@/domain/resultados";
import { baseDePrueba, crearAdmin } from "./base";

let base: Awaited<ReturnType<typeof baseDePrueba>>;
let equipo: { id: string; nombre: string };
let relevador: Extract<Awaited<ReturnType<typeof identificar>>, { tipo: "listo" }>;
const n: Record<string, number> = {};

async function corregir(prueba: string, prioridad: Prioridad, cierre: Cierre | "fallido") {
  const i = await base.tx((q) =>
    crearIncidencia(q, equipo, { pruebaCodigo: prueba, ejecucionId: null, descripcion: `Falla en ${prueba}`, resultadoEsperado: "", resultadoObservado: "", prioridad, responsableId: null }),
  );
  await base.tx((q) => pedirTrabajo(q, equipo, i.id));
  const t = await base.tx((q) => tomarTrabajo(q));
  if (cierre === "fallido") await base.tx((q) => fallarTrabajo(q, t!.trabajo.numero, "Se alcanzó el límite de uso del plan."));
  else await base.tx((q) => terminarTrabajo(q, t!.trabajo.numero, cierre));
  n[prueba] = i.numero;
  return i;
}

async function revalidar(prueba: string, resultado: Resultado) {
  await base.tx((q) => guardarEjecucion(q, relevador, { codigo: prueba, resultado, observaciones: "Revalidación.", casoUsado: "", prioridadSugerida: null, evidencias: [] }));
}

const listar = (f: Partial<FiltrosCorrecciones> = {}) => base.tx((q) => listarCorrecciones(q, { pagina: 1, porPagina: 50, ...f }));

beforeAll(async () => {
  base = await baseDePrueba();
  equipo = await crearAdmin(base.tx, "equipo@dim360.test");
  const r = await base.tx((q) => identificar(q, "Romina Díaz", []));
  if (r.tipo !== "listo") throw new Error("ingreso");
  relevador = r;
  await base.tx((q) => guardarConfig(q, equipo, { activo: true, automatico: false, prioridadesAutomaticas: [], publicar: true }));

  const pr = { texto: "PR #41", url: "https://github.com/dim-desarrollo/Dim360_back-copia/pull/41" };
  await corregir("PAD-10", "P1", { resultado: "desplegado", resumen: "El filtro de períodos no incluía los no prescriptos.", enlaces: [pr] });
  await corregir("PAD-11", "P2", { resultado: "ya_resuelto", resumen: "La versión de test estaba atrasada." });
  await corregir("TEM-02", "P2", { resultado: "desplegado", resumen: "Calcula el mínimo con la alícuota vigente." });
  await corregir("PAD-12", "P3", { resultado: "pr_abierto", resumen: "Listo para revisar." });
  await corregir("PAD-13", "P2", { resultado: "requiere_ok", resumen: "Falta un parámetro en la base." });
  await corregir("PAD-14", "P2", { resultado: "bloqueado", resumen: "No se pudo reproducir." });
  await corregir("PAD-15", "P3", "fallido");

  // La DIM revalida: una funciona, otra vuelve a fallar; la tercera queda esperando.
  await revalidar("PAD-10", "funciona");
  await revalidar("TEM-02", "parcial");

  // Lo que no terminó no es una corrección: un pedido en la cola y uno cancelado.
  const cola = await base.tx((q) =>
    crearIncidencia(q, equipo, { pruebaCodigo: "PAD-16", ejecucionId: null, descripcion: "En cola", resultadoEsperado: "", resultadoObservado: "", prioridad: "P3", responsableId: null }),
  );
  await base.tx((q) => pedirTrabajo(q, equipo, cola.id));
  const cancelada = await base.tx((q) =>
    crearIncidencia(q, equipo, { pruebaCodigo: "PAD-17", ejecucionId: null, descripcion: "Cancelada", resultadoEsperado: "", resultadoObservado: "", prioridad: "P3", responsableId: null }),
  );
  await base.tx((q) => pedirTrabajo(q, equipo, cancelada.id));
  await base.tx(async (q) => cancelarTrabajo(q, equipo, (await listarTrabajos(q, { incidenciaId: cancelada.id }))[0]!.numero));
});
afterAll(async () => {
  await base.cerrar();
});

describe("correcciones del agente", () => {
  it("lista solo lo que terminó, lo último primero, con la incidencia y su estado de hoy", async () => {
    const filas = await listar();
    expect(filas.map((f) => f.prueba_codigo)).toEqual(["PAD-15", "PAD-14", "PAD-13", "PAD-12", "TEM-02", "PAD-11", "PAD-10"]);
    expect(filas[0]!.total).toBe(7);
    const pad10 = filas.find((f) => f.prueba_codigo === "PAD-10")!;
    expect(pad10).toMatchObject({ cierre: "desplegado", incidencia_numero: n["PAD-10"], incidencia_estado: "corregida", prioridad: "P1", origen: "manual" });
    expect(pad10.enlaces).toEqual([{ texto: "PR #41", url: "https://github.com/dim-desarrollo/Dim360_back-copia/pull/41" }]);
    expect(filas.find((f) => f.prueba_codigo === "PAD-15")).toMatchObject({ cierre: "fallido", resumen: "Se alcanzó el límite de uso del plan.", revalidacion: null });
    expect(filas.find((f) => f.prueba_codigo === "PAD-12")).toMatchObject({ cierre: "pr_abierto", incidencia_estado: "reportada", revalidacion: null });
  });

  it("sigue la revalidación que pidió al publicar: confirmada, volvió a fallar o pendiente", async () => {
    const filas = await listar();
    const de = (c: string) => filas.find((f) => f.prueba_codigo === c)!;
    expect(de("PAD-10")).toMatchObject({ revalidacion: "confirmada", revalidacion_resultado: "funciona", revalidacion_relevador: "Romina Díaz" });
    expect(de("TEM-02")).toMatchObject({ revalidacion: "volvio_a_fallar", revalidacion_resultado: "parcial" });
    expect(de("PAD-11")).toMatchObject({ revalidacion: "pendiente", revalidacion_resultado: null });
    expect(de("PAD-11").revalidacion_pedida_at).not.toBeNull();
  });

  it("filtra por cierre (suelto o agrupado), revalidación, módulo, prioridad y búsqueda", async () => {
    const codigos = async (f: Partial<FiltrosCorrecciones>) => (await listar(f)).map((x) => x.prueba_codigo).sort();
    expect(await codigos({ cierres: ["desplegado", "ya_resuelto"] })).toEqual(["PAD-10", "PAD-11", "TEM-02"]);
    expect(await codigos({ cierres: ["requiere_ok", "bloqueado"] })).toEqual(["PAD-13", "PAD-14"]);
    expect(await codigos({ cierres: ["fallido"] })).toEqual(["PAD-15"]);
    expect(await codigos({ revalidacion: "volvio_a_fallar" })).toEqual(["TEM-02"]);
    expect(await codigos({ modulo: "TEM" })).toEqual(["TEM-02"]);
    expect(await codigos({ prioridad: "P3" })).toEqual(["PAD-12", "PAD-15"]);
    expect(await codigos({ busqueda: "PRESCRIPTOS" })).toEqual(["PAD-10"]);
    expect(await codigos({ busqueda: "pull/41" })).toEqual(["PAD-10"]);
    expect(await codigos({ busqueda: `INC-${String(n["PAD-13"]).padStart(4, "0")}` })).toEqual(["PAD-13"]);
    expect(await codigos({ busqueda: "alicuota" })).toEqual(["TEM-02"]);
  });

  it("pagina con el total de lo filtrado", async () => {
    const p1 = await listar({ pagina: 1, porPagina: 3 });
    const p3 = await listar({ pagina: 3, porPagina: 3 });
    expect(p1).toHaveLength(3);
    expect(p1[0]!.total).toBe(7);
    expect(p3.map((f) => f.prueba_codigo)).toEqual(["PAD-10"]);
  });

  it("resume todo lo que hizo el agente", async () => {
    expect(await base.tx((q) => resumenCorrecciones(q))).toEqual({
      publicadas: 3,
      confirmadas: 1,
      volvieron_a_fallar: 1,
      por_revalidar: 1,
      para_revisar: 1,
      necesitan_persona: 2,
      fallidas: 1,
    });
  });
});

describe("cola del agente", () => {
  const pedir = async (prueba: string, prioridad: Prioridad) => {
    const i = await base.tx((q) =>
      crearIncidencia(q, equipo, { pruebaCodigo: prueba, ejecucionId: null, descripcion: `Falla en ${prueba}`, resultadoEsperado: "", resultadoObservado: "", prioridad, responsableId: null }),
    );
    await base.tx((q) => pedirTrabajo(q, equipo, i.id));
    n[prueba] = i.numero;
  };
  const orden = async () => (await base.tx((q) => colaAgente(q))).map((t) => `${t.estado} ${t.prueba_codigo}`);

  it("muestra lo que espera en el orden en que el agente lo va a tomar, con lo que está haciendo primero", async () => {
    // PAD-16 (P3) ya esperaba desde el principio.
    expect(await orden()).toEqual(["pendiente PAD-16"]);
    await pedir("PAD-18", "P3");
    await pedir("PAD-19", "P1");
    expect(await orden()).toEqual(["pendiente PAD-19", "pendiente PAD-16", "pendiente PAD-18"]);

    const t = await base.tx((q) => tomarTrabajo(q));
    expect(t?.prueba.codigo).toBe("PAD-19");
    await base.tx((q) => informarAvance(q, t!.trabajo.numero, "Reproduje el error en local."));
    await pedir("PAD-20", "P0");
    expect(await orden()).toEqual(["en_curso PAD-19", "pendiente PAD-20", "pendiente PAD-16", "pendiente PAD-18"]);

    const [enCurso] = await base.tx((q) => colaAgente(q));
    expect(enCurso).toMatchObject({ incidencia_numero: n["PAD-19"], prioridad: "P1", ultimo_avance: "Reproduje el error en local." });
    expect(enCurso!.tomado_at).not.toBeNull();

    // Lo que termina sale de la cola y pasa a las correcciones.
    await base.tx((q) => terminarTrabajo(q, t!.trabajo.numero, { resultado: "pr_abierto", resumen: "Listo para revisar." }));
    expect(await orden()).toEqual(["pendiente PAD-20", "pendiente PAD-16", "pendiente PAD-18"]);
    expect((await listar())[0]).toMatchObject({ prueba_codigo: "PAD-19", cierre: "pr_abierto" });
  });
});
