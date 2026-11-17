import "server-only";
import { conBase } from "@/lib/db";
import { log } from "@/lib/log";
import { enviarWhatsapp, whatsappConfigurado } from "@/lib/whatsapp";

const MAX_INTENTOS = 3;

/**
 * Manda los avisos pendientes. Se llama después de cada transacción que encola avisos
 * (si el envío falla, el aviso ya quedó registrado). Sin WhatsApp configurado, quedan
 * como «sin canal» y se ven en la página del agente. No lanza errores.
 */
export async function enviarAvisosPendientes(limite = 20) {
  try {
    const pendientes = await conBase((q) =>
      q<{ id: number; destino: string | null; texto: string; intentos: number }>(
        `update notificaciones set intentos = intentos + 1
          where id in (select id from notificaciones where estado = 'pendiente' order by id limit $1 for update skip locked)
          returning id, destino, texto, intentos`,
        [limite],
      ),
    );
    if (!pendientes.length) return;
    const configurado = whatsappConfigurado();
    let enviados = 0;
    for (const n of pendientes) {
      const r = configurado && n.destino ? await enviarWhatsapp(n.destino, n.texto) : ({ ok: false, error: "sin_canal" } as const);
      const estado = r.ok ? "enviada" : r.error === "sin_canal" ? "sin_canal" : n.intentos >= MAX_INTENTOS ? "fallida" : "pendiente";
      await conBase((q) =>
        q("update notificaciones set estado = $2, error = $3, enviada_at = case when $2 = 'enviada' then now() else null end where id = $1", [
          n.id,
          estado,
          r.ok ? null : r.error,
        ]),
      );
      if (r.ok) enviados++;
    }
    log("avisos.enviados", { total: pendientes.length, enviados, configurado });
  } catch (error) {
    log("avisos.error", { error: error instanceof Error ? error.name : "desconocido" });
  }
}
