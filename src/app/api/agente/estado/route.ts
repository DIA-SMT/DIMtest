import { conAgente, json } from "@/features/agente/api";
import { leerConfig } from "@/features/agente/servicio";
import { conBase } from "@/lib/db";

/**
 * Para el diagnóstico de la máquina (`npm run agente -- --revisar`): confirma que el token
 * vale y cuenta la cola, sin tomar ningún trabajo.
 */
export async function GET(pedido: Request) {
  return conAgente(pedido, async () => {
    const r = await conBase(async (q) => {
      const c = await leerConfig(q);
      const [cola] = await q<{ pendientes: number; en_curso: number }>(
        `select count(*) filter (where estado = 'pendiente')::int as pendientes,
                count(*) filter (where estado = 'en_curso')::int as en_curso
           from trabajos_agente`,
      );
      return { activo: c.activo, publicar: c.publicar, automatico: c.automatico, pendientes: cola!.pendientes, enCurso: cola!.en_curso };
    });
    return json(r);
  });
}
