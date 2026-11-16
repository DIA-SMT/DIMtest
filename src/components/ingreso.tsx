import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MarcaCiudad, Ondas, PieInstitucional } from "./ui";

/**
 * Pantalla de ingreso con portada clara, como el login de Applaza: a la izquierda la marca,
 * un título grande y lo que se puede hacer; a la derecha la tarjeta con el formulario y el
 * filete amarillo arriba. En el celular la portada queda arriba, más chica.
 */
export function PantallaIngreso({
  subtitulo,
  antetitulo,
  titulo,
  remate,
  texto,
  rasgos,
  tituloTarjeta,
  bajada,
  icono: Icono,
  nota,
  children,
}: {
  subtitulo: string;
  antetitulo: string;
  titulo: string;
  remate: string;
  texto: ReactNode;
  rasgos: { icono: LucideIcon; texto: ReactNode }[];
  tituloTarjeta: string;
  bajada: ReactNode;
  icono: LucideIcon;
  nota?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <div className="grid flex-1 content-start lg:grid-cols-[1.25fr_0.75fr] lg:content-stretch">
        <section className="fondo-ingreso relative flex flex-col gap-4 overflow-hidden px-5 pt-[18px] pb-16 text-institucional lg:gap-10 lg:border-r lg:border-borde lg:px-[clamp(28px,6vw,72px)] lg:pt-[30px]">
          <MarcaCiudad subtitulo={subtitulo} />
          <div className="relative z-[2] lg:my-auto lg:pb-16">
            <p className="antetitulo text-[11px] tracking-[0.06em] text-primario sm:text-[13px] sm:tracking-[0.12em]">{antetitulo}</p>
            <h1 className="mt-3.5 mb-3 text-[clamp(2rem,9.6vw,2.5rem)] leading-[0.98] font-extrabold lg:mt-[18px] lg:mb-[18px] lg:text-[clamp(2.5rem,5vw,6rem)]">
              <span className="block">{titulo}</span>
              <span className="block text-primario">{remate}</span>
            </h1>
            <div className="max-w-[520px] text-[15px] leading-relaxed text-texto-ingreso lg:text-[clamp(17px,1.15vw,21px)]">{texto}</div>
            <ul className="mt-4 grid max-w-[520px] gap-2 lg:mt-[26px] lg:gap-3.5">
              {rasgos.map(({ icono: I, texto: t }, n) => (
                <li key={n} className="flex items-center gap-[11px] text-sm font-medium lg:text-[clamp(16px,1.05vw,19px)]">
                  <I aria-hidden="true" className="size-5 shrink-0 fill-amarillo text-institucional lg:size-6" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <Ondas className="h-12 lg:h-16" />
        </section>

        <main id="contenido" className="flex flex-col justify-center px-4 pt-2 pb-8 lg:px-8 lg:py-12">
          <div className="mx-auto w-full max-w-[400px]">
            <div className="rounded-panel border border-t-[5px] border-borde border-t-amarillo bg-superficie px-[22px] py-[26px] shadow-flotante sm:px-[38px] sm:py-[38px]">
              <span className="grid size-11 place-items-center rounded-xl bg-superficie-azul text-primario">
                <Icono aria-hidden="true" className="size-[21px]" />
              </span>
              <h2 className="mt-[18px] mb-1.5 text-[26px] leading-tight font-bold text-institucional">{tituloTarjeta}</h2>
              <div className="mb-6 text-sm text-texto-secundario">{bajada}</div>
              {children}
            </div>
            {nota ? <div className="mt-5 text-center text-xs text-texto-secundario">{nota}</div> : null}
          </div>
        </main>
      </div>
      <PieInstitucional />
    </div>
  );
}
