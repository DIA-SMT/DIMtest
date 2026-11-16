"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { problemaNombre, NOMBRE_MAX } from "@/domain/nombres";
import { esPrioridad } from "@/domain/prioridades";
import { esResultado, requiereExplicacion, RESULTADOS } from "@/domain/resultados";
import { leerFormulario, valoresDe, type EstadoAccion } from "@/lib/accion";
import { borrarArchivos, guardarArchivo, prepararArchivos } from "@/lib/almacenamiento";
import {
  borrarCookieRelevador,
  emitirSesionRelevador,
  exigirRelevador,
  leerRelevador,
  relevadoresDelDispositivo,
} from "@/lib/auth/relevador";
import { conBase } from "@/lib/db";
import { entorno } from "@/lib/entorno";
import { claveDeError, mensajeError } from "@/lib/errores";
import { fechaHora, hora } from "@/lib/fechas";
import { log } from "@/lib/log";
import {
  cerrarSesion,
  confirmarIdentidad,
  guardarEjecucion,
  identificar,
  ingresarConocido,
  liberarReserva,
  renovarReserva,
  tomarPrueba,
  type Identificacion,
} from "./servicio";

const RE_CODIGO = /^[A-Z]{2,4}-\d{2}$/;

// ---------------------------------------------------------------------------
// Ingreso con nombre y apellido
// ---------------------------------------------------------------------------

export interface EstadoIngreso extends EstadoAccion {
  confirmar?: { nombre: string; candidatos: { id: string; nombre: string; ultimoIngreso: string; ejecuciones: number }[] };
}

async function terminarIngreso(r: Identificacion): Promise<EstadoIngreso> {
  if (r.tipo === "confirmar") {
    return {
      confirmar: {
        nombre: r.nombre,
        candidatos: r.candidatos.map((c) => ({ id: c.id, nombre: c.nombre, ultimoIngreso: fechaHora(c.ultimoIngreso), ejecuciones: c.ejecuciones })),
      },
    };
  }
  await emitirSesionRelevador(r.sesionId, r.relevadorId);
  log("relevador.ingreso", { nuevo: r.nuevo });
  redirect("/relevamiento");
}

export async function ingresarAccion(_previo: EstadoIngreso, formData: FormData): Promise<EstadoIngreso> {
  const nombre = String(formData.get("nombre") ?? "").slice(0, NOMBRE_MAX * 2);
  const problema = problemaNombre(nombre);
  if (problema) return { error: "Revisá los datos marcados.", errores: { nombre: problema }, valores: { nombre } };
  const conocidos = await relevadoresDelDispositivo();
  return terminarIngreso(await conBase((q) => identificar(q, nombre, conocidos)));
}

export async function confirmarIdentidadAccion(_previo: EstadoIngreso, formData: FormData): Promise<EstadoIngreso> {
  const nombre = String(formData.get("nombre") ?? "");
  const eleccion = String(formData.get("eleccion") ?? "");
  if (problemaNombre(nombre) || !(eleccion === "nuevo" || /^[0-9a-f-]{36}$/.test(eleccion))) {
    return { error: "Volvé a escribir tu nombre y apellido." };
  }
  return terminarIngreso(await conBase((q) => confirmarIdentidad(q, nombre, eleccion)));
}

/** Segundo ingreso: elige su nombre de la lista de este navegador. */
export async function ingresarConocidoAccion(_previo: EstadoIngreso, formData: FormData): Promise<EstadoIngreso> {
  const id = String(formData.get("relevador") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "Elegí tu nombre de la lista." };
  const conocidos = await relevadoresDelDispositivo();
  const r = await conBase((q) => ingresarConocido(q, id, conocidos));
  if (!r) return { error: "Ese nombre ya no está disponible en este navegador. Escribí tu nombre y apellido." };
  return terminarIngreso(r);
}

