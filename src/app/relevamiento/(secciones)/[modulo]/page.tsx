import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Clock } from "lucide-react";
import { Aviso, BarraResultados, EstadoVacio, InsigniaEstadoPrueba, InsigniaPerfil, InsigniaResultado, LeyendaResultados } from "@/components/ui";
import { CLASE_BOTON_PRIMARIO } from "@/components/formulario";
import { estadoDePruebas, listarModulos, resumirPorModulo, type FilaPrueba } from "@/features/relevamiento/servicio";
import { exigirRelevador } from "@/lib/auth/relevador";
import { conBase } from "@/lib/db";
import { fechaHora, hora } from "@/lib/fechas";

const VISTAS = [
  { clave: "pendientes", nombre: "Pendientes" },
  { clave: "en_ejecucion", nombre: "En ejecución" },
  { clave: "realizadas", nombre: "Realizadas" },
  { clave: "todas", nombre: "Todas" },
] as const;
type Vista = (typeof VISTAS)[number]["clave"];

function filtrar(filas: FilaPrueba[], vista: Vista) {
  if (vista === "pendientes") return filas.filter((f) => f.estado === "sin_realizar" || f.estado === "revalidar");
  if (vista === "en_ejecucion") return filas.filter((f) => f.estado === "en_ejecucion");
  if (vista === "realizadas") return filas.filter((f) => f.ejecuciones > 0);
  return filas;
}

export async function generateMetadata({ params }: { params: Promise<{ modulo: string }> }) {
  return { title: `Módulo ${(await params).modulo}` };
}

