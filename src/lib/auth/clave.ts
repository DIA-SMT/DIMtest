// Contraseñas del panel de administración. Copia reducida de CementerIA
// (src/lib/auth/clave.ts): scrypt con sal y parámetros dentro del valor guardado,
// verificación en tiempo constante y un señuelo cuando el usuario no existe.
// Pura (solo node:crypto): la usan el ingreso, la administración de usuarios,
// el script `npm run admin:crear` y los tests.
import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

export interface ParametrosScrypt {
  N: number;
  r: number;
  p: number;
}

/** OWASP: N = 2^15, r = 8, p = 3 (32 MiB, ~160 ms en una PC de oficina). */
export const PARAMETROS_ACTUALES: Readonly<ParametrosScrypt> = Object.freeze({ N: 2 ** 15, r: 8, p: 3 });

export const LARGO_MINIMO_CLAVE = 12;
export const LARGO_MAXIMO_CLAVE = 128;

const COTAS = { N: [2 ** 10, 2 ** 20], r: [1, 32], p: [1, 16] } as const;

function derivar(clave: string, sal: Buffer, largo: number, { N, r, p }: ParametrosScrypt): Promise<Buffer> {
  const opciones: ScryptOptions = { N, r, p, maxmem: 256 * N * r };
  return new Promise((resolve, reject) => {
    scrypt(clave.normalize("NFC"), sal, largo, opciones, (error, hash) => (error ? reject(error) : resolve(hash)));
  });
}

export async function hashearClave(clave: string, parametros: ParametrosScrypt = PARAMETROS_ACTUALES): Promise<string> {
  if (clave.length === 0 || clave.length > LARGO_MAXIMO_CLAVE) throw new Error("hashearClave: largo fuera de rango");
  const sal = randomBytes(16);
  const hash = await derivar(clave, sal, 32, parametros);
  return `scrypt$${parametros.N}$${parametros.r}$${parametros.p}$${sal.toString("base64url")}$${hash.toString("base64url")}`;
}

const RE_HASH = /^scrypt\$([1-9]\d{0,7})\$([1-9]\d{0,2})\$([1-9]\d{0,2})\$([A-Za-z0-9_-]{22,})\$([A-Za-z0-9_-]{22,})$/;

function dentro(valor: number, [min, max]: readonly [number, number]) {
  return Number.isSafeInteger(valor) && valor >= min && valor <= max;
}

interface HashLeido {
  parametros: ParametrosScrypt;
  sal: Buffer;
  hash: Buffer;
}

export function leerHash(valor: string | null | undefined): HashLeido | null {
  const m = typeof valor === "string" ? RE_HASH.exec(valor) : null;
  if (!m) return null;
  const parametros = { N: Number(m[1]), r: Number(m[2]), p: Number(m[3]) };
  if (!dentro(parametros.N, COTAS.N) || (parametros.N & (parametros.N - 1)) !== 0) return null;
  if (!dentro(parametros.r, COTAS.r) || !dentro(parametros.p, COTAS.p)) return null;
  const sal = Buffer.from(m[4], "base64url");
  const hash = Buffer.from(m[5], "base64url");
  if (sal.length < 16 || hash.length < 16 || hash.length > 64) return null;
  return { parametros, sal, hash };
}

let senuelo: Promise<HashLeido> | undefined;
function hashSenuelo() {
  senuelo ??= hashearClave(randomBytes(24).toString("base64url")).then((h) => leerHash(h) as HashLeido);
  return senuelo;
}

/**
 * ¿`clave` corresponde al hash guardado? Sin hash válido (usuario inexistente) hace
 * el mismo cálculo contra un señuelo, para que el tiempo no delate el caso.
 */
export async function verificarClave(clave: string, guardado: string | null | undefined): Promise<boolean> {
  const leido = leerHash(guardado);
  const contra = leido ?? (await hashSenuelo());
  const valida = clave.length > 0 && clave.length <= LARGO_MAXIMO_CLAVE;
  const calculado = await derivar(valida ? clave : "-", contra.sal, contra.hash.length, contra.parametros);
  return timingSafeEqual(calculado, contra.hash) && valida && leido !== null;
}

/** Minúsculas y dígitos sin los que se confunden (i, l, o, 0, 1). Cuatro grupos: ~79 bits. */
const ALFABETO_TEMPORAL = "abcdefghjkmnpqrstuvwxyz23456789";

export function generarClaveTemporal(): string {
  const grupos: string[] = [];
  for (let g = 0; g < 4; g++) {
    let grupo = "";
    for (let i = 0; i < 4; i++) grupo += ALFABETO_TEMPORAL[randomInt(ALFABETO_TEMPORAL.length)];
    grupos.push(grupo);
  }
  return grupos.join("-");
}

const CLAVES_COMUNES = [
  "password", "contrasena", "clave", "qwerty", "asdfgh", "admin", "administrador", "usuario",
  "bienvenido", "cambiar", "secreto", "municipalidad", "sanmiguel", "tucuman", "argentina",
  "dim", "dimqa", "dimlocal",
];

function soloLetras(texto: string) {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-zñ]/g, "");
}

/** Lo que no cumple una contraseña nueva, en palabras (vacío = cumple). */
export function problemasDeClave(clave: string, usuario: string): string[] {
  const problemas: string[] = [];
  if (clave.length < LARGO_MINIMO_CLAVE) problemas.push(`Tiene que tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`);
  if (clave.length > LARGO_MAXIMO_CLAVE) problemas.push(`No puede tener más de ${LARGO_MAXIMO_CLAVE} caracteres.`);
  if (new Set(clave).size < 5) problemas.push("Usá al menos 5 caracteres distintos.");
  const letras = soloLetras(clave);
  if (letras && CLAVES_COMUNES.includes(letras)) problemas.push("Es una contraseña común: elegí otra.");
  if (usuario && clave.toLowerCase().includes(usuario.toLowerCase())) problemas.push("No puede contener tu usuario.");
  return problemas;
}
