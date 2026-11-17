"use client";

import { useActionState } from "react";
import { Bot, KeyRound, Save } from "lucide-react";
import { BotonEnviar, Campo, CLASE_BOTON_COMPACTO, CLASE_CONTROL } from "@/components/formulario";
import { Aviso } from "@/components/ui";
import { NOMBRE_PRIORIDAD, PRIORIDADES, type Prioridad } from "@/domain/prioridades";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/accion";
import { generarTokenAgenteAccion, guardarConfigAgenteAccion, guardarWhatsappAccion, pedirAgenteAccion } from "../actions";

const CASILLA = "mt-0.5 size-4 shrink-0 accent-primario";

function Opcion({ nombre, valor = "si", marcada, titulo, ayuda }: { nombre: string; valor?: string; marcada: boolean; titulo: string; ayuda: string }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-tarjeta border border-borde p-3 hover:border-borde-control has-checked:border-primario has-checked:bg-superficie-azul">
      <input type="checkbox" name={nombre} value={valor} defaultChecked={marcada} className={CASILLA} />
      <span>
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="block text-xs text-texto-secundario">{ayuda}</span>
      </span>
    </label>
  );
}

export function FormConfigAgente({
  config,
}: {
  config: { activo: boolean; automatico: boolean; prioridadesAutomaticas: readonly Prioridad[]; publicar: boolean };
}) {
  const [estado, guardar] = useActionState<EstadoAccion, FormData>(guardarConfigAgenteAccion, ESTADO_INICIAL);
  return (
    <form action={guardar} className="space-y-4">
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {estado.ok ? <Aviso tipo="exito">{estado.mensaje}</Aviso> : null}
      <Opcion
        nombre="activo"
        marcada={config.activo}
        titulo="Encendido"
        ayuda="Apagado, el agente no recibe trabajo. Si estaba trabajando, se entera en su próxima señal y no publica."
      />
      <Opcion
        nombre="publicar"
        marcada={config.publicar}
        titulo="Puede mergear y publicar en test"
        ayuda="Solo si pasan las verificaciones del repositorio. Apagado, deja el PR abierto para que lo revise una persona."
      />
      <Opcion
        nombre="automatico"
        marcada={config.automatico}
        titulo="Pedirle cada incidencia nueva"
        ayuda="Al crear una incidencia con alguna de estas prioridades, entra sola a su cola. Si no, se le pide desde cada incidencia."
      />
      <fieldset className="flex flex-wrap gap-2 pl-7" aria-label="Prioridades que se le piden solas">
        {PRIORIDADES.map((p) => (
          <label key={p} className="flex cursor-pointer items-center gap-2 rounded-full border border-borde px-3 py-1.5 text-sm has-checked:border-primario has-checked:bg-superficie-azul">
            <input type="checkbox" name="prioridades" value={p} defaultChecked={config.prioridadesAutomaticas.includes(p)} className="size-4 accent-primario" />
            {p} · {NOMBRE_PRIORIDAD[p]}
          </label>
        ))}
      </fieldset>
      <BotonEnviar enviando="Guardando…">
        <Save aria-hidden="true" className="size-4" />
        Guardar
      </BotonEnviar>
    </form>
  );
}

export function GenerarToken({ tieneToken }: { tieneToken: boolean }) {
  const [estado, generar] = useActionState<EstadoAccion, FormData>(generarTokenAgenteAccion, ESTADO_INICIAL);
  const token = (estado.datos as { token?: string } | undefined)?.token;
  return (
    <form action={generar} className="space-y-3">
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {token ? (
        <Aviso tipo="exito" titulo={estado.mensaje}>
          <p>Copialo ahora en la configuración del agente (variable <code>AGENTE_TOKEN</code>): no se vuelve a mostrar.</p>
          <code className="mt-2 block rounded bg-superficie p-2 font-mono text-xs break-all select-all">{token}</code>
        </Aviso>
      ) : null}
      <BotonEnviar enviando="Generando…" className={CLASE_BOTON_COMPACTO}>
        <KeyRound aria-hidden="true" className="size-3.5" />
        {tieneToken ? "Generar uno nuevo (el actual deja de andar)" : "Generar el token del agente"}
      </BotonEnviar>
    </form>
  );
}

export function PedirAgente({ incidenciaId, numero }: { incidenciaId: string; numero: number }) {
  const [estado, pedir] = useActionState<EstadoAccion, FormData>(pedirAgenteAccion, ESTADO_INICIAL);
  return (
    <form action={pedir} className="space-y-2">
      <input type="hidden" name="incidencia" value={incidenciaId} />
      <input type="hidden" name="numero" value={numero} />
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {estado.ok ? <Aviso tipo="exito">{estado.mensaje}</Aviso> : null}
      <BotonEnviar enviando="Pidiendo…">
        <Bot aria-hidden="true" className="size-4" />
        Pedirle al agente que la corrija
      </BotonEnviar>
    </form>
  );
}

export function MiWhatsapp({ whatsapp, avisos }: { whatsapp: string | null; avisos: boolean }) {
  const [estado, guardar] = useActionState<EstadoAccion, FormData>(guardarWhatsappAccion, ESTADO_INICIAL);
  const e = estado.errores ?? {};
  return (
    <form action={guardar} className="space-y-4" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {estado.ok ? <Aviso tipo="exito">{estado.mensaje}</Aviso> : null}
      <Campo id="whatsapp" etiqueta="Número de WhatsApp" error={e.whatsapp} ayuda="Con el código de país. Dejalo vacío para no recibir avisos.">
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={estado.valores?.whatsapp ?? whatsapp ?? ""}
          aria-describedby="whatsapp-ayuda"
          className={CLASE_CONTROL}
          placeholder="+54 9 381 555 1234"
        />
      </Campo>
      <Opcion
        nombre="avisos"
        marcada={avisos}
        titulo="Quiero recibir todos los avisos del agente"
        ayuda="Si no lo marcás, igual te avisa cuando trabaja en una incidencia donde sos responsable."
      />
      <BotonEnviar enviando="Guardando…">
        <Save aria-hidden="true" className="size-4" />
        Guardar
      </BotonEnviar>
    </form>
  );
}
