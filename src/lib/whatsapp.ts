import "server-only";
import { textoParaPlantilla } from "@/domain/agente";
import { entorno } from "@/lib/entorno";

/**
 * Envío por WhatsApp Cloud API (Meta) con una plantilla aprobada de categoría «utility»
 * y un solo parámetro de texto ({{1}}). Fuera de la ventana de 24 horas, Meta solo permite
 * plantillas aprobadas. Nunca se loguean números ni textos.
 */
export const whatsappConfigurado = () => !!(entorno.WHATSAPP_TOKEN && entorno.WHATSAPP_NUMERO_ID);

export type ResultadoEnvio = { ok: true } | { ok: false; error: string };

export async function enviarWhatsapp(destino: string, texto: string): Promise<ResultadoEnvio> {
  if (!whatsappConfigurado()) return { ok: false, error: "sin_canal" };
  try {
    const r = await fetch(`https://graph.facebook.com/${entorno.WHATSAPP_VERSION_API}/${entorno.WHATSAPP_NUMERO_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${entorno.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: destino.replace(/^\+/, ""),
        type: "template",
        template: {
          name: entorno.WHATSAPP_PLANTILLA,
          language: { code: entorno.WHATSAPP_IDIOMA },
          components: [{ type: "body", parameters: [{ type: "text", text: textoParaPlantilla(texto) }] }],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (r.ok) return { ok: true };
    const cuerpo = (await r.json().catch(() => null)) as { error?: { message?: string; code?: number } } | null;
    return { ok: false, error: `HTTP ${r.status}${cuerpo?.error ? ` · ${cuerpo.error.code ?? ""} ${cuerpo.error.message ?? ""}` : ""}`.slice(0, 500) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.name : "error_de_red" };
  }
}
