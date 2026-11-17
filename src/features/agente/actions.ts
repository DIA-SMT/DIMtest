"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizarWhatsapp } from "@/domain/agente";
import { esPrioridad, PRIORIDADES } from "@/domain/prioridades";
import type { EstadoAccion } from "@/lib/accion";
import { adminConPermiso } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { claveDeError, mensajeError } from "@/lib/errores";
import { log } from "@/lib/log";
import { enviarAvisosPendientes } from "./avisos";
import { cancelarTrabajo, generarToken, guardarConfig, guardarWhatsapp, pedirTrabajo, revocarToken } from "./servicio";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ---------------------------------------------------------------------------
// Configuración (solo administradores)
// ---------------------------------------------------------------------------

export async function guardarConfigAgenteAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const u = await adminConPermiso("usuarios.gestionar");
  if (!u) return { error: mensajeError("sin_permiso") };
  const prioridades = formData.getAll("prioridades").map(String).filter(esPrioridad);
  const config = {
    activo: formData.get("activo") === "si",
    automatico: formData.get("automatico") === "si",
    prioridadesAutomaticas: PRIORIDADES.filter((p) => prioridades.includes(p)),
    publicar: formData.get("publicar") === "si",
  };
  await conBase((q) => guardarConfig(q, u, config));
  log("agente.config", { activo: config.activo, automatico: config.automatico, publicar: config.publicar });
  revalidatePath("/admin/agente");
  return { ok: true, mensaje: config.activo ? "Guardado. El agente está encendido." : "Guardado. El agente está apagado: no recibe trabajo." };
}

export async function generarTokenAgenteAccion(): Promise<EstadoAccion> {
  const u = await adminConPermiso("usuarios.gestionar");
  if (!u) return { error: mensajeError("sin_permiso") };
  const token = await conBase((q) => generarToken(q, u));
  log("agente.token_generado");
  revalidatePath("/admin/agente");
  return { ok: true, mensaje: "Token nuevo. El anterior dejó de funcionar.", datos: { token } };
}

export async function revocarTokenAgenteAccion() {
  const u = await adminConPermiso("usuarios.gestionar");
  if (!u) redirect("/admin/ingresar");
  await conBase((q) => revocarToken(q, u));
  log("agente.token_revocado");
  revalidatePath("/admin/agente");
}

export async function reintentarAvisosAccion() {
  const u = await adminConPermiso("usuarios.gestionar");
  if (!u) redirect("/admin/ingresar");
  // Los que quedaron «sin canal» (antes de configurar WhatsApp) vuelven a la cola.
  await conBase((q) => q("update notificaciones set estado = 'pendiente', intentos = 0, error = null where estado in ('sin_canal', 'fallida')"));
  await enviarAvisosPendientes(50);
  revalidatePath("/admin/agente");
}

// ---------------------------------------------------------------------------
// Pedir y cancelar (quien gestiona incidencias)
// ---------------------------------------------------------------------------

function volverA(formData: FormData) {
  const numero = Number(formData.get("numero"));
  return Number.isInteger(numero) && numero > 0 ? `/admin/incidencias/${numero}` : "/admin/agente";
}

export async function pedirAgenteAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const u = await adminConPermiso("incidencias.gestionar");
  if (!u) return { error: mensajeError("sin_permiso") };
  const id = String(formData.get("incidencia") ?? "");
  if (!UUID.test(id)) return { error: mensajeError("incidencia_inexistente") };
  try {
    const t = await conBase((q) => pedirTrabajo(q, u, id));
    log("agente.pedido", { trabajo: t.numero });
  } catch (error) {
    const clave = claveDeError(error);
    if (!clave) throw error;
    return { error: mensajeError(clave) };
  }
  revalidatePath(volverA(formData));
  return { ok: true, mensaje: "Pedido. El agente lo toma en los próximos minutos (si está encendido)." };
}

export async function cancelarTrabajoAccion(formData: FormData) {
  const u = await adminConPermiso("incidencias.gestionar");
  if (!u) redirect("/admin/ingresar");
  const numero = Number(formData.get("trabajo"));
  if (Number.isInteger(numero) && numero > 0) await conBase((q) => cancelarTrabajo(q, u, numero));
  revalidatePath(volverA(formData));
  revalidatePath("/admin/agente");
}

// ---------------------------------------------------------------------------
// Mi WhatsApp (cada persona el suyo)
// ---------------------------------------------------------------------------

export async function guardarWhatsappAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const u = await adminConPermiso("panel.ver");
  if (!u) return { error: mensajeError("no_autenticado") };
  const texto = String(formData.get("whatsapp") ?? "").slice(0, 40);
  const avisos = formData.get("avisos") === "si";
  const whatsapp = texto.trim() ? normalizarWhatsapp(texto) : null;
  if (texto.trim() && !whatsapp) {
    return { error: "Revisá los datos marcados.", errores: { whatsapp: mensajeError("whatsapp_invalido") }, valores: { whatsapp: texto } };
  }
  await conBase((q) => guardarWhatsapp(q, u.id, whatsapp, avisos));
  revalidatePath("/admin/cuenta");
  return {
    ok: true,
    mensaje: !whatsapp
      ? "Sacaste tu número: no vas a recibir avisos."
      : avisos
        ? "Listo: vas a recibir todos los avisos del agente."
        : "Listo: vas a recibir los avisos de las incidencias donde seas responsable.",
  };
}
