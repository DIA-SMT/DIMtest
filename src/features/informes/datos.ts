// Arma cada informe como una tabla genérica (columnas + filas) que después se exporta
// a Excel o PDF. Siempre con el código original de cada prueba del documento DIM360.
import type { Consulta } from "@/lib/db";
import { ESTADOS_ACTIVOS, NOMBRE_ESTADO } from "@/domain/incidencias";
import { NOMBRE_PRIORIDAD, PRIORIDADES } from "@/domain/prioridades";
import { NOMBRE_RESULTADO, type Resultado } from "@/domain/resultados";
import { estadoDePruebas, listarModulos, resumirPorModulo } from "@/features/relevamiento/servicio";
import { NOMBRE_ESTADO_PRUEBA } from "@/domain/estado-prueba";
import { diasDesde, fechaHora } from "@/lib/fechas";
import { numeroIncidencia, porcentaje } from "@/lib/formato";
import type { EstadoIncidencia } from "@/domain/incidencias";
import type { Prioridad } from "@/domain/prioridades";

export interface Columna {
  clave: string;
  titulo: string;
  /** Ancho relativo (Excel: caracteres; PDF: proporción). */
  ancho: number;
}

export interface Informe {
  titulo: string;
  descripcion: string;
  columnas: Columna[];
  filas: Record<string, string | number>[];
  resumen: [string, string | number][];
}

export const TIPOS_INFORME = {
  realizadas: { titulo: "Pruebas realizadas", descripcion: "Todas las ejecuciones registradas, de la más nueva a la más vieja (el historial completo)." },
  pendientes: { titulo: "Pruebas pendientes", descripcion: "Pruebas del catálogo que todavía nadie ejecutó, y las que esperan una nueva validación." },
  fallidas: { titulo: "Pruebas fallidas", descripcion: "Pruebas cuyo último resultado es «No funciona» o «Parcial»." },
  observaciones: { titulo: "Observaciones recibidas", descripcion: "Todo lo que escribieron los relevadores, con su clasificación." },
  "correcciones-pendientes": { titulo: "Correcciones pendientes", descripcion: "Incidencias sin cerrar, de la más urgente a la menos urgente." },
  "correcciones-realizadas": { titulo: "Correcciones realizadas", descripcion: "Incidencias corregidas (pendientes de validar) y validadas y cerradas." },
  prioridades: { titulo: "Incidencias por prioridad", descripcion: "Todas las incidencias agrupadas por prioridad." },
  avance: { titulo: "Avance por módulo", descripcion: "Pruebas evaluadas y resultados de cada uno de los 22 módulos." },
} as const;
export type TipoInforme = keyof typeof TIPOS_INFORME;

export function esTipoInforme(v: string): v is TipoInforme {
  return v in TIPOS_INFORME;
}

const resultado = (r: string | null) => (r ? (NOMBRE_RESULTADO[r as Resultado] ?? r) : "—");

interface FilaInc {
  numero: number;
  prueba_codigo: string;
  modulo: string;
  que_probar: string;
  descripcion: string;
  reportada_por: string;
  reportada_at: Date;
  prioridad: Prioridad;
  estado: EstadoIncidencia;
  responsable: string | null;
  solucion_aplicada: string;
  cerrada_at: Date | null;
  actualizada_at: Date;
}

async function incidencias(q: Consulta, estados: string[] | null): Promise<FilaInc[]> {
  return q<FilaInc>(
    `select i.numero, i.prueba_codigo, m.nombre as modulo, p.que_probar, i.descripcion, i.reportada_por, i.reportada_at,
            i.prioridad, i.estado, u.nombre as responsable, i.solucion_aplicada, i.cerrada_at, i.actualizada_at
       from incidencias i join pruebas p on p.codigo = i.prueba_codigo join modulos m on m.codigo = p.modulo_codigo
       left join usuarios_admin u on u.id = i.responsable_id
      where ($1::text[] is null or i.estado = any($1))
      order by i.prioridad, i.reportada_at, i.numero`,
    [estados],
  );
}

const COLS_INCIDENCIA: Columna[] = [
  { clave: "numero", titulo: "Incidencia", ancho: 11 },
  { clave: "prioridad", titulo: "Prioridad", ancho: 11 },
  { clave: "codigo", titulo: "Código", ancho: 9 },
  { clave: "modulo", titulo: "Módulo", ancho: 22 },
  { clave: "descripcion", titulo: "Descripción", ancho: 44 },
  { clave: "reporto", titulo: "Reportó", ancho: 18 },
  { clave: "responsable", titulo: "Responsable", ancho: 18 },
  { clave: "estado", titulo: "Estado", ancho: 20 },
  { clave: "dias", titulo: "Días", ancho: 6 },
];

