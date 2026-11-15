// Catálogo oficial: 217 pruebas en 22 módulos, extraído del PDF de la DIM con
// `npm run catalogo:extraer` (scripts/catalogo-extraer.mjs). Los códigos son los del PDF.
import datos from "./catalogo-dim360.json";

export type Perfil = "C" | "O" | "A" | "S" | "P";

export const catalogo = datos;

export const NOMBRE_PERFIL: Record<Perfil, string> = {
  C: "Contribuyente",
  O: "Operador de la DIM",
  A: "Administrador del sistema",
  S: "Proceso automático",
  P: "Público, sin iniciar sesión",
};

export function esPerfil(v: unknown): v is Perfil {
  return typeof v === "string" && v in NOMBRE_PERFIL;
}

export const TOTAL_PRUEBAS = datos.totalSegunPdf;
export const TOTAL_MODULOS = datos.modulos.length;
