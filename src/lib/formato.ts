export const SIN_DATO = "—";

export function porcentaje(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

export function plural(n: number, singular: string, pluralTexto = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

export function tamanoArchivo(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** INC-0007 */
export const numeroIncidencia = (n: number) => `INC-${String(n).padStart(4, "0")}`;

/** Recorta un texto largo para listados. */
export function resumir(texto: string, largo = 140) {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.length > largo ? `${t.slice(0, largo - 1).trimEnd()}…` : t;
}
