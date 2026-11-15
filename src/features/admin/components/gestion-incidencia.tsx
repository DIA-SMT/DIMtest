"use client";

import { useActionState, useState } from "react";
import { MessageSquarePlus, Paperclip, UserCheck } from "lucide-react";
import { BotonEnviar, Campo, CLASE_BOTON_SECUNDARIO, CLASE_CONTROL } from "@/components/formulario";
import { Aviso } from "@/components/ui";
import { ACCION_HACIA, NOMBRE_ESTADO, transicionesDesde, type EstadoIncidencia } from "@/domain/incidencias";
import { NOMBRE_PRIORIDAD, PRIORIDADES, type Prioridad } from "@/domain/prioridades";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/accion";
import { asignarResponsableAccion, cambiarEstadoAccion, cambiarPrioridadAccion, comentarAccion } from "../actions";
import type { Opcion } from "../consultas";

function Resultado({ estado }: { estado: EstadoAccion }) {
  if (estado.error) return <Aviso tipo="error">{estado.error}</Aviso>;
  if (estado.ok && estado.mensaje) return <Aviso tipo="exito">{estado.mensaje}</Aviso>;
  return null;
}

/** Cambio de estado: solo ofrece las transiciones permitidas y pide lo que cada una exige. */
export function CambioEstado({ id, numero, estado, ultimaRevalidacion }: { id: string; numero: number; estado: EstadoIncidencia; ultimaRevalidacion: string | null }) {
  const [r, enviar] = useActionState<EstadoAccion, FormData>(cambiarEstadoAccion, ESTADO_INICIAL);
  const opciones = transicionesDesde(estado);
  const [hacia, setHacia] = useState<EstadoIncidencia>(opciones[0]);
  const accion = ACCION_HACIA[hacia];
  const cierraSinValidar = hacia === "cerrada" && ultimaRevalidacion !== "funciona";
  return (
    <form action={enviar} className="space-y-3" key={estado}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="numero" value={numero} />
      <Resultado estado={r} />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">Próximo paso</legend>
        {opciones.map((o) => (
          <label key={o} className="flex cursor-pointer items-start gap-2 rounded-control border border-borde p-2.5 text-sm has-checked:border-primario has-checked:bg-superficie-azul">
            <input type="radio" name="hacia" value={o} checked={hacia === o} onChange={() => setHacia(o)} className="mt-0.5 size-4 accent-primario" />
            <span>
              <span className="font-semibold">{ACCION_HACIA[o].etiqueta}</span>
              <span className="block text-xs text-texto-secundario">→ {NOMBRE_ESTADO[o]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {accion.ayuda ? <p className="text-xs text-texto-secundario">{accion.ayuda}</p> : null}
      {accion.requiere === "solucion" ? (
        <Campo id="solucion" etiqueta="Solución aplicada" obligatorio>
          <textarea id="solucion" name="solucion" rows={3} maxLength={4000} required className={CLASE_CONTROL} />
        </Campo>
      ) : null}
      {accion.requiere === "justificacion" ? (
        <Campo id="justificacion" etiqueta="Justificación del descarte" obligatorio>
          <textarea id="justificacion" name="justificacion" rows={3} maxLength={2000} required className={CLASE_CONTROL} />
        </Campo>
      ) : null}
      <Campo
        id="comentario-estado"
        etiqueta={accion.requiere === "comentario" ? "Qué sigue fallando" : cierraSinValidar ? "Por qué se cierra sin una revalidación que funcione" : "Comentario técnico (opcional)"}
        obligatorio={accion.requiere === "comentario" || cierraSinValidar}
      >
        <textarea id="comentario-estado" name="comentario" rows={2} maxLength={4000} className={CLASE_CONTROL} />
      </Campo>
      <BotonEnviar enviando="Guardando…">{accion.etiqueta}</BotonEnviar>
    </form>
  );
}

export function CambioPrioridad({ id, numero, prioridad }: { id: string; numero: number; prioridad: Prioridad }) {
  const [r, enviar] = useActionState<EstadoAccion, FormData>(cambiarPrioridadAccion, ESTADO_INICIAL);
  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="numero" value={numero} />
      <Resultado estado={r} />
      <Campo id="prioridad" etiqueta="Prioridad">
        <select id="prioridad" name="prioridad" defaultValue={prioridad} className={CLASE_CONTROL} key={prioridad}>
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>
              {p} · {NOMBRE_PRIORIDAD[p]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="comentario-prioridad" etiqueta="Motivo (opcional)">
        <input id="comentario-prioridad" name="comentario" type="text" maxLength={1000} className={CLASE_CONTROL} />
      </Campo>
      <BotonEnviar enviando="Guardando…" className={CLASE_BOTON_SECUNDARIO}>
        Cambiar prioridad
      </BotonEnviar>
    </form>
  );
}

export function CambioResponsable({ id, numero, responsableId, responsables }: { id: string; numero: number; responsableId: string | null; responsables: Opcion[] }) {
  const [r, enviar] = useActionState<EstadoAccion, FormData>(asignarResponsableAccion, ESTADO_INICIAL);
  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="numero" value={numero} />
      <Resultado estado={r} />
      <Campo id="responsable" etiqueta="Responsable de la corrección">
        <select id="responsable" name="responsable" defaultValue={responsableId ?? ""} className={CLASE_CONTROL} key={responsableId ?? "ninguno"}>
          <option value="">Sin asignar</option>
          {responsables.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.etiqueta}
            </option>
          ))}
        </select>
      </Campo>
      <BotonEnviar enviando="Guardando…" className={CLASE_BOTON_SECUNDARIO}>
        <UserCheck aria-hidden="true" className="size-4" />
        Asignar
      </BotonEnviar>
    </form>
  );
}

export function NuevoComentario({ id, numero }: { id: string; numero: number }) {
  const [r, enviar] = useActionState<EstadoAccion, FormData>(comentarAccion, ESTADO_INICIAL);
  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="numero" value={numero} />
      <Resultado estado={r} />
      <Campo id="comentario" etiqueta="Comentario interno" error={r.errores?.comentario} ayuda="Solo lo ve el equipo. Podés adjuntar capturas o PDF.">
        <textarea id="comentario" name="comentario" rows={3} maxLength={4000} className={CLASE_CONTROL} aria-describedby="comentario-ayuda" />
      </Campo>
      <div className="flex flex-wrap items-center gap-3">
        <BotonEnviar enviando="Guardando…" className={CLASE_BOTON_SECUNDARIO}>
          <MessageSquarePlus aria-hidden="true" className="size-4" />
          Agregar comentario
        </BotonEnviar>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primario-oscuro">
          <Paperclip aria-hidden="true" className="size-4" />
          Adjuntar
          <input type="file" name="evidencias" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="max-w-48 text-xs font-normal text-texto-secundario" />
        </label>
      </div>
    </form>
  );
}
