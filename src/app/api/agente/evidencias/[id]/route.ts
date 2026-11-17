import { conAgente, json } from "@/features/agente/api";
import { leerArchivo } from "@/lib/almacenamiento";
import { consultar } from "@/lib/db";

/**
 * Una evidencia para el agente. Solo las de una incidencia que está trabajando ahora
 * (las suyas o las de la ejecución que la originó).
 */
export async function GET(pedido: Request, { params }: { params: Promise<{ id: string }> }) {
  return conAgente(pedido, async () => {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: "evidencia_inexistente" }, 404);
    const [ev] = await consultar<{ nombre_original: string; tipo_mime: string; ruta: string }>(
      `select v.nombre_original, v.tipo_mime, v.ruta from evidencias v
        where v.id = $1 and exists (
          select 1 from trabajos_agente t join incidencias i on i.id = t.incidencia_id
           where t.estado = 'en_curso' and (v.incidencia_id = i.id or (i.ejecucion_id is not null and v.ejecucion_id = i.ejecucion_id)))`,
      [id],
    );
    if (!ev) return json({ error: "evidencia_inexistente" }, 404);
    const datos = await leerArchivo(ev.ruta).catch(() => null);
    if (!datos) return json({ error: "archivo_no_disponible" }, 410);
    return new Response(new Uint8Array(datos), {
      headers: {
        "Content-Type": ev.tipo_mime,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ev.nombre_original)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  });
}
