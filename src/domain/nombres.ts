// Nombre y apellido declarado por el relevador. No es una identidad verificada:
// sirve para mostrar quién probó qué y para evitar perfiles duplicados por error de tipeo.

export const NOMBRE_MIN = 3;
export const NOMBRE_MAX = 80;

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "di", "van", "von"]);

/**
 * Cómo se guarda y se muestra: espacios simples, NFC y cada palabra con mayúscula inicial
 * («  luis   PÉREZ » → «Luis Pérez»). Respeta partículas y apellidos compuestos con guion o apóstrofo.
 */
export function normalizarNombre(entrada: string): string {
  const limpio = entrada.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return limpio
    .split(" ")
    .map((palabra, i) => {
      const minus = palabra.toLocaleLowerCase("es-AR");
      if (i > 0 && PARTICULAS.has(minus)) return minus;
      return minus.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, letra: string) => sep + letra.toLocaleUpperCase("es-AR"));
    })
    .join(" ");
}

/**
 * Clave para comparar: minúsculas, sin tildes ni signos, un espacio entre palabras.
 * «Luis  Pérez», «luis perez» y «LUIS PEREZ» dan la misma clave.
 */
export function claveNombre(entrada: string): string {
  return entrada
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es-AR")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mensaje de error para el campo, o null si el nombre sirve. */
export function problemaNombre(entrada: string): string | null {
  const nombre = normalizarNombre(entrada);
  if (nombre.length === 0) return "Escribí tu nombre y apellido.";
  if (nombre.length < NOMBRE_MIN) return "Escribí tu nombre y apellido completos.";
  if (nombre.length > NOMBRE_MAX) return `Usá como máximo ${NOMBRE_MAX} caracteres.`;
  if (!/\p{L}/u.test(nombre)) return "El nombre tiene que tener letras.";
  if (/[<>{}\[\]\|@#$%^*=+~`]/.test(nombre)) return "Usá solo letras, espacios, guiones o apóstrofos.";
  if (nombre.split(" ").filter((p) => /\p{L}/u.test(p)).length < 2) return "Escribí nombre y apellido (por ejemplo, Luis Pérez).";
  return null;
}

/** Primer nombre, para el saludo. */
export function primerNombre(nombre: string): string {
  return nombre.split(" ")[0] ?? nombre;
}

/** Dos iniciales para el avatar («Luis Pérez» → «LP»), ignorando paréntesis y signos. */
export function iniciales(nombre: string): string {
  const palabras = nombre.match(/\p{L}+/gu) ?? [];
  const primera = palabras[0];
  if (!primera) return "?";
  const ultima = palabras.length > 1 ? (palabras.at(-1) ?? "").charAt(0) : primera.charAt(1);
  return (primera.charAt(0) + ultima).toUpperCase();
}
