import { leerAdmin } from "@/lib/auth/admin";
import { leerRelevador } from "@/lib/auth/relevador";
import { leerArchivo } from "@/lib/almacenamiento";
import { consultar } from "@/lib/db";

/**
 * Descarga de una evidencia. La ven los relevadores (el historial de cada prueba es
 * compartido) y el equipo. Se sirve con el tipo validado al subirla y sin poder
 * ejecutar nada (CSP sandbox, nosniff).
 */
export async function GET(_pedido: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("No encontrado", { status: 404 });
  const [relevador, admin] = await Promise.all([leerRelevador(), leerAdmin()]);
  if (!relevador && !admin) return new Response("Se venció tu sesión. Ingresá de nuevo.", { status: 401 });

  const [ev] = await consultar<{ nombre_original: string; tipo_mime: string; ruta: string; de_incidencia: boolean }>(
    "select nombre_original, tipo_mime, ruta, incidencia_id is not null as de_incidencia from evidencias where id = $1",
    [id],
  );
  // Una evidencia de una incidencia (subida por el equipo) solo la ve el equipo.
  if (!ev || (ev.de_incidencia && !admin)) return new Response("No encontrado", { status: 404 });
  const datos = await leerArchivo(ev.ruta).catch(() => null);
  if (!datos) return new Response("El archivo ya no está disponible.", { status: 410 });

  const nombre = encodeURIComponent(ev.nombre_original);
  return new Response(new Uint8Array(datos), {
    headers: {
      "Content-Type": ev.tipo_mime,
      "Content-Disposition": `inline; filename*=UTF-8''${nombre}`,
      // Las imágenes, en un documento aislado. El PDF no: el visor de Chrome no abre con sandbox.
      "Content-Security-Policy":
        ev.tipo_mime === "application/pdf" ? "default-src 'none'; object-src 'none'" : "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
