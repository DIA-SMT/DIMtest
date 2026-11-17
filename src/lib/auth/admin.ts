import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { esRol, puede, type Permiso, type Rol } from "@/domain/permisos";
import { conBase } from "@/lib/db";
import { COOKIE, DURACION, firmar, opcionesCookie, verificar, type DatosSesionAdmin } from "./tokens";

/**
 * Sesión del panel de administración: usuario y contraseña (scrypt), con límite de
 * intentos en la base. Es otra cookie y otra audiencia que la del relevador: una sesión
 * de relevamiento nunca abre el panel. El rol se lee de la base en cada pedido.
 */
export interface UsuarioAdmin {
  id: string;
  usuario: string;
  nombre: string;
  rol: Rol;
  debeCambiarClave: boolean;
}

export const leerAdmin = cache(async (): Promise<UsuarioAdmin | null> => {
  const datos = await verificar<DatosSesionAdmin>("admin", (await cookies()).get(COOKIE.admin)?.value);
  if (!datos?.sub || typeof datos.sv !== "number" || typeof datos.inicio !== "number") return null;
  if (Date.now() / 1000 - datos.inicio > DURACION.adminMaximo) return null;
  const filas = await conBase((q) =>
    q<{ id: string; usuario: string; nombre: string; rol: string; debe_cambiar_clave: boolean }>(
      `select id, usuario, nombre, rol, debe_cambiar_clave from usuarios_admin
        where id = $1 and activo and not es_agente and sesion_version = $2`,
      [datos.sub, datos.sv],
    ),
  );
  const u = filas[0];
  if (!u || !esRol(u.rol)) return null;
  return { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, debeCambiarClave: u.debe_cambiar_clave };
});

/**
 * La barrera del panel: cada página, acción y route handler la llama (el proxy solo
 * redirige por comodidad). Sin sesión, al ingreso; sin el permiso, 404 (no se anuncia).
 */
export async function exigirAdmin(permiso: Permiso = "panel.ver"): Promise<UsuarioAdmin> {
  const u = await leerAdmin();
  if (!u) redirect("/admin/ingresar");
  if (!puede(u.rol, permiso)) notFound();
  return u;
}

/** Igual que exigirAdmin, pero para acciones: devuelve null en vez de redirigir. */
export async function adminConPermiso(permiso: Permiso): Promise<UsuarioAdmin | null> {
  const u = await leerAdmin();
  return u && puede(u.rol, permiso) ? u : null;
}

export async function emitirSesionAdmin(usuarioId: string, sesionVersion: number) {
  const inicio = Math.floor(Date.now() / 1000);
  const token = await firmar("admin", { sub: usuarioId, sv: sesionVersion, inicio }, DURACION.admin);
  (await cookies()).set(COOKIE.admin, token, opcionesCookie(DURACION.adminMaximo));
}

export async function borrarSesionAdmin() {
  (await cookies()).delete(COOKIE.admin);
}

/** IP del pedido, para el límite de intentos (primer valor de x-forwarded-for). */
export async function ipDelPedido(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 64);
}
