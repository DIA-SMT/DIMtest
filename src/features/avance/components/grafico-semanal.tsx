import type { SemanaAvance } from "@/domain/avance";
import { porcentaje } from "@/lib/formato";

const MARCAS = [100, 75, 50, 25, 0];

/** 2026-11-16 → 16/11 */
export const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** 2026-11-16 → «16/11 al 22/11» */
export function rangoSemana(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return `${diaMes(iso)} al ${diaMes(d.toISOString().slice(0, 10))}`;
}

/**
 * Columnas: el porcentaje de pruebas que funcionaban al cierre de cada semana (una sola serie,
 * en el verde de «Funciona»). La semana en curso va más clara porque todavía no cerró. El
 * detalle de cada columna está en su tooltip y en la tabla de abajo.
 */
export function GraficoSemanal({ semanas }: { semanas: SemanaAvance[] }) {
  const ultima = semanas.length - 1;
  return (
    <figure className="space-y-2">
      <div className="flex gap-2">
        {/* Eje Y: porcentaje, con líneas finas y recesivas. */}
        <div aria-hidden="true" className="relative h-56 w-9 shrink-0 text-right text-[11px] text-texto-secundario tabular-nums">
          {MARCAS.map((m) => (
            <span key={m} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - m}%` }}>
              {m} %
            </span>
          ))}
        </div>
        <div className="relative h-56 min-w-0 flex-1">
          {MARCAS.map((m) => (
            <span key={m} aria-hidden="true" className="absolute inset-x-0 border-t border-borde" style={{ top: `${100 - m}%` }} />
          ))}
          <ol className="relative flex h-full items-end gap-0.5">
            {semanas.map((s, k) => {
              const pct = s.total ? (s.funciona / s.total) * 100 : 0;
              const texto = `Semana del ${rangoSemana(s.inicio)}${s.enCurso ? " (en curso)" : ""}: ${s.funciona} de ${s.total} pruebas funcionan (${porcentaje(s.funciona, s.total)} %)`;
              return (
                <li key={s.inicio} title={texto} className="group relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center hover:bg-superficie-azul/60">
                  <span className="sr-only">{texto}</span>
                  {k === ultima ? (
                    <span aria-hidden="true" className="absolute -translate-y-full pb-1 text-xs font-bold text-institucional tabular-nums" style={{ bottom: `${pct}%` }}>
                      {porcentaje(s.funciona, s.total)} %
                    </span>
                  ) : null}
                  <span
                    aria-hidden="true"
                    className={`w-full max-w-6 rounded-t-[4px] ${s.enCurso ? "bg-exito-solido/55" : "bg-exito-solido"}`}
                    style={{ height: `${pct}%`, minHeight: s.funciona ? 2 : 0 }}
                  />
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {/* Eje X: el lunes de cada semana. Con muchas semanas, una etiqueta cada tanto. */}
      <ol aria-hidden="true" className="ml-11 flex gap-0.5 text-[11px] text-texto-secundario">
        {semanas.map((s, k) => {
          const salto = Math.ceil(semanas.length / 8);
          const mostrar = k === ultima || (k % salto === 0 && ultima - k >= salto);
          return (
            <li key={s.inicio} className="min-w-0 flex-1 text-center whitespace-nowrap">
              {mostrar ? (s.enCurso ? "Esta semana" : diaMes(s.inicio)) : ""}
            </li>
          );
        })}
      </ol>
      <figcaption className="text-xs text-texto-secundario">
        Porcentaje de las {semanas.at(-1)?.total ?? 0} pruebas cuyo último resultado al cierre de cada semana (lunes a domingo) era «Funciona». La semana en curso, más clara, cuenta
        hasta hoy.
      </figcaption>
    </figure>
  );
}
