import { redirect } from "next/navigation";
import { CircleCheck, FileSpreadsheet, Flame, ShieldCheck } from "lucide-react";
import { PantallaIngreso } from "@/components/ingreso";
import { FormIngresoAdmin } from "@/features/admin/components/form-ingreso-admin";
import { leerAdmin } from "@/lib/auth/admin";

export const metadata = { title: "Ingreso del equipo" };

/** Ingreso al panel de administración: separado del portal de relevamiento. */
export default async function IngresoAdmin({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  if (await leerAdmin()) redirect("/admin");
  const { motivo } = await searchParams;
  return (
    <PantallaIngreso
      subtitulo="Panel del equipo"
      antetitulo="Dirección de Inteligencia Artificial"
      titulo="Panel del"
      remate="equipo"
      texto={<p>Seguí el relevamiento de la DIM, convertí las observaciones en incidencias y pedí que se vuelvan a validar.</p>}
      rasgos={[
        { icono: CircleCheck, texto: "Resultados de cada prueba, con su historial completo" },
        { icono: Flame, texto: "Prioridades P0 a P3 y ciclo de corrección" },
        { icono: FileSpreadsheet, texto: "Informes en Excel y PDF con los códigos originales" },
      ]}
      icono={ShieldCheck}
      tituloTarjeta="Ingresá al panel"
      bajada={<p>Acceso restringido al equipo de la DIA. El personal de la DIM releva desde el portal, sin usuario.</p>}
    >
      <FormIngresoAdmin motivo={motivo} />
    </PantallaIngreso>
  );
}
