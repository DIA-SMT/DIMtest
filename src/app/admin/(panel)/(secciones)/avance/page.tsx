import Link from "next/link";
import { ArrowDown, ArrowUp, CircleCheck, Gauge, RotateCcw, ShieldAlert, Target } from "lucide-react";
import { BarraResultados, EncabezadoPagina, EstadoVacio, Indicador, LeyendaResultados, Tarjeta, TituloSeccion } from "@/components/ui";
import { cambioSemanal, estimarSemanas } from "@/domain/avance";
import { CLASE_TABLA, CLASE_TD, CLASE_THEAD } from "@/features/admin/components/filtros";
import { avanceSemanal, enCaminoAFuncionar } from "@/features/avance/consultas";
import { GraficoSemanal, rangoSemana } from "@/features/avance/components/grafico-semanal";
import { estadoDePruebas, listarModulos, resumirPorModulo } from "@/features/relevamiento/servicio";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { porcentaje } from "@/lib/formato";

export const metadata = { title: "Avance de DIM360" };

/** «0 no funcionan, 1 parcial y 214 sin realizar»: solo lo que no es cero, en singular o plural. */
function detalleFaltan(h: { noFunciona: number; parcial: number; noProbado: number }, sinRealizar: number) {
  const partes = [
    h.noFunciona ? `${h.noFunciona} ${h.noFunciona === 1 ? "no funciona" : "no funcionan"}` : null,
    h.parcial ? `${h.parcial} ${h.parcial === 1 ? "parcial" : "parciales"}` : null,
    h.noProbado ? `${h.noProbado} ${h.noProbado === 1 ? "no se pudo probar" : "no se pudieron probar"}` : null,
    sinRealizar ? `${sinRealizar} sin realizar` : null,
  ].filter(Boolean);
  return partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}` : (partes[0] ?? "");
}

// Como CLASE_TH de los filtros, pero los títulos largos pueden ir en dos renglones para que la tabla entre.
const TH = "px-3 py-2.5 align-bottom font-semibold";

function Cambio({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-texto-secundario">—</span>;
  if (valor === 0) return <span className="text-texto-secundario">sin cambios</span>;
  const Icono = valor > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${valor > 0 ? "text-exito" : "text-error"}`}>
      <Icono aria-hidden="true" className="size-3.5" />
      {valor > 0 ? `+${valor}` : valor}
    </span>
  );
}

