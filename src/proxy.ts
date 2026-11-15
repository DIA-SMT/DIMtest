import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, DURACION, firmar, opcionesCookie, verificar, type DatosSesionAdmin, type DatosSesionRelevador } from "@/lib/auth/tokens";

/**
 * El proxy NO es la barrera (cada página y acción vuelve a pedir la sesión). Hace dos cosas:
 *  1. Redirige por comodidad a quien llega sin sesión al panel o al portal.
 *  2. Renueva las sesiones mientras se usan: administración vence a los 60 minutos sin
 *     actividad (y a las 10 horas del ingreso); el relevador, a los 30 días sin usar.
 */
export async function proxy(pedido: NextRequest) {
  const { pathname } = pedido.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/ingresar") return NextResponse.next();
    const token = pedido.cookies.get(COOKIE.admin)?.value;
    const datos = await verificar<DatosSesionAdmin>("admin", token);
    const ahora = Math.floor(Date.now() / 1000);
    if (!datos || ahora - datos.inicio > DURACION.adminMaximo) {
      // Los archivos de informes y evidencias responden 401 por su cuenta.
      if (pathname.startsWith("/admin/informes/")) return NextResponse.next();
      const url = pedido.nextUrl.clone();
      url.pathname = "/admin/ingresar";
      url.search = "";
      if (token) url.searchParams.set("motivo", "vencida");
      return NextResponse.redirect(url);
    }
    const respuesta = NextResponse.next();
    // Renovar si pasaron más de 5 minutos desde la última firma.
    if (datos.iat && ahora - datos.iat > 300) {
      const nuevo = await firmar("admin", { sub: datos.sub, sv: datos.sv, inicio: datos.inicio }, DURACION.admin);
      respuesta.cookies.set(COOKIE.admin, nuevo, opcionesCookie(DURACION.adminMaximo));
    }
    return respuesta;
  }

  if (pathname.startsWith("/relevamiento")) {
    const datos = await verificar<DatosSesionRelevador>("relevador", pedido.cookies.get(COOKIE.relevador)?.value);
    if (!datos) {
      const url = pedido.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    const respuesta = NextResponse.next();
    const ahora = Math.floor(Date.now() / 1000);
    if (datos.iat && ahora - datos.iat > 12 * 3600) {
      const nuevo = await firmar("relevador", { sub: datos.sub }, DURACION.relevador);
      respuesta.cookies.set(COOKIE.relevador, nuevo, opcionesCookie(DURACION.relevador));
    }
    return respuesta;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/relevamiento/:path*"],
};
