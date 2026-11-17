import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { CLASE_BOTON_COMPACTO } from "@/components/formulario";
import { InsigniaPrioridad } from "@/components/ui";
import { NOMBRE_ESTADO_TRABAJO, NOMBRE_RESULTADO_AGENTE, type EstadoTrabajo } from "@/domain/agente";
import { fechaHora } from "@/lib/fechas";
import { numeroIncidencia } from "@/lib/formato";
import { cancelarTrabajoAccion } from "../actions";
import type { FilaTrabajo } from "../servicio";

const ESTILO_ESTADO: Record<EstadoTrabajo, string> = {
  pendiente: "border-borde-control bg-superficie text-texto-secundario",
  en_curso: "border-primario bg-superficie-azul text-primario-oscuro",
  terminado: "border-exito-borde bg-exito-fondo text-exito",
  fallido: "border-error-borde bg-error-fondo text-error",
  cancelado: "border-borde bg-neutro-fondo text-texto-secundario",
};

export function InsigniaTrabajo({ estado }: { estado: EstadoTrabajo }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ESTILO_ESTADO[estado]}`}>{NOMBRE_ESTADO_TRABAJO[estado]}</span>;
}

/** Los pedidos al agente: en curso primero. Con `conIncidencia`, el número de incidencia enlaza a su ficha. */
export function ListaTrabajos({ trabajos, conIncidencia, puedeCancelar }: { trabajos: FilaTrabajo[]; conIncidencia: boolean; puedeCancelar: boolean }) {
  if (!trabajos.length) return <p className="text-sm text-texto-secundario">Todavía no se le pidió nada al agente.</p>;
  return (
    <ul className="divide-y divide-borde">
      {trabajos.map((t) => (
        <li key={t.numero} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <InsigniaTrabajo estado={t.estado} />
            {conIncidencia ? (
              <>
                <Link href={`/admin/incidencias/${t.incidencia_numero}`} className="font-semibold text-primario-oscuro hover:underline">
                  {numeroIncidencia(t.incidencia_numero)}
                </Link>
                <span className="font-mono text-xs">{t.prueba_codigo}</span>
                <InsigniaPrioridad prioridad={t.prioridad} corta />
              </>
            ) : null}
            <span className="text-xs text-texto-secundario">
              Trabajo #{t.numero} · pedido por {t.pedido_por} el {fechaHora(t.pedido_at)}
              {t.origen === "automatico" ? " (automático)" : ""}
            </span>
          </div>
          {t.resultado ? <p className="text-sm font-semibold">{NOMBRE_RESULTADO_AGENTE[t.resultado]}</p> : null}
          {t.resumen ? <p className="text-sm whitespace-pre-line text-texto-secundario">{t.resumen}</p> : null}
          {t.enlaces.length ? (
            <p className="flex flex-wrap gap-3 text-sm">
              {t.enlaces.map((e) => (
                <a key={e.url} href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primario-oscuro hover:underline">
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                  {e.texto}
                </a>
              ))}
            </p>
          ) : null}
          {puedeCancelar && (t.estado === "pendiente" || t.estado === "en_curso") ? (
            <form action={cancelarTrabajoAccion}>
              <input type="hidden" name="trabajo" value={t.numero} />
              {conIncidencia ? null : <input type="hidden" name="numero" value={t.incidencia_numero} />}
              <button type="submit" className={CLASE_BOTON_COMPACTO}>
                <X aria-hidden="true" className="size-3.5" />
                {t.estado === "en_curso" ? "Pedirle que pare" : "Sacar de la cola"}
              </button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
