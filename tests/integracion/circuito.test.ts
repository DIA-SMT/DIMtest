// El circuito completo de los criterios de aceptación, contra la base real (PGlite).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import catalogo from "@/domain/catalogo/catalogo-dim360.json";
import { controlarCatalogo, sembrarCatalogo, type CatalogoJson } from "@/lib/db/esquema";
import { asignarResponsable, cambiarEstado, cambiarPrioridad, clasificarObservacion, crearIncidencia } from "@/features/incidencias/servicio";
import {
  confirmarIdentidad,
  estadoDePruebas,
  guardarEjecucion,
  historialDePrueba,
  identificar,
  tomarPrueba,
} from "@/features/relevamiento/servicio";
import { baseDePrueba, crearAdmin } from "./base";

let base: Awaited<ReturnType<typeof baseDePrueba>>;
const MIN = { minutos: 30, repetir: false };

beforeAll(async () => {
  base = await baseDePrueba();
});
afterAll(async () => {
  await base.cerrar();
});

describe("catálogo", () => {
  it("carga sola las 217 pruebas en 22 módulos, sin resultados", async () => {
    expect(base.siembra.totalPruebas).toBe(217);
    const [c] = await base.tx((q) =>
      q<{ pruebas: number; modulos: number; ejecuciones: number }>(
        "select (select count(*)::int from pruebas) as pruebas, (select count(*)::int from modulos) as modulos, (select count(*)::int from ejecuciones) as ejecuciones",
      ),
    );
    expect(c).toEqual({ pruebas: 217, modulos: 22, ejecuciones: 0 });
    const porModulo = await base.tx((q) =>
      q<{ codigo: string; n: number }>("select modulo_codigo as codigo, count(*)::int as n from pruebas group by 1"),
    );
    for (const m of catalogo.modulos) expect(porModulo.find((p) => p.codigo === m.prefijo)?.n, m.nombre).toBe(m.cantidadSegunPdf);
  });

  it("volver a sembrar no duplica ni cambia nada", async () => {
    const r = await sembrarCatalogo(base.db, catalogo as CatalogoJson);
    expect(r).toEqual({ modulosNuevos: 0, pruebasNuevas: 0, pruebasActualizadas: 0, totalPruebas: 217 });
  });

  it("el control del arranque no escribe y detecta pruebas que faltan", async () => {
    expect(await controlarCatalogo(base.db, catalogo as CatalogoJson)).toEqual({ esperadas: 217, faltantes: [] });
    const conUnaDeMas = { ...catalogo, pruebas: [...catalogo.pruebas, { ...catalogo.pruebas[0]!, codigo: "ZZZ-99" }] } as CatalogoJson;
    expect(await controlarCatalogo(base.db, conUnaDeMas)).toEqual({ esperadas: 218, faltantes: ["ZZZ-99"] });
    const [{ n }] = await base.tx((q) => q<{ n: number }>("select count(*)::int as n from pruebas"));
    expect(n).toBe(217);
  });
});

