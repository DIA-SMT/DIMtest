import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { NOMBRE_ESTADO_PRUEBA, type EstadoPrueba } from "@/domain/estado-prueba";
import { NOMBRE_ESTADO, type EstadoIncidencia } from "@/domain/incidencias";
import { NOMBRE_PRIORIDAD, type Prioridad } from "@/domain/prioridades";
import { NOMBRE_RESULTADO, type Resultado } from "@/domain/resultados";
import { NOMBRE_PERFIL, type Perfil } from "@/domain/catalogo/catalogo";
import { porcentaje } from "@/lib/formato";

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

type TipoAviso = "exito" | "advertencia" | "error" | "info";
const ESTILO_AVISO: Record<TipoAviso, { clase: string; icono: LucideIcon }> = {
  exito: { clase: "border-exito-borde bg-exito-fondo text-exito", icono: CircleCheck },
  advertencia: { clase: "border-advertencia-borde bg-advertencia-fondo text-advertencia", icono: TriangleAlert },
  error: { clase: "border-error-borde bg-error-fondo text-error", icono: CircleAlert },
  info: { clase: "border-info-borde bg-info-fondo text-info", icono: Info },
};

export function Aviso({ tipo = "info", titulo, children, accion }: { tipo?: TipoAviso; titulo?: ReactNode; children?: ReactNode; accion?: ReactNode }) {
  const { clase, icono: Icono } = ESTILO_AVISO[tipo];
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={`flex gap-3 rounded-tarjeta border px-4 py-3 text-sm ${clase}`}>
      <Icono aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        {titulo ? <p className="font-semibold">{titulo}</p> : null}
        {children ? <div className="text-texto">{children}</div> : null}
        {accion ? <div className="pt-1">{accion}</div> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insignias
// ---------------------------------------------------------------------------

const INSIGNIA = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap";

const ESTILO_RESULTADO: Record<Resultado, string> = {
  funciona: "border-exito-borde bg-exito-fondo text-exito",
  no_funciona: "border-error-borde bg-error-fondo text-error",
  parcial: "border-advertencia-borde bg-advertencia-fondo text-advertencia",
  no_probado: "border-borde bg-neutro-fondo text-texto-secundario",
};

export function InsigniaResultado({ resultado }: { resultado: Resultado }) {
  return <span className={`${INSIGNIA} ${ESTILO_RESULTADO[resultado]}`}>{NOMBRE_RESULTADO[resultado]}</span>;
}

const ESTILO_ESTADO_PRUEBA: Record<EstadoPrueba, string> = {
  sin_realizar: "border-info-borde bg-info-fondo text-info",
  en_ejecucion: "border-advertencia-borde bg-advertencia-fondo text-advertencia",
  realizada: "border-exito-borde bg-exito-fondo text-exito",
  revalidar: "border-transparent bg-institucional text-white",
};

export function InsigniaEstadoPrueba({ estado }: { estado: EstadoPrueba }) {
  return <span className={`${INSIGNIA} ${ESTILO_ESTADO_PRUEBA[estado]}`}>{NOMBRE_ESTADO_PRUEBA[estado]}</span>;
}

const ESTILO_PRIORIDAD: Record<Prioridad, string> = {
  P0: "border-transparent bg-error text-white",
  P1: "border-error-borde bg-error-fondo text-error",
  P2: "border-advertencia-borde bg-advertencia-fondo text-advertencia",
  P3: "border-borde bg-neutro-fondo text-texto-secundario",
};

export function InsigniaPrioridad({ prioridad, corta = false }: { prioridad: Prioridad; corta?: boolean }) {
  return (
    <span className={`${INSIGNIA} ${ESTILO_PRIORIDAD[prioridad]}`} title={`${prioridad} · ${NOMBRE_PRIORIDAD[prioridad]}`}>
      {prioridad}
      {corta ? null : <span className="font-medium">· {NOMBRE_PRIORIDAD[prioridad]}</span>}
    </span>
  );
}

const ESTILO_ESTADO_INCIDENCIA: Record<EstadoIncidencia, string> = {
  reportada: "border-info-borde bg-info-fondo text-info",
  en_analisis: "border-info-borde bg-info-fondo text-info",
  pendiente_correccion: "border-advertencia-borde bg-advertencia-fondo text-advertencia",
  en_correccion: "border-advertencia-borde bg-advertencia-fondo text-advertencia",
  corregida: "border-transparent bg-institucional text-white",
  cerrada: "border-exito-borde bg-exito-fondo text-exito",
  reabierta: "border-error-borde bg-error-fondo text-error",
  descartada: "border-borde bg-neutro-fondo text-texto-secundario",
};

export function InsigniaEstadoIncidencia({ estado }: { estado: EstadoIncidencia }) {
  return <span className={`${INSIGNIA} ${ESTILO_ESTADO_INCIDENCIA[estado]}`}>{NOMBRE_ESTADO[estado]}</span>;
}

export function InsigniaPerfil({ perfil }: { perfil: string }) {
  const nombre = NOMBRE_PERFIL[perfil as Perfil] ?? perfil;
  return (
    <span className={`${INSIGNIA} border-borde bg-superficie text-texto-secundario`} title={`Quién hace la prueba: ${nombre}`}>
      <span aria-hidden="true" className="grid size-4 place-items-center rounded-full bg-superficie-azul text-[10px] font-bold text-primario-oscuro">
        {perfil}
      </span>
      {nombre}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Progreso
// ---------------------------------------------------------------------------

/** Barra de avance con los resultados apilados (funciona, parcial, no funciona, no probado). */
export function BarraResultados({
  total,
  porResultado,
  etiqueta,
  alta = false,
}: {
  total: number;
  porResultado: Record<Resultado, number>;
  etiqueta: string;
  alta?: boolean;
}) {
  const hechas = porResultado.funciona + porResultado.parcial + porResultado.no_funciona + porResultado.no_probado;
  const tramos: { clave: Resultado; clase: string }[] = [
    { clave: "funciona", clase: "bg-exito-solido" },
    { clave: "parcial", clase: "bg-amarillo" },
    { clave: "no_funciona", clase: "bg-error" },
    { clave: "no_probado", clase: "bg-borde-control" },
  ];
  // Los tramos van separados por 2 px de superficie y cada uno dice su valor al pasar el mouse.
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={hechas}
      aria-valuetext={`${hechas} de ${total} evaluadas (${porcentaje(hechas, total)} %)`}
      className={`flex w-full gap-0.5 overflow-hidden rounded-full bg-neutro-fondo ${alta ? "h-3" : "h-2"}`}
    >
      {tramos.map((t) =>
        porResultado[t.clave] > 0 ? (
          <span
            key={t.clave}
            title={`${NOMBRE_RESULTADO[t.clave]}: ${porResultado[t.clave]} de ${total}`}
            className={`${t.clase} first:rounded-l-full`}
            style={{ width: `${(porResultado[t.clave] / total) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

export function LeyendaResultados() {
  const items: { clase: string; texto: string }[] = [
    { clase: "bg-exito-solido", texto: "Funciona" },
    { clase: "bg-amarillo", texto: "Parcial" },
    { clase: "bg-error", texto: "No funciona" },
    { clase: "bg-borde-control", texto: "No probado" },
    { clase: "bg-neutro-fondo border border-borde", texto: "Sin realizar" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-secundario">
      {items.map((i) => (
        <li key={i.texto} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-2.5 rounded-full ${i.clase}`} />
          {i.texto}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Estructura
// ---------------------------------------------------------------------------

/** Ancho de página y márgenes laterales, iguales en el portal y en el panel. */
export const CONTENEDOR = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10";
/** El portal del relevador es más angosto: se lee como un formulario, no como un tablero. */
export const CONTENEDOR_ANGOSTO = "mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-10";

export function EncabezadoPagina({ antetitulo, titulo, descripcion, acciones }: { antetitulo?: string; titulo: ReactNode; descripcion?: ReactNode; acciones?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        {antetitulo ? <p className="antetitulo text-primario">{antetitulo}</p> : null}
        <h1 className="text-[1.75rem] leading-tight font-bold text-institucional sm:text-[2rem]">{titulo}</h1>
        {descripcion ? <div className="max-w-3xl text-[15px] text-texto-secundario">{descripcion}</div> : null}
      </div>
      {acciones ? <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div> : null}
    </header>
  );
}

/** Título de sección con la hoja amarilla delante (como los de Applaza). */
export function TituloSeccion({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={`flex items-center gap-2.5 text-[1.375rem] font-bold text-institucional ${className}`}>
      <span aria-hidden="true" className="hoja" />
      {children}
    </h2>
  );
}

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-tarjeta border border-borde bg-superficie shadow-tarjeta ${className}`}>{children}</section>;
}

export function EstadoVacio({ icono: Icono, titulo, ayuda }: { icono: LucideIcon; titulo: string; ayuda?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-tarjeta border border-dashed border-borde-control/50 bg-superficie px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-superficie-azul">
        <Icono aria-hidden="true" className="size-6 text-primario" />
      </span>
      <p className="font-display text-lg font-bold text-institucional">{titulo}</p>
      {ayuda ? <p className="max-w-md text-sm text-texto-secundario">{ayuda}</p> : null}
    </div>
  );
}

/**
 * Marca combinada: isologo municipal + «Ciudad San Miguel de Tucumán» + DIM360 QA.
 * `compacta` deja solo el isologo y el nombre del sistema (barras angostas).
 */
export function MarcaCiudad({ compacta = false, subtitulo = "Relevamiento funcional" }: { compacta?: boolean; subtitulo?: string }) {
  return (
    <span className="flex items-center gap-2.5 text-left text-institucional">
      <Image src="/marca/logo-smt-iso.png" alt="" width={235} height={235} className="size-9 shrink-0 sm:size-10" priority />
      <span className={compacta ? "sr-only" : "hidden leading-none min-[420px]:block"}>
        <small className="block text-[9px] font-bold tracking-[0.1em] uppercase">Ciudad</small>
        <b className="block max-w-[118px] font-display text-[15px] leading-[1.02] font-extrabold">San Miguel de Tucumán</b>
      </span>
      <i aria-hidden="true" className={compacta ? "hidden" : "mx-1.5 hidden h-9 w-[1.5px] shrink-0 bg-azul-suave min-[420px]:block"} />
      <span className="leading-none">
        <b className="block font-display text-[22px] font-extrabold tracking-tight text-primario">DIM360 QA</b>
        <small className="mt-0.5 block text-[11px] whitespace-nowrap text-texto-secundario">{subtitulo}</small>
      </span>
    </span>
  );
}

/** Ondas celeste, amarilla y del color de fondo que cierran las portadas. */
export function Ondas({ className = "h-14 sm:h-[78px]" }: { className?: string }) {
  return (
    <svg className={`pointer-events-none absolute inset-x-0 -bottom-px z-[3] w-full ${className}`} viewBox="0 0 1200 110" preserveAspectRatio="none" aria-hidden="true">
      <path className="fill-celeste" d="M0 110V62c230 40 470 44 700 10 190-28 350-46 500-30v68z" />
      <path className="fill-amarillo" d="M0 110V84c240 26 480 26 720 0 180-20 330-30 480-18v44z" />
      <path className="fill-fondo" d="M0 110V100c260 10 520 8 780-8 160-10 300-14 420-8v26z" />
    </svg>
  );
}

/** Portada azul de las páginas de inicio: antetítulo, título grande con remate celeste y acciones. */
export function Portada({
  antetitulo,
  titulo,
  remate,
  children,
  acciones,
  id = "titulo-portada",
  angosta = false,
}: {
  antetitulo: string;
  titulo: string;
  remate?: string;
  children?: ReactNode;
  acciones?: ReactNode;
  id?: string;
  angosta?: boolean;
}) {
  return (
    <section aria-labelledby={id} className="fondo-portada relative isolate overflow-hidden text-white">
      <span
        aria-hidden="true"
        className="absolute -top-[120px] right-[18%] -z-10 h-[420px] w-[340px] rotate-[18deg] rounded-[80%_0_80%_0] bg-linear-to-b from-celeste/30 to-celeste/0"
      />
      <div className={`${angosta ? CONTENEDOR_ANGOSTO : CONTENEDOR} relative z-[2] pt-8 pb-24 sm:pt-12 sm:pb-28`}>
        <div className="max-w-[680px]">
          <p className="antetitulo text-[11px] text-white sm:text-[13px]">{antetitulo}</p>
          <h1 id={id} className="mt-4 mb-4 text-[clamp(2.25rem,8vw,4.25rem)] leading-[0.96] font-extrabold">
            {titulo}
            {remate ? <span className="block text-celeste">{remate}</span> : null}
          </h1>
          {children ? <div className="max-w-[560px] text-[15px] leading-relaxed text-texto-portada sm:text-[17px]">{children}</div> : null}
          {acciones ? <div className="mt-6 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap">{acciones}</div> : null}
        </div>
      </div>
      <Ondas />
    </section>
  );
}

/** Botones de la portada: amarillo (principal) y blanco (secundario). */
export const CLASE_PORTADA_PRINCIPAL =
  "inline-flex min-h-[50px] items-center justify-center gap-2.5 rounded-full bg-amarillo px-6 text-[15px] font-bold text-institucional shadow-[0_10px_22px_rgb(244_220_0/0.25)] transition-transform hover:-translate-y-0.5 focus-visible:outline-white";
export const CLASE_PORTADA_SECUNDARIA =
  "inline-flex min-h-[50px] items-center justify-center gap-2.5 rounded-full bg-superficie px-6 text-[15px] font-bold text-institucional transition-transform hover:-translate-y-0.5 focus-visible:outline-white [&>svg]:text-primario";

type Tono = "azul" | "amarillo" | "celeste" | "verde";
const ESTILO_TONO: Record<Tono, { fondo: string; color: string }> = {
  azul: { fondo: "border-azul-suave bg-superficie-azul", color: "text-primario" },
  amarillo: { fondo: "border-advertencia-borde/60 bg-superficie-amarilla", color: "text-amarillo-texto" },
  celeste: { fondo: "border-celeste/30 bg-superficie-celeste", color: "text-celeste-oscuro" },
  verde: { fondo: "border-exito-borde/70 bg-superficie-verde", color: "text-exito-solido" },
};

/** Acceso rápido de color suave, con ícono, flecha y el ícono en marca de agua. */
export function AccesoRapido({ href, titulo, detalle, icono: Icono, tono }: { href: string; titulo: string; detalle: ReactNode; icono: LucideIcon; tono: Tono }) {
  const t = ESTILO_TONO[tono];
  return (
    <Link
      href={href}
      className={`group relative flex min-h-[112px] items-center gap-3.5 overflow-hidden rounded-tarjeta border p-4 text-institucional shadow-[0_4px_16px_rgb(9_35_76/0.05)] transition-[transform,box-shadow] hover:-translate-y-[3px] hover:shadow-[0_12px_28px_rgb(9_35_76/0.1)] max-sm:min-h-[128px] max-sm:flex-col max-sm:items-start max-sm:gap-2 sm:px-[18px] sm:py-5 ${t.fondo}`}
    >
      <span className={`grid size-11 shrink-0 place-items-center ${t.color}`}>
        <Icono aria-hidden="true" className="size-[34px]" strokeWidth={1.7} />
      </span>
      <span className="relative z-[1] min-w-0 flex-1">
        <strong className="block font-display text-base leading-tight font-bold sm:text-lg">{titulo}</strong>
        <small className="mt-1 block text-[13px] text-texto-secundario">{detalle}</small>
      </span>
      <span className={`relative z-[1] grid size-9 shrink-0 place-items-center rounded-full bg-superficie shadow-[0_3px_10px_rgb(9_35_76/0.08)] max-sm:absolute max-sm:top-3.5 max-sm:right-3 max-sm:size-[30px] ${t.color}`}>
        <ArrowRight aria-hidden="true" className="size-4" />
      </span>
      <Icono aria-hidden="true" className={`pointer-events-none absolute -right-2.5 -bottom-[18px] size-[92px] opacity-10 ${t.color}`} strokeWidth={1.5} />
    </Link>
  );
}

/** Indicador numérico: ícono en recuadro de color, etiqueta y valor (como los de Applaza). */
export function Indicador({
  titulo,
  valor,
  detalle,
  icono: Icono,
  tono = "neutro",
  href,
}: {
  titulo: string;
  valor: number;
  detalle?: string;
  icono: LucideIcon;
  tono?: "neutro" | "exito" | "advertencia" | "error" | "info";
  href?: string;
}) {
  const color = {
    neutro: "bg-neutro-fondo text-texto-secundario",
    exito: "bg-exito-fondo text-exito-solido",
    advertencia: "bg-advertencia-fondo text-advertencia",
    error: "bg-error-fondo text-error",
    info: "bg-superficie-azul text-primario",
  }[tono];
  const contenido = (
    <>
      <span className={`grid size-[46px] shrink-0 place-items-center rounded-[14px] max-sm:size-10 ${color}`}>
        <Icono aria-hidden="true" className="size-[21px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] text-texto-secundario">{titulo}</span>
        <strong className="block font-display text-[22px] leading-tight font-bold text-institucional tabular-nums sm:text-[27px]">{valor}</strong>
        {detalle ? <span className="block text-xs leading-snug text-texto-secundario">{detalle}</span> : null}
      </span>
    </>
  );
  const clase = "flex items-center gap-3 rounded-tarjeta border border-borde bg-superficie p-3.5 shadow-tarjeta sm:p-[18px]";
  return href ? (
    <Link href={href} className={`${clase} transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-azul-hover hover:shadow-elevada`}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

export function PieInstitucional() {
  return (
    <footer className="border-t border-borde bg-superficie">
      <div className={`${CONTENEDOR} flex flex-col items-center justify-between gap-3 py-5 text-xs text-texto-secundario sm:flex-row`}>
        <p>Municipalidad de San Miguel de Tucumán · Dirección de Impuestos Municipales</p>
        <p className="flex items-center gap-2">
          Desarrollado por la Dirección de Inteligencia Artificial
          <Image src="/marca/logo-dia.png" alt="" width={526} height={220} className="h-6 w-auto" />
        </p>
      </div>
    </footer>
  );
}
