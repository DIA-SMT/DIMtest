"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { esEstadoIncidencia } from "@/domain/incidencias";
import { esRol, ROLES } from "@/domain/permisos";
import { PRIORIDADES } from "@/domain/prioridades";
import { LARGO_MAXIMO_USUARIO, normalizarUsuario, problemaUsuario } from "@/domain/usuario-admin";
import { leerFormulario, valoresDe, type EstadoAccion } from "@/lib/accion";
import { borrarArchivos, guardarArchivo, prepararArchivos } from "@/lib/almacenamiento";
import { adminConPermiso, borrarSesionAdmin, emitirSesionAdmin, exigirAdmin, ipDelPedido, leerAdmin } from "@/lib/auth/admin";
import { generarClaveTemporal, hashearClave, problemasDeClave, verificarClave } from "@/lib/auth/clave";
import { conBase } from "@/lib/db";
import { claveDeError, mensajeError } from "@/lib/errores";
import { log } from "@/lib/log";
import {
  adjuntarEvidencias,
  asignarResponsable,
  auditar,
  cambiarEstado,
  cambiarPrioridad,
  clasificarObservacion,
  comentar,
  crearIncidencia,
} from "@/features/incidencias/servicio";
import { pedirSiCorresponde } from "@/features/agente/servicio";
import { borrarRelevador } from "@/features/relevamiento/servicio";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Traduce los errores esperables; los inesperados suben a error.tsx. */
async function intentar(fn: () => Promise<void>, formData?: FormData): Promise<EstadoAccion | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    const clave = claveDeError(error);
    if (!clave) throw error;
    return { error: mensajeError(clave), valores: formData ? valoresDe(formData) : undefined };
  }
}

// ---------------------------------------------------------------------------
// Ingreso del equipo
// ---------------------------------------------------------------------------

const LIMITE_INTENTOS = 5;

export async function ingresarAdminAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const usuario = normalizarUsuario(String(formData.get("usuario") ?? "")).slice(0, LARGO_MAXIMO_USUARIO);
  const clave = String(formData.get("clave") ?? "").slice(0, 200);
  if (!usuario || !clave) {
    return {
      error: "Revisá los datos marcados.",
      errores: { ...(usuario ? {} : { usuario: "Escribí tu correo." }), ...(clave ? {} : { clave: "Escribí tu contraseña." }) },
      valores: { usuario },
    };
  }
  const ip = await ipDelPedido();

  const r = await conBase(async (q) => {
    const [{ fallidos_usuario, fallidos_ip }] = await q<{ fallidos_usuario: number; fallidos_ip: number }>(
      `select count(*) filter (where usuario = $1)::int as fallidos_usuario, count(*) filter (where ip = $2)::int as fallidos_ip
         from intentos_ingreso where not exitoso and creado_at > now() - interval '15 minutes'`,
      [usuario, ip],
    );
    if (fallidos_usuario >= LIMITE_INTENTOS || fallidos_ip >= LIMITE_INTENTOS * 4) return { error: "limite_intentos" as const };
    const [u] = await q<{ id: string; nombre: string; clave_hash: string; activo: boolean; sesion_version: number }>(
      // La cuenta del agente nunca ingresa al panel (D-015).
      "select id, nombre, clave_hash, activo, sesion_version from usuarios_admin where usuario = $1 and not es_agente",
      [usuario],
    );
    const ok = await verificarClave(clave, u?.clave_hash);
    await q("insert into intentos_ingreso (usuario, ip, exitoso) values ($1, $2, $3)", [usuario, ip, ok && !!u?.activo]);
    if (!ok || !u) return { error: "credenciales" as const };
    if (!u.activo) return { error: "usuario_inactivo" as const };
    await q("update usuarios_admin set ultimo_ingreso_at = now() where id = $1", [u.id]);
    await auditar(q, { id: u.id, nombre: u.nombre }, "admin.ingreso");
    return { usuario: u };
  });

  if ("error" in r) {
    log("admin.ingreso_rechazado", { motivo: r.error });
    return { error: mensajeError(r.error), valores: { usuario } };
  }
  await emitirSesionAdmin(r.usuario.id, r.usuario.sesion_version);
  redirect("/admin");
}

export async function salirAdminAccion() {
  const u = await leerAdmin();
  if (u) await conBase((q) => auditar(q, u, "admin.salida"));
  await borrarSesionAdmin();
  redirect("/admin/ingresar");
}

