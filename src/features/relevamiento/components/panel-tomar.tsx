"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Play, RotateCcw, TriangleAlert } from "lucide-react";
import { BotonEnviar, CLASE_BOTON_PRIMARIO, CLASE_BOTON_SECUNDARIO } from "@/components/formulario";
import { Aviso } from "@/components/ui";
import { NOMBRE_RESULTADO, type Resultado } from "@/domain/resultados";
import { tomarPruebaAccion, type EstadoTomar } from "../actions";

/**
 * «Empezar a probar»: reserva la prueba. Si ya tiene resultado, avisa antes y pide
 * confirmar (sin impedirlo). Si el equipo pidió revalidarla, no pregunta.
 */
export function PanelTomar({
  codigo,
  realizada,
  revalidar,
  reservadaPorMi,
}: {
  codigo: string;
  realizada: boolean;
  revalidar: boolean;
  reservadaPorMi: boolean;
}) {
  const [estado, tomar] = useActionState<EstadoTomar, FormData>(tomarPruebaAccion, {});

  if (estado.ocupada) {
    return (
      <Aviso tipo="advertencia" titulo={`${estado.ocupada.por} acaba de empezar esta prueba`}>
        Empezó a las {estado.ocupada.desde}. Si no termina, se libera a las {estado.ocupada.vence}. Elegí otra prueba pendiente.
      </Aviso>
    );
  }

  if (estado.confirmar) {
    const c = estado.confirmar;
    return (
      <div className="space-y-4 rounded-tarjeta border-2 border-advertencia-borde bg-advertencia-fondo p-4 sm:p-5">
        <div className="flex gap-3">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-advertencia" />
          <div className="space-y-1">
            <p className="font-bold text-texto">Esta prueba ya fue evaluada</p>
            <p className="text-sm text-texto">
              <strong>{c.relevador}</strong> la marcó como <strong>{NOMBRE_RESULTADO[c.resultado as Resultado] ?? c.resultado}</strong> el {c.fecha}. Su
              resultado se conserva. ¿Querés registrar una nueva evaluación igual?
            </p>
          </div>
        </div>
        <form action={tomar} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="codigo" value={codigo} />
          <input type="hidden" name="repetir" value="si" />
          <BotonEnviar enviando="Reservando…">
            <RotateCcw aria-hidden="true" className="size-4" />
            Sí, registrar una nueva evaluación
          </BotonEnviar>
          <Link href={`/relevamiento/${codigo.split("-")[0]}`} className={CLASE_BOTON_SECUNDARIO}>
            No, elegir otra pendiente
          </Link>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta sm:p-5">
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <p className="text-sm text-texto-secundario">
        {reservadaPorMi
          ? "Tenés esta prueba reservada. Seguí donde la dejaste."
          : revalidar
            ? "Al empezar, la prueba queda reservada para vos un rato para que nadie la repita a la vez."
            : realizada
              ? "Esta prueba ya tiene resultado. Podés consultarlo abajo o registrar una nueva evaluación."
              : "Al empezar, la prueba queda reservada para vos un rato para que nadie la repita a la vez."}
      </p>
      <form action={tomar}>
        <input type="hidden" name="codigo" value={codigo} />
        <BotonEnviar enviando="Reservando…" className={`${CLASE_BOTON_PRIMARIO} w-full sm:w-auto`}>
          {revalidar ? <RotateCcw aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
          {reservadaPorMi ? "Seguir probando" : revalidar ? "Volver a probar" : realizada ? "Registrar una nueva evaluación" : "Empezar a probar"}
        </BotonEnviar>
      </form>
    </div>
  );
}
