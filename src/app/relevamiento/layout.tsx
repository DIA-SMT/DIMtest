import Link from "next/link";
import { LogOut, RotateCcw } from "lucide-react";
import { MarcaCiudad, PieInstitucional } from "@/components/ui";
import { cambiarUsuarioAccion } from "@/features/relevamiento/actions";
import { cuantasParaVolverAProbar } from "@/features/relevamiento/servicio";
import { conBase } from "@/lib/db";
import { leerRelevador } from "@/lib/auth/relevador";
import { iniciales, primerNombre } from "@/domain/nombres";

/** Portal del relevador: barra blanca con la marca de la ciudad, sin nada de administración. */
export default async function LayoutRelevamiento({ children }: { children: React.ReactNode }) {
  const relevador = await leerRelevador();
  // Lo que el equipo corrigió y espera que la DIM vuelva a probar: se ve desde cualquier página.
  const paraVolverAProbar = relevador ? await conBase((q) => cuantasParaVolverAProbar(q)) : 0;
  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <header className="sticky top-0 z-40 border-b border-borde bg-superficie shadow-[0_1px_0_rgb(9_35_76/0.03)]">
        <div className="flex h-[72px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <Link href="/relevamiento" aria-label="DIM360 QA, ir al inicio" className="-ml-1 shrink-0 rounded-xl p-1">
            <MarcaCiudad />
          </Link>
          {relevador ? (
            <div className="flex items-center gap-2.5">
              {paraVolverAProbar > 0 ? (
                <Link
                  href="/relevamiento#titulo-revalidar"
                  className="inline-flex h-11 items-center gap-2 rounded-[14px] border-2 border-institucional bg-superficie-azul px-3 text-sm font-bold text-institucional transition-colors hover:bg-superficie"
                >
                  <RotateCcw aria-hidden="true" className="size-4 text-primario" />
                  <span className="max-sm:sr-only">Para volver a probar</span>
                  <span className="rounded-full bg-amarillo px-1.5 text-xs leading-5">
                    {paraVolverAProbar}
                  </span>
                </Link>
              ) : null}
              <span aria-hidden="true" className="hidden size-10 place-items-center rounded-full bg-superficie-azul text-xs font-bold text-primario sm:grid">
                {iniciales(relevador.nombre)}
              </span>
              <p className="hidden text-xs leading-tight md:block">
                <span className="block text-[11px] text-texto-secundario">Probando como</span>
                <strong className="block text-institucional">{relevador.nombre}</strong>
              </p>
              <form action={cambiarUsuarioAccion}>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-borde bg-superficie px-3.5 text-sm font-bold text-institucional transition-colors hover:bg-superficie-azul"
                >
                  <LogOut aria-hidden="true" className="size-4 text-primario" />
                  <span className="max-[419px]:sr-only md:hidden">{primerNombre(relevador.nombre)} · </span>
                  <span className="max-[419px]:sr-only">Cambiar usuario</span>
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </header>
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <PieInstitucional />
    </div>
  );
}
