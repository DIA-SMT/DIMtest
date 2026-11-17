import "server-only";
import { z } from "zod";
import { conBase } from "@/lib/db";
import { claveDeError, mensajeError } from "@/lib/errores";
import { log } from "@/lib/log";
import { verificarToken } from "./servicio";

/** Lo más grande que manda el agente es el cierre (resumen + enlaces). */
const MAX_CUERPO = 64 * 1024;

export const json = (datos: unknown, status = 200) =>
  Response.json(datos, { status, headers: { "Cache-Control": "no-store" } });

export class ErrorPedido extends Error {
  constructor(
    public status: number,
    public clave: string,
  ) {
    super(clave);
  }
}

/** Lee y valida el cuerpo JSON del pedido. */
export async function leerCuerpo<T>(pedido: Request, esquema: z.ZodType<T>): Promise<T> {
  const largo = Number(pedido.headers.get("content-length") ?? 0);
  if (largo > MAX_CUERPO) throw new ErrorPedido(413, "cuerpo_muy_grande");
  const texto = await pedido.text();
  if (texto.length > MAX_CUERPO) throw new ErrorPedido(413, "cuerpo_muy_grande");
  let crudo: unknown;
  try {
    crudo = texto ? JSON.parse(texto) : {};
  } catch {
    throw new ErrorPedido(400, "json_invalido");
  }
  const r = esquema.safeParse(crudo);
  if (!r.success) throw new ErrorPedido(400, `datos_invalidos: ${r.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  return r.data;
}

/**
 * La barrera de la API del agente: exige su token (Authorization: Bearer dimag_…) y
 * traduce los errores esperables a JSON. `base` es la dirección pública del panel, para
 * los enlaces de los avisos.
 */
export async function conAgente(pedido: Request, fn: (base: string) => Promise<Response>): Promise<Response> {
  const token = /^Bearer (\S+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1] ?? "";
  const ok = token ? await conBase((q) => verificarToken(q, token)) : false;
  if (!ok) return json({ error: "no_autorizado" }, 401);
  try {
    return await fn(new URL(pedido.url).origin);
  } catch (error) {
    if (error instanceof ErrorPedido) return json({ error: error.clave }, error.status);
    const clave = claveDeError(error);
    if (clave) return json({ error: clave, mensaje: mensajeError(clave) }, 409);
    log("agente.api_error", { ruta: new URL(pedido.url).pathname, error: error instanceof Error ? error.name : "desconocido" });
    return json({ error: "error_interno" }, 500);
  }
}

/** El número de trabajo de la ruta. */
export function numeroDeRuta(texto: string): number {
  if (!/^\d{1,9}$/.test(texto)) throw new ErrorPedido(404, "trabajo_inexistente");
  return Number(texto);
}
