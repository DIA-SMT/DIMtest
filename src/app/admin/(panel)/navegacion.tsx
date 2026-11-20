"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bot,
  ClipboardList,
  FileSpreadsheet,
  Flame,
  KeyRound,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquareText,
  ShieldAlert,
  UserCog,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { MarcaCiudad } from "@/components/ui";
import { iniciales } from "@/domain/nombres";
import { salirAdminAccion } from "@/features/admin/actions";

interface Item {
  href: string;
  texto: string;
  icono: LucideIcon;
  contador?: number;
}

/**
 * Barra superior del panel con el lenguaje de Applaza: marca a la izquierda, secciones al
 * centro (subrayado azul en la activa) y la persona a la derecha. Debajo de 1280 px las
 * secciones pasan a un menú que entra desde la derecha.
 */
export function Navegacion({
  nombre,
  rol,
  puedeUsuarios,
  sinRevisar,
  criticas,
  sugerenciasNuevas,
}: {
  nombre: string;
  rol: string;
  puedeUsuarios: boolean;
  sinRevisar: number;
  criticas: number;
  sugerenciasNuevas: number;
}) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);

  const items: Item[] = [
    { href: "/admin", texto: "Tablero", icono: LayoutDashboard },
    { href: "/admin/pruebas", texto: "Pruebas", icono: ClipboardList },
    { href: "/admin/observaciones", texto: "Observaciones", icono: MessageSquareText, contador: sinRevisar },
    { href: "/admin/incidencias", texto: "Incidencias", icono: ShieldAlert },
    { href: "/admin/correcciones", texto: "Correcciones", icono: Wrench },
    { href: "/admin/prioridades", texto: "Prioridades", icono: Flame, contador: criticas },
    { href: "/admin/informes", texto: "Informes", icono: FileSpreadsheet },
    { href: "/admin/sugerencias", texto: "Sugerencias", icono: Lightbulb, contador: sugerenciasNuevas },
    { href: "/admin/relevadores", texto: "Relevadores", icono: Users },
    ...(puedeUsuarios
      ? [
          { href: "/admin/usuarios", texto: "Equipo", icono: UserCog },
          { href: "/admin/agente", texto: "Agente", icono: Bot },
        ]
      : []),
  ];
  const activo = (href: string) => (href === "/admin" ? ruta === "/admin" : ruta.startsWith(href));

  // Menú desplegable: Escape lo cierra, el foco entra al abrir y vuelve al botón al cerrar.
  useEffect(() => {
    if (!abierto) return;
    botonCerrar.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  function cerrar() {
    setAbierto(false);
    botonMenu.current?.focus();
  }

  const contador = (n?: number) =>
    n ? (
      <span className="ml-1 rounded-full bg-amarillo px-1.5 text-xs leading-5 font-bold text-institucional" aria-label={`${n} pendientes`}>
        {n}
      </span>
    ) : null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-borde bg-superficie shadow-[0_1px_0_rgb(9_35_76/0.03)]">
        <div className="flex h-[72px] items-center gap-4 px-4 sm:px-6 2xl:px-10">
          <Link href="/admin" aria-label="DIM360 QA, ir al tablero" className="-ml-1 shrink-0 rounded-xl p-1">
            <span className="xl:hidden 3xl:block">
              <MarcaCiudad subtitulo="Panel del equipo" />
            </span>
            <span className="hidden xl:block 3xl:hidden">
              <MarcaCiudad compacta subtitulo="Panel del equipo" />
            </span>
          </Link>

          <nav aria-label="Secciones del panel" className="hidden min-w-0 flex-1 justify-center xl:flex">
            <ul className="flex gap-0.5">
              {items.map((i) => (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={activo(i.href) ? "page" : undefined}
                    className={`relative flex h-[46px] items-center rounded-full px-1.5 text-[13.5px] font-semibold 2xl:px-2 2xl:text-[14.5px] whitespace-nowrap transition-colors hover:bg-superficie-azul hover:text-primario ${
                      activo(i.href)
                        ? "text-primario after:absolute after:inset-x-1.5 2xl:after:inset-x-2 after:bottom-[3px] after:h-[3px] after:rounded-full after:bg-primario"
                        : "text-institucional"
                    }`}
                  >
                    {i.texto}
                    {contador(i.contador)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto hidden shrink-0 items-center gap-2.5 xl:flex">
            <Link href="/admin/cuenta" className="flex items-center gap-2.5 rounded-full p-0.5 pr-1 hover:bg-superficie-azul" title="Mi cuenta">
              <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-superficie-azul text-xs font-bold text-primario">
                {iniciales(nombre)}
              </span>
              <span className="hidden text-xs leading-tight 3xl:block">
                <strong className="block text-institucional">{nombre}</strong>
                <small className="mt-0.5 block text-[11px] text-texto-secundario">{rol}</small>
              </span>
              <span className="sr-only 3xl:hidden">{nombre}, mi cuenta</span>
            </Link>
            <form action={salirAdminAccion}>
              <button
                type="submit"
                title="Salir"
                aria-label="Salir del panel"
                className="grid size-10 place-items-center rounded-full text-texto-secundario transition-colors hover:bg-error-fondo hover:text-error"
              >
                <LogOut aria-hidden="true" className="size-[18px]" />
              </button>
            </form>
          </div>

          <button
            ref={botonMenu}
            type="button"
            onClick={() => setAbierto(true)}
            aria-expanded={abierto}
            aria-controls="menu-admin"
            className="ml-auto inline-flex h-11 items-center gap-2 rounded-[14px] border border-borde bg-superficie px-4 text-[15px] font-bold text-institucional hover:bg-superficie-azul xl:hidden"
          >
            <Menu aria-hidden="true" className="size-[19px]" />
            Menú
            {sinRevisar + criticas + sugerenciasNuevas > 0 ? <span aria-hidden="true" className="size-2 rounded-full bg-amarillo ring-2 ring-institucional/10" /> : null}
          </button>
        </div>
      </header>

      {/* Menú desplegable (tablet y celular), desde la derecha */}
      <div
        aria-hidden="true"
        onClick={cerrar}
        className={`fixed inset-0 z-50 bg-institucional/45 transition-opacity xl:hidden ${abierto ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        id="menu-admin"
        role="dialog"
        aria-modal="true"
        aria-label="Menú del panel"
        inert={!abierto}
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(340px,88vw)] flex-col overflow-y-auto rounded-l-3xl bg-superficie px-5 pt-5 pb-4 shadow-[-16px_0_45px_rgb(9_35_76/0.22)] transition-transform duration-200 ease-salida xl:hidden ${
          abierto ? "translate-x-0" : "translate-x-[105%]"
        }`}
      >
        <div className="flex items-center justify-between gap-2.5 pb-2.5">
          <MarcaCiudad compacta subtitulo="Panel del equipo" />
          <button
            ref={botonCerrar}
            type="button"
            onClick={cerrar}
            aria-label="Cerrar menú"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-borde text-institucional hover:bg-superficie-azul hover:text-primario"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <nav aria-label="Secciones del panel" className="mt-2">
          <ul>
            {items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  onClick={() => setAbierto(false)}
                  aria-current={activo(i.href) ? "page" : undefined}
                  className={`relative flex min-h-14 items-center gap-3 border-b border-borde px-1 font-display text-[16.5px] font-bold hover:text-primario ${
                    activo(i.href)
                      ? "text-primario before:absolute before:top-3.5 before:bottom-3.5 before:-left-5 before:w-1 before:rounded-r before:bg-amarillo"
                      : "text-institucional"
                  }`}
                >
                  <i.icono aria-hidden="true" className={`size-5 shrink-0 ${activo(i.href) ? "text-primario" : "text-icono"}`} />
                  <span className="flex-1">
                    {i.texto}
                    {contador(i.contador)}
                  </span>
                  <span aria-hidden="true" className="mr-1.5 size-2 rotate-45 border-t-2 border-r-2 border-primario" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto pt-6">
          <Link href="/admin/cuenta" onClick={() => setAbierto(false)} className="flex items-center gap-2.5 border-t border-borde px-1 py-3.5">
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-superficie-azul text-xs font-bold text-primario">
              {iniciales(nombre)}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm text-institucional">{nombre}</strong>
              <small className="mt-0.5 block text-xs text-texto-secundario">{rol}</small>
            </span>
            <KeyRound aria-hidden="true" className="size-4 text-icono" />
            <span className="sr-only">Mi cuenta</span>
          </Link>
          <form action={salirAdminAccion}>
            <button type="submit" className="flex min-h-[46px] w-full items-center gap-2.5 border-t border-borde px-1 font-semibold text-error hover:bg-error-fondo">
              <LogOut aria-hidden="true" className="size-4" />
              Salir
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
