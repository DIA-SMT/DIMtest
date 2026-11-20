import Link from "next/link";
import { ArrowLeft, Lightbulb, MessageSquareReply } from "lucide-react";
import { Aviso, EstadoVacio, TituloSeccion } from "@/components/ui";
import { FormSugerencia } from "@/features/sugerencias/components/form-sugerencia";
import { InsigniaEstadoSugerencia, InsigniaTipoSugerencia, numeroSugerencia } from "@/features/sugerencias/components/insignias";
import { listarModulos } from "@/features/relevamiento/servicio";
import { sugerenciasDeRelevador } from "@/features/sugerencias/servicio";
import { exigirRelevador } from "@/lib/auth/relevador";
import { conBase } from "@/lib/db";
import { fecha } from "@/lib/fechas";
import { primerNombre } from "@/domain/nombres";

export const metadata = { title: "Sugerencias" };

export default async function PaginaSugerencias({ searchParams }: { searchParams: Promise<{ enviada?: string }> }) {
  const relevador = await exigirRelevador();
  const { enviada } = await searchParams;
  const { modulos, propias } = await conBase(async (q) => ({
    modulos: await listarModulos(q),
    propias: await sugerenciasDeRelevador(q, relevador.relevadorId),
  }));
  const recienEnviada = propias.find((s) => String(s.numero) === enviada);

  return (
    <div className="space-y-6">
      <Link href="/relevamiento" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primario-oscuro hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Todos los módulos
      </Link>

      <header className="space-y-2">
        <p className="antetitulo text-primario">Ideas para DIM360</p>
        <h1 className="text-[1.75rem] leading-tight font-bold text-institucional sm:text-[2rem]">Sugerencias</h1>
        <p className="text-texto-secundario">
          {primerNombre(relevador.nombre)}, vos usás DIM360 todos los días: si le falta una función o algo se podría hacer mejor, contanos. El equipo de la DIA las lee
          todas y te responde acá.
        </p>
      </header>

      {recienEnviada ? (
        <Aviso tipo="exito" titulo={`¡Gracias! Recibimos tu sugerencia ${numeroSugerencia(recienEnviada.numero)}`}>
          Cuando el equipo la mire vas a ver acá abajo en qué quedó y su respuesta.
        </Aviso>
      ) : null}

      <section aria-labelledby="titulo-nueva-sugerencia" className="space-y-3">
        <TituloSeccion id="titulo-nueva-sugerencia">Nueva sugerencia</TituloSeccion>
        {/* La key vacía el formulario después de enviar. */}
        <FormSugerencia key={enviada ?? "nueva"} modulos={modulos.map((m) => ({ codigo: m.codigo, nombre: m.nombre }))} />
      </section>

      <section aria-labelledby="titulo-mis-sugerencias" className="space-y-3">
        <TituloSeccion id="titulo-mis-sugerencias" className="scroll-mt-24">
          Tus sugerencias ({propias.length})
        </TituloSeccion>
        {propias.length === 0 ? (
          <EstadoVacio icono={Lightbulb} titulo="Todavía no mandaste ninguna" ayuda="Las que mandes van a aparecer acá, con la respuesta del equipo." />
        ) : (
          <ul className="space-y-3">
            {propias.map((s) => (
              <li key={s.numero} className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
                <div className="flex flex-wrap items-center gap-2 text-xs text-texto-secundario">
                  <span className="font-mono font-bold text-primario-oscuro">{numeroSugerencia(s.numero)}</span>
                  <InsigniaEstadoSugerencia estado={s.estado} paraRelevador />
                  <InsigniaTipoSugerencia tipo={s.tipo} />
                  <span>
                    {s.modulo ?? "General"} · {fecha(s.creadaAt)}
                  </span>
                </div>
                <h3 className="mt-2 leading-snug font-semibold">{s.titulo}</h3>
                <p className="mt-1 text-sm whitespace-pre-line text-texto-secundario">{s.detalle}</p>
                {s.respuesta ? (
                  <div className="mt-3 rounded-control border border-info-borde bg-info-fondo p-3 text-sm">
                    <p className="flex items-center gap-1.5 font-semibold text-institucional">
                      <MessageSquareReply aria-hidden="true" className="size-4 text-primario" />
                      Respuesta del equipo{s.respondidaAt ? ` · ${fecha(s.respondidaAt)}` : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-line">{s.respuesta}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
