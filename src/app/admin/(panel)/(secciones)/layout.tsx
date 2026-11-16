import { CONTENEDOR } from "@/components/ui";

/** Secciones del panel (todo menos el tablero, que abre con su portada a lo ancho). */
export default function LayoutSecciones({ children }: { children: React.ReactNode }) {
  return <div className={`${CONTENEDOR} space-y-6 py-6 lg:py-9`}>{children}</div>;
}
