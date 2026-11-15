"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ClipboardList,
  FileSpreadsheet,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  ShieldAlert,
  UserCog,
  Users,
  X,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { salirAdminAccion } from "@/features/admin/actions";

interface Item {
  href: string;
  texto: string;
  icono: LucideIcon;
  contador?: number;
}

export function Navegacion({
  nombre,
  rol,
  puedeUsuarios,
  sinRevisar,
  criticas,
}: {
  nombre: string;
  rol: string;
  puedeUsuarios: boolean;
  sinRevisar: number;
  criticas: number;
}) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const items: Item[] = [
    { href: "/admin", texto: "Tablero", icono: LayoutDashboard },
    { href: "/admin/pruebas", texto: "Pruebas", icono: ClipboardList },
    { href: "/admin/observaciones", texto: "Observaciones", icono: MessageSquareText, contador: sinRevisar },
    { href: "/admin/incidencias", texto: "Incidencias", icono: ShieldAlert },
    { href: "/admin/prioridades", texto: "Prioridades", icono: Flame, contador: criticas },
    { href: "/admin/informes", texto: "Informes", icono: FileSpreadsheet },
    { href: "/admin/relevadores", texto: "Relevadores", icono: Users },
    ...(puedeUsuarios ? [{ href: "/admin/usuarios", texto: "Equipo", icono: UserCog }] : []),
  ];
  const activo = (href: string) => (href === "/admin" ? ruta === "/admin" : ruta.startsWith(href));

  const lista = (
    <nav aria-label="Secciones del panel" className="flex flex-1 flex-col gap-1">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          onClick={() => setAbierto(false)}
          aria-current={activo(i.href) ? "page" : undefined}
          className={`flex min-h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors ${
            activo(i.href) ? "bg-institucional-activo text-white" : "text-institucional-texto hover:bg-institucional-hover hover:text-white"
          }`}
        >
          <i.icono aria-hidden="true" className={`size-[18px] ${activo(i.href) ? "text-amarillo" : ""}`} />
          <span className="flex-1">{i.texto}</span>
          {i.contador ? (
            <span className="rounded-full bg-amarillo px-1.5 text-xs font-bold text-institucional" aria-label={`${i.contador} pendientes`}>
              {i.contador}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );

  const pie = (
    <div className="space-y-2 border-t border-white/10 pt-4">
      <div className="px-3 text-sm">
        <p className="font-semibold text-white">{nombre}</p>
        <p className="text-xs text-institucional-texto">{rol}</p>
      </div>
      <Link href="/admin/cuenta" className="flex min-h-9 items-center gap-3 rounded-control px-3 text-sm text-institucional-texto hover:bg-institucional-hover hover:text-white">
        <KeyRound aria-hidden="true" className="size-4" />
        Mi contraseña
      </Link>
      <form action={salirAdminAccion}>
        <button type="submit" className="flex min-h-9 w-full items-center gap-3 rounded-control px-3 text-sm text-institucional-texto hover:bg-institucional-hover hover:text-white">
          <LogOut aria-hidden="true" className="size-4" />
          Salir
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Celular: franja superior con botón Menú */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-institucional px-4 py-3 text-white lg:hidden">
        <Link href="/admin" className="font-bold">
          DIM360 <span className="font-normal text-institucional-texto">· Administración</span>
        </Link>
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          aria-controls="menu-admin"
          className="inline-flex min-h-10 items-center gap-2 rounded-control border border-white/20 px-3 text-sm font-semibold"
        >
          {abierto ? <X aria-hidden="true" className="size-4" /> : <Menu aria-hidden="true" className="size-4" />}
          Menú
        </button>
      </div>
      {abierto ? (
        <div id="menu-admin" className="fixed inset-x-0 top-[60px] bottom-0 z-30 flex flex-col gap-4 overflow-y-auto bg-institucional p-4 lg:hidden">
          {lista}
          {pie}
        </div>
      ) : null}

      {/* Escritorio: barra lateral de 256 px */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto bg-institucional p-4 lg:flex">
        <Link href="/admin" className="flex items-center gap-3 px-2 pt-2">
          <span className="grid size-9 place-items-center rounded-control bg-white/10 text-sm font-black text-amarillo">360</span>
          <span className="leading-tight text-white">
            <span className="block font-bold">DIM360</span>
            <span className="block text-xs text-institucional-texto">Administración del relevamiento</span>
          </span>
        </Link>
        {lista}
        {pie}
      </aside>
    </>
  );
}
