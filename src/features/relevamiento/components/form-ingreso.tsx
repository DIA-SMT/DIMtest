"use client";

import { useActionState, useState } from "react";
import { ArrowRight, UserRound, UserRoundPlus } from "lucide-react";
import { BotonEnviar, Campo, CLASE_BOTON_FANTASMA, CLASE_BOTON_INGRESO, CLASE_CONTROL } from "@/components/formulario";
import { Aviso } from "@/components/ui";
import { confirmarIdentidadAccion, ingresarAccion, type EstadoIngreso } from "../actions";

/** El ingreso en dos pasos posibles; «Volver a escribir el nombre» lo vuelve a montar de cero. */
export function FormIngreso() {
  const [intento, setIntento] = useState(0);
  return <Pasos key={intento} reiniciar={() => setIntento((n) => n + 1)} />;
}

function Pasos({ reiniciar }: { reiniciar: () => void }) {
  const [estado, ingresar] = useActionState<EstadoIngreso, FormData>(ingresarAccion, {});
  const [estadoConfirmar, confirmar] = useActionState<EstadoIngreso, FormData>(confirmarIdentidadAccion, {});
  const confirmacion = estado.confirmar;

  if (confirmacion) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-bold">¿Sos vos?</h2>
          <p className="text-sm text-texto-secundario">
            Ya ingresó alguien como <strong className="text-texto">{confirmacion.nombre}</strong> desde otro dispositivo. Elegí
            si sos esa persona o si es otra con el mismo nombre.
          </p>
        </div>
        {estadoConfirmar.error ? <Aviso tipo="error">{estadoConfirmar.error}</Aviso> : null}
        <form action={confirmar} className="space-y-3">
          <input type="hidden" name="nombre" value={confirmacion.nombre} />
          {confirmacion.candidatos.map((c) => (
            <BotonEnviar
              key={c.id}
              name="eleccion"
              value={c.id}
              enviando="Ingresando…"
              className="flex w-full items-center gap-3 rounded-tarjeta border border-borde-control bg-superficie px-4 py-3 text-left transition-colors hover:border-primario hover:bg-superficie-azul focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario"
            >
              <UserRound aria-hidden="true" className="size-5 shrink-0 text-primario" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Sí, soy {c.nombre}</span>
                <span className="block text-xs text-texto-secundario">
                  Último ingreso: {c.ultimoIngreso} · {c.ejecuciones === 1 ? "1 prueba registrada" : `${c.ejecuciones} pruebas registradas`}
                </span>
              </span>
            </BotonEnviar>
          ))}
          <BotonEnviar
            name="eleccion"
            value="nuevo"
            enviando="Ingresando…"
            className="flex w-full items-center gap-3 rounded-tarjeta border border-dashed border-borde-control bg-superficie px-4 py-3 text-left transition-colors hover:border-primario hover:bg-superficie-azul focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario"
          >
            <UserRoundPlus aria-hidden="true" className="size-5 shrink-0 text-texto-secundario" />
            <span className="block font-semibold">No, soy otra persona con el mismo nombre</span>
          </BotonEnviar>
        </form>
        <button type="button" onClick={reiniciar} className={CLASE_BOTON_FANTASMA}>
          Volver a escribir el nombre
        </button>
      </div>
    );
  }

  const error = estado.errores?.nombre;
  return (
    <form action={ingresar} className="space-y-5" noValidate>
      <Campo id="nombre" etiqueta="Nombre y apellido" obligatorio error={error} ayuda="Así va a figurar en cada prueba que registres.">
        <input
          id="nombre"
          name="nombre"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          required
          minLength={3}
          maxLength={80}
          defaultValue={estado.valores?.nombre ?? ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "nombre-ayuda nombre-error" : "nombre-ayuda"}
          className={CLASE_CONTROL}
          placeholder="Por ejemplo, Luis Pérez"
        />
      </Campo>
      <BotonEnviar enviando="Ingresando…" className={CLASE_BOTON_INGRESO}>
        Comenzar relevamiento
        <ArrowRight aria-hidden="true" className="size-5" />
      </BotonEnviar>
    </form>
  );
}
