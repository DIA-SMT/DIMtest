import { CircleCheck, CircleSlash, Inbox, Lightbulb, MessageSquareReply, Search, Sparkles } from "lucide-react";
import { EncabezadoPagina, EstadoVacio, Indicador, Tarjeta } from "@/components/ui";
import { puede } from "@/domain/permisos";
import { esEstadoSugerencia, esTipoSugerencia, ESTADOS_SUGERENCIA, NOMBRE_ESTADO_SUGERENCIA, NOMBRE_TIPO_SUGERENCIA, TIPOS_SUGERENCIA } from "@/domain/sugerencias";
import { opcionesModulos } from "@/features/admin/consultas";
import { aBusqueda, BarraFiltros, FiltroSelect, FiltroTexto, Paginacion, param } from "@/features/admin/components/filtros";
import { listarSugerencias, resumenSugerencias } from "@/features/sugerencias/consultas";
import { FormRespuestaSugerencia } from "@/features/sugerencias/components/form-respuesta";
import { InsigniaEstadoSugerencia, InsigniaTipoSugerencia, numeroSugerencia } from "@/features/sugerencias/components/insignias";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";

export const metadata = { title: "Sugerencias" };
const POR_PAGINA = 20;
const OPCIONES_ESTADO = [{ valor: "abiertas", etiqueta: "Sin resolver (nuevas, en evaluación y planificadas)" }, ...ESTADOS_SUGERENCIA.map((e) => ({ valor: e, etiqueta: NOMBRE_ESTADO_SUGERENCIA[e] }))];

/** Lo que los relevadores proponen para DIM360 (D-017): funciones nuevas, mejoras e ideas. */
export default async function Sugerencias({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sesion = await exigirAdmin("panel.ver");
  const puedeResponder = puede(sesion.rol, "observaciones.clasificar");
  const sp = await searchParams;
  const estado = param(sp, "estado");
  const tipo = param(sp, "tipo");
  const modulo = param(sp, "modulo");
  const busqueda = param(sp, "q");
  const pagina = Math.max(1, Number(param(sp, "pagina")) || 1);

  const { filas, r, modulos } = await conBase(async (q) => ({
    filas: await listarSugerencias(q, {
      estado: estado === "abiertas" || esEstadoSugerencia(estado) ? estado : undefined,
      tipo: esTipoSugerencia(tipo) ? tipo : undefined,
      modulo: modulo && /^[A-Z]{2,4}$/.test(modulo) ? modulo : undefined,
      busqueda,
      pagina,
      porPagina: POR_PAGINA,
    }),
    r: await resumenSugerencias(q),
    modulos: await opcionesModulos(q),
  }));
  const total = filas[0]?.total ?? 0;
  const conFiltros = [estado, tipo, modulo, busqueda].some(Boolean);

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        antetitulo="Lo que proponen los relevadores"
        titulo="Sugerencias"
        descripcion={
          r.total > 0
            ? `Funciones nuevas, mejoras e ideas para DIM360 que escribieron en el portal: ${r.total === 1 ? "1 sugerencia" : `${r.total} sugerencias`} de ${r.relevadores === 1 ? "1 relevador" : `${r.relevadores} relevadores`}. Lo que les respondas lo ven debajo de su sugerencia.`
            : "Funciones nuevas, mejoras e ideas para DIM360 que escriben los relevadores en el portal. Lo que les respondas lo ven debajo de su sugerencia."
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Indicador titulo="Nuevas" valor={r.nuevas} detalle="sin mirar todavía" icono={Inbox} tono="info" href="/admin/sugerencias?estado=nueva" />
        <Indicador titulo="En evaluación" valor={r.en_evaluacion} detalle="las estamos viendo" icono={Search} tono="advertencia" href="/admin/sugerencias?estado=en_evaluacion" />
        <Indicador titulo="Planificadas" valor={r.planificadas} detalle="se van a hacer" icono={Sparkles} tono="neutro" href="/admin/sugerencias?estado=planificada" />
        <Indicador titulo="Hechas" valor={r.hechas} detalle="ya están en DIM360" icono={CircleCheck} tono="exito" href="/admin/sugerencias?estado=hecha" />
        <Indicador titulo="Descartadas" valor={r.descartadas} detalle="por ahora no" icono={CircleSlash} tono="neutro" href="/admin/sugerencias?estado=descartada" />
      </div>

      <BarraFiltros accion="/admin/sugerencias" limpiar="/admin/sugerencias">
        <div className="sm:col-span-2">
          <FiltroTexto nombre="q" etiqueta="Buscar" tipo="search" valor={busqueda} placeholder="SUG-0003, texto o relevador" />
        </div>
        <FiltroSelect nombre="estado" etiqueta="Estado" opciones={OPCIONES_ESTADO} valor={estado} />
        <FiltroSelect nombre="tipo" etiqueta="Tipo" opciones={TIPOS_SUGERENCIA.map((t) => ({ valor: t, etiqueta: NOMBRE_TIPO_SUGERENCIA[t] }))} valor={tipo} />
        <FiltroSelect nombre="modulo" etiqueta="Módulo" opciones={modulos} valor={modulo} />
      </BarraFiltros>
      <p className="text-sm text-texto-secundario">{total === 1 ? "1 sugerencia" : `${total} sugerencias`}</p>

      {filas.length === 0 ? (
        <EstadoVacio
          icono={Lightbulb}
          titulo={conFiltros ? "No hay sugerencias con estos filtros" : "Los relevadores todavía no dejaron sugerencias"}
          ayuda={conFiltros ? "Probá con otra búsqueda." : "Las escriben desde el portal, en «Sugerencias». Cuando llegue una, aparece acá."}
        />
      ) : (
        <ul className="space-y-3">
          {filas.map((s) => (
            <li key={s.numero}>
              <Tarjeta className={`p-4 ${s.estado === "nueva" ? "border-l-4 border-l-primario" : ""}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono font-bold text-primario-oscuro">{numeroSugerencia(s.numero)}</span>
                  <InsigniaEstadoSugerencia estado={s.estado} />
                  <InsigniaTipoSugerencia tipo={s.tipo} />
                  <span className="text-texto-secundario">
                    <strong className="text-texto">{s.relevador_nombre}</strong>
                    · {fechaHora(s.creada_at)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-texto-secundario">{s.modulo ? `${s.modulo_codigo} · ${s.modulo}` : "General"}</p>
                <h2 className="mt-2 leading-snug font-semibold">{s.titulo}</h2>
                <blockquote className="mt-2 border-l-2 border-borde pl-3 text-sm whitespace-pre-line">{s.detalle}</blockquote>
                {s.respuesta ? (
                  <div className="mt-3 rounded-control border border-info-borde bg-info-fondo p-3 text-sm">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-institucional">
                      <MessageSquareReply aria-hidden="true" className="size-3.5 text-primario" />
                      Respondió {s.respondida_por}
                      {s.respondida_at ? ` · ${fechaHora(s.respondida_at)}` : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-line">{s.respuesta}</p>
                  </div>
                ) : null}
                {puedeResponder ? (
                  <details className="mt-3 border-t border-borde pt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-primario-oscuro">
                      {s.respuesta ? "Cambiar el estado o la respuesta" : "Responder o cambiar el estado"}
                    </summary>
                    <div className="mt-3">
                      <FormRespuestaSugerencia numero={s.numero} estado={s.estado} respuesta={s.respuesta} />
                    </div>
                  </details>
                ) : null}
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
      <Paginacion pagina={pagina} total={total} porPagina={POR_PAGINA} base={aBusqueda(sp)} />
    </div>
  );
}
