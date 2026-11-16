import ExcelJS from "exceljs";
import { fechaHora } from "@/lib/fechas";
import type { Informe } from "./datos";

const AZUL_INSTITUCIONAL = "FF0F2F5D";
const BLANCO = "FFFFFFFF";
const TEXTO = "FF172B4D";
const GRIS = "FF5F6878";
const FONDO = "FFF4F7FB";
const ENLACE = "FF0047C2";

/** Dirección de una evidencia en el panel: pide la sesión del equipo para abrirla. */
export const urlEvidencia = (base: string, id: string) => `${base.replace(/\/$/, "")}/evidencias/${id}`;

/**
 * Una hoja con el encabezado institucional, la tabla filtrable y el resumen debajo. Si el
 * informe tiene evidencias, suma una columna por archivo con el enlace para abrirlo.
 */
export async function generarExcel(informe: Informe, generado: Date, { base }: { base: string }): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "DIM360 QA · Dirección de Inteligencia Artificial";
  libro.title = informe.titulo;
  libro.created = generado;
  const hoja = libro.addWorksheet(informe.titulo.slice(0, 31), { views: [{ state: "frozen", ySplit: 5 }] });

  const maxArchivos = Math.max(0, ...(informe.evidencias ?? []).map((e) => e.archivos.length));
  const enlaces = Array.from({ length: maxArchivos }, (_, i) => ({ clave: `evidencia_${i + 1}`, titulo: `Evidencia ${i + 1}`, ancho: 26 }));
  const columnas = [...informe.columnas, ...enlaces];
  hoja.columns = columnas.map((c) => ({ key: c.clave, width: c.ancho }));
  const ultimaCol = columnas.length;

  hoja.mergeCells(1, 1, 1, ultimaCol);
  hoja.getCell(1, 1).value = `DIM360 · ${informe.titulo}`;
  hoja.getCell(1, 1).font = { bold: true, size: 14, color: { argb: TEXTO } };
  hoja.mergeCells(2, 1, 2, ultimaCol);
  hoja.getCell(2, 1).value = `Municipalidad de San Miguel de Tucumán · Dirección de Impuestos Municipales. ${informe.descripcion}`;
  hoja.getCell(2, 1).font = { size: 10, color: { argb: GRIS } };
  hoja.mergeCells(3, 1, 3, ultimaCol);
  hoja.getCell(3, 1).value =
    `Generado el ${fechaHora(generado)} (hora de Tucumán) · ${informe.filas.length} filas` +
    (maxArchivos ? " · Los enlaces de las evidencias abren el archivo en el panel y piden ingresar con tu cuenta." : "");
  hoja.getCell(3, 1).font = { size: 10, color: { argb: GRIS } };

  const encabezado = hoja.getRow(5);
  columnas.forEach((c, i) => {
    const celda = encabezado.getCell(i + 1);
    celda.value = c.titulo;
    celda.font = { bold: true, color: { argb: BLANCO } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_INSTITUCIONAL } };
    celda.alignment = { vertical: "middle", wrapText: true };
  });
  encabezado.height = 22;

  informe.filas.forEach((f, i) => {
    const fila = hoja.getRow(6 + i);
    informe.columnas.forEach((c, j) => {
      const celda = fila.getCell(j + 1);
      celda.value = f[c.clave] ?? "";
      celda.alignment = { vertical: "top", wrapText: true };
      if (i % 2 === 1) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FONDO } };
    });
    (informe.evidencias?.[i]?.archivos ?? []).forEach((ev, k) => {
      const celda = fila.getCell(informe.columnas.length + k + 1);
      celda.value = { text: ev.nombre, hyperlink: urlEvidencia(base, ev.id), tooltip: "Abrir en el panel" };
      celda.font = { color: { argb: ENLACE }, underline: true };
      celda.alignment = { vertical: "top", wrapText: true };
      if (i % 2 === 1) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FONDO } };
    });
  });
  if (informe.filas.length) {
    hoja.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + informe.filas.length, column: ultimaCol } };
  }

  let r = 7 + informe.filas.length;
  hoja.getCell(r, 1).value = "Resumen";
  hoja.getCell(r, 1).font = { bold: true, color: { argb: TEXTO } };
  for (const [etiqueta, valor] of informe.resumen) {
    r++;
    hoja.getCell(r, 1).value = etiqueta;
    hoja.getCell(r, 2).value = valor;
    hoja.getCell(r, 2).font = { bold: true };
  }
  hoja.getCell(r + 2, 1).value = "Desarrollado por la Dirección de Inteligencia Artificial";
  hoja.getCell(r + 2, 1).font = { size: 9, color: { argb: GRIS } };

  return Buffer.from(await libro.xlsx.writeBuffer());
}
