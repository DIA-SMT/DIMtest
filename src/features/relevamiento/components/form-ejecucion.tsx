"use client";

import { useActionState, useEffect, useState } from "react";
import { Clock, Paperclip, Save } from "lucide-react";
import { BotonEnviar, Campo, CLASE_BOTON_SECUNDARIO, CLASE_CONTROL } from "@/components/formulario";
import { Aviso, InsigniaPrioridad } from "@/components/ui";
import { AYUDA_PRIORIDAD, NOMBRE_PRIORIDAD, PRIORIDADES, type Prioridad } from "@/domain/prioridades";
import { admitePrioridad, AYUDA_RESULTADO, NOMBRE_RESULTADO, PEDIDO_EXPLICACION, RESULTADOS, requiereExplicacion, type Resultado } from "@/domain/resultados";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/accion";
import { guardarEjecucionAccion, liberarPruebaAccion, renovarReservaAccion } from "../actions";

const ESTILO_OPCION: Record<Resultado, string> = {
  funciona: "has-checked:border-exito-solido has-checked:bg-exito-fondo",
  no_funciona: "has-checked:border-error has-checked:bg-error-fondo",
  parcial: "has-checked:border-advertencia-borde has-checked:bg-advertencia-fondo",
  no_probado: "has-checked:border-borde-control has-checked:bg-neutro-fondo",
};
/** P0 a P3 y, al final, «No sé» (valor vacío). */
const OPCIONES_PRIORIDAD: (Prioridad | "")[] = [...PRIORIDADES, ""];
const PUNTO: Record<Resultado, string> = {
  funciona: "bg-exito-solido",
  no_funciona: "bg-error",
  parcial: "bg-amarillo",
  no_probado: "bg-borde-control",
};

