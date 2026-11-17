import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, RotateCcw } from "lucide-react";
import { EncabezadoPagina, InsigniaPerfil, InsigniaPrioridad, InsigniaResultado, Tarjeta } from "@/components/ui";
import { AccionesObservacion } from "@/features/admin/components/acciones-observacion";
import { GaleriaEvidencias } from "@/features/admin/components/galeria-evidencias";
import { observacionDetalle } from "@/features/admin/consultas";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";

export const metadata = { title: "Observación" };

/** Detalle de una observación: la prueba, lo que vio el relevador y sus evidencias a la vista. */
export default async function DetalleObservacion({ params }: { params: Promise<{ numero: string }> }) {
  await exigirAdmin("observaciones.clasificar");
  const { numero } = await params;
  const n = /^\d{1,9}$/.test(numero) ? Number(numero) : 0;
  const o = n ? await conBase((q) => observacionDetalle(q, n)) : null;
  if (!o) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/observaciones" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primario-oscuro hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Observaciones
      </Link>
      <EncabezadoPagina
        antetitulo={`${o.modulo_codigo} · ${o.modulo}`}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{o.prueba_codigo}</span>
            <InsigniaResultado resultado={o.resultado} />
          </span>
        }
        descripcion={
          <p>
            Registrada por <strong className="text-texto">{o.relevador_nombre}</strong> el {fechaHora(o.creada_at)}.
          </p>
        }
        acciones={
          <Link
            href={`/admin/pruebas/${o.prueba_codigo}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primario-oscuro hover:underline"
          >
            <History aria-hidden="true" className="size-4" />
            Ver la prueba y su historial
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Tarjeta className="space-y-4 p-5">
            <h2 className="text-base font-bold">Lo que vio el relevador</h2>
            <blockquote className="border-l-2 border-primario pl-3 text-[15px] whitespace-pre-line">
              {o.observaciones || <span className="text-texto-secundario">No dejó observaciones.</span>}
            </blockquote>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-texto-secundario">Caso usado</dt>
                <dd className="mt-0.5">{o.caso_usado || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-texto-secundario">Prioridad sugerida</dt>
                <dd className="mt-0.5">{o.prioridad_sugerida ? <InsigniaPrioridad prioridad={o.prioridad_sugerida} /> : "No sugirió"}</dd>
              </div>
            </dl>
            {o.es_revalidacion || o.repetida ? (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-institucional">
                <RotateCcw aria-hidden="true" className="size-3.5" />
                {o.es_revalidacion ? "Revalidación pedida por el equipo" : "Nueva evaluación de una prueba que ya tenía resultado"}
              </p>
            ) : null}
          </Tarjeta>

          <Tarjeta className="space-y-4 p-5">
            <h2 id="evidencias" className="scroll-mt-24 text-base font-bold">
              Evidencias{o.evidencias.length ? ` (${o.evidencias.length})` : ""}
            </h2>
            <GaleriaEvidencias evidencias={o.evidencias} />
          </Tarjeta>
        </div>

        <aside className="space-y-6">
          <Tarjeta className="space-y-3 p-5">
            <h2 className="text-base font-bold">Clasificación</h2>
            <div className="flex flex-wrap items-center gap-2">
              <AccionesObservacion id={o.id} clasificacion={o.clasificacion} revisadaPor={o.revisada_por} incidenciaNumero={o.incidencia_numero} />
            </div>
          </Tarjeta>
          <Tarjeta className="space-y-3 p-5 text-sm">
            <h2 className="text-base font-bold">La prueba</h2>
            <InsigniaPerfil perfil={o.perfil} />
            <div>
              <p className="antetitulo text-texto-secundario">Qué probar</p>
              <p className="mt-1">{o.que_probar}</p>
            </div>
            <div>
              <p className="antetitulo text-texto-secundario">Resultado esperado</p>
              <p className="mt-1">{o.resultado_esperado}</p>
            </div>
          </Tarjeta>
        </aside>
      </div>
    </div>
  );
}
