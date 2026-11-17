import { ExternalLink, FileText } from "lucide-react";
import { CLASE_BOTON_COMPACTO } from "@/components/formulario";
import { tamanoArchivo } from "@/lib/formato";
import type { EvidenciaDetalle } from "../consultas";

/**
 * Las evidencias a la vista: las imágenes en miniatura (se abren en grande en otra pestaña) y
 * los PDF con una vista previa. Se sirven por /evidencias/<id>, que pide la sesión.
 */
export function GaleriaEvidencias({ evidencias }: { evidencias: EvidenciaDetalle[] }) {
  if (evidencias.length === 0) return <p className="text-sm text-texto-secundario">No adjuntó evidencias.</p>;
  const imagenes = evidencias.filter((v) => v.mime !== "application/pdf");
  const pdfs = evidencias.filter((v) => v.mime === "application/pdf");
  return (
    <div className="space-y-4">
      {imagenes.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {imagenes.map((v) => (
            <li key={v.id} className="overflow-hidden rounded-control border border-borde bg-fondo">
              <a
                href={`/evidencias/${v.id}`}
                target="_blank"
                rel="noopener"
                className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario"
              >
                {/* Imagen privada que sirve la app con sesión: next/image no puede optimizarla. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/evidencias/${v.id}`} alt={`Evidencia: ${v.nombre}`} loading="lazy" className="h-56 w-full bg-superficie object-contain" />
                <span className="flex items-center justify-between gap-2 border-t border-borde px-3 py-2 text-xs">
                  <span className="truncate font-semibold text-primario-oscuro group-hover:underline">{v.nombre}</span>
                  <span className="shrink-0 text-texto-secundario">{tamanoArchivo(v.tamano)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {pdfs.map((v) => (
        <div key={v.id} className="overflow-hidden rounded-control border border-borde bg-fondo">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <FileText aria-hidden="true" className="size-4 shrink-0 text-primario" />
              <span className="truncate font-semibold">{v.nombre}</span>
              <span className="shrink-0 text-xs text-texto-secundario">{tamanoArchivo(v.tamano)}</span>
            </span>
            <a href={`/evidencias/${v.id}`} target="_blank" rel="noopener" className={CLASE_BOTON_COMPACTO}>
              <ExternalLink aria-hidden="true" className="size-3.5" />
              Abrir en otra pestaña
            </a>
          </div>
          <iframe src={`/evidencias/${v.id}`} title={`Vista previa de ${v.nombre}`} className="hidden h-[36rem] w-full bg-superficie sm:block" />
          <p className="px-3 py-2 text-xs text-texto-secundario sm:hidden">En el celular, abrilo en otra pestaña para verlo.</p>
        </div>
      ))}
    </div>
  );
}
