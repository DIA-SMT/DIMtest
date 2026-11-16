import { CONTENEDOR_ANGOSTO } from "@/components/ui";

/** Módulo y prueba: el inicio del portal abre con su portada a lo ancho; el resto va en el contenedor angosto. */
export default function LayoutSecciones({ children }: { children: React.ReactNode }) {
  return <div className={`${CONTENEDOR_ANGOSTO} py-6 sm:py-8`}>{children}</div>;
}
