import { ESTADO_SUGERENCIA_RELEVADOR, NOMBRE_ESTADO_SUGERENCIA, NOMBRE_TIPO_SUGERENCIA, type EstadoSugerencia, type TipoSugerencia } from "@/domain/sugerencias";

const INSIGNIA = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap";

const ESTILO_ESTADO: Record<EstadoSugerencia, string> = {
  nueva: "border-info-borde bg-info-fondo text-info",
  en_evaluacion: "border-advertencia-borde bg-advertencia-fondo text-advertencia",
  planificada: "border-transparent bg-institucional text-white",
  hecha: "border-exito-borde bg-exito-fondo text-exito",
  descartada: "border-borde bg-neutro-fondo text-texto-secundario",
};

/** El estado con el nombre del panel o, en el portal, con el que ve el relevador. */
export function InsigniaEstadoSugerencia({ estado, paraRelevador = false }: { estado: EstadoSugerencia; paraRelevador?: boolean }) {
  return <span className={`${INSIGNIA} ${ESTILO_ESTADO[estado]}`}>{(paraRelevador ? ESTADO_SUGERENCIA_RELEVADOR : NOMBRE_ESTADO_SUGERENCIA)[estado]}</span>;
}

export function InsigniaTipoSugerencia({ tipo }: { tipo: TipoSugerencia }) {
  return <span className={`${INSIGNIA} border-borde bg-superficie text-texto-secundario`}>{NOMBRE_TIPO_SUGERENCIA[tipo]}</span>;
}

/** SUG-0007 */
export const numeroSugerencia = (n: number) => `SUG-${String(n).padStart(4, "0")}`;
