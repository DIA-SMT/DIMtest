"use client";

import { RotateCcw } from "lucide-react";
import { CLASE_BOTON_PRIMARIO } from "@/components/formulario";

export default function ErrorGeneral({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="contenido" className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Algo no salió bien</h1>
      <p className="text-texto-secundario">No se pudo conectar con el servidor o hubo un error inesperado. Revisá la conexión y probá de nuevo.</p>
      <button type="button" onClick={reset} className={CLASE_BOTON_PRIMARIO}>
        <RotateCcw aria-hidden="true" className="size-4" />
        Probar de nuevo
      </button>
    </main>
  );
}
