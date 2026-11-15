// Una línea JSON por evento (estándar DIA 01 §6). Nunca datos personales, tokens ni
// el texto que escriben los usuarios: solo eventos, estados y códigos.
export function log(evento: string, datos: Record<string, string | number | boolean | null | undefined> = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), evento, ...datos }));
}

/** La primera línea del mensaje: los errores de la base pueden traer valores. */
export function resumenError(error: unknown) {
  const m = error instanceof Error ? error.message : String(error);
  return m.split("\n")[0].slice(0, 200);
}