/** «Cambiar usuario»: cierra la sesión de este relevador y vuelve al ingreso. */
export async function cambiarUsuarioAccion() {
  const r = await leerRelevador();
  if (r) await conBase((q) => cerrarSesion(q, r.sesionId));
  await borrarCookieRelevador();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Tomar, renovar y liberar una prueba
// ---------------------------------------------------------------------------

export interface EstadoTomar extends EstadoAccion {
  ocupada?: { por: string; desde: string; vence: string };
  confirmar?: { relevador: string; fecha: string; resultado: string };
}

export async function tomarPruebaAccion(_previo: EstadoTomar, formData: FormData): Promise<EstadoTomar> {
  const relevador = await exigirRelevador();
  const codigo = String(formData.get("codigo") ?? "");
  if (!RE_CODIGO.test(codigo)) return { error: mensajeError("prueba_inexistente") };
  const repetir = formData.get("repetir") === "si";
  const r = await conBase((q) => tomarPrueba(q, codigo, relevador, { minutos: entorno.RESERVA_MINUTOS, repetir }));
  if (r.tipo === "ocupada") return { ocupada: { por: r.por, desde: hora(r.desde), vence: hora(r.vence) } };
  if (r.tipo === "confirmar") return { confirmar: { relevador: r.ultima.relevador, fecha: fechaHora(r.ultima.fecha), resultado: r.ultima.resultado } };
  redirect(`/relevamiento/prueba/${codigo}?paso=probar`);
}

/** La llama el formulario abierto cada pocos minutos. */
export async function renovarReservaAccion(codigo: string): Promise<{ vence: string | null }> {
  const relevador = await leerRelevador();
  if (!relevador || !RE_CODIGO.test(codigo)) return { vence: null };
  const vence = await conBase((q) => renovarReserva(q, codigo, relevador.relevadorId, entorno.RESERVA_MINUTOS));
  return { vence: vence ? hora(vence) : null };
}

export async function liberarPruebaAccion(formData: FormData) {
  const relevador = await exigirRelevador();
  const codigo = String(formData.get("codigo") ?? "");
  if (RE_CODIGO.test(codigo)) await conBase((q) => liberarReserva(q, codigo, relevador.relevadorId));
  redirect(RE_CODIGO.test(codigo) ? `/relevamiento/prueba/${codigo}` : "/relevamiento");
}

// ---------------------------------------------------------------------------
// Guardar el resultado
// ---------------------------------------------------------------------------

const esquemaEjecucion = z.object({
  codigo: z.string().regex(RE_CODIGO, "Prueba inválida."),
  resultado: z.enum(RESULTADOS, { error: "Elegí el resultado de la prueba." }),
  observaciones: z.string().max(4000, "Usá como máximo 4000 caracteres.").default(""),
  caso: z.string().max(300, "Usá como máximo 300 caracteres.").default(""),
  prioridad: z.string().default(""),
  despues: z.enum(["seguir", "modulo"]).default("seguir"),
});

export async function guardarEjecucionAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const relevador = await exigirRelevador();
  const leido = leerFormulario(esquemaEjecucion, formData);
  if (!leido.ok) return leido.estado;
  const d = leido.datos;
  if (!esResultado(d.resultado)) return { error: "Elegí el resultado de la prueba." };
  if (requiereExplicacion(d.resultado) && !d.observaciones.trim()) {
    return {
      error: "Revisá los datos marcados.",
      errores: { observaciones: "Para este resultado contá qué pasó (es obligatorio)." },
      valores: valoresDe(formData),
    };
  }

  let rutas: string[] = [];
  let evidencias: { nombre: string; mime: string; tamano: number; ruta: string }[] = [];
  try {
    const archivos = await prepararArchivos(formData.getAll("evidencias"));
    for (const a of archivos) {
      const ruta = await guardarArchivo(a);
      rutas.push(ruta);
      evidencias.push({ nombre: a.nombre, mime: a.mime, tamano: a.datos.length, ruta });
    }
  } catch (error) {
    await borrarArchivos(rutas);
    const clave = claveDeError(error);
    if (!clave) throw error;
    return { error: "Revisá los datos marcados.", errores: { evidencias: mensajeError(clave) }, valores: valoresDe(formData) };
  }

  try {
    await conBase((q) =>
      guardarEjecucion(q, relevador, {
        codigo: d.codigo,
        resultado: d.resultado,
        observaciones: d.observaciones,
        casoUsado: d.caso,
        prioridadSugerida: d.resultado === "no_funciona" || d.resultado === "parcial" ? (esPrioridad(d.prioridad) ? d.prioridad : null) : null,
        evidencias,
      }),
    );
  } catch (error) {
    await borrarArchivos(rutas);
    rutas = [];
    evidencias = [];
    const clave = claveDeError(error);
    if (!clave) throw error;
    return { error: mensajeError(clave), valores: valoresDe(formData) };
  }

  log("ejecucion.guardada", { codigo: d.codigo, resultado: d.resultado, evidencias: evidencias.length });
  const modulo = d.codigo.split("-")[0];
  redirect(`/relevamiento/${modulo}?guardada=${d.codigo}${d.despues === "modulo" ? "&ver=todas" : ""}`);
}
