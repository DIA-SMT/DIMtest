import { FileSpreadsheet, FileText } from "lucide-react";
import { EncabezadoPagina, Tarjeta } from "@/components/ui";
import { TIPOS_INFORME, type TipoInforme } from "@/features/informes/datos";
import { exigirAdmin } from "@/lib/auth/admin";

export const metadata = { title: "Informes" };

const CLASE_DESCARGA =
  "inline-flex min-h-9 items-center gap-1.5 rounded-control border border-borde-control bg-superficie px-3 text-sm font-semibold hover:bg-fondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario";

export default async function Informes() {
  await exigirAdmin("informes.exportar");
  return (
    <div className="space-y-6">
      <EncabezadoPagina
        antetitulo="Exportación"
        titulo="Informes"
        descripcion="Cada informe se genera en el momento con los datos de la base y conserva el código original de cada prueba del checklist DIM360."
      />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(Object.entries(TIPOS_INFORME) as [TipoInforme, (typeof TIPOS_INFORME)[TipoInforme]][]).map(([tipo, info]) => (
          <li key={tipo}>
            <Tarjeta className="flex h-full flex-col gap-3 p-4">
              <div className="flex-1 space-y-1">
                <h2 className="font-bold">{info.titulo}</h2>
                <p className="text-sm text-texto-secundario">{info.descripcion}</p>
              </div>
              <div className="flex gap-2">
                <a href={`/admin/informes/${tipo}?formato=xlsx`} className={CLASE_DESCARGA} download>
                  <FileSpreadsheet aria-hidden="true" className="size-4 text-exito" />
                  Excel
                </a>
                <a href={`/admin/informes/${tipo}?formato=pdf`} className={CLASE_DESCARGA} download>
                  <FileText aria-hidden="true" className="size-4 text-error" />
                  PDF
                </a>
              </div>
            </Tarjeta>
          </li>
        ))}
      </ul>
    </div>
  );
}
