import Link from "next/link";
import { Hourglass, LoaderCircle, X } from "lucide-react";
import { CLASE_BOTON_COMPACTO } from "@/components/formulario";
import { InsigniaPrioridad, Tarjeta } from "@/components/ui";
import { antiguedad, fechaHora } from "@/lib/fechas";
import { numeroIncidencia } from "@/lib/formato";
import { cancelarTrabajoAccion } from "../actions";
import type { FilaCola } from "../consultas";

interface EstadoMaquina {
  activo: boolean;
  conectado: boolean;
  ultimoContactoAt: Date | null;
}

function Incidencia({ t }: { t: FilaCola }) {
  return (
    <>
      <Link href={`/admin/incidencias/${t.incidencia_numero}`} className="font-bold text-primario-oscuro hover:underline">
        {numeroIncidencia(t.incidencia_numero)}
      </Link>
      <Link href={`/admin/pruebas/${t.prueba_codigo}`} className="font-mono text-xs font-semibold text-primario-oscuro hover:underline">
        {t.prueba_codigo}
      </Link>
      <InsigniaPrioridad prioridad={t.prioridad} corta />
    </>
  );
}

function Pedido({ t }: { t: FilaCola }) {
  return (
    <>
      Trabajo #{t.numero} · {t.origen === "automatico" ? "pedido automático" : `pedido por ${t.pedido_por}`} {antiguedad(t.pedido_at)}
    </>
  );
}

function Cancelar({ t }: { t: FilaCola }) {
  return (
    <form action={cancelarTrabajoAccion}>
      <input type="hidden" name="trabajo" value={t.numero} />
      <button type="submit" className={CLASE_BOTON_COMPACTO}>
        <X aria-hidden="true" className="size-3.5" />
        {t.estado === "en_curso" ? "Pedirle que pare" : "Sacar de la cola"}
      </button>
    </form>
  );
}

/** Qué está haciendo el agente y qué le queda, en el orden en que lo va a tomar. */
export function ColaAgente({ cola, maquina, puedeCancelar }: { cola: FilaCola[]; maquina: EstadoMaquina; puedeCancelar: boolean }) {
  const enCurso = cola.filter((t) => t.estado === "en_curso");
  const pendientes = cola.filter((t) => t.estado === "pendiente");
  const estado = !maquina.activo
    ? { texto: "Apagado: la cola no avanza", clase: "border-advertencia-borde bg-advertencia-fondo text-advertencia" }
    : !maquina.conectado
      ? { texto: "Encendido, pero la máquina no da señales", clase: "border-error-borde bg-error-fondo text-error" }
      : { texto: "Encendido y conectado", clase: "border-exito-borde bg-exito-fondo text-exito" };

  return (
    <Tarjeta className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="cola" className="scroll-mt-24 text-base font-bold">
          Cola del agente
        </h2>
        <span className="flex flex-wrap items-center gap-2 text-xs text-texto-secundario">
          <span className={`rounded-full border px-2.5 py-0.5 font-semibold ${estado.clase}`}>{estado.texto}</span>
          {maquina.ultimoContactoAt ? `Última señal ${antiguedad(maquina.ultimoContactoAt)}` : "Nunca se conectó"}
        </span>
      </div>

      {cola.length === 0 ? (
        <p className="text-sm text-texto-secundario">No hay nada en la cola. Lo que se le pida al agente aparece acá hasta que termine.</p>
      ) : null}

      {enCurso.map((t) => (
        <div key={t.numero} className="space-y-1.5 rounded-control border border-primario bg-superficie-azul p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 font-semibold text-primario-oscuro">
              <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
              Trabajando
            </span>
            <Incidencia t={t} />
          </div>
          <p className="text-xs text-texto-secundario">
            {t.modulo} · {t.que_probar}
          </p>
          {t.ultimo_avance ? (
            <p className="text-sm">
              «{t.ultimo_avance}» <span className="text-xs text-texto-secundario">({antiguedad(t.ultimo_avance_at!)})</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-texto-secundario">
              <Pedido t={t} /> · empezó el {fechaHora(t.tomado_at!)}
              {t.latido_at ? ` · última señal ${antiguedad(t.latido_at)}` : ""}
            </p>
            {puedeCancelar ? <Cancelar t={t} /> : null}
          </div>
        </div>
      ))}

      {pendientes.length ? (
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-texto-secundario">
            <Hourglass aria-hidden="true" className="size-4" />
            {pendientes.length === 1 ? "1 esperando" : `${pendientes.length} esperando`}, en el orden en que los va a tomar (prioridad y después antigüedad)
          </h3>
          <ol className="divide-y divide-borde rounded-control border border-borde">
            {pendientes.map((t, k) => (
              <li key={t.numero} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-neutro-fondo text-xs font-bold tabular-nums">
                  {k + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Incidencia t={t} />
                  </div>
                  <p className="text-xs text-texto-secundario">
                    <Pedido t={t} />
                  </p>
                </div>
                {puedeCancelar ? <Cancelar t={t} /> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Tarjeta>
  );
}
