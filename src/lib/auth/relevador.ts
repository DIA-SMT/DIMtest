import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { conBase } from "@/lib/db";
import { COOKIE, DURACION, firmar, opcionesCookie, verificar, type DatosDispositivo, type DatosSesionRelevador } from "./tokens";

/**
 * Sesión del portal de relevamiento: sin contraseña. El relevador declara su nombre y
 * se crea una sesión interna (sesiones_relevador) cuyo id viaja firmado en una cookie.
 * Todo lo que hace queda atado a ese id, además del nombre declarado.
 */
export interface Relevador {
  sesionId: string;
  relevadorId: string;
  nombre: string;
}

export const leerRelevador = cache(async (): Promise<Relevador | null> => {
  const almacen = await cookies();
  const datos = await verificar<DatosSesionRelevador>("relevador", almacen.get(COOKIE.relevador)?.value);
  if (!datos?.sub || !/^[0-9a-f-]{36}$/.test(datos.sub)) return null;
  const filas = await conBase((q) =>
    q<{ sesion_id: string; relevador_id: string; nombre: string }>(
      `select s.id as sesion_id, r.id as relevador_id, r.nombre
         from sesiones_relevador s join relevadores r on r.id = s.relevador_id
        where s.id = $1 and s.cerrada_at is null`,
      [datos.sub],
    ),
  );
  const f = filas[0];
  return f ? { sesionId: f.sesion_id, relevadorId: f.relevador_id, nombre: f.nombre } : null;
});

/** La barrera del portal: cada página y acción la llama. Sin sesión, vuelve al ingreso. */
export async function exigirRelevador(): Promise<Relevador> {
  const r = await leerRelevador();
  if (!r) redirect("/");
  return r;
}

/** Solo en Server Actions o Route Handlers (escribe cookies). */
export async function emitirSesionRelevador(sesionId: string, relevadorId: string) {
  const almacen = await cookies();
  almacen.set(COOKIE.relevador, await firmar("relevador", { sub: sesionId }, DURACION.relevador), opcionesCookie(DURACION.relevador));
  const conocidos = await relevadoresDelDispositivo();
  const ids = [relevadorId, ...conocidos.filter((id) => id !== relevadorId)].slice(0, 5);
  almacen.set(COOKIE.dispositivo, await firmar("dispositivo", { ids }, DURACION.dispositivo), opcionesCookie(DURACION.dispositivo));
}

export async function borrarCookieRelevador() {
  (await cookies()).delete(COOKIE.relevador);
}

/** Relevadores que ya ingresaron desde este navegador: se los reconoce sin preguntar. */
export async function relevadoresDelDispositivo(): Promise<string[]> {
  const datos = await verificar<DatosDispositivo>("dispositivo", (await cookies()).get(COOKIE.dispositivo)?.value);
  return Array.isArray(datos?.ids) ? datos.ids.filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/.test(id)) : [];
}
