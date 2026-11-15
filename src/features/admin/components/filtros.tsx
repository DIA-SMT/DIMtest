import Link from "next/link";
import { ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Opcion } from "../consultas";

const CLASE_SELECT =
  "block w-full rounded-control border border-borde-control bg-superficie px-2.5 py-2 text-sm text-texto focus:border-primario focus:outline-2 focus:outline-primario";

/** Barra de filtros por GET: los filtros quedan en la URL y se pueden compartir. */
export function BarraFiltros({ accion, children, limpiar }: { accion: string; children: ReactNode; limpiar: string }) {
  return (
    <form method="get" action={accion} className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{children}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-control bg-primario px-3 text-sm font-semibold text-white hover:bg-primario-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario"
        >
          <Filter aria-hidden="true" className="size-4" />
          Filtrar
        </button>
        <Link href={limpiar} className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-borde-control px-3 text-sm font-semibold hover:bg-fondo">
          <X aria-hidden="true" className="size-4" />
          Limpiar
        </Link>
      </div>
    </form>
  );
}

export function FiltroSelect({ nombre, etiqueta, opciones, valor, todas = "Todos" }: { nombre: string; etiqueta: string; opciones: Opcion[]; valor?: string; todas?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={`f-${nombre}`} className="text-xs font-semibold text-texto-secundario">
        {etiqueta}
      </label>
      <select id={`f-${nombre}`} name={nombre} defaultValue={valor ?? ""} className={CLASE_SELECT}>
        <option value="">{todas}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FiltroTexto({ nombre, etiqueta, valor, tipo = "text", placeholder }: { nombre: string; etiqueta: string; valor?: string; tipo?: "text" | "date" | "search"; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={`f-${nombre}`} className="text-xs font-semibold text-texto-secundario">
        {etiqueta}
      </label>
      <input id={`f-${nombre}`} name={nombre} type={tipo} defaultValue={valor ?? ""} placeholder={placeholder} className={CLASE_SELECT} />
    </div>
  );
}

export function Paginacion({ pagina, total, porPagina, base }: { pagina: number; total: number; porPagina: number; base: URLSearchParams }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  const enlace = (p: number) => {
    const u = new URLSearchParams(base);
    u.set("pagina", String(p));
    return `?${u.toString()}`;
  };
  const clase = "inline-flex min-h-9 items-center gap-1 rounded-control border border-borde-control bg-superficie px-3 text-sm font-semibold hover:bg-fondo";
  return (
    <nav aria-label="Páginas" className="flex items-center justify-between gap-2 text-sm">
      <span className="text-texto-secundario">
        Página {pagina} de {paginas} · {total} resultados
      </span>
      <span className="flex gap-2">
        {pagina > 1 ? (
          <Link href={enlace(pagina - 1)} className={clase}>
            <ChevronLeft aria-hidden="true" className="size-4" />
            Anterior
          </Link>
        ) : null}
        {pagina < paginas ? (
          <Link href={enlace(pagina + 1)} className={clase}>
            Siguiente
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </span>
    </nav>
  );
}

/** Lee un parámetro de búsqueda como string simple. */
export function param(sp: Record<string, string | string[] | undefined>, clave: string): string | undefined {
  const v = sp[clave];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim().slice(0, 200) : undefined;
}

/** Los parámetros actuales, para armar enlaces de paginación o exportación. */
export function aBusqueda(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s && k !== "pagina") u.set(k, s);
  }
  return u;
}

export const CLASE_TABLA = "w-full text-sm";
export const CLASE_THEAD = "bg-fondo text-left text-xs text-texto-secundario uppercase";
export const CLASE_TH = "px-3 py-2.5 font-semibold whitespace-nowrap";
export const CLASE_TD = "px-3 py-2.5 align-top";
