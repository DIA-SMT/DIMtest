"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { NOMBRE_PRIORIDAD, PRIORIDADES, type Prioridad } from "@/domain/prioridades";
import { cambiarPrioridadRapidaAccion } from "../actions";

function Selector({ prioridad, numero }: { prioridad: Prioridad; numero: number }) {
  const { pending } = useFormStatus();
  return (
    <select
      name="prioridad"
      defaultValue={prioridad}
      disabled={pending}
      aria-label={`Prioridad de la incidencia ${numero}`}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="rounded-control border border-borde-control bg-superficie px-2 py-1 text-xs font-semibold focus:outline-2 focus:outline-primario disabled:opacity-60"
    >
      {PRIORIDADES.map((p) => (
        <option key={p} value={p}>
          {p} · {NOMBRE_PRIORIDAD[p]}
        </option>
      ))}
    </select>
  );
}

/** Cambio rápido de prioridad: se guarda al elegir (queda en el historial de la incidencia). */
export function PrioridadRapida({ id, numero, prioridad }: { id: string; numero: number; prioridad: Prioridad }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={cambiarPrioridadRapidaAccion} key={prioridad}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="numero" value={numero} />
      <Selector prioridad={prioridad} numero={numero} />
      <noscript>
        <button type="submit">Cambiar</button>
      </noscript>
    </form>
  );
}
