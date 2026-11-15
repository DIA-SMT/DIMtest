import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Image as ImagenIcono, Plus, RotateCcw } from "lucide-react";
import { CLASE_BOTON_COMPACTO } from "@/components/formulario";
import { EncabezadoPagina, InsigniaEstadoIncidencia, InsigniaEstadoPrueba, InsigniaPerfil, InsigniaPrioridad, InsigniaResultado, Tarjeta } from "@/components/ui";
import { listarIncidencias, pruebaAdmin, revalidacionesDePrueba } from "@/features/admin/consultas";
import { estadoDePruebas, historialDePrueba } from "@/features/relevamiento/servicio";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { antiguedad, fechaHora } from "@/lib/fechas";
import { numeroIncidencia, resumir, tamanoArchivo } from "@/lib/formato";

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }) {
  return { title: `Prueba ${(await params).codigo}` };
}

export default async function DetallePruebaAdmin({ params }: { params: Promise<{ codigo: string }> }) {
  await exigirAdmin();
  const { codigo } = await params;
  if (!/^[A-Z]{2,4}-\d{2}$/.test(codigo)) notFound();
  const d = await conBase(async (q) => {
    const prueba = await pruebaAdmin(q, codigo);
    if (!prueba) return null;
    return {
      prueba,
      fila: (await estadoDePruebas(q, prueba.modulo_codigo)).find((f) => f.codigo === codigo)!,
      historial: await historialDePrueba(q, codigo),
      incidencias: await listarIncidencias(q, { prueba: codigo }),
      revalidaciones: await revalidacionesDePrueba(q, codigo),
    };
  });
  if (!d) notFound();
  const { prueba, fila, historial, incidencias, revalidaciones } = d;

  return (
    <div className="space-y-6">
      <Link href="/admin/pruebas" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primario-oscuro hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Pruebas
      </Link>
      <EncabezadoPagina
        antetitulo={`${prueba.modulo_codigo} · ${prueba.modulo}`}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{prueba.codigo}</span>
            <InsigniaEstadoPrueba estado={fila.estado} />
          </span>
        }
        descripcion={`Página ${prueba.pagina ?? "—"} del checklist original.`}
        acciones={
          <Link href={`/admin/incidencias/nueva?prueba=${prueba.codigo}`} className={CLASE_BOTON_COMPACTO}>
            <Plus aria-hidden="true" className="size-4" />
            Nueva incidencia
          </Link>
        }
      />

      <Tarjeta className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_auto]">
        <div>
          <p className="text-xs font-semibold text-texto-secundario uppercase">Qué probar</p>
          <p className="mt-1">{prueba.que_probar}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-texto-secundario uppercase">Resultado esperado</p>
          <p className="mt-1">{prueba.resultado_esperado}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-texto-secundario uppercase">Perfil</p>
          <div className="mt-1">
            <InsigniaPerfil perfil={prueba.perfil} />
          </div>
        </div>
      </Tarjeta>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="titulo-historial" className="space-y-3">
          <h2 id="titulo-historial" className="text-base font-bold">
            Historial de ejecuciones ({historial.length})
          </h2>
          {historial.length === 0 ? (
            <p className="rounded-tarjeta border border-dashed border-borde bg-superficie p-4 text-sm text-texto-secundario">Todavía nadie la probó.</p>
          ) : (
            <ol className="space-y-3">
              {historial.map((e) => (
                <li key={e.id} className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-texto-secundario">#{e.numero}</span>
                    <InsigniaResultado resultado={e.resultado} />
                    <strong>{e.relevador}</strong>
                    <span className="text-texto-secundario">{fechaHora(e.fecha)}</span>
                    {e.esRevalidacion ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-institucional">
                        <RotateCcw aria-hidden="true" className="size-3" />
                        Revalidación
                      </span>
                    ) : e.repetida ? (
                      <span className="text-xs font-semibold text-texto-secundario">Nueva evaluación</span>
                    ) : null}
                    {e.prioridadSugerida ? (
                      <span className="flex items-center gap-1 text-xs text-texto-secundario">
                        sugiere <InsigniaPrioridad prioridad={e.prioridadSugerida} corta />
                      </span>
                    ) : null}
                  </div>
                  {e.observaciones ? <p className="mt-2 text-sm whitespace-pre-line">{e.observaciones}</p> : null}
                  {e.casoUsado ? <p className="mt-1 text-sm text-texto-secundario">Caso usado: {e.casoUsado}</p> : null}
                  {e.evidencias.length ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {e.evidencias.map((v) => (
                        <li key={v.id}>
                          <a href={`/evidencias/${v.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-control border border-borde bg-fondo px-2 py-1 text-xs text-primario-oscuro hover:border-primario">
                            {v.mime === "application/pdf" ? <FileText aria-hidden="true" className="size-3.5" /> : <ImagenIcono aria-hidden="true" className="size-3.5" />}
                            {resumir(v.nombre, 30)} · {tamanoArchivo(v.tamano)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {e.resultado !== "funciona" ? (
                    <div className="mt-3">
                      <Link href={`/admin/incidencias/nueva?ejecucion=${e.id}`} className={CLASE_BOTON_COMPACTO}>
                        <Plus aria-hidden="true" className="size-3.5" />
                        Convertir en incidencia
                      </Link>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-6">
          <section aria-labelledby="titulo-incidencias" className="space-y-3">
            <h2 id="titulo-incidencias" className="text-base font-bold">
              Incidencias ({incidencias.length})
            </h2>
            {incidencias.length === 0 ? (
              <p className="text-sm text-texto-secundario">Sin incidencias.</p>
            ) : (
              <ul className="space-y-2">
                {incidencias.map((i) => (
                  <li key={i.id}>
                    <Link href={`/admin/incidencias/${i.numero}`} className="block rounded-tarjeta border border-borde bg-superficie p-3 shadow-tarjeta hover:border-primario">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold">{numeroIncidencia(i.numero)}</span>
                        <InsigniaPrioridad prioridad={i.prioridad} corta />
                        <InsigniaEstadoIncidencia estado={i.estado} />
                      </div>
                      <p className="mt-1 text-sm">{resumir(i.descripcion, 120)}</p>
                      <p className="mt-1 text-xs text-texto-secundario">
                        {i.responsable ?? "Sin responsable"} · {antiguedad(i.reportada_at)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="titulo-revalidaciones" className="space-y-3">
            <h2 id="titulo-revalidaciones" className="text-base font-bold">
              Revalidaciones
            </h2>
            {revalidaciones.length === 0 ? (
              <p className="text-sm text-texto-secundario">No se pidió ninguna.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {revalidaciones.map((r) => (
                  <li key={r.id} className="rounded-tarjeta border border-borde bg-superficie p-3">
                    <p>
                      <strong>{numeroIncidencia(r.incidencia_numero)}</strong> · pedida por {r.solicitada_por} el {fechaHora(r.solicitada_at)}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-texto-secundario">
                      {r.resultado ? (
                        <>
                          <InsigniaResultado resultado={r.resultado} /> {r.relevador} · {fechaHora(r.resuelta_at!)}
                        </>
                      ) : r.cancelada_at ? (
                        "Cancelada"
                      ) : (
                        "Pendiente: espera que la DIM vuelva a probar"
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
