import Link from "next/link";
import { LogOut } from "lucide-react";
import { LogoMunicipal, PieInstitucional } from "@/components/ui";
import { cambiarUsuarioAccion } from "@/features/relevamiento/actions";
import { leerRelevador } from "@/lib/auth/relevador";
import { primerNombre } from "@/domain/nombres";

/** Portal del relevador: barra simple, sin nada de administración. */
export default async function LayoutRelevamiento({ children }: { children: React.ReactNode }) {
  const relevador = await leerRelevador();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="relative border-b border-borde bg-superficie">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/relevamiento" className="flex min-w-0 items-center gap-3 rounded-control">
            <LogoMunicipal className="h-8 w-auto shrink-0 sm:h-9" />
            <span className="hidden border-l border-borde pl-3 text-sm leading-tight font-semibold text-texto sm:block">
              DIM360
              <span className="block text-xs font-normal text-texto-secundario">Relevamiento funcional</span>
            </span>
          </Link>
          {relevador ? (
            <div className="flex items-center gap-2">
              <p className="hidden text-right text-sm leading-tight sm:block">
                <span className="text-texto-secundario">Probando como</span>
                <span className="block font-semibold">{relevador.nombre}</span>
              </p>
              <form action={cambiarUsuarioAccion}>
                <button
                  type="submit"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-borde-control bg-superficie px-3 text-sm font-semibold text-texto hover:bg-fondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                  <span className="sm:hidden">{primerNombre(relevador.nombre)} · </span>Cambiar usuario
                </button>
              </form>
            </div>
          ) : null}
        </div>
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-linear-to-r from-amarillo via-celeste to-primario" />
      </header>
      <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <PieInstitucional />
      </div>
    </div>
  );
}
