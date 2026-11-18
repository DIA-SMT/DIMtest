import Link from "next/link";
import { ArrowRight, Clock, Wrench } from "lucide-react";
import { TituloSeccion } from "@/components/ui";
import { solucionParaRelevador } from "@/domain/revalidaciones";
import { fecha } from "@/lib/fechas";
import type { ParaVolverAProbar } from "../servicio";

/**
 * Lo que el equipo corrigió y espera que la DIM vuelva a probar. Queda hasta que alguien la
 * prueba: esa nueva evaluación es la que confirma (o no) la corrección.
 */
export function ListaParaVolverAProbar({ pruebas }: { pruebas: ParaVolverAProbar[] }) {
  return (
    <section aria-labelledby="titulo-revalidar" className="scroll-mt-24 space-y-3">
      <TituloSeccion id="titulo-revalidar">Listas para volver a probar ({pruebas.length})</TituloSeccion>
      <p className="text-sm text-texto-secundario">
        Ya están corregidas en el sistema de prueba. Volvé a probarlas y contanos si ahora funcionan: hasta que alguien las confirme, quedan acá.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {pruebas.map((p) => {
          const solucion = solucionParaRelevador(p.solucion, 200);
          return (
            <li key={p.codigo}>
              <Link
                href={`/relevamiento/prueba/${p.codigo}`}
                className="group flex h-full flex-col gap-2 rounded-tarjeta border-2 border-institucional bg-superficie p-4 shadow-tarjeta transition-[transform,box-shadow] hover:-translate-y-0.5 hover:bg-superficie-azul hover:shadow-elevada"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-control bg-institucional px-2 py-1 font-mono text-xs font-bold text-white">{p.codigo}</span>
                  {p.mia ? <span className="rounded-full bg-amarillo px-2 py-0.5 text-xs font-bold text-institucional">Lo reportaste vos</span> : null}
                  <span className="ml-auto text-xs text-texto-secundario">Corregida el {fecha(p.pedidaAt)}</span>
                </div>
                <p className="text-sm font-semibold">{p.queProbar}</p>
                <p className="text-xs text-texto-secundario">{p.modulo}</p>
                {solucion ? (
                  <p className="flex gap-1.5 text-sm">
                    <Wrench aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primario" />
                    <span>
                      <span className="font-semibold">Qué se corrigió:</span> {solucion}
                    </span>
                  </p>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-sm">
                  {p.probandoOtro ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-advertencia">
                      <Clock aria-hidden="true" className="size-3.5" />
                      La está probando {p.probandoOtro}
                    </span>
                  ) : (
                    <span className="font-semibold text-primario-oscuro">Volver a probar</span>
                  )}
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-primario transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
