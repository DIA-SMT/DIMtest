// Sugerencias (D-017): el relevador propone, el equipo responde y el relevador ve la respuesta.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { metricas } from "@/features/admin/consultas";
import { listarSugerencias, resumenSugerencias } from "@/features/sugerencias/consultas";
import { crearSugerencia, responderSugerencia, sugerenciasDeRelevador } from "@/features/sugerencias/servicio";
import { borrarRelevador, identificar } from "@/features/relevamiento/servicio";
import { SUGERENCIAS_POR_HORA } from "@/domain/sugerencias";
import { baseDePrueba, crearAdmin } from "./base";

let base: Awaited<ReturnType<typeof baseDePrueba>>;
let equipo: { id: string; nombre: string };
let romina: { relevadorId: string; nombre: string };
let luis: { relevadorId: string; nombre: string };

async function ingresar(nombre: string) {
  const r = await base.tx((q) => identificar(q, nombre, []));
  if (r.tipo !== "listo") throw new Error("ingreso");
  return { relevadorId: r.relevadorId, nombre: r.nombre };
}

beforeAll(async () => {
  base = await baseDePrueba();
  equipo = await crearAdmin(base.tx, "equipo@dim360.test");
  romina = await ingresar("Romina Díaz");
  luis = await ingresar("Luis Pérez");
});
afterAll(async () => {
  await base.cerrar();
});

describe("sugerencias", () => {
  it("el relevador propone y la ve como recibida", async () => {
    const n = await base.tx((q) =>
      crearSugerencia(q, romina, { tipo: "nueva_funcion", moduloCodigo: "PAD", titulo: "  Exportar el padrón a Excel ", detalle: "Hoy lo copio a mano, tarda una hora." }),
    );
    await base.tx((q) => crearSugerencia(q, luis, { tipo: "mejora", moduloCodigo: null, titulo: "Buscador más rápido", detalle: "La búsqueda por CUIT tarda mucho." }));
    const propias = await base.tx((q) => sugerenciasDeRelevador(q, romina.relevadorId));
    expect(propias).toHaveLength(1);
    expect(propias[0]).toMatchObject({ numero: n, estado: "nueva", titulo: "Exportar el padrón a Excel", respuesta: "", respondidaAt: null });
    expect(propias[0]!.modulo).toBeTruthy();
  });

  it("no acepta un módulo que no existe", async () => {
    await expect(base.tx((q) => crearSugerencia(q, romina, { tipo: "otra", moduloCodigo: "ZZZ", titulo: "Algo", detalle: "Un detalle suficiente." }))).rejects.toThrow(
      "modulo_inexistente",
    );
  });

  it("el equipo la ve, la filtra y le cuenta en el tablero", async () => {
    const todas = await base.tx((q) => listarSugerencias(q, { pagina: 1, porPagina: 20 }));
    expect(todas.map((s) => s.relevador_nombre).sort()).toEqual(["Luis Pérez", "Romina Díaz"]);
    expect(todas[0]!.total).toBe(2);
    const buscadas = await base.tx((q) => listarSugerencias(q, { busqueda: "padron", pagina: 1, porPagina: 20 }));
    expect(buscadas.map((s) => s.titulo)).toEqual(["Exportar el padrón a Excel"]);
    const mejoras = await base.tx((q) => listarSugerencias(q, { tipo: "mejora", pagina: 1, porPagina: 20 }));
    expect(mejoras.map((s) => s.relevador_nombre)).toEqual(["Luis Pérez"]);
    expect((await base.tx((q) => metricas(q))).sugerencias_nuevas).toBe(2);
  });

  it("el equipo responde: el relevador ve el estado y la respuesta, y queda en la auditoría", async () => {
    const [s] = await base.tx((q) => sugerenciasDeRelevador(q, romina.relevadorId));
    await base.tx((q) => responderSugerencia(q, equipo, s!.numero, { estado: "planificada", respuesta: "Buena idea: va en la próxima versión." }));
    const [despues] = await base.tx((q) => sugerenciasDeRelevador(q, romina.relevadorId));
    expect(despues).toMatchObject({ estado: "planificada", respuesta: "Buena idea: va en la próxima versión." });
    expect(despues!.respondidaAt).toBeInstanceOf(Date);

    const abiertas = await base.tx((q) => listarSugerencias(q, { estado: "abiertas", pagina: 1, porPagina: 20 }));
    expect(abiertas).toHaveLength(2);
    const resumen = await base.tx((q) => resumenSugerencias(q));
    expect(resumen).toMatchObject({ total: 2, nuevas: 1, planificadas: 1, relevadores: 2 });

    const [a] = await base.tx((q) => q<{ usuario_nombre: string; detalle: { estado: string } }>("select usuario_nombre, detalle from auditoria where accion = 'sugerencia.respondida'"));
    expect(a).toMatchObject({ usuario_nombre: equipo.nombre, detalle: { estado: "planificada" } });
  });

  it("descartarla sin explicar por qué no se puede", async () => {
    const [s] = await base.tx((q) => sugerenciasDeRelevador(q, luis.relevadorId));
    await expect(base.tx((q) => responderSugerencia(q, equipo, s!.numero, { estado: "descartada", respuesta: "  " }))).rejects.toThrow("falta_respuesta_sugerencia");
    await base.tx((q) => responderSugerencia(q, equipo, s!.numero, { estado: "descartada", respuesta: "Depende del servidor de ARCA, no de DIM360." }));
    const [despues] = await base.tx((q) => sugerenciasDeRelevador(q, luis.relevadorId));
    expect(despues!.estado).toBe("descartada");
  });

  it("frena a quien manda demasiadas seguidas", async () => {
    const otra = await ingresar("Agustina Ruiz");
    for (let k = 0; k < SUGERENCIAS_POR_HORA; k++) {
      await base.tx((q) => crearSugerencia(q, otra, { tipo: "otra", moduloCodigo: null, titulo: `Idea ${k}`, detalle: "Un detalle suficiente." }));
    }
    await expect(base.tx((q) => crearSugerencia(q, otra, { tipo: "otra", moduloCodigo: null, titulo: "Una más", detalle: "Un detalle suficiente." }))).rejects.toThrow(
      "sugerencias_limite",
    );
  });

  it("un relevador con sugerencias no se borra", async () => {
    expect(await base.tx((q) => borrarRelevador(q, luis.relevadorId))).toEqual({ tipo: "con_sugerencias", sugerencias: 1 });
  });
});