/** Formulario del resultado. Mientras está abierto, renueva la reserva cada 4 minutos. */
export function FormEjecucion({ codigo, venceInicial, esRevalidacion }: { codigo: string; venceInicial: string; esRevalidacion: boolean }) {
  const [estado, guardar] = useActionState<EstadoAccion, FormData>(guardarEjecucionAccion, ESTADO_INICIAL);
  const [resultado, setResultado] = useState<Resultado | null>((estado.valores?.resultado as Resultado) ?? null);
  const [vence, setVence] = useState<string | null>(venceInicial);
  const [archivos, setArchivos] = useState<string[]>([]);

  useEffect(() => {
    const id = window.setInterval(async () => {
      const r = await renovarReservaAccion(codigo).catch(() => null);
      if (r) setVence(r.vence);
    }, 4 * 60_000);
    return () => window.clearInterval(id);
  }, [codigo]);

  const errores = estado.errores ?? {};
  const v = estado.valores ?? {};
  const pideExplicacion = resultado ? requiereExplicacion(resultado) : false;
  const conPrioridad = resultado ? admitePrioridad(resultado) : false;

  return (
    <div className="space-y-4 rounded-panel border-2 border-primario bg-superficie p-4 shadow-elevada sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{esRevalidacion ? "Registrá la nueva validación" : "Registrá el resultado"}</h2>
        <p className={`flex items-center gap-1.5 text-sm ${vence ? "text-texto-secundario" : "font-semibold text-error"}`}>
          <Clock aria-hidden="true" className="size-4" />
          {vence ? `Reservada para vos hasta las ${vence}` : "La reserva venció: si nadie la tomó, igual podés guardar."}
        </p>
      </div>

      {estado.error ? (
        <Aviso tipo="error" titulo={estado.error}>
          {Object.keys(errores).length > 0 ? (
            <ul className="list-disc pl-5">
              {Object.entries(errores).map(([campo, mensaje]) => (
                <li key={campo}>
                  <a href={`#${campo === "resultado" ? "resultado-funciona" : campo}`} className="underline">
                    {mensaje}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </Aviso>
      ) : null}

      <form action={guardar} className="space-y-5">
        <input type="hidden" name="codigo" value={codigo} />

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">
            ¿Cuál fue el resultado?<span className="ml-1 text-error" aria-hidden="true">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {RESULTADOS.map((r) => (
              <label
                key={r}
                className={`opcion-resultado flex cursor-pointer gap-3 rounded-tarjeta border-2 border-borde bg-superficie p-3 transition-colors hover:border-borde-control ${ESTILO_OPCION[r]}`}
              >
                <input
                  id={`resultado-${r}`}
                  type="radio"
                  name="resultado"
                  value={r}
                  required
                  defaultChecked={v.resultado === r}
                  onChange={() => setResultado(r)}
                  className="mt-1 size-4 shrink-0 accent-primario"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold">
                    <span aria-hidden="true" className={`size-2.5 rounded-full ${PUNTO[r]}`} />
                    {NOMBRE_RESULTADO[r]}
                  </span>
                  <span className="mt-0.5 block text-xs text-texto-secundario">{AYUDA_RESULTADO[r]}</span>
                </span>
              </label>
            ))}
          </div>
          {errores.resultado ? <p className="text-sm font-medium text-error">{errores.resultado}</p> : null}
        </fieldset>

        <Campo
          id="observaciones"
          etiqueta={resultado ? PEDIDO_EXPLICACION[resultado] : "Observaciones"}
          obligatorio={pideExplicacion}
          error={errores.observaciones}
          ayuda={pideExplicacion ? "Es obligatorio: contá qué viste para que el equipo lo pueda reproducir." : "Opcional. Un comentario, una duda o algo que te llamó la atención."}
        >
          <textarea
            id="observaciones"
            name="observaciones"
            rows={4}
            maxLength={4000}
            required={pideExplicacion}
            defaultValue={v.observaciones ?? ""}
            aria-invalid={errores.observaciones ? true : undefined}
            aria-describedby="observaciones-ayuda"
            className={CLASE_CONTROL}
          />
        </Campo>

        <Campo id="caso" etiqueta="Caso usado" ayuda="El CUIT, padrón o número de comprobante con el que probaste." error={errores.caso}>
          <input id="caso" name="caso" type="text" maxLength={300} defaultValue={v.caso ?? ""} aria-describedby="caso-ayuda" className={CLASE_CONTROL} />
        </Campo>

        <Campo id="evidencias" etiqueta="Evidencias (opcional)" ayuda="Capturas o fotos (JPG, PNG, WebP) o PDF. Hasta 5 archivos de 8 MB." error={errores.evidencias}>
          <label
            htmlFor="evidencias"
            className="flex min-h-12 cursor-pointer items-center gap-2 rounded-control border border-dashed border-borde-control bg-fondo px-3 py-2 text-sm font-semibold text-primario-oscuro hover:border-primario"
          >
            <Paperclip aria-hidden="true" className="size-4" />
            {archivos.length ? `${archivos.length} archivo${archivos.length > 1 ? "s" : ""}: ${archivos.join(", ")}` : "Elegir archivos o sacar una foto"}
          </label>
          <input
            id="evidencias"
            name="evidencias"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            aria-describedby="evidencias-ayuda"
            className="sr-only"
            onChange={(e) => setArchivos(Array.from(e.target.files ?? []).map((f) => f.name))}
          />
        </Campo>

        {conPrioridad ? (
          <fieldset className="space-y-2" aria-describedby="prioridad-ayuda">
            <legend className="mb-1 text-sm font-semibold">¿Qué tan grave te parece?</legend>
            <p id="prioridad-ayuda" className="text-sm text-texto-secundario">
              Es una sugerencia: la prioridad final la define el equipo. Si tenés dudas, dejá «No sé».
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {OPCIONES_PRIORIDAD.map((p) => (
                <label
                  key={p || "no-se"}
                  className={`flex cursor-pointer gap-3 rounded-tarjeta border-2 border-borde bg-superficie p-3 transition-colors hover:border-borde-control has-checked:border-primario has-checked:bg-superficie-azul ${p ? "" : "sm:col-span-2"}`}
                >
                  <input
                    id={`prioridad-${p || "no-se"}`}
                    type="radio"
                    name="prioridad"
                    value={p}
                    defaultChecked={(v.prioridad ?? "") === p}
                    className="mt-1 size-4 shrink-0 accent-primario"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-semibold">
                      {p ? <InsigniaPrioridad prioridad={p} corta /> : null}
                      {p ? NOMBRE_PRIORIDAD[p] : "No sé"}
                    </span>
                    <span className="mt-0.5 block text-xs text-texto-secundario">{p ? AYUDA_PRIORIDAD[p] : "El equipo la define al revisar la incidencia."}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-borde pt-4 sm:flex-row sm:items-center">
          <BotonEnviar enviando="Guardando…" name="despues" value="seguir">
            <Save aria-hidden="true" className="size-4" />
            Guardar y seguir con otra prueba
          </BotonEnviar>
          <button type="submit" formAction={liberarPruebaAccion} formNoValidate className={CLASE_BOTON_SECUNDARIO}>
            Cancelar y liberar la prueba
          </button>
        </div>
      </form>
    </div>
  );
}
