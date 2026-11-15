"use client";

import { useActionState } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { BotonEnviar, Campo, CLASE_BOTON_COMPACTO, CLASE_CONTROL } from "@/components/formulario";
import { Aviso } from "@/components/ui";
import { NOMBRE_ROL, ROLES, type Rol } from "@/domain/permisos";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/accion";
import { actualizarUsuarioAccion, cambiarClaveAccion, crearUsuarioAccion } from "../actions";

function ClaveTemporal({ estado }: { estado: EstadoAccion }) {
  const datos = estado.datos as { usuario?: string; temporal?: string } | undefined;
  if (!datos?.temporal) return null;
  return (
    <Aviso tipo="exito" titulo={estado.mensaje}>
      <p>
        Contraseña temporal para <strong>{datos.usuario}</strong>: <code className="rounded bg-superficie px-1.5 py-0.5 font-mono text-base">{datos.temporal}</code>
      </p>
      <p className="mt-1 text-xs">Se muestra una sola vez. Pasásela por un canal seguro: al ingresar se le pide elegir la suya.</p>
    </Aviso>
  );
}

export function NuevoUsuario() {
  const [estado, crear] = useActionState<EstadoAccion, FormData>(crearUsuarioAccion, ESTADO_INICIAL);
  const e = estado.errores ?? {};
  return (
    <form action={crear} className="space-y-4" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <ClaveTemporal estado={estado} />
      <div className="grid gap-4 md:grid-cols-3">
        <Campo id="nu-usuario" etiqueta="Usuario" obligatorio error={e.usuario}>
          <input id="nu-usuario" name="usuario" type="text" autoCapitalize="none" spellCheck={false} defaultValue={estado.valores?.usuario ?? ""} className={CLASE_CONTROL} placeholder="nombre.apellido" />
        </Campo>
        <Campo id="nu-nombre" etiqueta="Nombre y apellido" obligatorio error={e.nombre}>
          <input id="nu-nombre" name="nombre" type="text" defaultValue={estado.valores?.nombre ?? ""} className={CLASE_CONTROL} />
        </Campo>
        <Campo id="nu-rol" etiqueta="Rol" obligatorio error={e.rol}>
          <select id="nu-rol" name="rol" defaultValue={estado.valores?.rol ?? "desarrollador"} className={CLASE_CONTROL}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {NOMBRE_ROL[r]}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <BotonEnviar enviando="Creando…">
        <UserPlus aria-hidden="true" className="size-4" />
        Crear usuario
      </BotonEnviar>
    </form>
  );
}

export function AccionesUsuario({ id, rol, activo, esYo }: { id: string; rol: Rol; activo: boolean; esYo: boolean }) {
  const [estado, enviar] = useActionState<EstadoAccion, FormData>(actualizarUsuarioAccion, ESTADO_INICIAL);
  return (
    <div className="space-y-2">
      {estado.error ? <p className="text-xs font-medium text-error">{estado.error}</p> : null}
      {estado.ok && !estado.datos ? <p className="text-xs font-medium text-exito">{estado.mensaje}</p> : null}
      <ClaveTemporal estado={estado} />
      <form action={enviar} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        {esYo ? null : (
          <>
            <select name="rol" defaultValue={rol} aria-label="Rol" className="rounded-control border border-borde-control bg-superficie px-2 py-1.5 text-xs">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {NOMBRE_ROL[r]}
                </option>
              ))}
            </select>
            <button type="submit" name="operacion" value="rol" className={CLASE_BOTON_COMPACTO}>
              Cambiar rol
            </button>
            <button type="submit" name="operacion" value={activo ? "desactivar" : "activar"} className={CLASE_BOTON_COMPACTO}>
              {activo ? "Desactivar" : "Activar"}
            </button>
          </>
        )}
        <button type="submit" name="operacion" value="restablecer" className={CLASE_BOTON_COMPACTO}>
          <KeyRound aria-hidden="true" className="size-3.5" />
          Nueva contraseña temporal
        </button>
      </form>
    </div>
  );
}

export function FormCambioClave() {
  const [estado, cambiar] = useActionState<EstadoAccion, FormData>(cambiarClaveAccion, ESTADO_INICIAL);
  const e = estado.errores ?? {};
  return (
    <form action={cambiar} className="space-y-4" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {estado.ok ? <Aviso tipo="exito">{estado.mensaje}</Aviso> : null}
      <Campo id="actual" etiqueta="Contraseña actual" obligatorio error={e.actual}>
        <input id="actual" name="actual" type="password" autoComplete="current-password" className={CLASE_CONTROL} />
      </Campo>
      <Campo id="nueva" etiqueta="Contraseña nueva" obligatorio error={e.nueva} ayuda="Al menos 12 caracteres. Una frase de varias palabras sirve y se recuerda mejor.">
        <input id="nueva" name="nueva" type="password" autoComplete="new-password" aria-describedby="nueva-ayuda" className={CLASE_CONTROL} />
      </Campo>
      <Campo id="repetida" etiqueta="Repetí la contraseña nueva" obligatorio error={e.repetida}>
        <input id="repetida" name="repetida" type="password" autoComplete="new-password" className={CLASE_CONTROL} />
      </Campo>
      <BotonEnviar enviando="Guardando…">Cambiar contraseña</BotonEnviar>
    </form>
  );
}