describe("circuito de relevamiento y corrección", () => {
  let luis: { sesionId: string; relevadorId: string; nombre: string };
  let agustin: { sesionId: string; relevadorId: string; nombre: string };
  let ejecucionLuis: string;
  let incidencia: { id: string; numero: number };
  let equipo: { id: string; nombre: string };

  it("Luis ingresa solo con nombre y apellido", async () => {
    const r = await base.tx((q) => identificar(q, "  luis   PÉREZ ", []));
    expect(r).toMatchObject({ tipo: "listo", nombre: "Luis Pérez", nuevo: true });
    if (r.tipo === "listo") luis = r;
  });

  it("desde el mismo navegador, «luis perez» es la misma persona; desde otro, se pregunta", async () => {
    const mismo = await base.tx((q) => identificar(q, "Luis Perez", [luis.relevadorId]));
    expect(mismo).toMatchObject({ tipo: "listo", relevadorId: luis.relevadorId, nuevo: false });

    const otro = await base.tx((q) => identificar(q, "LUIS PÉREZ", []));
    expect(otro.tipo).toBe("confirmar");
    if (otro.tipo === "confirmar") expect(otro.candidatos.map((c) => c.id)).toEqual([luis.relevadorId]);

    // «Soy otra persona» crea otro perfil con el mismo nombre: no se fusiona solo.
    const homonimo = await base.tx((q) => confirmarIdentidad(q, "Luis Pérez", "nuevo"));
    expect(homonimo).toMatchObject({ tipo: "listo", nuevo: true });
    if (homonimo.tipo === "listo") expect(homonimo.relevadorId).not.toBe(luis.relevadorId);

    // No se puede elegir a alguien con otro nombre.
    const truco = await base.tx((q) => confirmarIdentidad(q, "Otra Persona", luis.relevadorId));
    if (truco.tipo === "listo") expect(truco.relevadorId).not.toBe(luis.relevadorId);
  });

  it("Luis toma ACC-01 y Agustín no puede tomarla a la vez", async () => {
    const tomada = await base.tx((q) => tomarPrueba(q, "ACC-01", luis, MIN));
    expect(tomada.tipo).toBe("tomada");

    const r = await base.tx((q) => identificar(q, "Agustín Gómez", []));
    if (r.tipo === "listo") agustin = r;
    const ocupada = await base.tx((q) => tomarPrueba(q, "ACC-01", agustin, MIN));
    expect(ocupada).toMatchObject({ tipo: "ocupada", por: "Luis Pérez" });

    const filas = await base.tx((q) => estadoDePruebas(q, "ACC"));
    expect(filas.find((f) => f.codigo === "ACC-01")?.estado).toBe("en_ejecucion");
    await expect(
      base.tx((q) => guardarEjecucion(q, agustin, { codigo: "ACC-01", resultado: "funciona", observaciones: "", casoUsado: "", prioridadSugerida: null, evidencias: [] })),
    ).rejects.toThrow("reservada_por_otro");
  });

  it("un resultado fallido exige explicación; con explicación se guarda y libera la reserva", async () => {
    await expect(
      base.tx((q) => guardarEjecucion(q, luis, { codigo: "ACC-01", resultado: "no_funciona", observaciones: "  ", casoUsado: "", prioridadSugerida: null, evidencias: [] })),
    ).rejects.toThrow("falta_explicacion");

    const g = await base.tx((q) =>
      guardarEjecucion(q, luis, {
        codigo: "ACC-01",
        resultado: "no_funciona",
        observaciones: "Con clave errada igual entra.",
        casoUsado: "CUIT 20-12345678-9",
        prioridadSugerida: "P1",
        evidencias: [],
      }),
    );
    ejecucionLuis = g.id;
    const [reservas] = await base.tx((q) => q<{ n: number }>("select count(*)::int as n from reservas"));
    expect(reservas.n).toBe(0);
  });

  it("Agustín ve lo que probó Luis y se le avisa antes de repetirla", async () => {
    const fila = (await base.tx((q) => estadoDePruebas(q, "ACC"))).find((f) => f.codigo === "ACC-01")!;
    expect(fila.estado).toBe("realizada");
    expect(fila.ultima).toMatchObject({ resultado: "no_funciona", relevador: "Luis Pérez" });

    const aviso = await base.tx((q) => tomarPrueba(q, "ACC-01", agustin, MIN));
    expect(aviso).toMatchObject({ tipo: "confirmar", ultima: { relevador: "Luis Pérez", resultado: "no_funciona" } });
    const confirmada = await base.tx((q) => tomarPrueba(q, "ACC-01", agustin, { minutos: 30, repetir: true }));
    expect(confirmada.tipo).toBe("tomada");
    await base.tx((q) => q("delete from reservas"));
  });

  it("el historial no se puede sobrescribir", async () => {
    await expect(base.tx((q) => q("update ejecuciones set resultado = 'funciona' where id = $1", [ejecucionLuis]))).rejects.toThrow(
      "solo_insercion",
    );
    await expect(base.tx((q) => q("delete from ejecuciones where id = $1", [ejecucionLuis]))).rejects.toThrow("solo_insercion");
  });

  it("el equipo convierte la observación en incidencia, la prioriza y la asigna", async () => {
    equipo = await crearAdmin(base.tx);
    const dev = await crearAdmin(base.tx, "desarrollo", "desarrollador");
    incidencia = await base.tx((q) =>
      crearIncidencia(q, equipo, {
        pruebaCodigo: "ACC-01",
        ejecucionId: ejecucionLuis,
        descripcion: "Con clave errada igual entra.",
        resultadoEsperado: "Con clave errada no entra.",
        resultadoObservado: "Entra igual.",
        prioridad: "P2",
        responsableId: null,
      }),
    );
    const [i] = await base.tx((q) =>
      q<{ reportada_por: string; prioridad_sugerida: string; estado: string }>("select reportada_por, prioridad_sugerida, estado from incidencias where id = $1", [incidencia.id]),
    );
    expect(i).toEqual({ reportada_por: "Luis Pérez", prioridad_sugerida: "P1", estado: "reportada" });

    expect(await base.tx((q) => cambiarPrioridad(q, equipo, incidencia.id, "P0", "Bloquea el ingreso"))).toBe(true);
    await base.tx((q) => asignarResponsable(q, equipo, incidencia.id, dev.id));
    const eventos = await base.tx((q) =>
      q<{ tipo: string; valor_anterior: string; valor_nuevo: string; usuario_nombre: string }>(
        "select tipo, valor_anterior, valor_nuevo, usuario_nombre from incidencia_eventos where incidencia_id = $1 order by id",
        [incidencia.id],
      ),
    );
    expect(eventos.find((e) => e.tipo === "prioridad")).toMatchObject({ valor_anterior: "P2", valor_nuevo: "P0", usuario_nombre: equipo.nombre });
    expect(eventos.find((e) => e.tipo === "responsable")?.valor_nuevo).toBe(dev.nombre);

    const [rev] = await base.tx((q) => q<{ clasificacion: string }>("select clasificacion from revisiones_observacion where ejecucion_id = $1", [ejecucionLuis]));
    expect(rev.clasificacion).toBe("incidencia");
    // Una observación ya convertida no vuelve a «informativa» por error.
    await base.tx((q) => clasificarObservacion(q, equipo, ejecucionLuis, "informativa"));
    const [sigue] = await base.tx((q) => q<{ clasificacion: string }>("select clasificacion from revisiones_observacion where ejecucion_id = $1", [ejecucionLuis]));
    expect(sigue.clasificacion).toBe("incidencia");
  });

  it("marcarla como corregida pide revalidación y no toca el resultado original", async () => {
    await expect(base.tx((q) => cambiarEstado(q, equipo, incidencia.id, { hacia: "corregida", solucion: "x" }))).rejects.toThrow("transicion_invalida");
    await base.tx((q) => cambiarEstado(q, equipo, incidencia.id, { hacia: "en_analisis" }));
    await base.tx((q) => cambiarEstado(q, equipo, incidencia.id, { hacia: "en_correccion" }));
    await expect(base.tx((q) => cambiarEstado(q, equipo, incidencia.id, { hacia: "corregida" }))).rejects.toThrow("falta_solucion");
    await base.tx((q) => cambiarEstado(q, equipo, incidencia.id, { hacia: "corregida", solucion: "Se valida la clave antes de crear la sesión." }));

    const fila = (await base.tx((q) => estadoDePruebas(q, "ACC"))).find((f) => f.codigo === "ACC-01")!;
    expect(fila.estado).toBe("revalidar");
    expect(fila.ultima?.resultado).toBe("no_funciona");
    // Cerrar sin revalidación exige explicación.
    await expect(base.tx((q) => cambiarEstado(q, equipo, incidencia.id, { hacia: "cerrada" }))).rejects.toThrow("cierre_sin_validacion");
  });

  it("la revalidación no pide confirmación, se registra aparte y permite cerrar", async () => {
    const t = await base.tx((q) => tomarPrueba(q, "ACC-01", agustin, MIN));
    expect(t.tipo).toBe("tomada");
    const g = await base.tx((q) =>
      guardarEjecucion(q, agustin, { codigo: "ACC-01", resultado: "funciona", observaciones: "", casoUsado: "CUIT 20-12345678-9", prioridadSugerida: null, evidencias: [] }),
    );
    expect(g.esRevalidacion).toBe(true);

    const historial = await base.tx((q) => historialDePrueba(q, "ACC-01"));
    expect(historial.map((h) => [h.relevador, h.resultado, h.esRevalidacion])).toEqual([
      ["Agustín Gómez", "funciona", true],
      ["Luis Pérez", "no_funciona", false],
    ]);
    const fila = (await base.tx((q) => estadoDePruebas(q, "ACC"))).find((f) => f.codigo === "ACC-01")!;
    expect(fila.estado).toBe("realizada");

    await base.tx((q) => cambiarEstado(q, equipo, incidencia.id, { hacia: "cerrada" }));
    const [i] = await base.tx((q) => q<{ estado: string; cerrada: boolean }>("select estado, cerrada_at is not null as cerrada from incidencias where id = $1", [incidencia.id]));
    expect(i).toEqual({ estado: "cerrada", cerrada: true });
  });

  it("si el error vuelve, se reabre con un comentario y queda todo el historial", async () => {
    await expect(base.tx((q) => cambiarEstado(q, equipo, incidencia.id, { hacia: "reabierta" }))).rejects.toThrow("falta_comentario");
    await base.tx((q) => cambiarEstado(q, equipo, incidencia.id, { hacia: "reabierta", comentario: "Volvió a pasar con otro CUIT." }));
    const tipos = await base.tx((q) =>
      q<{ tipo: string; valor_nuevo: string | null }>("select tipo, valor_nuevo from incidencia_eventos where incidencia_id = $1 order by id", [incidencia.id]),
    );
    expect(tipos.map((t) => `${t.tipo}:${t.valor_nuevo ?? ""}`)).toEqual([
      "creada:reportada",
      "prioridad:P0",
      "responsable:Equipo desarrollo",
      "estado:en_analisis",
      "estado:en_correccion",
      "estado:corregida",
      "solucion:",
      "revalidacion:pedida",
      "revalidacion:funciona",
      "estado:cerrada",
      "estado:reabierta",
    ]);
    await expect(base.tx((q) => q("delete from incidencia_eventos"))).rejects.toThrow("solo_insercion");
  });
});
