import { conAgente, json } from "@/features/agente/api";
import { enviarAvisosPendientes } from "@/features/agente/avisos";
import { tomarTrabajo } from "@/features/agente/servicio";
import { conBase } from "@/lib/db";

/**
 * El agente pide trabajo: POST /api/agente/tomar. Devuelve 200 con el trabajo, o 204 si
 * no hay nada (o el interruptor está apagado). Ver docs/AGENTE.md.
 */
export async function POST(pedido: Request) {
  return conAgente(pedido, async (base) => {
    const trabajo = await conBase((q) => tomarTrabajo(q, base));
    if (!trabajo) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    await enviarAvisosPendientes();
    return json({ trabajo });
  });
}
