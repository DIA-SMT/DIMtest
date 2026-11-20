"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { BotonEnviar, Campo, CLASE_BOTON_COMPACTO, CLASE_CONTROL } from "@/components/formulario";
import { Aviso } from "@/components/ui";
import { esEstadoSugerencia, ESTADO_SUGERENCIA_RELEVADOR, ESTADOS_SUGERENCIA, NOMBRE_ESTADO_SUGERENCIA, RESPUESTA_SUGERENCIA_MAX, type EstadoSugerencia } from "@/domain/sugerencias";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/accion";
import { responderSugerenciaAccion } from "../actions";

/** Panel: cambiar el estado de una sugerencia y contestarle a quien la propuso. */
export function FormRespuestaSugerencia({ numero, estado, respuesta }: { numero: number; estado: EstadoSugerencia; respuesta: string }) {
  const [r, enviar] = useActionState<EstadoAccion, FormData>(responderSugerenciaAccion, ESTADO_INICIAL);
  // Después de cada envío React reinicia el formulario, y un <select> ya montado no toma un
  // defaultValue nuevo: los campos se vuelven a montar con lo guardado o, si hubo error, con lo elegido.
  const v = r.valores;
  const inicial = {
    estado: esEstadoSugerencia(v?.estado) ? v.estado : estado === "nueva" ? "en_evaluacion" : estado,
    respuesta: v?.respuesta ?? respuesta,
  };
  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="numero" value={numero} />
      {r.error ? <Aviso tipo="error">{r.errores?.respuesta ?? r.error}</Aviso> : null}
      {r.ok && r.mensaje ? <Aviso tipo="exito">{r.mensaje}</Aviso> : null}
      <Campos key={`${estado}|${respuesta}|${v ? JSON.stringify(v) : ""}`} numero={numero} inicial={inicial} error={r.errores?.respuesta} />
      <BotonEnviar className={CLASE_BOTON_COMPACTO}>
        <Save aria-hidden="true" className="size-3.5" />
        Guardar
      </BotonEnviar>
    </form>
  );
}

function Campos({ numero, inicial, error }: { numero: number; inicial: { estado: EstadoSugerencia; respuesta: string }; error?: string }) {
  const [elegido, setElegido] = useState<EstadoSugerencia>(inicial.estado);
  const id = `respuesta-${numero}`;
  return (
    <div className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
      <Campo id={`estado-${numero}`} etiqueta="Estado">
        <select
          id={`estado-${numero}`}
          name="estado"
          defaultValue={inicial.estado}
          onChange={(e) => setElegido(e.target.value as EstadoSugerencia)}
          aria-describedby={`estado-${numero}-ve`}
          className={CLASE_CONTROL}
        >
          {ESTADOS_SUGERENCIA.map((e) => (
            <option key={e} value={e}>
              {NOMBRE_ESTADO_SUGERENCIA[e]}
            </option>
          ))}
        </select>
        <p id={`estado-${numero}-ve`} className="text-xs text-texto-secundario">
          El relevador ve: «{ESTADO_SUGERENCIA_RELEVADOR[elegido]}»
        </p>
      </Campo>
      <Campo id={id} etiqueta="Respuesta para quien la propuso" obligatorio={elegido === "descartada"} error={error}>
        <textarea
          id={id}
          name="respuesta"
          rows={3}
          maxLength={RESPUESTA_SUGERENCIA_MAX}
          required={elegido === "descartada"}
          defaultValue={inicial.respuesta}
          placeholder={elegido === "descartada" ? "Por qué no va por ahora." : "Opcional. La ve en el portal, debajo de su sugerencia."}
          className={CLASE_CONTROL}
        />
      </Campo>
    </div>
  );
}
