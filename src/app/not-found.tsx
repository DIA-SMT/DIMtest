import Link from "next/link";
import { CLASE_BOTON_PRIMARIO } from "@/components/formulario";

export default function NoEncontrado() {
  return (
    <main id="contenido" className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-sm font-bold text-primario-oscuro">404</p>
      <h1 className="text-2xl font-bold">No encontramos esta página</h1>
      <p className="text-texto-secundario">Puede que el enlace esté mal escrito o que la página ya no exista.</p>
      <Link href="/" className={CLASE_BOTON_PRIMARIO}>
        Ir al inicio
      </Link>
    </main>
  );
}
