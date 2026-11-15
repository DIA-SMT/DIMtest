import { redirect } from "next/navigation";
import { ClipboardCheck, ListChecks, MessageSquareText } from "lucide-react";
import { LogoMunicipal, PieInstitucional } from "@/components/ui";
import { FormIngreso } from "@/features/relevamiento/components/form-ingreso";
import { leerRelevador } from "@/lib/auth/relevador";
import { TOTAL_MODULOS, TOTAL_PRUEBAS } from "@/domain/catalogo/catalogo";

export const metadata = { title: "Ingreso al relevamiento" };

/** Ingreso del personal de la DIM: solo nombre y apellido. */
export default async function Ingreso() {
  if (await leerRelevador()) redirect("/relevamiento");

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Banda institucional */}
      <section className="relative overflow-hidden bg-institucional px-6 pt-8 pb-10 text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:px-12 lg:py-12">
        <div className="relative z-10 space-y-8">
          <LogoMunicipal negativo className="h-11 w-auto lg:h-14" />
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-[0.18em] text-institucional-texto uppercase">
              Municipalidad de San Miguel de Tucumán
            </p>
            <span className="filete" aria-hidden="true" />
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">DIM360 · Relevamiento funcional</h1>
            <p className="max-w-md text-base text-institucional-texto">
              Probá el sistema con casos reales y contanos qué funciona y qué no. Tu trabajo define el traspaso de DIM360 a la
              Dirección de Impuestos Municipales.
            </p>
          </div>
          <ul className="hidden space-y-3 text-sm text-institucional-texto lg:block">
            <li className="flex items-center gap-3">
              <ListChecks aria-hidden="true" className="size-5 text-celeste" />
              {TOTAL_PRUEBAS} pruebas en {TOTAL_MODULOS} módulos, del checklist oficial.
            </li>
            <li className="flex items-center gap-3">
              <ClipboardCheck aria-hidden="true" className="size-5 text-celeste" />
              Elegí el módulo que conocés: no hace falta probar todo.
            </li>
            <li className="flex items-center gap-3">
              <MessageSquareText aria-hidden="true" className="size-5 text-celeste" />
              Dejá el caso que usaste y lo que viste.
            </li>
          </ul>
        </div>
        <div className="relative z-10 mt-10 hidden lg:block">
          <PieInstitucional oscuro />
        </div>
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-r from-amarillo via-celeste to-primario" />
      </section>

      {/* Formulario */}
      <main id="contenido" className="flex flex-1 flex-col justify-between gap-8 px-4 py-8 sm:px-6 lg:px-12 lg:py-12">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <div className="rounded-panel border border-borde bg-superficie p-6 shadow-elevada sm:p-8">
            <div className="mb-6 space-y-1.5">
              <h2 className="text-xl font-bold">Ingresá para empezar</h2>
              <p className="text-sm text-texto-secundario">Solo necesitamos tu nombre. No hace falta registrarse ni crear una contraseña.</p>
            </div>
            <FormIngreso />
          </div>
          <p className="mt-4 text-xs text-texto-secundario">
            Tus datos se usan solo para registrar quién hizo cada prueba (Ley 25.326 de Protección de Datos Personales).
          </p>
        </div>
        <div className="lg:hidden">
          <PieInstitucional />
        </div>
      </main>
    </div>
  );
}
