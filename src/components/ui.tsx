import Image from "next/image";
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
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

export function EncabezadoPagina({ antetitulo, titulo, descripcion, acciones }: { antetitulo?: string; titulo: ReactNode; descripcion?: ReactNode; acciones?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        {antetitulo ? (
          <p className="text-xs font-semibold tracking-wider text-primario-oscuro uppercase">
            {antetitulo}
            <span className="filete mt-1.5" aria-hidden="true" />
          </p>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-texto sm:text-[1.75rem]">{titulo}</h1>
        {descripcion ? <div className="max-w-3xl text-sm text-texto-secundario">{descripcion}</div> : null}
      </div>
      {acciones ? <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div> : null}
    </header>
  );
}

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-tarjeta border border-borde bg-superficie shadow-tarjeta ${className}`}>{children}</section>;
}

export function EstadoVacio({ icono: Icono, titulo, ayuda }: { icono: LucideIcon; titulo: string; ayuda?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-tarjeta border border-dashed border-borde bg-superficie px-6 py-10 text-center">
      <Icono aria-hidden="true" className="size-8 text-texto-secundario" />
      <p className="font-semibold">{titulo}</p>
      {ayuda ? <p className="max-w-md text-sm text-texto-secundario">{ayuda}</p> : null}
    </div>
  );
}

export function LogoMunicipal({ negativo = false, className = "h-10 w-auto" }: { negativo?: boolean; className?: string }) {
  return (
    <Image
      src={negativo ? "/marca/logo-smt-neg.png" : "/marca/logo-smt-pos.png"}
      alt="Ciudad San Miguel de Tucumán"
      width={912}
      height={298}
      className={className}
      priority
    />
  );
}

export function PieInstitucional({ oscuro = false }: { oscuro?: boolean }) {
  return (
    <footer className={`text-xs ${oscuro ? "text-institucional-texto" : "text-texto-secundario"}`}>
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p>Municipalidad de San Miguel de Tucumán · Dirección de Impuestos Municipales</p>
        <p className="flex items-center gap-2">
          Desarrollado por la Dirección de Inteligencia Artificial
          {oscuro ? null : <Image src="/marca/logo-dia.png" alt="" width={512} height={210} className="h-6 w-auto" />}
        </p>
      </div>
    </footer>
  );
}
