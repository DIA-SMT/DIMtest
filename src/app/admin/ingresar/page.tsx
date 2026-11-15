import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LogoMunicipal, PieInstitucional } from "@/components/ui";
import { FormIngresoAdmin } from "@/features/admin/components/form-ingreso-admin";
import { leerAdmin } from "@/lib/auth/admin";

export const metadata = { title: "Ingreso del equipo" };

/** Ingreso al panel de administración: separado del portal de relevamiento. */
export default async function IngresoAdmin({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  if (await leerAdmin()) redirect("/admin");
  const { motivo } = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col bg-institucional">
      <main id="contenido" className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-4 text-center text-white">
            <LogoMunicipal negativo className="h-12 w-auto" />
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-[0.18em] text-institucional-texto uppercase">DIM360 · Administración</p>
              <h1 className="text-2xl font-bold">Panel del equipo</h1>
            </div>
          </div>
          <div className="rounded-panel bg-superficie p-6 shadow-elevada">
            <p className="mb-4 flex items-start gap-2 text-sm text-texto-secundario">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primario" />
              Acceso restringido al equipo de la Dirección de Inteligencia Artificial. El personal de la DIM releva desde el portal, sin usuario.
            </p>
            <FormIngresoAdmin motivo={motivo} />
          </div>
        </div>
      </main>
      <div className="px-4 py-6">
        <PieInstitucional oscuro />
      </div>
    </div>
  );
}
