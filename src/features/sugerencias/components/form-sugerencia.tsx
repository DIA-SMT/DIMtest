"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { BotonEnviar, Campo, CLASE_CONTROL } from "@/components/formulario";
import { Aviso } from "@/components/ui";
import { AYUDA_TIPO_SUGERENCIA, DETALLE_SUGERENCIA_MAX, NOMBRE_TIPO_SUGERENCIA, TIPOS_SUGERENCIA, TITULO_SUGERENCIA_MAX } from "@/domain/sugerencias";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/accion";
import { proponerSugerenciaAccion } from "../actions";

/** Portal: proponer una función nueva, una mejora u otra idea para DIM360. */
export function FormSugerencia({ modulos }: { modulos: { codigo: string; nombre: string }[] }) {
  const [estado, enviar] = useActionState<EstadoAccion, FormData>(proponerSugerenciaAccion, ESTADO_INICIAL);
  const errores = estado.errores ?? {};
  const v = estado.valores ?? {};

  return (
    <form action={enviar} className="space-y-5 rounded-panel border border-borde bg-superficie p-4 shadow-tarjeta sm:p-6">
      {estado.error ? (
        <Aviso tipo="error" titulo={estado.error}>
          {Object.keys(errores).length > 0 ? (
            <ul className="list-disc pl-5">
              {Object.entries(errores).map(([campo, mensaje]) => (
                <li key={campo}>
                  <a href={`#${campo === "tipo" ? "tipo-nueva_funcion" : campo}`} className="underline">
                    {mensaje}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </Aviso>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold text-institucional">
          ¿Qué querés proponer?<span className="ml-1 text-error" aria-hidden="true">*</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TIPOS_SUGERENCIA.map((t) => (
            <label
              key={t}
              className="flex cursor-pointer gap-3 rounded-tarjeta border-2 border-borde bg-superficie p-3 transition-colors hover:border-borde-control has-checked:border-primario has-checked:bg-superficie-azul"
            >
              <input
                id={`tipo-${t}`}
                type="radio"
                name="tipo"
                value={t}
                required
                defaultChecked={(v.tipo ?? "nueva_funcion") === t}
                className="mt-1 size-4 shrink-0 accent-primario"
              />
              <span className="min-w-0">
                <span className="block font-semibold">{NOMBRE_TIPO_SUGERENCIA[t]}</span>
                <span className="mt-0.5 block text-xs text-texto-secundario">{AYUDA_TIPO_SUGERENCIA[t]}</span>
              </span>
            </label>
          ))}
        </div>
        {errores.tipo ? <p className="text-sm font-medium text-error">{errores.tipo}</p> : null}
      </fieldset>

      <Campo id="modulo" etiqueta="Módulo" ayuda="Si tiene que ver con una parte de DIM360 en particular. Si no, dejalo en «General»." error={errores.modulo}>
        <select id="modulo" name="modulo" defaultValue={v.modulo ?? ""} aria-describedby="modulo-ayuda" className={CLASE_CONTROL}>
          <option value="">General</option>
          {modulos.map((m) => (
            <option key={m.codigo} value={m.codigo}>
              {m.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo id="titulo" etiqueta="En pocas palabras" obligatorio error={errores.titulo} ayuda="Por ejemplo: «Exportar el estado de cuenta a Excel».">
        <input
          id="titulo"
          name="titulo"
          type="text"
          required
          minLength={3}
          maxLength={TITULO_SUGERENCIA_MAX}
          defaultValue={v.titulo ?? ""}
          aria-invalid={errores.titulo ? true : undefined}
          aria-describedby="titulo-ayuda"
          className={CLASE_CONTROL}
        />
      </Campo>

      <Campo
        id="detalle"
        etiqueta="Contanos más"
        obligatorio
        error={errores.detalle}
        ayuda="Qué necesitás, para qué te serviría en tu trabajo y cómo lo hacés hoy. Si es un error de una prueba, mejor cargalo en la prueba."
      >
        <textarea
          id="detalle"
          name="detalle"
          rows={5}
          required
          minLength={10}
          maxLength={DETALLE_SUGERENCIA_MAX}
          defaultValue={v.detalle ?? ""}
          aria-invalid={errores.detalle ? true : undefined}
          aria-describedby="detalle-ayuda"
          className={CLASE_CONTROL}
        />
      </Campo>

      <div className="flex flex-wrap items-center gap-3">
        <BotonEnviar enviando="Enviando…">
          <Send aria-hidden="true" className="size-4" />
          Enviar sugerencia
        </BotonEnviar>
        <p className="text-xs text-texto-secundario">La lee el equipo de la DIA y te contesta acá mismo.</p>
      </div>
    </form>
  );
}
