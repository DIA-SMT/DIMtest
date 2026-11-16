// Usuario del panel: un correo (lo habitual, D-009) o un usuario corto como los primeros.
// Sin imports: lo usan la app, scripts/admin-crear.mjs y los tests. La misma regla está en
// la base (check de usuarios_admin.usuario, migración 20261116120000).

export const LARGO_MAXIMO_USUARIO = 254;

/** Usuario corto heredado: `nombre.apellido`. */
const USUARIO_CORTO = /^[a-z0-9._-]{3,40}$/;
/** Correo en minúsculas: parte local de hasta 64 caracteres y dominio con al menos un punto. */
const CORREO = /^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/** Como se guarda y se compara: sin espacios alrededor y en minúsculas. */
export function normalizarUsuario(texto: string): string {
  return texto.trim().toLowerCase();
}

export function esCorreo(usuario: string): boolean {
  return usuario.length <= LARGO_MAXIMO_USUARIO && CORREO.test(usuario);
}

/** null si sirve; si no, el mensaje para mostrar. Recibe el valor ya normalizado. */
export function problemaUsuario(usuario: string): string | null {
  if (!usuario) return "Escribí el correo.";
  if (esCorreo(usuario) || USUARIO_CORTO.test(usuario)) return null;
  return "Escribí un correo válido, por ejemplo nombre@smt.gob.ar.";
}
