import { z } from "zod";
import { RESULTADOS_AGENTE } from "@/domain/agente";
import { conAgente, json, leerCuerpo, numeroDeRuta } from "@/features/agente/api";
import { enviarAvisosPendientes } from "@/features/agente/avisos";
import { terminarTrabajo } from "@/features/agente/servicio";
import { conBase } from "@/lib/db";

const esquema = z.object({
  resultado: z.enum(RESULTADOS_AGENTE),
  resumen: z.string().trim().min(1).max(3500),
  enlaces: z
    .array(z.object({ texto: z.string().trim().min(1).max(80), url: z.string().url().max(500).startsWith("https://") }))
    .max(10)
    .default([]),
});

/** El agente terminó: ver los resultados posibles en docs/AGENTE.md. */
export async function POST(pedido: Request, { params }: { params: Promise<{ numero: string }> }) {
  return conAgente(pedido, async (base) => {
    const numero = numeroDeRuta((await params).numero);
    const cierre = await leerCuerpo(pedido, esquema);
    const r = await conBase((q) => terminarTrabajo(q, numero, cierre, base));
    await enviarAvisosPendientes();
    return json(r);
  });
}
