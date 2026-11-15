// Tokens de sesión propios (jose, HS256). Sin `server-only` ni node:crypto: también los
// usa src/proxy.ts. Cada tipo de token tiene su propia audiencia, así un token de
// relevador nunca sirve como sesión de administración.
import { jwtVerify, SignJWT, type JWTPayload } from "jose";

export const AUDIENCIA = {
  relevador: "dim360:relevador",
  dispositivo: "dim360:dispositivo",
  admin: "dim360:admin",
} as const;
export type TipoToken = keyof typeof AUDIENCIA;

const EMISOR = "dim360-qa";

/** Duración de cada token, en segundos. */
export const DURACION = {
  /** El relevador no vuelve a escribir su nombre durante 30 días en ese dispositivo (se renueva al usar). */
  relevador: 30 * 24 * 3600,
  /** Qué relevadores ingresaron desde este dispositivo, para reconocerlos sin preguntar. */
  dispositivo: 365 * 24 * 3600,
  /** Administración: 60 minutos sin actividad… */
  admin: 60 * 60,
  /** …y 10 horas como máximo desde el ingreso (estándar DIA 03 §3). */
  adminMaximo: 10 * 3600,
} as const;

const produccion = process.env.NODE_ENV === "production";

/** Nombres de cookie: con prefijo __Host- en producción (exige Secure, path=/ y sin Domain). */
export const COOKIE = {
  relevador: produccion ? "__Host-dim360-relevador" : "dim360-relevador",
  dispositivo: produccion ? "__Host-dim360-dispositivo" : "dim360-dispositivo",
  admin: produccion ? "__Host-dim360-admin" : "dim360-admin",
} as const;

export function opcionesCookie(maxAge: number) {
  return { httpOnly: true, secure: produccion, sameSite: "lax" as const, path: "/", maxAge };
}

function clave(): Uint8Array {
  // El valor de desarrollo es público (está en el repositorio): en producción nunca se usa,
  // así nadie puede fabricar una sesión. src/lib/entorno.ts además impide arrancar sin la variable.
  const secreto = process.env.SESSION_SECRET;
  if (!secreto && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET es obligatoria en producción.");
  return new TextEncoder().encode(secreto || "dim360-qa-secreto-de-desarrollo-local-no-usar");
}

export async function firmar(tipo: TipoToken, datos: JWTPayload, segundos: number): Promise<string> {
  return new SignJWT(datos)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(EMISOR)
    .setAudience(AUDIENCIA[tipo])
    .setIssuedAt()
    .setExpirationTime(`${segundos}s`)
    .sign(clave());
}

export async function verificar<T extends JWTPayload>(tipo: TipoToken, token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<T>(token, clave(), { issuer: EMISOR, audience: AUDIENCIA[tipo], algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

export interface DatosSesionAdmin extends JWTPayload {
  sub: string;
  /** sesion_version del usuario al ingresar: si cambia, la sesión deja de valer. */
  sv: number;
  /** Momento del ingreso (segundos), para el máximo de 10 horas. */
  inicio: number;
}

export interface DatosSesionRelevador extends JWTPayload {
  /** id de sesiones_relevador. */
  sub: string;
}

export interface DatosDispositivo extends JWTPayload {
  /** relevadores.id que ingresaron desde este navegador (máximo 5). */
  ids: string[];
}
