"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { BotonEnviar, CLASE_BOTON_COMPACTO } from "@/components/formulario";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/accion";
import { borrarRelevadorAccion } from "../actions";

/** «Borrar» con un paso de confirmación. Solo se muestra para relevadores sin pruebas. */
export function BorrarRelevador({ id, nombre }: { id: string; nombre: string }) {
  const [estado, borrar] = useActionState<EstadoAccion, FormData>(borrarRelevadorAccion, ESTADO_INICIAL);
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <div className="space-y-1">
        {estado.error ? <p className="text-xs font-medium text-error">{estado.error}</p> : null}
        <button type="button" onClick={() => setConfirmando(true)} className={`${CLASE_BOTON_COMPACTO} hover:border-error hover:text-error`}>
          <Trash2 aria-hidden="true" className="size-3.5" />
          Borrar<span className="sr-only"> a {nombre}</span>
        </button>
      </div>
    );
  }
  return (
    <form action={borrar} className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirmar el borrado de ${nombre}`}>
      <input type="hidden" name="id" value={id} />
      {estado.error ? <p className="w-full text-xs font-medium text-error">{estado.error}</p> : null}
      <span className="text-xs font-semibold text-error">¿Borrar a {nombre}?</span>
      <BotonEnviar
        enviando="Borrando…"
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-transparent bg-error px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-error-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
      >
        Sí, borrar
      </BotonEnviar>
      <button type="button" onClick={() => setConfirmando(false)} className={CLASE_BOTON_COMPACTO}>
        Cancelar
      </button>
    </form>
  );
}
