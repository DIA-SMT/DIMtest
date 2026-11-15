"use client";

import { useFormStatus } from "react-dom";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

/*
 * Clases base de controles (estándar DIA 04 §5, referente CementerIA). Cada variante es
 * una clase completa: sumarle utilidades a otra no pisa a la base en Tailwind 4.
 */
const BOTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border px-4 py-2 text-sm font-semibold " +
  "transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const CLASE_BOTON_PRIMARIO = `${BOTON_BASE} border-transparent bg-primario text-white shadow-xs hover:bg-primario-oscuro`;
export const CLASE_BOTON_SECUNDARIO = `${BOTON_BASE} border-borde-control bg-superficie text-texto hover:bg-fondo`;
export const CLASE_BOTON_PELIGRO = `${BOTON_BASE} border-transparent bg-error text-white hover:bg-error-hover`;
export const CLASE_BOTON_FANTASMA = `${BOTON_BASE} border-transparent bg-transparent text-primario-oscuro hover:bg-superficie-azul`;
export const CLASE_BOTON_COMPACTO =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-control border border-borde-control bg-superficie px-3 py-1.5 " +
  "text-xs font-semibold text-texto transition-colors hover:bg-fondo focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-primario disabled:cursor-not-allowed disabled:opacity-60";

export const CLASE_CONTROL =
  "block w-full rounded-control border border-borde-control bg-superficie px-3 py-2.5 text-base text-texto shadow-xs " +
  "placeholder:text-texto-secundario/80 focus:border-primario focus:outline-2 focus:outline-offset-0 focus:outline-primario " +
  "aria-invalid:border-error aria-invalid:outline-error disabled:bg-fondo sm:text-sm";

export const CLASE_ETIQUETA = "block text-sm font-semibold text-texto";

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
