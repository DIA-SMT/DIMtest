// Agente Claude (D-015): la cola, lo que informa, cómo cierra una incidencia y a quién avisa.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listarUsuarios, opcionesResponsables } from "@/features/admin/consultas";
import {
  actorAgente,
  cancelarTrabajo,
  fallarTrabajo,
  generarToken,
  guardarConfig,
  guardarWhatsapp,
  informarAvance,
  leerConfig,
  listarTrabajos,
  pedirSiCorresponde,
  pedirTrabajo,
  revocarToken,
  terminarTrabajo,
  tomarTrabajo,
  verificarToken,
} from "@/features/agente/servicio";
import { asignarResponsable, crearIncidencia } from "@/features/incidencias/servicio";
import { guardarEjecucion, identificar, tomarPrueba } from "@/features/relevamiento/servicio";
import type { Prioridad } from "@/domain/prioridades";
import { baseDePrueba, crearAdmin } from "./base";

let base: Awaited<ReturnType<typeof baseDePrueba>>;
let equipo: { id: string; nombre: string };
let responsable: { id: string; nombre: string };
let ejecucionId: string;
const SITIO = "https://dim360.test";
const CONFIG = { activo: true, automatico: true, prioridadesAutomaticas: ["P2", "P3"] as Prioridad[], publicar: true };

async function nuevaIncidencia(prueba: string, prioridad: Prioridad, conEjecucion = false) {
  return base.tx((q) =>
    crearIncidencia(q, equipo, {
      pruebaCodigo: prueba,
      ejecucionId: conEjecucion ? ejecucionId : null,
      descripcion: `Falla en ${prueba}`,
      resultadoEsperado: "Que funcione",
      resultadoObservado: "No funciona",
      prioridad,
      responsableId: responsable.id,
    }),
  );
}
const contar = (sql: string, params: unknown[] = []) => base.tx(async (q) => (await q<{ n: number }>(sql, params))[0]!.n);

beforeAll(async () => {
  base = await baseDePrueba();
  equipo = await crearAdmin(base.tx, "equipo@dim360.test");
  responsable = await crearAdmin(base.tx, "responsable@dim360.test", "desarrollador");
  // Quien se anota a los avisos y el responsable (sin anotarse) tienen WhatsApp; el tercero no.
  await base.tx((q) => guardarWhatsapp(q, equipo.id, "+5493815550001", true));
  await base.tx((q) => guardarWhatsapp(q, responsable.id, "+5493815550002", false));
  await crearAdmin(base.tx, "sin-whatsapp@dim360.test");

  const luis = await base.tx((q) => identificar(q, "Luis Pérez", []));
  if (luis.tipo !== "listo") throw new Error("ingreso");
  await base.tx((q) => tomarPrueba(q, "PAD-01", luis, { minutos: 30, repetir: false }));
  const e = await base.tx((q) =>
    guardarEjecucion(q, luis, {
      codigo: "PAD-01",
      resultado: "no_funciona",
      observaciones: "No trae la ficha del PGM con el CUIT 30-70992653-1.",
      casoUsado: "30-70992653-1",
      prioridadSugerida: "P1",
      evidencias: [{ nombre: "error.png", mime: "image/png", tamano: 10, ruta: "2026-11/33333333-3333-4333-8333-333333333333.png" }],
    }),
  );
  ejecucionId = e.id;
});
afterAll(async () => {
  await base.cerrar();
});

describe("la cuenta del agente", () => {
  it("existe, no figura en Equipo ni como responsable posible, y no se le puede asignar una incidencia", async () => {
    const agente = await base.tx((q) => actorAgente(q));
    expect(agente.nombre).toBe("Claude (agente)");
    expect((await base.tx((q) => listarUsuarios(q))).some((u) => u.id === agente.id)).toBe(false);
    expect((await base.tx((q) => opcionesResponsables(q))).some((o) => o.valor === agente.id)).toBe(false);
    const i = await nuevaIncidencia("PAD-03", "P3");
    await expect(base.tx((q) => asignarResponsable(q, equipo, i.id, agente.id))).rejects.toThrow("sin_permiso");
  });
});

describe("token del agente", () => {
  it("se genera una vez, se verifica por su hash y se puede revocar", async () => {
    const token = await base.tx((q) => generarToken(q, equipo));
    expect(token).toMatch(/^dimag_[A-Za-z0-9_-]{43}$/);
    expect(await base.tx((q) => verificarToken(q, token))).toBe(true);
    expect(await base.tx((q) => verificarToken(q, `${token.slice(0, -1)}x`))).toBe(false);
    expect(await base.tx((q) => verificarToken(q, "cualquier-cosa"))).toBe(false);
    const [guardado] = await base.tx((q) => q<{ token_hash: string }>("select token_hash from agente_config"));
    expect(guardado!.token_hash).not.toContain(token);
    expect((await base.tx((q) => leerConfig(q))).ultimoContactoAt).not.toBeNull();
    await base.tx((q) => revocarToken(q, equipo));
    expect(await base.tx((q) => verificarToken(q, token))).toBe(false);
  });
});

