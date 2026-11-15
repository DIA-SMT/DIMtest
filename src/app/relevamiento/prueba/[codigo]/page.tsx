import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, FileText, History, Image as ImagenIcono, RotateCcw } from "lucide-react";
import { Aviso, InsigniaEstadoPrueba, InsigniaPerfil, InsigniaPrioridad, InsigniaResultado } from "@/components/ui";
import { FormEjecucion } from "@/features/relevamiento/components/form-ejecucion";
import { PanelTomar } from "@/features/relevamiento/components/panel-tomar";
import {
  estadoDePruebas,
  historialDePrueba,
  listarModulos,
  reservaPropia,
  revalidacionesPendientes,
} from "@/features/relevamiento/servicio";
import { exigirRelevador } from "@/lib/auth/relevador";
import { conBase } from "@/lib/db";
import { fechaHora, hora } from "@/lib/fechas";
import { numeroIncidencia, tamanoArchivo } from "@/lib/formato";
import { NOMBRE_PERFIL, type Perfil } from "@/domain/catalogo/catalogo";

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }) {
  return { title: (await params).codigo };
}

export default async function PaginaPrueba({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ paso?: string }>;
}) {
  const relevador = await exigirRelevador();
  const { codigo } = await params;
  const { paso } = await searchParams;
  if (!/^[A-Z]{2,4}-\d{2}$/.test(codigo)) notFound();
  const moduloCodigo = codigo.split("-")[0];

  const datos = await conBase(async (q) => {
    const filas = await estadoDePruebas(q, moduloCodigo);
    const fila = filas.find((f) => f.codigo === codigo);
    if (!fila) return null;
    return {
      fila,
      modulo: (await listarModulos(q)).find((m) => m.codigo === moduloCodigo)!,
      historial: await historialDePrueba(q, codigo),
      revalidaciones: await revalidacionesPendientes(q, codigo),
      miReserva: await reservaPropia(q, codigo, relevador.relevadorId),
    };
  });
  if (!datos) notFound();
  const { fila, modulo, historial, revalidaciones, miReserva } = datos;
  const deOtro = fila.reserva && fila.reserva.relevadorId !== relevador.relevadorId ? fila.reserva : null;
  const probando = paso === "probar" && !!miReserva;

  return (
    <div className="space-y-6">
      <Link href={`/relevamiento/${moduloCodigo}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primario-oscuro hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {modulo.nombre}
      </Link>

      <article className="overflow-hidden rounded-panel border border-borde bg-superficie shadow-tarjeta">
        <header className="space-y-3 border-b border-borde bg-superficie-azul/60 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-control bg-primario px-2.5 py-1 font-mono text-sm font-bold text-white">{fila.codigo}</span>
            <InsigniaEstadoPrueba estado={fila.estado} />
            <InsigniaPerfil perfil={fila.perfil} />
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{fila.queProbar}</h1>
        </header>
        <dl className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
          <div className="space-y-1">
            <dt className="text-xs font-semibold tracking-wider text-texto-secundario uppercase">Qué probar</dt>
            <dd className="text-base">{fila.queProbar}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-semibold tracking-wider text-texto-secundario uppercase">Resultado esperado</dt>
            <dd className="text-base">{fila.resultadoEsperado}</dd>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-xs font-semibold tracking-wider text-texto-secundario uppercase">Con qué perfil</dt>
            <dd className="text-sm">
              {NOMBRE_PERFIL[fila.perfil as Perfil]}. Usá un caso real que la DIM conozca (un CUIT, padrón o legajo) para poder compararlo con el PGM, el
              180 o el SIAC.
            </dd>
          </div>
        </dl>
      </article>

      {revalidaciones.length > 0 ? (
        <Aviso tipo="info" titulo="El equipo corrigió un problema: hace falta volver a probarla">
          <ul className="space-y-1">
            {revalidaciones.map((r) => (
              <li key={r.incidenciaNumero}>
                <strong>{numeroIncidencia(r.incidenciaNumero)}</strong> · pedido el {fechaHora(r.solicitadaAt)}
                {r.solucion ? <span className="block text-texto-secundario">Solución aplicada: {r.solucion}</span> : null}
              </li>
            ))}
          </ul>
        </Aviso>
      ) : null}

      <section aria-labelledby="titulo-probar" className="space-y-3">
        <h2 id="titulo-probar" className="sr-only">
          Registrar el resultado
        </h2>
        {deOtro ? (
          <Aviso tipo="advertencia" titulo={`${deOtro.relevador} está probando esta función`}>
            <p className="flex items-center gap-1.5">
              <Clock aria-hidden="true" className="size-4" />
              Empezó a las {hora(deOtro.desde)}. Si no termina, se libera a las {hora(deOtro.vence)}.
            </p>
            <p className="mt-1">Para no repetir trabajo, elegí otra prueba pendiente.</p>
          </Aviso>
        ) : probando ? (
          <FormEjecucion codigo={fila.codigo} venceInicial={hora(miReserva!)} esRevalidacion={revalidaciones.length > 0} />
        ) : (
          <PanelTomar codigo={fila.codigo} realizada={fila.ejecuciones > 0} revalidar={revalidaciones.length > 0} reservadaPorMi={!!miReserva} />
        )}
      </section>

      <section aria-labelledby="titulo-historial" className="space-y-3">
        <h2 id="titulo-historial" className="flex items-center gap-2 text-lg font-bold">
          <History aria-hidden="true" className="size-5 text-texto-secundario" />
          Historial de esta prueba
        </h2>
        {historial.length === 0 ? (
          <p className="rounded-tarjeta border border-dashed border-borde bg-superficie p-4 text-sm text-texto-secundario">
            Todavía nadie la probó.
          </p>
        ) : (
          <ol className="space-y-3">
            {historial.map((e) => (
              <li key={e.id} className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
                <div className="flex flex-wrap items-center gap-2">
                  <InsigniaResultado resultado={e.resultado} />
                  <span className="text-sm">
                    <strong>{e.relevador}</strong>
                    {e.relevadorId === relevador.relevadorId ? " (vos)" : ""} · {fechaHora(e.fecha)}
                  </span>
                  {e.esRevalidacion ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-institucional">
                      <RotateCcw aria-hidden="true" className="size-3.5" />
                      Revalidación
                    </span>
                  ) : e.repetida ? (
                    <span className="text-xs font-semibold text-texto-secundario">Nueva evaluación</span>
                  ) : null}
                  {e.prioridadSugerida ? (
                    <span className="flex items-center gap-1 text-xs text-texto-secundario">
                      Prioridad sugerida <InsigniaPrioridad prioridad={e.prioridadSugerida} corta />
                    </span>
                  ) : null}
                </div>
                {e.observaciones ? <p className="mt-2 text-sm whitespace-pre-line">{e.observaciones}</p> : null}
                {e.casoUsado ? (
                  <p className="mt-1 text-sm text-texto-secundario">
                    <span className="font-medium text-texto">Caso usado:</span> {e.casoUsado}
                  </p>
                ) : null}
                {e.evidencias.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {e.evidencias.map((v) => (
                      <li key={v.id}>
                        <a
                          href={`/evidencias/${v.id}`}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1.5 rounded-control border border-borde bg-fondo px-2.5 py-1.5 text-xs font-medium text-primario-oscuro hover:border-primario"
                        >
                          {v.mime === "application/pdf" ? <FileText aria-hidden="true" className="size-4" /> : <ImagenIcono aria-hidden="true" className="size-4" />}
                          <span className="max-w-[12rem] truncate">{v.nombre}</span>
                          <span className="text-texto-secundario">{tamanoArchivo(v.tamano)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
