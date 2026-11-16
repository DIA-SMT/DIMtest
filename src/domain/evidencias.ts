// Límites de las evidencias. Sin imports: los usan la app (src/lib/almacenamiento.ts) y
// scripts/almacenamiento-preparar.mjs, que configura el bucket con los mismos valores.

export const MAX_ARCHIVOS = 5;
export const MAX_BYTES = 8 * 1024 * 1024;
export const TIPOS_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type Mime = (typeof TIPOS_MIME)[number];
export const EXTENSION: Record<Mime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/** Ruta del archivo dentro del almacén: mes de subida y un id al azar (`2026-11/<uuid>.jpg`). */
export const RE_RUTA = /^\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;
