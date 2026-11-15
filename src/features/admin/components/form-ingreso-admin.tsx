"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { BotonEnviar, Campo, CLASE_BOTON_PRIMARIO, CLASE_CONTROL } from "@/components/formulario";
import { Aviso } from "@/components/ui";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/accion";
import { ingresarAdminAccion } from "../actions";

export function FormIngresoAdmin({ motivo }: { motivo?: string }) {
  const [estado, ingresar] = useActionState<EstadoAccion, FormData>(ingresarAdminAccion, ESTADO_INICIAL);
  const e = estado.errores ?? {};
  return (
    <form action={ingresar} className="space-y-4" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : motivo === "vencida" ? <Aviso tipo="info">Se venció tu sesión. Ingresá de nuevo.</Aviso> : null}
      <Campo id="usuario" etiqueta="Usuario" obligatorio error={e.usuario}>
        <input
          id="usuario"
          name="usuario"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={estado.valores?.usuario ?? ""}
          aria-invalid={e.usuario ? true : undefined}
          className={CLASE_CONTROL}
        />
      </Campo>
      <Campo id="clave" etiqueta="Contraseña" obligatorio error={e.clave}>
        <input id="clave" name="clave" type="password" autoComplete="current-password" required aria-invalid={e.clave ? true : undefined} className={CLASE_CONTROL} />
      </Campo>
      <BotonEnviar enviando="Ingresando…" className={`${CLASE_BOTON_PRIMARIO} w-full`}>
        <LogIn aria-hidden="true" className="size-4" />
        Ingresar al panel
      </BotonEnviar>
    </form>
  );
}
