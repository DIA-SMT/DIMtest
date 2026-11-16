import Link from "next/link";
import { ArrowRight, Ban, ChevronRight, Clock, ListChecks, RotateCcw } from "lucide-react";
import { Aviso, BarraResultados, CLASE_PORTADA_PRINCIPAL, CLASE_PORTADA_SECUNDARIA, CONTENEDOR_ANGOSTO, LeyendaResultados, Portada, TituloSeccion } from "@/components/ui";
import { estadoDePruebas, listarModulos, resumirPorModulo } from "@/features/relevamiento/servicio";
import { exigirRelevador } from "@/lib/auth/relevador";
import { conBase } from "@/lib/db";
import { catalogo } from "@/domain/catalogo/catalogo";
import { primerNombre } from "@/domain/nombres";
import { hora } from "@/lib/fechas";
import { porcentaje } from "@/lib/formato";
import type { Resultado } from "@/domain/resultados";

export const metadata = { title: "Módulos" };

export default async function InicioRelevamiento() {
  const relevador = await exigirRelevador();
  const { modulos, filas } = await conBase(async (q) => ({ modulos: await listarModulos(q), filas: await estadoDePruebas(q) }));
  const resumen = resumirPorModulo(modulos, filas);
  const total = filas.length;
  const realizadas = filas.filter((f) => f.ejecuciones > 0).length;
  const porResultado = resumen.reduce(
    (acc, m) => {
      for (const k of Object.keys(acc) as Resultado[]) acc[k] += m.porResultado[k];
      return acc;
    },
    { funciona: 0, no_funciona: 0, parcial: 0, no_probado: 0 } as Record<Resultado, number>,
  );
  const mias = filas.filter((f) => f.reserva?.relevadorId === relevador.relevadorId);
  const revalidar = filas.filter((f) => f.estado === "revalidar");
  const pendientes = filas.filter((f) => f.estado === "sin_realizar").length;

  return (
    <>
      <Portada
        angosta
        antetitulo="Dirección de Impuestos Municipales"
        titulo={`Hola, ${primerNombre(relevador.nombre)}`}
        remate="Probemos DIM360"
        acciones={
          <>
            <a href="#titulo-modulos" className={CLASE_PORTADA_PRINCIPAL}>
              <ListChecks aria-hidden="true" className="size-[18px]" />
              Elegir un módulo
              <ArrowRight aria-hidden="true" className="size-[17px]" />
            </a>
            {revalidar.length > 0 ? (
              <a href="#titulo-revalidar" className={CLASE_PORTADA_SECUNDARIA}>
                <RotateCcw aria-hidden="true" className="size-[18px]" />
                Revalidar ({revalidar.length})
              </a>
            ) : null}
          </>
        }
      >
        <p>
          Elegí el módulo que conocés y probá con casos reales. Las pruebas pendientes aparecen primero · {realizadas} de {total} evaluadas
          entre todos.
        </p>
      </Portada>

      <div className={`${CONTENEDOR_ANGOSTO} space-y-9 pb-10`}>
        <section className="relative z-[4] mt-2 space-y-4">
          <div className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-elevada sm:p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-base font-bold text-institucional">Avance general del relevamiento</p>
              <p className="text-sm text-texto-secundario">
                <strong className="text-lg text-texto">{realizadas}</strong> de {total} pruebas evaluadas ({porcentaje(realizadas, total)} %) ·{" "}
                {pendientes} sin realizar
              </p>
            </div>
            <BarraResultados total={total} porResultado={porResultado} etiqueta="Avance general" alta />
            <div className="mt-3">
              <LeyendaResultados />
            </div>
          </div>
        </section>

        {mias.length > 0 ? (
          <Aviso tipo="advertencia" titulo="Tenés pruebas empezadas">
            <ul className="mt-1 space-y-1">
              {mias.map((f) => (
                <li key={f.codigo}>
                  <Link href={`/relevamiento/prueba/${f.codigo}?paso=probar`} className="font-semibold text-primario-oscuro underline underline-offset-2">
                    {f.codigo}
                  </Link>{" "}
                  · reservada para vos hasta las {hora(f.reserva!.vence)}
                </li>
              ))}
            </ul>
          </Aviso>
        ) : null}

        {revalidar.length > 0 ? (
          <section aria-labelledby="titulo-revalidar" className="scroll-mt-24 space-y-3">
            <TituloSeccion id="titulo-revalidar">Requieren nueva validación ({revalidar.length})</TituloSeccion>
            <p className="text-sm text-texto-secundario">El equipo corrigió estos problemas. Volvé a probarlas para confirmar que ahora funcionan.</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {revalidar.map((f) => (
                <li key={f.codigo}>
                  <Link
                    href={`/relevamiento/prueba/${f.codigo}`}
                    className="flex items-center gap-3 rounded-tarjeta border-2 border-institucional bg-superficie p-3 shadow-tarjeta transition-colors hover:bg-superficie-azul"
                  >
                    <span className="rounded-control bg-institucional px-2 py-1 font-mono text-xs font-bold text-white">{f.codigo}</span>
                    <span className="min-w-0 flex-1 text-sm">{f.queProbar}</span>
                    <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-primario" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="titulo-modulos" className="space-y-3">
          <TituloSeccion id="titulo-modulos" className="scroll-mt-24">Módulos ({modulos.length})</TituloSeccion>
          <ul className="grid gap-3 sm:grid-cols-2">
            {resumen.map((m) => {
              const disponibles = m.porEstado.sin_realizar + m.porEstado.revalidar;
              const completo = m.realizadas === m.total && m.porEstado.revalidar === 0;
              return (
                <li key={m.codigo}>
                  <Link
                    href={`/relevamiento/${m.codigo}`}
                    className="group flex h-full flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-azul-hover hover:shadow-elevada"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-control bg-superficie-azul px-2 py-1 font-mono text-xs font-bold text-primario-oscuro">{m.codigo}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="leading-snug font-semibold">{m.nombre}</h3>
                        {m.descripcion ? <p className="mt-0.5 line-clamp-2 text-sm text-texto-secundario">{m.descripcion}</p> : null}
                      </div>
                      <ChevronRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-texto-secundario group-hover:text-primario" />
                    </div>
                    <div className="mt-auto space-y-2">
                      <BarraResultados total={m.total} porResultado={m.porResultado} etiqueta={`Avance de ${m.nombre}`} />
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-secundario">
                        <span>
                          <strong className="text-texto">{m.realizadas}</strong>/{m.total} evaluadas
                        </span>
                        {completo ? (
                          <span className="font-semibold text-exito">Completo</span>
                        ) : (
                          <span className="font-semibold text-primario-oscuro">{disponibles} pendientes</span>
                        )}
                        {m.porEstado.en_ejecucion > 0 ? (
                          <span className="flex items-center gap-1 text-advertencia">
                            <Clock aria-hidden="true" className="size-3.5" />
                            {m.porEstado.en_ejecucion} en curso
                          </span>
                        ) : null}
                        {m.porEstado.revalidar > 0 ? (
                          <span className="flex items-center gap-1 font-semibold text-institucional">
                            <RotateCcw aria-hidden="true" className="size-3.5" />
                            {m.porEstado.revalidar} para revalidar
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <details className="rounded-tarjeta border border-borde bg-superficie p-4 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold">
            <Ban aria-hidden="true" className="size-4 text-texto-secundario" />
            Lo que no entra en esta prueba
          </summary>
          <p className="mt-2 text-texto-secundario">Estas funciones existen pero hoy están apagadas a propósito. Se prueban cuando se habiliten:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {catalogo.exclusiones.map((e) => (
              <li key={e.funcion}>
                <strong>{e.funcion}:</strong> {e.motivo}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </>
  );
}