export async function cambiarClaveAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const u = await exigirAdmin();
  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const repetida = String(formData.get("repetida") ?? "");
  const errores: Record<string, string> = {};
  const problemas = problemasDeClave(nueva);
  if (problemas.length) errores.nueva = problemas.join(" ");
  if (nueva !== repetida) errores.repetida = "Las dos contraseñas nuevas no coinciden.";
  if (nueva && nueva === actual) errores.nueva = "Tiene que ser distinta de la actual.";
  if (Object.keys(errores).length) return { error: "Revisá los datos marcados.", errores };

  const r = await conBase(async (q) => {
    const [fila] = await q<{ clave_hash: string; sesion_version: number }>("select clave_hash, sesion_version from usuarios_admin where id = $1", [u.id]);
    if (!(await verificarClave(actual, fila?.clave_hash))) return null;
    const [n] = await q<{ sesion_version: number }>(
      "update usuarios_admin set clave_hash = $2, debe_cambiar_clave = false, sesion_version = sesion_version + 1 where id = $1 returning sesion_version",
      [u.id, await hashearClave(nueva)],
    );
    await auditar(q, u, "admin.cambio_clave");
    return n.sesion_version;
  });
  if (r === null) return { error: "Revisá los datos marcados.", errores: { actual: mensajeError("clave_actual_incorrecta") } };
  // Cambiar la contraseña cierra las otras sesiones; esta sigue con la versión nueva.
  await emitirSesionAdmin(u.id, r);
  return { ok: true, mensaje: "Listo: tu contraseña nueva ya está activa." };
}

// ---------------------------------------------------------------------------
// Observaciones
// ---------------------------------------------------------------------------

export async function clasificarObservacionAccion(formData: FormData) {
  const u = await adminConPermiso("observaciones.clasificar");
  if (!u) redirect("/admin/ingresar");
  const id = String(formData.get("ejecucion") ?? "");
  const clasificacion = formData.get("clasificacion") === "informativa" ? "informativa" : "sin_revisar";
  if (UUID.test(id)) await conBase((q) => clasificarObservacion(q, u, id, clasificacion));
  // La bandeja y el detalle de cada observación.
  revalidatePath("/admin/observaciones", "layout");
}

// ---------------------------------------------------------------------------
// Incidencias
// ---------------------------------------------------------------------------

const esquemaIncidencia = z.object({
  prueba: z.string().regex(/^[A-Z]{2,4}-\d{2}$/, "Elegí la prueba."),
  ejecucion: z.string().regex(UUID).optional().or(z.literal("")),
  descripcion: z.string().trim().min(3, "Describí el problema.").max(4000, "Usá como máximo 4000 caracteres."),
  esperado: z.string().max(2000).default(""),
  observado: z.string().max(4000).default(""),
  prioridad: z.enum(PRIORIDADES, { error: "Elegí la prioridad." }),
  responsable: z.string().regex(UUID).optional().or(z.literal("")),
});

export async function crearIncidenciaAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const u = await adminConPermiso("incidencias.gestionar");
  if (!u) return { error: mensajeError("sin_permiso") };
  const leido = leerFormulario(esquemaIncidencia, formData);
  if (!leido.ok) return leido.estado;
  const d = leido.datos;
  let numero = 0;
  const error = await intentar(async () => {
    const r = await conBase(async (q) => {
      const i = await crearIncidencia(q, u, {
        pruebaCodigo: d.prueba,
        ejecucionId: d.ejecucion || null,
        descripcion: d.descripcion,
        resultadoEsperado: d.esperado,
        resultadoObservado: d.observado,
        prioridad: d.prioridad,
        responsableId: d.responsable || null,
      });
      await auditar(q, u, "incidencia.crear", { numero: i.numero, prueba: d.prueba });
      // Si el agente está encendido en modo automático para esta prioridad, entra a su cola (D-015).
      await pedirSiCorresponde(q, i.id);
      return i;
    });
    numero = r.numero;
  }, formData);
  if (error) return error;
  log("incidencia.creada", { numero, prioridad: d.prioridad });
  redirect(`/admin/incidencias/${numero}?creada=1`);
}

function rutaIncidencia(formData: FormData) {
  const numero = Number(formData.get("numero"));
  return Number.isInteger(numero) && numero > 0 ? `/admin/incidencias/${numero}` : "/admin/incidencias";
}