export default async function PaginaModulo({
  params,
  searchParams,
}: {
  params: Promise<{ modulo: string }>;
  searchParams: Promise<{ ver?: string; guardada?: string }>;
}) {
  const relevador = await exigirRelevador();
  const { modulo: codigo } = await params;
  const { ver, guardada } = await searchParams;
  if (!/^[A-Z]{2,4}$/.test(codigo)) notFound();

  const { modulos, filas } = await conBase(async (q) => ({ modulos: await listarModulos(q), filas: await estadoDePruebas(q, codigo) }));
  const modulo = modulos.find((m) => m.codigo === codigo);
  if (!modulo) notFound();
  const [resumen] = resumirPorModulo([modulo], filas);

  const vista: Vista = VISTAS.some((v) => v.clave === ver) ? (ver as Vista) : "pendientes";
  const visibles = filtrar(filas, vista);
  const guardadaFila = guardada ? filas.find((f) => f.codigo === guardada) : undefined;
  const siguiente = filas.find(
    (f) => (f.estado === "sin_realizar" || f.estado === "revalidar") && f.codigo !== guardada && (!guardada || f.codigo > guardada),
  ) ?? filas.find((f) => f.estado === "sin_realizar" || f.estado === "revalidar");

  return (
    <div className="space-y-6">
      <Link href="/relevamiento" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primario-oscuro hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Todos los módulos
      </Link>

      {guardadaFila ? (
        <Aviso
          tipo="exito"
          titulo={`Guardaste ${guardadaFila.codigo}. ¡Gracias!`}
          accion={
            siguiente ? (
              <Link href={`/relevamiento/prueba/${siguiente.codigo}`} className={CLASE_BOTON_PRIMARIO}>
                Seguir con {siguiente.codigo}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            ) : (
              <Link href="/relevamiento" className={CLASE_BOTON_PRIMARIO}>
                Elegir otro módulo
              </Link>
            )
          }
        >
          {siguiente ? "Podés seguir con la próxima prueba pendiente de este módulo o elegir otra de la lista." : "No quedan pruebas pendientes en este módulo."}
        </Aviso>
      ) : null}

      <header className="space-y-3">
        <div className="space-y-2">
          <p className="antetitulo text-primario">Módulo {modulo.codigo}</p>
          <h1 className="text-[1.75rem] leading-tight font-bold text-institucional sm:text-[2rem]">{modulo.nombre}</h1>
          {modulo.descripcion ? <p className="text-texto-secundario">{modulo.descripcion}</p> : null}
        </div>
        <div className="rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
          <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-semibold">
              {resumen.realizadas} de {resumen.total} evaluadas
            </span>
            <span className="text-texto-secundario">
              {resumen.porEstado.sin_realizar} sin realizar · {resumen.porEstado.en_ejecucion} en ejecución · {resumen.porEstado.revalidar} para revalidar
            </span>
          </div>
          <BarraResultados total={resumen.total} porResultado={resumen.porResultado} etiqueta={`Avance de ${modulo.nombre}`} alta />
          <div className="mt-2">
            <LeyendaResultados />
          </div>
        </div>
      </header>

      <nav aria-label="Filtrar pruebas" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-full border border-borde bg-superficie p-1 shadow-tarjeta">
          {VISTAS.map((v) => {
            const n = filtrar(filas, v.clave).length;
            const activa = v.clave === vista;
            return (
              <li key={v.clave}>
                <Link
                  href={`/relevamiento/${codigo}?ver=${v.clave}`}
                  aria-current={activa ? "page" : undefined}
                  className={`flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors ${
                    activa ? "bg-primario text-white" : "text-institucional hover:bg-superficie-azul hover:text-primario"
                  }`}
                >
                  {v.nombre}
                  <span className={`rounded-full px-1.5 text-xs ${activa ? "bg-white/20" : "bg-neutro-fondo"}`}>{n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {visibles.length === 0 ? (
        <EstadoVacio
          icono={vista === "pendientes" ? CheckCircle2 : ClipboardList}
          titulo={vista === "pendientes" ? "No quedan pruebas pendientes en este módulo" : "No hay pruebas en esta vista"}
          ayuda={vista === "pendientes" ? "Podés revisar las realizadas o elegir otro módulo." : "Probá con otra pestaña."}
        />
      ) : (
        <ul className="space-y-3">
          {visibles.map((f) => {
            const deOtro = f.reserva && f.reserva.relevadorId !== relevador.relevadorId;
            const disponible = f.estado === "sin_realizar" || f.estado === "revalidar";
            return (
              <li key={f.codigo}>
                <Link
                  href={`/relevamiento/prueba/${f.codigo}`}
                  className={`block rounded-tarjeta border bg-superficie p-4 shadow-tarjeta transition-[border-color,box-shadow] hover:border-primario hover:shadow-elevada ${
                    f.estado === "revalidar" ? "border-2 border-institucional" : disponible ? "border-info-borde" : "border-borde"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-primario-oscuro">{f.codigo}</span>
                    <InsigniaEstadoPrueba estado={f.estado} />
                    <InsigniaPerfil perfil={f.perfil} />
                  </div>
                  <p className="mt-2 font-semibold">{f.queProbar}</p>
                  <p className="mt-1 text-sm text-texto-secundario">
                    <span className="font-medium text-texto">Esperado:</span> {f.resultadoEsperado}
                  </p>
                  {f.reserva ? (
                    <p className="mt-3 flex items-center gap-1.5 text-sm text-advertencia">
                      <Clock aria-hidden="true" className="size-4" />
                      {deOtro ? `${f.reserva.relevador} la está probando desde las ${hora(f.reserva.desde)}` : `La estás probando vos (hasta las ${hora(f.reserva.vence)})`}
                    </p>
                  ) : null}
                  {f.ultima ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borde pt-3 text-sm">
                      <InsigniaResultado resultado={f.ultima.resultado} />
                      <span className="text-texto-secundario">
                        Probó <strong className="text-texto">{f.ultima.relevador}</strong> · {fechaHora(f.ultima.fecha)}
                        {f.ejecuciones > 1 ? ` · ${f.ejecuciones} evaluaciones` : ""}
                      </span>
                    </div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
