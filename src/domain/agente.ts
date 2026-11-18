// Reglas del agente Claude (D-015), sin base ni red: qué incidencias puede tomar, cómo
// llega una incidencia a «corregida» y cómo se escriben los avisos.
import { transicionesDesde, type EstadoIncidencia } from "./incidencias";
import type { Prioridad } from "./prioridades";

export const ESTADOS_TRABAJO = ["pendiente", "en_curso", "terminado", "fallido", "cancelado"] as const;
export type EstadoTrabajo = (typeof ESTADOS_TRABAJO)[number];

export const NOMBRE_ESTADO_TRABAJO: Record<EstadoTrabajo, string> = {
  pendiente: "En la cola",
  en_curso: "Trabajando",
  terminado: "Terminado",
  fallido: "No pudo terminar",
  cancelado: "Cancelado",
};

/** Cómo termina un trabajo. */
export const RESULTADOS_AGENTE = ["desplegado", "ya_resuelto", "pr_abierto", "requiere_ok", "bloqueado"] as const;
export type ResultadoAgente = (typeof RESULTADOS_AGENTE)[number];

export const NOMBRE_RESULTADO_AGENTE: Record<ResultadoAgente, string> = {
  desplegado: "Corregido y publicado en test",
  ya_resuelto: "Ya estaba en el código: publicado en test",
  pr_abierto: "Corrección lista para revisar (PR abierto)",
  requiere_ok: "Cambio de datos preparado: espera el OK de una persona",
  bloqueado: "No pudo corregirlo: hace falta una persona",
};

/** Los dos resultados que publican en test y mandan la prueba a revalidación. */
export const resultadoPublica = (r: ResultadoAgente) => r === "desplegado" || r === "ya_resuelto";

export function esResultadoAgente(v: unknown): v is ResultadoAgente {
  return typeof v === "string" && (RESULTADOS_AGENTE as readonly string[]).includes(v);
}

/** Se le puede pedir trabajo al agente mientras la incidencia esté sin resolver. */
const ELEGIBLES: readonly EstadoIncidencia[] = ["reportada", "en_analisis", "pendiente_correccion", "en_correccion", "reabierta"];
export const incidenciaElegible = (e: EstadoIncidencia) => ELEGIBLES.includes(e);

export interface ConfigAgente {
  activo: boolean;
  automatico: boolean;
  prioridadesAutomaticas: readonly Prioridad[];
  publicar: boolean;
}

/** Al crear una incidencia: ¿se le pide trabajo al agente sin que nadie toque nada? */
export function pedirAutomaticamente(c: ConfigAgente, prioridad: Prioridad, estado: EstadoIncidencia): boolean {
  return c.activo && c.automatico && c.prioridadesAutomaticas.includes(prioridad) && incidenciaElegible(estado);
}

/**
 * Los estados por los que pasa una incidencia hasta «corregida», respetando el ciclo de
 * siempre (el agente no tiene atajos). Vacío si desde ese estado no se puede llegar.
 */
export function caminoHastaCorregida(desde: EstadoIncidencia): EstadoIncidencia[] {
  // Una incidencia ya resuelta no se reabre sola: eso lo decide una persona.
  if (!incidenciaElegible(desde)) return [];
  const visitados = new Set<EstadoIncidencia>([desde]);
  let frente: EstadoIncidencia[][] = [[]];
  let actuales: EstadoIncidencia[] = [desde];
  while (actuales.length) {
    const siguientesFrente: EstadoIncidencia[][] = [];
    const siguientes: EstadoIncidencia[] = [];
    for (let i = 0; i < actuales.length; i++) {
      for (const s of transicionesDesde(actuales[i]!)) {
        // Nunca pasa por estados finales ni por «corregida» de otro camino.
        if (s === "descartada" || s === "cerrada") continue;
        const camino = [...frente[i]!, s];
        if (s === "corregida") return camino;
        if (visitados.has(s)) continue;
        visitados.add(s);
        siguientes.push(s);
        siguientesFrente.push(camino);
      }
    }
    actuales = siguientes;
    frente = siguientesFrente;
  }
  return [];
}