export async function cambiarEstadoAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const u = await adminConPermiso("incidencias.gestionar");
  if (!u) return { error: mensajeError("sin_permiso") };
  const id = String(formData.get("id") ?? "");
  const hacia = String(formData.get("hacia") ?? "");
  if (!UUID.test(id) || !esEstadoIncidencia(hacia)) return { error: mensajeError("transicion_invalida") };
  const texto = (k: string) => String(formData.get(k) ?? "").slice(0, 4000);
  const error = await intentar(
    () => conBase((q) => cambiarEstado(q, u, id, { hacia, comentario: texto("comentario"), solucion: texto("solucion"), justificacion: texto("justificacion") })),
    formData,
  );
  if (error) return error;
  revalidatePath(rutaIncidencia(formData));
  return { ok: true, mensaje: "Estado actualizado." };
}

export async function cambiarPrioridadAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const u = await adminConPermiso("prioridad.cambiar");
  if (!u) return { error: mensajeError("sin_permiso") };
  const id = String(formData.get("id") ?? "");
  const prioridad = String(formData.get("prioridad") ?? "");
  if (!UUID.test(id) || !(PRIORIDADES as readonly string[]).includes(prioridad)) return { error: "Elegí una prioridad." };
  const error = await intentar(() =>
    conBase((q) => cambiarPrioridad(q, u, id, prioridad as (typeof PRIORIDADES)[number], String(formData.get("comentario") ?? "").slice(0, 1000))).then(() => {}),
  );
  if (error) return error;
  revalidatePath("/admin/prioridades");
  revalidatePath(rutaIncidencia(formData));
  return { ok: true, mensaje: "Prioridad actualizada." };
}

/** Cambio rápido desde la vista de prioridades (sin estado de formulario). */
export async function cambiarPrioridadRapidaAccion(formData: FormData) {
  await cambiarPrioridadAccion({}, formData);
}

export async function asignarResponsableAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const u = await adminConPermiso("incidencias.gestionar");
  if (!u) return { error: mensajeError("sin_permiso") };
  const id = String(formData.get("id") ?? "");
  const responsable = String(formData.get("responsable") ?? "");
  if (!UUID.test(id) || (responsable && !UUID.test(responsable))) return { error: "Elegí un responsable." };
  const error = await intentar(() => conBase((q) => asignarResponsable(q, u, id, responsable || null)).then(() => {}));
  if (error) return error;
  revalidatePath(rutaIncidencia(formData));
  return { ok: true, mensaje: "Responsable actualizado." };
}

export async function comentarAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const u = await adminConPermiso("incidencias.gestionar");
  if (!u) return { error: mensajeError("sin_permiso") };
  const id = String(formData.get("id") ?? "");
  const texto = String(formData.get("comentario") ?? "").slice(0, 4000);
  if (!UUID.test(id)) return { error: mensajeError("incidencia_inexistente") };
  if (!texto.trim()) return { error: "Revisá los datos marcados.", errores: { comentario: "Escribí el comentario." } };

  let rutas: string[] = [];
  const error = await intentar(async () => {
    const archivos = await prepararArchivos(formData.getAll("evidencias"));
    const guardados: { nombre: string; mime: string; tamano: number; ruta: string }[] = [];
    for (const a of archivos) {
      const ruta = await guardarArchivo(a);
      rutas.push(ruta);
      guardados.push({ nombre: a.nombre, mime: a.mime, tamano: a.datos.length, ruta });
    }
    await conBase(async (q) => {
      await comentar(q, u, id, texto);
      if (guardados.length) await adjuntarEvidencias(q, u, id, guardados);
    });
    rutas = [];
  }, formData);
  if (rutas.length) await borrarArchivos(rutas);
  if (error) return error;
  revalidatePath(rutaIncidencia(formData));
  return { ok: true, mensaje: "Comentario agregado." };
}

// ---------------------------------------------------------------------------
// Usuarios del equipo
// ---------------------------------------------------------------------------

const esquemaUsuario = z.object({
  usuario: z
    .string()
    .transform(normalizarUsuario)
    .superRefine((u, ctx) => {
      const problema = problemaUsuario(u);
      if (problema) ctx.addIssue({ code: "custom", message: problema });
    }),
  nombre: z.string().trim().min(3, "Escribí el nombre y apellido.").max(80),
  rol: z.enum(ROLES, { error: "Elegí el rol." }),
});

