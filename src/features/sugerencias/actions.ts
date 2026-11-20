"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  DETALLE_SUGERENCIA_MAX,
  esEstadoSugerencia,
  problemaRespuesta,
  RESPUESTA_SUGERENCIA_MAX,
  TIPOS_SUGERENCIA,
  TITULO_SUGERENCIA_MAX,
} from "@/domain/sugerencias";
import { leerFormulario, valoresDe, type EstadoAccion } from "@/lib/accion";
import { adminConPermiso } from "@/lib/auth/admin";
import { leerRelevador } from "@/lib/auth/relevador";
import { conBase } from "@/lib/db";
import { claveDeError, mensajeError } from "@/lib/errores";
import { log } from "@/lib/log";
import { crearSugerencia, responderSugerencia } from "./servicio";

const esquemaSugerencia = z.object({
  tipo: z.enum(TIPOS_SUGERENCIA, { error: "Elegí qué tipo de sugerencia es." }),
  modulo: z
    .string()
    .regex(/^([A-Z]{2,4})?$/, "Elegí un módulo de la lista.")
    .optional()
    .transform((v) => v || null),
  titulo: z
    .string()
    .trim()
    .min(3, "Escribí un título corto, de al menos 3 letras.")
    .max(TITULO_SUGERENCIA_MAX, `Hasta ${TITULO_SUGERENCIA_MAX} caracteres.`),
  detalle: z
    .string()
    .trim()
    .min(10, "Contanos un poco más: qué necesitás y para qué te serviría.")
    .max(DETALLE_SUGERENCIA_MAX, `Hasta ${DETALLE_SUGERENCIA_MAX} caracteres.`),
});

/** Portal: el relevador propone una función nueva, una mejora u otra idea. */
export async function proponerSugerenciaAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const relevador = await leerRelevador();
  if (!relevador) return { error: mensajeError("no_autenticado") };
  const leido = leerFormulario(esquemaSugerencia, formData);
  if (!leido.ok) return leido.estado;
  const d = leido.datos;
  let numero: number;
  try {
    numero = await conBase((q) => crearSugerencia(q, relevador, { tipo: d.tipo, moduloCodigo: d.modulo, titulo: d.titulo, detalle: d.detalle }));
  } catch (error) {
    const clave = claveDeError(error);
    if (!clave) throw error;
    return { error: mensajeError(clave), valores: valoresDe(formData) };
  }
  log("sugerencia.creada", { numero, tipo: d.tipo });
  revalidatePath("/relevamiento/sugerencias");
  redirect(`/relevamiento/sugerencias?enviada=${numero}`);
}

/** Panel: el equipo cambia el estado y le contesta al relevador. */
export async function responderSugerenciaAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const u = await adminConPermiso("observaciones.clasificar");
  if (!u) return { error: mensajeError("sin_permiso") };
  const numero = Number(formData.get("numero"));
  const estado = String(formData.get("estado") ?? "");
  const respuesta = String(formData.get("respuesta") ?? "").slice(0, RESPUESTA_SUGERENCIA_MAX + 1);
  if (!Number.isInteger(numero) || numero < 1 || !esEstadoSugerencia(estado)) return { error: mensajeError("transicion_invalida") };
  const problema = problemaRespuesta(estado, respuesta.trim());
  if (problema) return { error: "Revisá los datos marcados.", errores: { respuesta: problema }, valores: valoresDe(formData) };
  try {
    await conBase((q) => responderSugerencia(q, u, numero, { estado, respuesta }));
  } catch (error) {
    const clave = claveDeError(error);
    if (!clave) throw error;
    return { error: mensajeError(clave), valores: valoresDe(formData) };
  }
  log("sugerencia.respondida", { numero, estado });
  revalidatePath("/admin/sugerencias");
  return { ok: true, mensaje: "Guardado. Quien la propuso ya lo ve en el portal." };
}
