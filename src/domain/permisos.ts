// Permisos del panel de administración. El rol se lee de la base en cada pedido,
// nunca del token. Los relevadores no tienen ningún permiso de acá: escribir el
// nombre de un administrador en el portal no da acceso al panel (es otra sesión).
export const ROLES = ["administrador", "desarrollador"] as const;
export type Rol = (typeof ROLES)[number];

export const NOMBRE_ROL: Record<Rol, string> = {
  administrador: "Administrador",
  desarrollador: "Desarrollador",
};

export type Permiso =
  | "panel.ver"
  | "observaciones.clasificar"
  | "incidencias.gestionar"
  | "prioridad.cambiar"
  | "revalidacion.pedir"
  | "informes.exportar"
  | "usuarios.gestionar";

const PERMISOS: Record<Rol, readonly Permiso[]> = {
  administrador: [
    "panel.ver",
    "observaciones.clasificar",
    "incidencias.gestionar",
    "prioridad.cambiar",
    "revalidacion.pedir",
    "informes.exportar",
    "usuarios.gestionar",
  ],
  desarrollador: [
    "panel.ver",
    "observaciones.clasificar",
    "incidencias.gestionar",
    "prioridad.cambiar",
    "revalidacion.pedir",
    "informes.exportar",
  ],
};

export function esRol(v: unknown): v is Rol {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

export function puede(rol: Rol | null | undefined, permiso: Permiso): boolean {
  return !!rol && PERMISOS[rol].includes(permiso);
}