export async function crearUsuarioAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const u = await adminConPermiso("usuarios.gestionar");
  if (!u) return { error: mensajeError("sin_permiso") };
  const leido = leerFormulario(esquemaUsuario, formData);
  if (!leido.ok) return leido.estado;
  const d = leido.datos;
  const temporal = generarClaveTemporal();
  const r = await conBase(async (q) => {
    const [existe] = await q("select 1 from usuarios_admin where usuario = $1", [d.usuario]);
    if (existe) return false;
    await q("insert into usuarios_admin (usuario, nombre, rol, clave_hash, debe_cambiar_clave) values ($1, $2, $3, $4, true)", [
      d.usuario,
      d.nombre,
      d.rol,
      await hashearClave(temporal),
    ]);
    await auditar(q, u, "usuario.crear", { usuario: d.usuario, rol: d.rol });
    return true;
  });
  if (!r) return { error: "Revisá los datos marcados.", errores: { usuario: mensajeError("usuario_repetido") }, valores: valoresDe(formData) };
  revalidatePath("/admin/usuarios");
  return { ok: true, mensaje: `Se creó la cuenta ${d.usuario}.`, datos: { usuario: d.usuario, temporal } };
}

export async function actualizarUsuarioAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const u = await adminConPermiso("usuarios.gestionar");
  if (!u) return { error: mensajeError("sin_permiso") };
  const id = String(formData.get("id") ?? "");
  const operacion = String(formData.get("operacion") ?? "");
  if (!UUID.test(id)) return { error: "Usuario inválido." };
  if (id === u.id && operacion !== "restablecer") return { error: "No podés cambiar tu propio rol ni desactivarte." };
  // La cuenta del agente no se toca desde Equipo: se maneja desde la página del agente.
  const [esAgente] = await conBase((q) => q("select 1 from usuarios_admin where id = $1 and es_agente", [id]));
  if (esAgente) return { error: "Usuario inválido." };

  if (operacion === "restablecer") {
    const temporal = generarClaveTemporal();
    const usuario = await conBase(async (q) => {
      const [f] = await q<{ usuario: string }>(
        "update usuarios_admin set clave_hash = $2, debe_cambiar_clave = true, sesion_version = sesion_version + 1 where id = $1 returning usuario",
        [id, await hashearClave(temporal)],
      );
      if (f) await auditar(q, u, "usuario.restablecer_clave", { usuario: f.usuario });
      return f?.usuario;
    });
    revalidatePath("/admin/usuarios");
    return usuario ? { ok: true, mensaje: `Nueva contraseña temporal para ${usuario}.`, datos: { usuario, temporal } } : { error: "Usuario inválido." };
  }
  if (operacion === "activar" || operacion === "desactivar") {
    await conBase(async (q) => {
      await q("update usuarios_admin set activo = $2, sesion_version = sesion_version + 1 where id = $1", [id, operacion === "activar"]);
      await auditar(q, u, `usuario.${operacion}`, { id });
    });
    revalidatePath("/admin/usuarios");
    return { ok: true, mensaje: operacion === "activar" ? "Usuario activado." : "Usuario desactivado: sus sesiones se cerraron." };
  }
  const rol = String(formData.get("rol") ?? "");
  if (operacion === "rol" && esRol(rol)) {
    await conBase(async (q) => {
      await q("update usuarios_admin set rol = $2 where id = $1", [id, rol]);
      await auditar(q, u, "usuario.rol", { id, rol });
    });
    revalidatePath("/admin/usuarios");
    return { ok: true, mensaje: "Rol actualizado." };
  }
  return { error: "Operación inválida." };
}


// ---------------------------------------------------------------------------
// Relevadores
// ---------------------------------------------------------------------------

/** Borra un relevador sin pruebas registradas (D-013). */
export async function borrarRelevadorAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const u = await adminConPermiso("usuarios.gestionar");
  if (!u) return { error: mensajeError("sin_permiso") };
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return { error: "Relevador inválido." };
  const r = await conBase(async (q) => {
    const borrado = await borrarRelevador(q, id);
    if (borrado.tipo === "borrado") await auditar(q, u, "relevador.borrar", { id, sesiones: borrado.sesiones });
    return borrado;
  });
  if (r.tipo === "con_pruebas") return { error: "Registró pruebas: no se puede borrar, el historial se conserva." };
  if (r.tipo === "con_sugerencias") return { error: "Dejó sugerencias: no se puede borrar, se conservan con su nombre." };
  revalidatePath("/admin/relevadores");
  return r.tipo === "borrado" ? { ok: true, mensaje: "Relevador borrado." } : { error: "Ese relevador ya no existe." };
}
