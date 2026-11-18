import Link from "next/link";
import { Bot, CircleCheck, CircleX, ExternalLink, Hourglass, MinusCircle, type LucideIcon } from "lucide-react";
import { InsigniaEstadoIncidencia, InsigniaPrioridad, InsigniaResultado, Tarjeta } from "@/components/ui";
import { duracionTrabajo, NOMBRE_CIERRE_AGENTE, NOMBRE_REVALIDACION_AGENTE, type CierreAgente, type RevalidacionAgente } from "@/domain/agente";
import { fechaHora } from "@/lib/fechas";
import { numeroIncidencia } from "@/lib/formato";
import type { FilaCorreccion } from "../consultas";

const ESTILO_CIERRE: Record<CierreAgente, string> = {
  desplegado: "border-exito-borde bg-exito-fondo text-exito",
  ya_resuelto: "border-exito-borde bg-exito-fondo text-exito",
  pr_abierto: "border-info-borde bg-info-fondo text-info",
  requiere_ok: "border-advertencia-borde bg-advertencia-fondo text-advertencia",
  bloqueado: "border-advertencia-borde bg-advertencia-fondo text-advertencia",
  fallido: "border-error-borde bg-error-fondo text-error",
};

export function InsigniaCierre({ cierre }: { cierre: CierreAgente }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${ESTILO_CIERRE[cierre]}`}>
      {NOMBRE_CIERRE_AGENTE[cierre]}
    </span>
  );
}

const ESTILO_REVALIDACION: Record<RevalidacionAgente, { clase: string; icono: LucideIcon }> = {
  pendiente: { clase: "text-info", icono: Hourglass },
  confirmada: { clase: "text-exito", icono: CircleCheck },
  volvio_a_fallar: { clase: "text-error", icono: CircleX },
  sin_probar: { clase: "text-texto-secundario", icono: MinusCircle },
  cancelada: { clase: "text-texto-secundario", icono: MinusCircle },
};

function Revalidacion({ c }: { c: FilaCorreccion }) {
  if (!c.revalidacion) return null;
  const { clase, icono: Icono } = ESTILO_REVALIDACION[c.revalidacion];
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className={`inline-flex items-center gap-1.5 font-semibold ${clase}`}>
        <Icono aria-hidden="true" className="size-4" />
        {NOMBRE_REVALIDACION_AGENTE[c.revalidacion]}
      </span>
      {c.revalidacion_resultado ? <InsigniaResultado resultado={c.revalidacion_resultado} /> : null}
      <span className="text-xs text-texto-secundario">
        {c.revalidacion === "pendiente" && c.revalidacion_pedida_at ? `pedida el ${fechaHora(c.revalidacion_pedida_at)}` : null}
        {c.revalidacion_resuelta_at ? `${c.revalidacion_relevador ?? "—"} · ${fechaHora(c.revalidacion_resuelta_at)}` : null}
      </span>
    </p>
  );
}

/** Una corrección terminada: qué incidencia, cómo terminó, qué hizo, sus PR y cómo salió la revalidación. */
export function FichaCorreccion({ c }: { c: FilaCorreccion }) {
  const duracion = duracionTrabajo(c.tomado_at, c.terminado_at);
  return (
    <Tarjeta className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <InsigniaCierre cierre={c.cierre} />
        <Link href={`/admin/incidencias/${c.incidencia_numero}`} className="font-bold text-primario-oscuro hover:underline">
          {numeroIncidencia(c.incidencia_numero)}
        </Link>
        <Link href={`/admin/pruebas/${c.prueba_codigo}`} className="font-mono text-xs font-semibold text-primario-oscuro hover:underline">
          {c.prueba_codigo}
        </Link>
        <InsigniaPrioridad prioridad={c.prioridad} corta />
        <span className="flex items-center gap-1 text-xs text-texto-secundario">
          hoy <InsigniaEstadoIncidencia estado={c.incidencia_estado} />
        </span>
      </div>
      <p className="text-xs text-texto-secundario">
        {c.modulo} · {c.que_probar}
      </p>

      {c.resumen ? <p className="text-sm whitespace-pre-line">{c.resumen}</p> : null}

      {c.enlaces.length ? (
        <p className="flex flex-wrap gap-3 text-sm">
          {c.enlaces.map((e) => (
            <a key={e.url} href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primario-oscuro hover:underline">
              <ExternalLink aria-hidden="true" className="size-3.5" />
              {e.texto}
            </a>
          ))}
        </p>
      ) : null}

      <Revalidacion c={c} />

      <p className="border-t border-borde pt-3 text-xs text-texto-secundario">
        <Bot aria-hidden="true" className="mr-1 inline size-3.5 align-[-3px]" />
        Trabajo #{c.numero} · {c.origen === "automatico" ? "pedido automático" : `pedido por ${c.pedido_por}`} el {fechaHora(c.pedido_at)} · terminó el{" "}
        {fechaHora(c.terminado_at)}
        {duracion ? ` · trabajó ${duracion}` : ""}
      </p>
    </Tarjeta>
  );
}
