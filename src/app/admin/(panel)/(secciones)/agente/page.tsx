import { Bot, RefreshCw } from "lucide-react";
import { CLASE_BOTON_COMPACTO } from "@/components/formulario";
import { Aviso, EncabezadoPagina, Tarjeta } from "@/components/ui";
import { reintentarAvisosAccion, revocarTokenAgenteAccion } from "@/features/agente/actions";
import { FormConfigAgente, GenerarToken } from "@/features/agente/components/formularios";
import { ListaTrabajos } from "@/features/agente/components/lista-trabajos";
import { avisosRecientes, leerConfig, listarTrabajos } from "@/features/agente/servicio";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { antiguedad, fechaHora } from "@/lib/fechas";
import { whatsappConfigurado } from "@/lib/whatsapp";

export const metadata = { title: "Agente Claude" };

const ESTADO_AVISO = { pendiente: "Por enviar", enviada: "Enviado", fallida: "Falló", sin_canal: "Sin WhatsApp configurado" } as const;

/** El agente Claude (D-015): interruptor, conexión, lo que hizo y a quién avisó. */
export default async function Agente() {
  await exigirAdmin("usuarios.gestionar");
  const { config, trabajos, avisos } = await conBase(async (q) => ({
    config: await leerConfig(q),
    trabajos: await listarTrabajos(q, { limite: 40 }),
    avisos: await avisosRecientes(q, 15),
  }));
  const conWhatsapp = whatsappConfigurado();
  const sinCanal = avisos.filter((a) => a.estado === "sin_canal" || a.estado === "fallida").length;

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        antetitulo="Correcciones automáticas"
        titulo="Agente Claude"
        descripcion="Corre en una máquina de la red municipal, toma las incidencias que se le piden, corrige DIM360, publica en test y pide la revalidación. Todo lo que hace queda en el historial de cada incidencia."
      />

      {!config.activo ? (
        <Aviso tipo="advertencia" titulo="El agente está apagado">
          No recibe trabajo. Lo que se le pida queda en la cola hasta que lo enciendas.
        </Aviso>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <Tarjeta className="p-5">
            <h2 className="mb-3 text-base font-bold">Lo que se le pidió</h2>
            <ListaTrabajos trabajos={trabajos} conIncidencia puedeCancelar />
          </Tarjeta>

          <Tarjeta className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">Avisos por WhatsApp</h2>
              {sinCanal && conWhatsapp ? (
                <form action={reintentarAvisosAccion}>
                  <button type="submit" className={CLASE_BOTON_COMPACTO}>
                    <RefreshCw aria-hidden="true" className="size-3.5" />
                    Reintentar los no enviados
                  </button>
                </form>
              ) : null}
            </div>
            {!conWhatsapp ? (
              <p className="mb-3 text-sm text-texto-secundario">
                WhatsApp todavía no está configurado: los avisos quedan registrados acá pero no se envían. Ver README, «Agente Claude».
              </p>
            ) : null}
            {avisos.length === 0 ? (
              <p className="text-sm text-texto-secundario">Todavía no hubo avisos.</p>
            ) : (
              <ul className="divide-y divide-borde text-sm">
                {avisos.map((a) => (
                  <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-xs text-texto-secundario">
                      {fechaHora(a.creada_at)} · para {a.destinatario ?? "—"} · <strong>{ESTADO_AVISO[a.estado]}</strong>
                      {a.error && a.error !== "sin_canal" ? ` (${a.error})` : ""}
                    </p>
                    <p className="mt-0.5">{a.texto}</p>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>

        <aside className="space-y-6">
          <Tarjeta className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Bot aria-hidden="true" className="size-5 text-primario" />
              Estado
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-texto-secundario">Interruptor</dt>
                <dd className={`font-semibold ${config.activo ? "text-exito" : "text-error"}`}>{config.activo ? "Encendido" : "Apagado"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-texto-secundario">Última conexión</dt>
                <dd className="text-right">
                  {config.ultimoContactoAt ? `${fechaHora(config.ultimoContactoAt)} (${antiguedad(config.ultimoContactoAt)})` : "Nunca se conectó"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-texto-secundario">Máquina del agente</dt>
                <dd className="font-semibold">{config.conectado ? "Conectada" : "Sin señales"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-texto-secundario">Último cambio</dt>
                <dd className="text-right">
                  {config.actualizadoPor} · {fechaHora(config.actualizadoAt)}
                </dd>
              </div>
            </dl>
          </Tarjeta>

          <Tarjeta className="p-5">
            <h2 className="mb-3 text-base font-bold">Configuración</h2>
            <FormConfigAgente config={config} />
          </Tarjeta>

          <Tarjeta className="space-y-3 p-5">
            <h2 className="text-base font-bold">Conexión de la máquina</h2>
            <p className="text-sm text-texto-secundario">
              {config.tieneToken
                ? `El agente tiene un token desde el ${fechaHora(config.tokenCreadoAt!)}. Solo se guarda su huella: si se pierde, generá uno nuevo.`
                : "Sin token, la máquina del agente no se puede conectar."}
            </p>
            <GenerarToken tieneToken={config.tieneToken} />
            {config.tieneToken ? (
              <form action={revocarTokenAgenteAccion}>
                <button type="submit" className={`${CLASE_BOTON_COMPACTO} hover:border-error hover:text-error`}>
                  Desconectar la máquina (revocar el token)
                </button>
              </form>
            ) : null}
          </Tarjeta>
        </aside>
      </div>
    </div>
  );
}
