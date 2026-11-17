import { z } from "zod";
import { conAgente, json, leerCuerpo, numeroDeRuta } from "@/features/agente/api";
import { enviarAvisosPendientes } from "@/features/agente/avisos";
import { fallarTrabajo } from "@/features/agente/servicio";
import { conBase } from "@/lib/db";

const esquema = z.object({ motivo: z.string().trim().min(1).max(2000) });

/** El agente no pudo terminar por un problema suyo (red, GitHub, límite de uso…). */
export async function POST(pedido: Request, { params }: { params: Promise<{ numero: string }> }) {
  return conAgente(pedido, async (base) => {
    const numero = numeroDeRuta((await params).numero);
    const { motivo } = await leerCuerpo(pedido, esquema);
    await conBase((q) => fallarTrabajo(q, numero, motivo, base));
    await enviarAvisosPendientes();
    return json({ ok: true });
  });
}
