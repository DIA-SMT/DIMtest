import { z } from "zod";
import { conAgente, json, leerCuerpo, numeroDeRuta } from "@/features/agente/api";
import { informarAvance } from "@/features/agente/servicio";
import { conBase } from "@/lib/db";

const esquema = z.object({ mensaje: z.string().max(2000).default("") });

/**
 * Señal de vida (cada pocos minutos) y, si trae mensaje, una nota en el historial.
 * Contesta { seguir, publicar }: si seguir es false, el agente deja todo como está y no publica.
 */
export async function POST(pedido: Request, { params }: { params: Promise<{ numero: string }> }) {
  return conAgente(pedido, async () => {
    const numero = numeroDeRuta((await params).numero);
    const { mensaje } = await leerCuerpo(pedido, esquema);
    return json(await conBase((q) => informarAvance(q, numero, mensaje)));
  });
}
