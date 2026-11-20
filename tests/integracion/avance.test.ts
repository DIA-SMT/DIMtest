// Avance de DIM360 hacia el 100 %, reconstruido semana a semana desde el historial.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { avanceSemanal, enCaminoAFuncionar } from "@/features/avance/consultas";
import { guardarConfig, pedirTrabajo, terminarTrabajo, tomarTrabajo } from "@/features/agente/servicio";
import { crearIncidencia } from "@/features/incidencias/servicio";
import { identificar } from "@/features/relevamiento/servicio";
import type { SemanaAvance } from "@/domain/avance";
import { baseDePrueba, crearAdmin } from "./base";

let base: Awaited<ReturnType<typeof baseDePrueba>>;
let semanas: SemanaAvance[];

beforeAll(async () => {
  base = await baseDePrueba();
  const equipo = await crearAdmin(base.tx, "equipo@dim360.test");
  const r = await base.tx((q) => identificar(q, "Romina Díaz", []));
  if (r.tipo !== "listo") throw new Error("ingreso");

  // Fechas relativas a hoy: siempre caen en la semana de hace dos, en la anterior y en esta.
  const ejecutar = (codigo: string, resultado: string, haceDias: number) =>
    base.tx((q) =>
      q(
        `insert into ejecuciones (prueba_codigo, relevador_id, sesion_id, relevador_nombre, resultado, observaciones, caso_usado,
                                  prioridad_sugerida, repetida, es_revalidacion, creada_at)
         values ($1, $2, $3, $4, $5, 'Prueba.', '', null, false, false, now() - make_interval(days => $6))`,
        [codigo, r.relevadorId, r.sesionId, r.nombre, resultado, haceDias],
      ),
    );
  // Hace dos semanas: PAD-01 funciona, PAD-02 no, PAD-03 a medias.
  await ejecutar("PAD-01", "funciona", 14);
  await ejecutar("PAD-02", "no_funciona", 14);
  await ejecutar("PAD-03", "parcial", 14);
  // La semana pasada: PAD-02 pasa a funcionar y PAD-01 deja de funcionar.
  await ejecutar("PAD-02", "funciona", 7);
  await ejecutar("PAD-01", "no_funciona", 7);
  // Esta semana: PAD-04 funciona y PAD-05 no se pudo probar.
  await ejecutar("PAD-04", "funciona", 0);
  await ejecutar("PAD-05", "no_probado", 0);

  // Esta semana también: dos incidencias nuevas; el agente corrige y publica la de PAD-03.
  await base.tx((q) => guardarConfig(q, equipo, { activo: true, automatico: false, prioridadesAutomaticas: [], publicar: true }));
  const nueva = (prueba: string) =>
    base.tx((q) =>
      crearIncidencia(q, equipo, { pruebaCodigo: prueba, ejecucionId: null, descripcion: `Falla en ${prueba}`, resultadoEsperado: "", resultadoObservado: "", prioridad: "P2", responsableId: null }),
    );
  const pad03 = await nueva("PAD-03");
  await nueva("PAD-01");
  await base.tx((q) => pedirTrabajo(q, equipo, pad03.id));
  const t = await base.tx((q) => tomarTrabajo(q));
  await base.tx((q) => terminarTrabajo(q, t!.trabajo.numero, { resultado: "desplegado", resumen: "Corregido." }));

  semanas = await base.tx((q) => avanceSemanal(q));
});
afterAll(async () => {
  await base.cerrar();
});

describe("avance semanal", () => {
  it("una semana por fila, desde la primera ejecución hasta la semana en curso", () => {
    expect(semanas).toHaveLength(3);
    expect(semanas.map((s) => s.enCurso)).toEqual([false, false, true]);
    expect(semanas.every((s) => s.total === 217)).toBe(true);
    // Lunes consecutivos.
    const lunes = semanas.map((s) => new Date(`${s.inicio}T12:00:00Z`));
    expect(lunes.every((d) => d.getUTCDay() === 1)).toBe(true);
    expect((lunes[2]!.getTime() - lunes[0]!.getTime()) / 86_400_000).toBe(14);
  });

  it("toma el último resultado de cada prueba al cierre de cada semana", () => {
    expect(semanas.map((s) => [s.funciona, s.parcial, s.noFunciona, s.noProbado])).toEqual([
      [1, 1, 1, 0],
      [1, 1, 1, 0],
      [2, 1, 1, 1],
    ]);
  });

  it("cuenta las que pasaron a funcionar y las que dejaron de hacerlo", () => {
    expect(semanas.map((s) => [s.pasaronAFuncionar, s.dejaronDeFuncionar])).toEqual([
      [1, 0],
      [1, 1],
      [1, 0],
    ]);
  });

  it("reconstruye las incidencias abiertas al cierre y lo que hizo el agente", () => {
    expect(semanas.map((s) => [s.incidenciasNuevas, s.incidenciasAbiertas, s.correccionesAgente])).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [2, 1, 1],
    ]);
  });

  it("la corregida que espera revalidación cuenta como en camino a funcionar", async () => {
    expect(await base.tx((q) => enCaminoAFuncionar(q))).toBe(1);
  });
});