function filaIncidencia(i: FilaInc) {
  return {
    numero: numeroIncidencia(i.numero),
    prioridad: `${i.prioridad} · ${NOMBRE_PRIORIDAD[i.prioridad]}`,
    codigo: i.prueba_codigo,
    modulo: i.modulo,
    descripcion: i.descripcion,
    reporto: i.reportada_por,
    responsable: i.responsable ?? "Sin asignar",
    estado: NOMBRE_ESTADO[i.estado],
    dias: diasDesde(i.reportada_at),
    solucion: i.solucion_aplicada || "—",
    cerrada: i.cerrada_at ? fechaHora(i.cerrada_at) : "—",
  };
}

export async function armarInforme(q: Consulta, tipo: TipoInforme): Promise<Informe> {
  const base = TIPOS_INFORME[tipo];

  if (tipo === "realizadas" || tipo === "observaciones") {
    const filas = await q<{
      numero: number;
      prueba_codigo: string;
      modulo: string;
      que_probar: string;
      relevador_nombre: string;
      creada_at: Date;
      resultado: string;
      observaciones: string;
      caso_usado: string;
      es_revalidacion: boolean;
      clasificacion: string;
      incidencia: number | null;
    }>(
      `select e.numero, e.prueba_codigo, m.nombre as modulo, p.que_probar, e.relevador_nombre, e.creada_at, e.resultado,
              e.observaciones, e.caso_usado, e.es_revalidacion, coalesce(r.clasificacion, 'sin_revisar') as clasificacion, i.numero as incidencia
         from ejecuciones e join pruebas p on p.codigo = e.prueba_codigo join modulos m on m.codigo = p.modulo_codigo
         left join revisiones_observacion r on r.ejecucion_id = e.id left join incidencias i on i.id = r.incidencia_id
        where ($1::boolean is false or btrim(e.observaciones) <> '')
        order by e.creada_at desc, e.numero desc`,
      [tipo === "observaciones"],
    );
    const clasif = (c: string, n: number | null) =>
      c === "incidencia" && n ? `Incidencia ${numeroIncidencia(n)}` : c === "informativa" ? "Informativa" : "Sin revisar";
    return {
      ...base,
      columnas: [
        { clave: "codigo", titulo: "Código", ancho: 9 },
        { clave: "modulo", titulo: "Módulo", ancho: 22 },
        { clave: "funcion", titulo: "Función", ancho: 36 },
        { clave: "relevador", titulo: "Relevador", ancho: 18 },
        { clave: "fecha", titulo: "Fecha", ancho: 16 },
        { clave: "resultado", titulo: "Resultado", ancho: 12 },
        { clave: "observaciones", titulo: "Observaciones", ancho: 44 },
        { clave: "caso", titulo: "Caso usado", ancho: 18 },
        ...(tipo === "observaciones" ? [{ clave: "clasificacion", titulo: "Clasificación", ancho: 18 }] : [{ clave: "tipo", titulo: "Tipo", ancho: 14 }]),
      ],
      filas: filas.map((f) => ({
        codigo: f.prueba_codigo,
        modulo: f.modulo,
        funcion: f.que_probar,
        relevador: f.relevador_nombre,
        fecha: fechaHora(f.creada_at),
        resultado: resultado(f.resultado),
        observaciones: f.observaciones || "—",
        caso: f.caso_usado || "—",
        clasificacion: clasif(f.clasificacion, f.incidencia),
        tipo: f.es_revalidacion ? "Revalidación" : "Evaluación",
      })),
      resumen: [
        [tipo === "observaciones" ? "Observaciones" : "Ejecuciones", filas.length],
        ["Pruebas distintas", new Set(filas.map((f) => f.prueba_codigo)).size],
        ["Relevadores", new Set(filas.map((f) => f.relevador_nombre)).size],
      ],
    };
  }

  if (tipo === "pendientes" || tipo === "fallidas") {
    const filas = (await estadoDePruebas(q)).filter((f) =>
      tipo === "pendientes" ? f.ejecuciones === 0 || f.estado === "revalidar" : f.ultima?.resultado === "no_funciona" || f.ultima?.resultado === "parcial",
    );
    const modulos = new Map((await listarModulos(q)).map((m) => [m.codigo, m.nombre]));
    return {
      ...base,
      columnas: [
        { clave: "codigo", titulo: "Código", ancho: 9 },
        { clave: "modulo", titulo: "Módulo", ancho: 24 },
        { clave: "perfil", titulo: "Perfil", ancho: 7 },
        { clave: "funcion", titulo: "Qué probar", ancho: 40 },
        { clave: "esperado", titulo: "Resultado esperado", ancho: 40 },
        ...(tipo === "pendientes"
          ? [{ clave: "estado", titulo: "Estado", ancho: 18 }]
          : [
              { clave: "resultado", titulo: "Último resultado", ancho: 13 },
              { clave: "relevador", titulo: "Relevador", ancho: 18 },
              { clave: "fecha", titulo: "Fecha", ancho: 16 },
              { clave: "observaciones", titulo: "Observaciones", ancho: 40 },
            ]),
      ],
      filas: filas.map((f) => ({
        codigo: f.codigo,
        modulo: modulos.get(f.moduloCodigo) ?? f.moduloCodigo,
        perfil: f.perfil,
        funcion: f.queProbar,
        esperado: f.resultadoEsperado,
        estado: NOMBRE_ESTADO_PRUEBA[f.estado],
        resultado: resultado(f.ultima?.resultado ?? null),
        relevador: f.ultima?.relevador ?? "—",
        fecha: f.ultima ? fechaHora(f.ultima.fecha) : "—",
        observaciones: f.ultima?.observaciones || "—",
      })),
      resumen:
        tipo === "pendientes"
          ? [
              ["Sin ejecutar", filas.filter((f) => f.ejecuciones === 0).length],
              ["Para revalidar", filas.filter((f) => f.estado === "revalidar").length],
            ]
          : [
              ["No funciona", filas.filter((f) => f.ultima?.resultado === "no_funciona").length],
              ["Parcial", filas.filter((f) => f.ultima?.resultado === "parcial").length],
            ],
    };
  }

  if (tipo === "correcciones-pendientes" || tipo === "correcciones-realizadas" || tipo === "prioridades") {
    const estados = tipo === "correcciones-pendientes" ? [...ESTADOS_ACTIVOS] : tipo === "correcciones-realizadas" ? ["corregida", "cerrada"] : null;
    const filas = await incidencias(q, estados);
    const columnas =
      tipo === "correcciones-realizadas"
        ? [...COLS_INCIDENCIA.filter((c) => c.clave !== "dias"), { clave: "solucion", titulo: "Solución aplicada", ancho: 40 }, { clave: "cerrada", titulo: "Cerrada", ancho: 16 }]
        : COLS_INCIDENCIA;
    return {
      ...base,
      columnas,
      filas: filas.map(filaIncidencia),
      resumen: PRIORIDADES.map((p) => [`${p} · ${NOMBRE_PRIORIDAD[p]}`, filas.filter((f) => f.prioridad === p).length] as [string, number]),
    };
  }

  // Avance por módulo
  const resumen = resumirPorModulo(await listarModulos(q), await estadoDePruebas(q));
  const tot = (k: keyof (typeof resumen)[number]["porResultado"]) => resumen.reduce((a, m) => a + m.porResultado[k], 0);
  const total = resumen.reduce((a, m) => a + m.total, 0);
  const evaluadas = resumen.reduce((a, m) => a + m.realizadas, 0);
  return {
    ...base,
    columnas: [
      { clave: "codigo", titulo: "Código", ancho: 8 },
      { clave: "modulo", titulo: "Módulo", ancho: 40 },
      { clave: "total", titulo: "Pruebas", ancho: 9 },
      { clave: "evaluadas", titulo: "Evaluadas", ancho: 10 },
      { clave: "avance", titulo: "Avance", ancho: 9 },
      { clave: "funciona", titulo: "Funciona", ancho: 10 },
      { clave: "parcial", titulo: "Parcial", ancho: 9 },
      { clave: "no_funciona", titulo: "No funciona", ancho: 11 },
      { clave: "no_probado", titulo: "No probado", ancho: 11 },
      { clave: "revalidar", titulo: "Para revalidar", ancho: 12 },
    ],
    filas: resumen.map((m) => ({
      codigo: m.codigo,
      modulo: m.nombre,
      total: m.total,
      evaluadas: m.realizadas,
      avance: `${porcentaje(m.realizadas, m.total)} %`,
      funciona: m.porResultado.funciona,
      parcial: m.porResultado.parcial,
      no_funciona: m.porResultado.no_funciona,
      no_probado: m.porResultado.no_probado,
      revalidar: m.porEstado.revalidar,
    })),
    resumen: [
      ["Pruebas del catálogo", total],
      ["Evaluadas", `${evaluadas} (${porcentaje(evaluadas, total)} %)`],
      ["Funciona", tot("funciona")],
      ["Parcial", tot("parcial")],
      ["No funciona", tot("no_funciona")],
      ["No probado", tot("no_probado")],
    ],
  };
}