describe("la cola del agente", () => {
  it("apagado (como arranca) no recibe trabajo ni toma pedidos automáticos", async () => {
    expect((await base.tx((q) => leerConfig(q))).activo).toBe(false);
    const i = await nuevaIncidencia("PAD-04", "P2");
    expect(await base.tx((q) => pedirSiCorresponde(q, i.id))).toBe(false);
    await base.tx((q) => pedirTrabajo(q, equipo, i.id));
    expect(await base.tx((q) => tomarTrabajo(q, SITIO))).toBeNull();
    await base.tx(async (q) => cancelarTrabajo(q, equipo, (await listarTrabajos(q, { incidenciaId: i.id }))[0]!.numero));
  });

  it("encendido, pide solo las prioridades elegidas y no duplica pedidos", async () => {
    await base.tx((q) => guardarConfig(q, equipo, CONFIG));
    const p2 = await nuevaIncidencia("PAD-05", "P2");
    const p0 = await nuevaIncidencia("PAD-06", "P0");
    expect(await base.tx((q) => pedirSiCorresponde(q, p2.id))).toBe(true);
    expect(await base.tx((q) => pedirSiCorresponde(q, p0.id))).toBe(false);
    await expect(base.tx((q) => pedirTrabajo(q, equipo, p2.id))).rejects.toThrow("agente_ya_pedido");
    // Se vacía la cola para las pruebas que siguen.
    await base.tx(async (q) => cancelarTrabajo(q, equipo, (await listarTrabajos(q, { incidenciaId: p2.id }))[0]!.numero));
  });

  it("toma la más urgente, recibe todo lo necesario y avisa al responsable y a los anotados", async () => {
    const baja = await nuevaIncidencia("PAD-07", "P3");
    const urgente = await nuevaIncidencia("PAD-01", "P1", true);
    await base.tx((q) => pedirTrabajo(q, equipo, baja.id));
    await base.tx((q) => pedirTrabajo(q, equipo, urgente.id));

    const avisosAntes = await contar("select count(*)::int as n from notificaciones");
    const p = await base.tx((q) => tomarTrabajo(q, SITIO));
    expect(p?.incidencia.numero).toBe(urgente.numero);
    expect(p).toMatchObject({
      publicar: true,
      incidencia: { prioridad: "P1", estado: "reportada", descripcion: "Falla en PAD-01", responsable: "Equipo responsable@dim360.test" },
      prueba: { codigo: "PAD-01" },
      ejecucion: { relevador: "Luis Pérez", resultado: "no_funciona", casoUsado: "30-70992653-1" },
    });
    expect(p?.ejecucion?.observaciones).toContain("CUIT");
    expect(p?.evidencias).toEqual([expect.objectContaining({ nombre: "error.png", mime: "image/png", origen: "ejecucion" })]);
    expect(p?.historial.map((h) => h.tipo)).toEqual(expect.arrayContaining(["creada", "agente"]));

    const avisos = await base.tx((q) =>
      q<{ destino: string; texto: string }>("select destino, texto from notificaciones order by id offset $1", [avisosAntes]),
    );
    expect(avisos.map((a) => a.destino).sort()).toEqual(["+5493815550001", "+5493815550002"]);
    expect(avisos[0]!.texto).toContain(`${SITIO}/admin/incidencias/${urgente.numero}`);

    // Mientras trabaja: señales de vida y notas en el historial.
    expect(await base.tx((q) => informarAvance(q, p!.trabajo.numero, "Reproduje el error en local."))).toEqual({ seguir: true, publicar: true });
    expect(await contar("select count(*)::int as n from incidencia_eventos where incidencia_id = $1 and valor_nuevo = 'avance'", [urgente.id])).toBe(1);

    // Publicó en test: la incidencia pasa a «corregida» por el ciclo de siempre y se pide revalidación.
    const r = await base.tx((q) =>
      terminarTrabajo(
        q,
        p!.trabajo.numero,
        { resultado: "desplegado", resumen: "El filtro de CUIT ignoraba los guiones.", enlaces: [{ texto: "PR #12", url: "https://github.com/x/y/pull/12" }] },
        SITIO,
      ),
    );
    expect(r.corregida).toBe(true);
    const [inc] = await base.tx((q) => q<{ estado: string; solucion_aplicada: string }>("select estado, solucion_aplicada from incidencias where id = $1", [urgente.id]));
    expect(inc).toMatchObject({ estado: "corregida" });
    expect(inc!.solucion_aplicada).toContain("guiones");
    expect(inc!.solucion_aplicada).toContain("pull/12");
    expect(await contar("select count(*)::int as n from revalidaciones where incidencia_id = $1 and ejecucion_id is null", [urgente.id])).toBe(1);
    const estados = await base.tx((q) =>
      q<{ valor_nuevo: string; usuario_nombre: string }>("select valor_nuevo, usuario_nombre from incidencia_eventos where incidencia_id = $1 and tipo = 'estado' order by id", [urgente.id]),
    );
    expect(estados).toEqual([
      { valor_nuevo: "en_analisis", usuario_nombre: "Claude (agente)" },
      { valor_nuevo: "en_correccion", usuario_nombre: "Claude (agente)" },
      { valor_nuevo: "corregida", usuario_nombre: "Claude (agente)" },
    ]);
    await expect(base.tx((q) => terminarTrabajo(q, p!.trabajo.numero, { resultado: "bloqueado", resumen: "x" }))).rejects.toThrow("trabajo_no_en_curso");

    // La siguiente de la cola es la de baja prioridad.
    const siguiente = await base.tx((q) => tomarTrabajo(q, SITIO));
    expect(siguiente?.incidencia.numero).toBe(baja.numero);
    await base.tx((q) => fallarTrabajo(q, siguiente!.trabajo.numero, "Se cortó la conexión con GitHub."));
    expect(await base.tx((q) => tomarTrabajo(q, SITIO))).toBeNull();
  });

  it("con «publicar» apagado solo puede dejar el PR abierto, y la incidencia no cambia", async () => {
    await base.tx((q) => guardarConfig(q, equipo, { ...CONFIG, publicar: false }));
    const i = await nuevaIncidencia("PAD-08", "P2");
    await base.tx((q) => pedirTrabajo(q, equipo, i.id));
    const p = await base.tx((q) => tomarTrabajo(q));
    expect(p?.publicar).toBe(false);
    expect(await base.tx((q) => informarAvance(q, p!.trabajo.numero))).toEqual({ seguir: true, publicar: false });
    await expect(base.tx((q) => terminarTrabajo(q, p!.trabajo.numero, { resultado: "desplegado", resumen: "x" }))).rejects.toThrow("agente_sin_publicar");
    expect((await base.tx((q) => terminarTrabajo(q, p!.trabajo.numero, { resultado: "pr_abierto", resumen: "Listo para revisar." }))).corregida).toBe(false);
    const [inc] = await base.tx((q) => q<{ estado: string }>("select estado from incidencias where id = $1", [i.id]));
    expect(inc!.estado).toBe("reportada");
    await base.tx((q) => guardarConfig(q, equipo, CONFIG));
  });

  it("si lo cancelan mientras trabaja, se entera en la próxima señal", async () => {
    const i = await nuevaIncidencia("PAD-09", "P2");
    await base.tx((q) => pedirTrabajo(q, equipo, i.id));
    const p = await base.tx((q) => tomarTrabajo(q));
    await base.tx((q) => cancelarTrabajo(q, equipo, p!.trabajo.numero));
    expect(await base.tx((q) => informarAvance(q, p!.trabajo.numero))).toEqual({ seguir: false, publicar: false });
    await expect(base.tx((q) => terminarTrabajo(q, p!.trabajo.numero, { resultado: "desplegado", resumen: "x" }))).rejects.toThrow("trabajo_no_en_curso");
  });

  it("si deja de dar señales, el trabajo vence y se avisa", async () => {
    const i = await nuevaIncidencia("PAD-10", "P2");
    await base.tx((q) => pedirTrabajo(q, equipo, i.id));
    const p = await base.tx((q) => tomarTrabajo(q));
    await base.tx((q) => q("update trabajos_agente set latido_at = now() - interval '2 hours' where numero = $1", [p!.trabajo.numero]));
    expect(await base.tx((q) => tomarTrabajo(q))).toBeNull();
    const [t] = await base.tx((q) => listarTrabajos(q, { incidenciaId: i.id }));
    expect(t).toMatchObject({ estado: "fallido" });
    expect(await contar("select count(*)::int as n from notificaciones where texto like '%dejó de dar señales%'")).toBeGreaterThan(0);
  });

  it("no se le puede pedir una incidencia ya resuelta", async () => {
    const [cerrada] = await base.tx((q) => q<{ id: string }>("select id from incidencias where estado = 'corregida' limit 1"));
    await expect(base.tx((q) => pedirTrabajo(q, equipo, cerrada!.id))).rejects.toThrow("agente_no_elegible");
  });
});
