import Link from "next/link";
import { Info, Plus, Undo2 } from "lucide-react";
import { CLASE_BOTON_COMPACTO } from "@/components/formulario";
import { numeroIncidencia } from "@/lib/formato";
import { clasificarObservacionAccion } from "../actions";

/** Clasificar una observación: convertirla en incidencia o marcarla como comentario informativo. */
export function AccionesObservacion({
  id,
  clasificacion,
  revisadaPor,
  incidenciaNumero,
}: {
  id: string;
  clasificacion: "sin_revisar" | "informativa" | "incidencia";
  revisadaPor: string | null;
  incidenciaNumero: number | null;
}) {
  if (clasificacion === "incidencia" && incidenciaNumero) {
    return (
      <Link href={`/admin/incidencias/${incidenciaNumero}`} className="text-sm font-semibold text-primario-oscuro hover:underline">
        Convertida en {numeroIncidencia(incidenciaNumero)} →
      </Link>
    );
  }
  return (
    <>
      <Link href={`/admin/incidencias/nueva?ejecucion=${id}`} className={CLASE_BOTON_COMPACTO}>
        <Plus aria-hidden="true" className="size-3.5" />
        Convertir en incidencia
      </Link>
      <form action={clasificarObservacionAccion}>
        <input type="hidden" name="ejecucion" value={id} />
        {clasificacion === "informativa" ? (
          <button type="submit" name="clasificacion" value="sin_revisar" className={CLASE_BOTON_COMPACTO}>
            <Undo2 aria-hidden="true" className="size-3.5" />
            Volver a «sin revisar»
          </button>
        ) : (
          <button type="submit" name="clasificacion" value="informativa" className={CLASE_BOTON_COMPACTO}>
            <Info aria-hidden="true" className="size-3.5" />
            Es un comentario informativo
          </button>
        )}
      </form>
      <span className="text-xs text-texto-secundario">
        {clasificacion === "informativa" ? `Informativa · revisó ${revisadaPor}` : "Sin revisar"}
      </span>
    </>
  );
}