/** +54 9 381 555-1234 → +5493815551234. Null si no parece un número internacional. */
export function normalizarWhatsapp(texto: string): string | null {
  const limpio = texto.replace(/[\s().-]/g, "");
  if (!limpio) return null;
  const conMas = limpio.startsWith("00") ? `+${limpio.slice(2)}` : limpio;
  return /^\+[1-9][0-9]{7,14}$/.test(conMas) ? conMas : null;
}

/**
 * WhatsApp no acepta saltos de línea, tabulaciones ni más de 4 espacios seguidos en los
 * parámetros de una plantilla. Tope 1000 caracteres (la base guarda hasta 1000).
 */
export function textoParaPlantilla(texto: string): string {
  return texto
    .replace(/\s*\n+\s*/g, " · ")
    .replace(/\t/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim()
    .slice(0, 1000);
}

// ---------------------------------------------------------------------------
// Correcciones del agente (lo que ya terminó)
// ---------------------------------------------------------------------------

/** Cómo terminó: un resultado del agente, o «fallido» si no pudo terminar por un problema suyo. */
export const CIERRES_AGENTE = [...RESULTADOS_AGENTE, "fallido"] as const;
export type CierreAgente = (typeof CIERRES_AGENTE)[number];

export const NOMBRE_CIERRE_AGENTE: Record<CierreAgente, string> = {
  desplegado: "Corregida y publicada en test",
  ya_resuelto: "Ya estaba corregida: publicada en test",
  pr_abierto: "Para revisar (PR abierto)",
  requiere_ok: "Espera el OK para un cambio de datos",
  bloqueado: "Necesita una persona",
  fallido: "No pudo terminar",
};

export const esCierreAgente = (v: unknown): v is CierreAgente => typeof v === "string" && (CIERRES_AGENTE as readonly string[]).includes(v);

/** Grupos para filtrar (los de los indicadores), además de cada cierre suelto. */
export const GRUPOS_CIERRE = {
  publicadas: { nombre: "Publicadas (todas)", cierres: ["desplegado", "ya_resuelto"] },
  persona: { nombre: "Esperan a una persona", cierres: ["requiere_ok", "bloqueado"] },
} as const satisfies Record<string, { nombre: string; cierres: readonly CierreAgente[] }>;

/** El valor del filtro «Cómo terminó» a la lista de cierres que abarca. Null si no es válido. */
export function cierresDelFiltro(v: unknown): CierreAgente[] | null {
  if (typeof v === "string" && Object.hasOwn(GRUPOS_CIERRE, v)) return [...GRUPOS_CIERRE[v as keyof typeof GRUPOS_CIERRE].cierres];
  return esCierreAgente(v) ? [v] : null;
}

/** Qué pasó con la revalidación que pidió el agente al publicar. */
export const REVALIDACIONES_AGENTE = ["pendiente", "confirmada", "volvio_a_fallar", "sin_probar", "cancelada"] as const;
export type RevalidacionAgente = (typeof REVALIDACIONES_AGENTE)[number];

export const NOMBRE_REVALIDACION_AGENTE: Record<RevalidacionAgente, string> = {
  pendiente: "Esperando la revalidación de la DIM",
  confirmada: "La DIM confirmó que funciona",
  volvio_a_fallar: "Volvió a fallar en la revalidación",
  sin_probar: "La DIM no la pudo probar",
  cancelada: "Revalidación cancelada",
};

export const esRevalidacionAgente = (v: unknown): v is RevalidacionAgente =>
  typeof v === "string" && (REVALIDACIONES_AGENTE as readonly string[]).includes(v);

/** «12 min», «1 h 05 min», «2 días 3 h». Null si falta alguna de las dos fechas. */
export function duracionTrabajo(desde: Date | null, hasta: Date | null): string | null {
  if (!desde || !hasta) return null;
  const min = Math.max(0, Math.round((hasta.getTime() - desde.getTime()) / 60_000));
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${String(min % 60).padStart(2, "0")} min`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "día" : "días"} ${h % 24} h`;
}
