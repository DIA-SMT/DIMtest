"use client";

import { useFormStatus } from "react-dom";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

/*
 * Clases base de controles con el lenguaje visual de Applaza (D-008): botones píldora y
 * campos de 46 px con radio de 12. Cada variante es una clase completa: sumarle utilidades
 * a otra no pisa a la base en Tailwind 4.
 */
const BOTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 py-2 text-sm font-bold " +
  "transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primario " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const CLASE_BOTON_PRIMARIO = `${BOTON_BASE} border-transparent bg-primario text-white hover:bg-primario-oscuro`;
/** Botón principal de las pantallas de ingreso: píldora de 50 px a todo el ancho. */
export const CLASE_BOTON_INGRESO =
  "inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-primario px-5 py-3 text-[15px] font-bold text-white " +
  "transition-colors hover:bg-primario-oscuro focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primario disabled:opacity-60";
export const CLASE_BOTON_SECUNDARIO = `${BOTON_BASE} border-borde-control bg-superficie text-institucional hover:bg-superficie-azul`;
export const CLASE_BOTON_PELIGRO = `${BOTON_BASE} border-transparent bg-error text-white hover:bg-error-hover`;
export const CLASE_BOTON_FANTASMA = `${BOTON_BASE} border-transparent bg-transparent text-primario-oscuro hover:bg-superficie-azul`;
export const CLASE_BOTON_COMPACTO =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-borde-control bg-superficie px-3.5 py-1.5 " +
  "text-xs font-bold text-institucional transition-colors hover:bg-superficie-azul focus-visible:outline-3 focus-visible:outline-offset-2 " +
  "focus-visible:outline-primario disabled:cursor-not-allowed disabled:opacity-60";

export const CLASE_CONTROL =
  "block min-h-[46px] w-full rounded-control border border-borde-control bg-superficie px-3.5 py-2.5 text-base text-texto " +
  "placeholder:text-texto-secundario/80 focus:border-primario focus:ring-3 focus:ring-primario/15 focus:outline-none " +
  "aria-invalid:border-error aria-invalid:ring-error/15 disabled:bg-fondo sm:text-[15px]";

export const CLASE_ETIQUETA = "block text-sm font-semibold text-institucional";

export function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  obligatorio,
  children,
}: {
  id: string;
  etiqueta: ReactNode;
  ayuda?: ReactNode;
  error?: string;
  obligatorio?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={CLASE_ETIQUETA}>
        {etiqueta}
        {obligatorio ? (
          <span className="ml-1 text-error" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {ayuda ? (
        <p id={`${id}-ayuda`} className="text-sm text-texto-secundario">
          {ayuda}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-medium text-error">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Botón de envío que se deshabilita y avisa mientras la acción corre. */
export function BotonEnviar({
  children,
  enviando = "Guardando…",
  className = CLASE_BOTON_PRIMARIO,
  name,
  value,
  formAction,
}: {
  children: ReactNode;
  enviando?: string;
  className?: string;
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending} name={name} value={value} formAction={formAction}>
      {pending ? enviando : children}
    </button>
  );
}