/** Cuánto le falta a DIM360 para funcionar al 100 %, y cómo viene semana a semana (solo el equipo). */
export default async function Avance() {
  await exigirAdmin("panel.ver");
  const { semanas, enCamino, modulos } = await conBase(async (q) => ({
    semanas: await avanceSemanal(q),
    enCamino: await enCaminoAFuncionar(q),
    modulos: resumirPorModulo(await listarModulos(q), await estadoDePruebas(q)),
  }));

  const encabezado = (
    <EncabezadoPagina
      antetitulo="Estado de DIM360"
      titulo="Avance hacia el 100 %"
      descripcion="Cuántas de las pruebas del checklist oficial funcionan hoy y cómo viene cambiando semana a semana. Cuenta el último resultado de cada prueba: el 100 % es que funcionen todas."
    />
  );
  if (!semanas.length) {
    return (
      <div className="space-y-6">
        {encabezado}
        <EstadoVacio icono={Gauge} titulo="Todavía no hay resultados" ayuda="El avance arranca con la primera prueba que registre un relevador." />
      </div>
    );
  }

  const hoy = semanas.at(-1)!;
  const faltan = hoy.total - hoy.funciona;
  const sinRealizar = hoy.total - hoy.funciona - hoy.parcial - hoy.noFunciona - hoy.noProbado;
  const cambio = cambioSemanal(semanas, semanas.length - 1);
  const estimacion = estimarSemanas(semanas);
  const porResultado = { funciona: hoy.funciona, parcial: hoy.parcial, no_funciona: hoy.noFunciona, no_probado: hoy.noProbado };
  const porModulo = [...modulos].sort((a, b) => a.porResultado.funciona / a.total - b.porResultado.funciona / b.total || b.total - a.total);

  return (
    <div className="space-y-6">
      {encabezado}

      <Tarjeta className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-2">
          <p className="text-sm text-texto-secundario">Funciona hoy</p>
          <p className="font-display text-6xl leading-none font-bold text-institucional tabular-nums">{porcentaje(hoy.funciona, hoy.total)} %</p>
          <p className="text-sm">
            <strong>{hoy.funciona}</strong> de {hoy.total} pruebas funcionan · {cambio === null ? "primera semana con resultados" : <>esta semana <Cambio valor={cambio} /></>}
          </p>
          <p className="text-sm text-texto-secundario">
            {estimacion === null
              ? "Con una sola semana de resultados todavía no se puede estimar cuándo llega al 100 %."
              : estimacion.semanasRestantes === 0
                ? "Ya funcionan todas las pruebas."
                : estimacion.semanasRestantes === null
                  ? `En ${estimacion.semanas === 1 ? "la última semana" : `las últimas ${estimacion.semanas} semanas`} no aumentaron las pruebas que funcionan: a este ritmo no se puede estimar cuándo llega al 100 %.`
                  : `Al ritmo de ${estimacion.semanas === 1 ? "la última semana" : `las últimas ${estimacion.semanas} semanas`} (${estimacion.ritmo.toLocaleString("es-AR")} pruebas más por semana), faltarían unas ${estimacion.semanasRestantes} semanas. Es una estimación: cambia con cada relevamiento.`}
          </p>
        </div>
        <div className="space-y-3 self-center">
          <BarraResultados total={hoy.total} porResultado={porResultado} etiqueta="Resultado actual de las pruebas" alta />
          <LeyendaResultados />
          <p className="text-sm">
            {faltan ? (
              <>
                <strong>Faltan {faltan}:</strong> {detalleFaltan(hoy, sinRealizar)}.
              </>
            ) : (
              <strong>Funcionan todas.</strong>
            )}
          </p>
        </div>
      </Tarjeta>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador titulo="Faltan" valor={faltan} detalle="pruebas que todavía no funcionan" icono={Target} tono="advertencia" href="/admin/pruebas?ultima=1" />
        <Indicador titulo="En camino" valor={enCamino} detalle="corregidas, esperan que la DIM las vuelva a probar" icono={RotateCcw} tono="info" href="/admin/incidencias?estado=corregida" />
        <Indicador titulo="Incidencias abiertas" valor={hoy.incidenciasAbiertas} detalle="todavía sin corregir" icono={ShieldAlert} tono="error" href="/admin/incidencias?estado=abiertas" />
        <Indicador titulo="Pasaron a funcionar" valor={hoy.pasaronAFuncionar} detalle={hoy.dejaronDeFuncionar ? `esta semana · ${hoy.dejaronDeFuncionar} dejaron de funcionar` : "esta semana"} icono={CircleCheck} tono="exito" />
      </div>

      <section aria-labelledby="titulo-grafico" className="space-y-3">
        <TituloSeccion id="titulo-grafico">Semana a semana</TituloSeccion>
        <Tarjeta className="space-y-5 p-5">
          <h3 className="font-display text-base font-bold text-institucional">Pruebas que funcionan</h3>
          <GraficoSemanal semanas={semanas} />
        </Tarjeta>

        <Tarjeta className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className={CLASE_TABLA}>
              <caption className="sr-only">Avance de DIM360 por semana, de la más reciente a la más antigua</caption>
              <thead className={CLASE_THEAD}>
                <tr>
                  <th scope="col" className={TH}>Semana</th>
                  <th scope="col" className={`${TH} text-right`}>Funcionan</th>
                  <th scope="col" className={`${TH} text-right`}>Pasaron a funcionar</th>
                  <th scope="col" className={`${TH} text-right`}>Dejaron de funcionar</th>
                  <th scope="col" className={`${TH} text-right`}>Incidencias nuevas</th>
                  <th scope="col" className={`${TH} text-right`}>Incidencias cerradas</th>
                  <th scope="col" className={`${TH} text-right`}>Abiertas al cierre</th>
                  <th scope="col" className={`${TH} text-right`}>Publicadas por el agente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {semanas
                  .map((s, k) => ({ s, k }))
                  .reverse()
                  .map(({ s, k }) => (
                    <tr key={s.inicio} className="hover:bg-fondo">
                      <th scope="row" className={`${CLASE_TD} text-left font-medium whitespace-nowrap`}>
                        {rangoSemana(s.inicio)}
                        {s.enCurso ? <span className="ml-1.5 text-xs font-normal text-texto-secundario">(en curso)</span> : null}
                      </th>
                      <td className={`${CLASE_TD} text-right whitespace-nowrap tabular-nums`}>
                        {s.funciona} <span className="text-texto-secundario">({porcentaje(s.funciona, s.total)} %)</span>
                        {k > 0 ? (
                          <span className="block text-xs">
                            <Cambio valor={cambioSemanal(semanas, k)} />
                          </span>
                        ) : null}
                      </td>
                      <td className={`${CLASE_TD} text-right tabular-nums`}>{s.pasaronAFuncionar || "—"}</td>
                      <td className={`${CLASE_TD} text-right tabular-nums`}>{s.dejaronDeFuncionar || "—"}</td>
                      <td className={`${CLASE_TD} text-right tabular-nums`}>{s.incidenciasNuevas || "—"}</td>
                      <td className={`${CLASE_TD} text-right tabular-nums`}>{s.incidenciasCerradas || "—"}</td>
                      <td className={`${CLASE_TD} text-right tabular-nums`}>{s.incidenciasAbiertas}</td>
                      <td className={`${CLASE_TD} text-right tabular-nums`}>{s.correccionesAgente || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      </section>

      <section aria-labelledby="titulo-modulos" className="space-y-3">
        <TituloSeccion id="titulo-modulos">Lo que falta por módulo</TituloSeccion>
        <p className="text-sm text-texto-secundario">Primero los módulos con menos pruebas funcionando.</p>
        <Tarjeta className="divide-y divide-borde">
          {porModulo.map((m) => {
            const faltanModulo = m.total - m.porResultado.funciona;
            return (
              <div key={m.codigo} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_10rem] sm:items-center sm:gap-4">
                <Link href={`/admin/pruebas?modulo=${m.codigo}&vista=catalogo`} className="text-sm font-medium hover:text-primario-oscuro hover:underline">
                  <span className="font-mono text-xs text-primario-oscuro">{m.codigo}</span> {m.nombre}
                </Link>
                <BarraResultados total={m.total} porResultado={m.porResultado} etiqueta={`Resultado de ${m.nombre}`} />
                <p className="text-sm whitespace-nowrap tabular-nums sm:text-right">
                  <strong>{porcentaje(m.porResultado.funciona, m.total)} %</strong>{" "}
                  <span className="text-texto-secundario">{faltanModulo ? `· faltan ${faltanModulo} de ${m.total}` : "· completo"}</span>
                </p>
              </div>
            );
          })}
        </Tarjeta>
      </section>
    </div>
  );
}
