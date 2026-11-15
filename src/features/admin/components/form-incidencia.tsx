"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { BotonEnviar, Campo, CLASE_CONTROL } from "@/components/formulario";
import { Aviso } from "@/components/ui";
import { AYUDA_PRIORIDAD, NOMBRE_PRIORIDAD, PRIORIDADES } from "@/domain/prioridades";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/accion";
import { crearIncidenciaAccion } from "../actions";
import type { Opcion } from "../consultas";

export interface DatosIniciales {
  prueba: string;
  ejecucion: string;
  descripcion: string;
  esperado: string;
  observado: string;
  prioridad: string;
}

export function FormIncidencia({ iniciales, pruebas, responsables }: { iniciales: DatosIniciales; pruebas: Opcion[] | null; responsables: Opcion[] }) {
  const [estado, crear] = useActionState<EstadoAccion, FormData>(crearIncidenciaAccion, ESTADO_INICIAL);
  const e = estado.errores ?? {};
  const v = { ...iniciales, ...(estado.valores ?? {}) };
  return (
    <form action={crear} className="space-y-5" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <input type="hidden" name="ejecucion" value={iniciales.ejecucion} />
      {pruebas ? (
        <Campo id="prueba" etiqueta="Prueba afectada" obligatorio error={e.prueba}>
          <select id="prueba" name="prueba" defaultValue={v.prueba} className={CLASE_CONTROL} required>
            <option value="">Elegí la prueba</option>
            {pruebas.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
      ) : (
        <input type="hidden" name="prueba" value={iniciales.prueba} />
      )}
      <Campo id="descripcion" etiqueta="Descripción del problema" obligatorio error={e.descripcion}>
        <textarea id="descripcion" name="descripcion" rows={3} maxLength={4000} defaultValue={v.descripcion} className={CLASE_CONTROL} required />
      </Campo>
      <div className="grid gap-5 md:grid-cols-2">
        <Campo id="esperado" etiqueta="Resultado esperado" error={e.esperado}>
          <textarea id="esperado" name="esperado" rows={3} maxLength={2000} defaultValue={v.esperado} className={CLASE_CONTROL} />
        </Campo>
        <Campo id="observado" etiqueta="Resultado observado" error={e.observado}>
          <textarea id="observado" name="observado" rows={3} maxLength={4000} defaultValue={v.observado} className={CLASE_CONTROL} />
        </Campo>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Campo id="prioridad" etiqueta="Prioridad" obligatorio error={e.prioridad} ayuda="La definitiva la decide el equipo; la del relevador es solo una sugerencia.">
          <select id="prioridad" name="prioridad" defaultValue={v.prioridad} className={CLASE_CONTROL} aria-describedby="prioridad-ayuda" required>
            <option value="">Elegí la prioridad</option>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {p} · {NOMBRE_PRIORIDAD[p]} — {AYUDA_PRIORIDAD[p]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="responsable" etiqueta="Responsable de la corrección">
          <select id="responsable" name="responsable" defaultValue="" className={CLASE_CONTROL}>
            <option value="">Sin asignar por ahora</option>
            {responsables.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <BotonEnviar enviando="Creando…">
        <Save aria-hidden="true" className="size-4" />
        Crear incidencia
      </BotonEnviar>
    </form>
  );
}
