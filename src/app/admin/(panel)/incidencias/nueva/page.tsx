import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina, InsigniaPrioridad, InsigniaResultado, Tarjeta } from "@/components/ui";
import { FormIncidencia } from "@/features/admin/components/form-incidencia";
import { ejecucionParaIncidencia, opcionesResponsables, pruebaAdmin, type Opcion } from "@/features/admin/consultas";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";

export const metadata = { title: "Nueva incidencia" };

/** Alta de incidencia: desde una observación (?ejecucion=…) o desde una prueba (?prueba=…). */
export default async function NuevaIncidencia({ searchParams }: { searchParams: Promise<{ ejecucion?: string; prueba?: string }> }) {
  await exigirAdmin("incidencias.gestionar");
  const { ejecucion, prueba } = await searchParams;
  const ejecucionId = ejecucion && /^[0-9a-f-]{36}$/.test(ejecucion) ? ejecucion : undefined;
  const codigo = prueba && /^[A-Z]{2,4}-\d{2}$/.test(prueba) ? prueba : undefined;

  const d = await conBase(async (q) => {
    const ej = ejecucionId ? await ejecucionParaIncidencia(q, ejecucionId) : null;
    const pr = !ej && codigo ? await pruebaAdmin(q, codigo) : null;
    const pruebas: Opcion[] | null =
      ej || pr
        ? null
        : (await q<{ codigo: string; que_probar: string }>("select codigo, que_probar from pruebas p join modulos m on m.codigo = p.modulo_codigo order by m.orden, p.numero")).map(
            (p) => ({ valor: p.codigo, etiqueta: `${p.codigo} · ${p.que_probar}` }),
          );
    return { ej, pr, pruebas, responsables: await opcionesResponsables(q) };
  });
  if (ejecucionId && !d.ej) notFound();

  const iniciales = d.ej
    ? {
        prueba: d.ej.prueba_codigo,
        ejecucion: d.ej.id,
        descripcion: d.ej.observaciones,
        esperado: d.ej.resultado_esperado,
        observado: [d.ej.observaciones, d.ej.caso_usado ? `Caso usado: ${d.ej.caso_usado}` : ""].filter(Boolean).join("\n"),
        prioridad: d.ej.prioridad_sugerida ?? "",
      }
    : { prueba: d.pr?.codigo ?? "", ejecucion: "", descripcion: "", esperado: d.pr?.resultado_esperado ?? "", observado: "", prioridad: "" };

  return (
    <div className="space-y-6">
      <Link href={d.ej ? "/admin/observaciones" : "/admin/incidencias"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primario-oscuro hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {d.ej ? "Observaciones" : "Incidencias"}
      </Link>
      <EncabezadoPagina
        antetitulo="Gestión de correcciones"
        titulo="Nueva incidencia"
        descripcion={d.ej ? "Se crea a partir de la observación del relevador. Revisá y completá los datos." : "Registrá un problema que requiere corrección."}
      />
      {d.ej ? (
        <Tarjeta className="space-y-2 p-4 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-bold">{d.ej.prueba_codigo}</span>
            <InsigniaResultado resultado={d.ej.resultado} />
            <span className="text-texto-secundario">
              Reportó <strong className="text-texto">{d.ej.relevador_nombre}</strong> el {fechaHora(d.ej.creada_at)}
            </span>
            {d.ej.prioridad_sugerida ? (
              <span className="flex items-center gap-1 text-texto-secundario">
                sugiere <InsigniaPrioridad prioridad={d.ej.prioridad_sugerida} />
              </span>
            ) : null}
          </p>
          <p className="text-texto-secundario">
            {d.ej.modulo} · {d.ej.que_probar}
          </p>
        </Tarjeta>
      ) : d.pr ? (
        <Tarjeta className="p-4 text-sm">
          <span className="font-mono font-bold">{d.pr.codigo}</span> · {d.pr.que_probar}
        </Tarjeta>
      ) : null}
      <Tarjeta className="p-5">
        <FormIncidencia iniciales={iniciales} pruebas={d.pruebas} responsables={d.responsables} />
      </Tarjeta>
    </div>
  );
}
