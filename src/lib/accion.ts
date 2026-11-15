import type { z } from "zod";

/** Estado que devuelve una Server Action a su formulario (useActionState). */
export interface EstadoAccion {
  ok?: boolean;
  /** Error general, arriba del formulario. */
  error?: string;
  /** Errores por campo. */
  errores?: Record<string, string>;
  /** Lo que escribió, para no perderlo si hay error. */
  valores?: Record<string, string>;
  /** Mensaje de éxito. */
  mensaje?: string;
  /** Datos extra para la pantalla (por ejemplo, una contraseña temporal recién generada). */
  datos?: Record<string, unknown>;
}

export const ESTADO_INICIAL: EstadoAccion = {};

export function valoresDe(formData: FormData): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, valor] of formData.entries()) if (typeof valor === "string" && !k.startsWith("$")) v[k] = valor;
  return v;
}

/** Valida un FormData con zod. Si falla, devuelve el estado con los errores por campo. */
export function leerFormulario<S extends z.ZodType>(
  esquema: S,
  formData: FormData,
): { ok: true; datos: z.infer<S> } | { ok: false; estado: EstadoAccion } {
  const r = esquema.safeParse(Object.fromEntries(formData.entries()));
  if (r.success) return { ok: true, datos: r.data };
  const errores: Record<string, string> = {};
  for (const i of r.error.issues) {
    const campo = String(i.path[0] ?? "_");
    errores[campo] ??= i.message;
  }
  return { ok: false, estado: { error: "Revisá los datos marcados.", errores, valores: valoresDe(formData) } };
}
