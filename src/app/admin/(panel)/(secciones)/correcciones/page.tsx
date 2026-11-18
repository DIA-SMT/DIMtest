import Link from "next/link";
import { Bot, CircleCheck, CircleX, GitPullRequest, Hand, Rocket, TriangleAlert } from "lucide-react";
import { Aviso, EncabezadoPagina, EstadoVacio, Indicador } from "@/components/ui";
import {
  CIERRES_AGENTE,
  cierresDelFiltro,
  esRevalidacionAgente,
  GRUPOS_CIERRE,
  NOMBRE_CIERRE_AGENTE,
  NOMBRE_REVALIDACION_AGENTE,
  REVALIDACIONES_AGENTE,
} from "@/domain/agente";
import { puede } from "@/domain/permisos";
import { esPrioridad, etiquetaPrioridad, PRIORIDADES } from "@/domain/prioridades";
import { opcionesModulos } from "@/features/admin/consultas";
import { aBusqueda, BarraFiltros, FiltroSelect, FiltroTexto, Paginacion, param } from "@/features/admin/components/filtros";
import { listarCorrecciones, resumenCorrecciones } from "@/features/agente/consultas";
import { FichaCorreccion } from "@/features/agente/components/correcciones";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";

export const metadata = { title: "Correcciones del agente" };
const POR_PAGINA = 20;
const OPCIONES_CIERRE = [
  ...Object.entries(GRUPOS_CIERRE).map(([valor, g]) => ({ valor, etiqueta: g.nombre })),
  ...CIERRES_AGENTE.map((c) => ({ valor: c, etiqueta: NOMBRE_CIERRE_AGENTE[c] })),
];

/** Todo lo que terminó el agente Claude (D-015), con sus PR y cómo salió la revalidación. */
export default async function Correcciones({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sesion = await exigirAdmin("panel.ver");
  const sp = await searchParams;
  const cierre = param(sp, "cierre");
  const revalidacion = param(sp, "revalidacion");
  const modulo = param(sp, "modulo");
  const prioridad = param(sp, "prioridad");
  const busqueda = param(sp, "q");
  const pagina = Math.max(1, Number(param(sp, "pagina")) || 1);

  const { filas, resumen, modulos } = await conBase(async (q) => ({
    filas: await listarCorrecciones(q, {
      cierres: cierresDelFiltro(cierre) ?? undefined,
      revalidacion: esRevalidacionAgente(revalidacion) ? revalidacion : undefined,
      modulo: modulo && /^[A-Z]{2,4}$/.test(modulo) ? modulo : undefined,
      prioridad: esPrioridad(prioridad) ? prioridad : undefined,
      busqueda,
      pagina,
      porPagina: POR_PAGINA,
    }),
    resumen: await resumenCorrecciones(q),
    modulos: await opcionesModulos(q),
  }));
  const total = filas[0]?.total ?? 0;
  const conFiltros = [cierre, revalidacion, modulo, prioridad, busqueda].some(Boolean);
  const r = resumen;
  const enMarcha = r.en_curso + r.pendientes;

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        antetitulo="Agente Claude"
        titulo="Correcciones del agente"
        descripcion="Todo lo que terminó el agente: qué corrigió, los cambios que dejó en GitHub y si la DIM confirmó que funciona al revalidar."
      />

      {enMarcha ? (
        <Aviso
          tipo="info"
          titulo={r.en_curso ? "El agente está trabajando ahora" : "Hay pedidos en la cola del agente"}
          accion={
            puede(sesion.rol, "usuarios.gestionar") ? (
              <Link href="/admin/agente" className="font-semibold text-primario-oscuro hover:underline">
                Ver la cola del agente
              </Link>
            ) : null
          }
        >
          {r.en_curso ? `${r.en_curso === 1 ? "1 trabajo en curso" : `${r.en_curso} trabajos en curso`}` : null}
          {r.en_curso && r.pendientes ? " y " : null}
          {r.pendientes ? `${r.pendientes === 1 ? "1 pedido esperando" : `${r.pendientes} pedidos esperando`}` : null}. Aparecen acá cuando terminan.
        </Aviso>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Indicador
          titulo="Publicadas en test"
          valor={r.publicadas}
          detalle={r.por_revalidar === 1 ? "1 espera la revalidación" : `${r.por_revalidar} esperan la revalidación`} icono={Rocket} tono="info" href="/admin/correcciones?cierre=publicadas" />
        <Indicador titulo="Confirmadas por la DIM" valor={r.confirmadas} detalle="revalidadas: funciona" icono={CircleCheck} tono="exito" href="/admin/correcciones?revalidacion=confirmada" />
        <Indicador titulo="Volvieron a fallar" valor={r.volvieron_a_fallar} detalle="en la revalidación" icono={CircleX} tono="error" href="/admin/correcciones?revalidacion=volvio_a_fallar" />
        <Indicador titulo="Para revisar" valor={r.para_revisar} detalle="PR abierto, sin publicar" icono={GitPullRequest} tono="neutro" href="/admin/correcciones?cierre=pr_abierto" />
        <Indicador titulo="Necesitan una persona" valor={r.necesitan_persona} detalle="cambio de datos o bloqueadas" icono={Hand} tono="advertencia" href="/admin/correcciones?cierre=persona" />
        <Indicador titulo="No pudo terminar" valor={r.fallidas} detalle="problemas del agente" icono={TriangleAlert} tono="error" href="/admin/correcciones?cierre=fallido" />
      </div>

      <BarraFiltros accion="/admin/correcciones" limpiar="/admin/correcciones">
        <div className="sm:col-span-2">
          <FiltroTexto nombre="q" etiqueta="Buscar" tipo="search" valor={busqueda} placeholder="INC-0007, código, texto o PR" />
        </div>
        <FiltroSelect nombre="cierre" etiqueta="Cómo terminó" opciones={OPCIONES_CIERRE} valor={cierre} />
        <FiltroSelect
          nombre="revalidacion"
          etiqueta="Revalidación"
          opciones={REVALIDACIONES_AGENTE.map((v) => ({ valor: v, etiqueta: NOMBRE_REVALIDACION_AGENTE[v] }))}
          valor={revalidacion}
          todas="Todas"
        />
        <FiltroSelect nombre="modulo" etiqueta="Módulo" opciones={modulos} valor={modulo} />
        <FiltroSelect nombre="prioridad" etiqueta="Prioridad" opciones={PRIORIDADES.map((p) => ({ valor: p, etiqueta: etiquetaPrioridad(p) }))} valor={prioridad} todas="Todas" />
      </BarraFiltros>
      <p className="text-sm text-texto-secundario">{total === 1 ? "1 corrección" : `${total} correcciones`}</p>

      {filas.length === 0 ? (
        <EstadoVacio
          icono={Bot}
          titulo={conFiltros ? "No hay correcciones con estos filtros" : "El agente todavía no terminó ninguna corrección"}
          ayuda={conFiltros ? "Probá con otra búsqueda." : "Cuando termine un trabajo, va a aparecer acá con su resumen y sus PR."}
        />
      ) : (
        <ul className="space-y-3">
          {filas.map((c) => (
            <li key={c.numero}>
              <FichaCorreccion c={c} />
            </li>
          ))}
        </ul>
      )}
      <Paginacion pagina={pagina} total={total} porPagina={POR_PAGINA} base={aBusqueda(sp)} />
    </div>
  );
}
