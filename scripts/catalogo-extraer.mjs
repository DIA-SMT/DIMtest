// Extrae las 217 pruebas del checklist oficial de DIM360 (docs/fuentes/…pdf) y escribe
// src/domain/catalogo/catalogo-dim360.json, que la app carga sola en la base.
//
//   npm run catalogo:extraer            # vuelve a generar el JSON desde el PDF
//   npm run catalogo:extraer -- --ver   # además muestra cada prueba en la consola
//
// Se apoya en la posición de cada texto en la página (pdfjs-dist), no en el texto
// corrido: las columnas «Qué probar» y «Resultado esperado» comparten renglón y el
// texto corrido las mezcla. Las columnas se ubican por los encabezados de cada tabla.
//
// El JSON queda versionado: la app no lee el PDF en tiempo de ejecución. Si la DIM
// entrega una versión nueva del checklist, se reemplaza el PDF, se corre este script
// y se revisa el diff (los códigos de prueba nunca se renumeran).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PDF = path.join(RAIZ, "docs", "fuentes", "DIM360-checklist-prueba-funcional-2026-11-05.pdf");
const SALIDA = path.join(RAIZ, "src", "domain", "catalogo", "catalogo-dim360.json");
const VER = process.argv.includes("--ver");
// --verificar: no escribe; compara con el JSON versionado y falla si difiere o si no da 217.
const VERIFICAR = process.argv.includes("--verificar");

const RE_CODIGO = /^([A-Z]{2,4})-(\d{2})$/;
const RE_PERFIL = /^[COASP]$/;
const RE_CONTINUA = /\(contin[uú]a\)\s*$/;
const ETIQUETAS_RESULTADO = new Set(["Funciona", "No funciona", "Parcial", "No probado"]);

// Los tramos en negrita o cursiva llegan como textos aparte: al unirlos queda un espacio antes de la puntuación.
const limpiar = (s) =>
  s
    .replace(/\s+/g, " ")
    .replace(/ ([.,;:)])/g, "$1")
    .replace(/\( /g, "(")
    .trim();

/** Une renglones de una celda: corta palabras con guion y espacios dobles. */
function unirRenglones(renglones) {
  let texto = "";
  for (const r of renglones) {
    const t = limpiar(r);
    if (!t) continue;
    if (!texto) texto = t;
    else if (texto.endsWith("-") && !texto.endsWith(" -")) texto = texto.slice(0, -1) + t;
    else texto += " " + t;
  }
  return texto;
}

/** Agrupa ítems por renglón (misma y, con tolerancia) y ordena de arriba hacia abajo. */
function renglones(items, tolerancia = 2) {
  const ordenados = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const grupos = [];
  for (const it of ordenados) {
    const g = grupos.find((g) => Math.abs(g.y - it.y) <= tolerancia);
    if (g) g.items.push(it);
    else grupos.push({ y: it.y, items: [it] });
  }
  return grupos
    .sort((a, b) => b.y - a.y)
    .map((g) => g.items.sort((a, b) => a.x - b.x).map((i) => i.str).join(" "));
}

async function leerPaginas() {
  const datos = new Uint8Array(fs.readFileSync(PDF));
  const doc = await getDocument({ data: datos, useSystemFonts: true, isEvalSupported: false }).promise;
  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const contenido = await pagina.getTextContent();
    const items = contenido.items
      .filter((it) => "str" in it && it.str.trim() !== "")
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        ancho: it.width,
        alto: it.height || Math.abs(it.transform[3]),
      }));
    paginas.push({ numero: n, items });
  }
  return { paginas, total: doc.numPages };
}

/** Índice de la portada: nombre del módulo → cantidad de pruebas y página. */
function leerIndice(pagina) {
  const indice = [];
  for (const linea of renglones(pagina.items)) {
    for (const m of linea.matchAll(/([^·]+?)\s+(\d+)\s+·\s+pág\.\s+(\d+)/g)) {
      indice.push({ nombre: limpiar(m[1]), cantidad: Number(m[2]), pagina: Number(m[3]) });
    }
  }
  return indice;
}

/** Leyenda de perfiles de la portada: «C contribuyente O operador de la DIM …». */
function leerPerfiles(pagina) {
  const linea = renglones(pagina.items).find((l) => l.startsWith("Quién hace la prueba"));
  if (!linea) throw new Error("No encontré la leyenda de perfiles en la portada");
  const texto = linea.replace(/^Quién hace la prueba:\s*/, "");
  const perfiles = {};
  for (const m of texto.matchAll(/(?:^|\s)([COASP])\s+(.+?)(?=\s+[COASP]\s+|$)/g)) perfiles[m[1]] = limpiar(m[2]);
  return perfiles;
}

/**
 * «Lo que no entra en esta prueba» (última página): los renglones entre el párrafo
 * que termina en «Se prueban cuando se habiliten:» y las firmas. Cada exclusión
 * empieza con un rótulo que termina en «:»; los renglones sin rótulo continúan la anterior.
 */
function leerExclusiones(pagina) {
  const desde = pagina.items.find((it) => /Se prueban cuando se habiliten:/.test(it.str));
  const hasta = pagina.items.find((it) => /^Por la Dirección/.test(it.str.trim()));
  if (!desde || !hasta) throw new Error("No encontré «Lo que no entra en esta prueba» en la última página");
  const enRango = pagina.items.filter((it) => it.y < desde.y - 1 && it.y > hasta.y + 1);
  const grupos = [];
  for (const it of [...enRango].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const g = grupos.find((g) => Math.abs(g.y - it.y) <= 2);
    if (g) g.items.push(it);
    else grupos.push({ y: it.y, items: [it] });
  }
  const exclusiones = [];
  for (const g of grupos) {
    const items = g.items.sort((a, b) => a.x - b.x);
    const texto = items.map((i) => i.str).join(" ");
    const iRotulo = items.findIndex((it) => it.str.includes(":"));
    if (iRotulo >= 0) {
      const dosPuntos = texto.indexOf(":");
      exclusiones.push({ funcion: limpiar(texto.slice(0, dosPuntos)), motivo: limpiar(texto.slice(dosPuntos + 1)) });
    } else if (exclusiones.length) {
      const ultima = exclusiones.at(-1);
      ultima.motivo = limpiar(ultima.motivo + " " + items.map((i) => i.str).join(" "));
    }
  }
  for (const e of exclusiones) e.motivo = e.motivo.charAt(0).toUpperCase() + e.motivo.slice(1);
  return exclusiones;
}

function extraerPruebas(paginas, indice) {
  const nombresModulo = new Map(indice.map((m) => [m.nombre, m]));
  const modulos = [];
  const pruebas = [];
  let moduloActual = null;

  for (const pagina of paginas) {
    const items = pagina.items;
    // Pie y encabezado de página: fuera.
    const utiles = items.filter((it) => !/^(Noviembre de 2026|Municipalidad de San Miguel|DIM360 ·|Desarrollado por|Dirección de Inteligencia Artificial|Desarrollo de DIM360|Pruebas por módulo)/.test(it.str.trim()));

    // Encabezados de tabla: fijan las columnas (pueden repetirse si hay dos tablas en la página).
    const encabezados = utiles.filter((it) => it.str.trim() === "QUÉ PROBAR");
    if (encabezados.length === 0) continue;

    // Títulos de módulo: un renglón con el nombre del índice y «N pruebas», o «(continúa)».
    // «(continúa)» puede venir como un texto aparte en el mismo renglón del título.
    const titulos = [];
    for (const it of utiles) {
      const t = limpiar(it.str);
      const sinContinua = limpiar(t.replace(RE_CONTINUA, ""));
      if (nombresModulo.has(sinContinua)) {
        const continua =
          RE_CONTINUA.test(t) || utiles.some((o) => RE_CONTINUA.test(o.str) && Math.abs(o.y - it.y) < 3 && o.x > it.x);
        titulos.push({ nombre: sinContinua, y: it.y, continua });
      }
    }

    const codigos = utiles.filter((it) => RE_CODIGO.test(it.str.trim())).sort((a, b) => b.y - a.y);
    const enc = (it) => ({
      y: it.y,
      // Columnas: N.º (código) | QUÉ PROBAR | RESULTADO ESPERADO | RESULTADO | OBSERVACIONES
      xQue: it.x,
      xEsperado: utiles.find((o) => o.str.trim() === "RESULTADO ESPERADO" && Math.abs(o.y - it.y) < 3)?.x,
      xResultado: utiles
        .filter((o) => o.str.trim() === "RESULTADO" && Math.abs(o.y - it.y) < 3)
        .map((o) => o.x)
        .sort((a, b) => a - b)[0],
    });
    const tablas = encabezados.map(enc).sort((a, b) => b.y - a.y);
    for (const t of tablas) {
      if (t.xEsperado == null || t.xResultado == null) throw new Error(`Página ${pagina.numero}: no ubiqué las columnas`);
    }

    // Descripción del módulo: renglón entre el título y el encabezado de la tabla.
    for (const titulo of titulos.sort((a, b) => b.y - a.y)) {
      if (titulo.continua) {
        moduloActual = modulos.find((m) => m.nombre === titulo.nombre);
        continue;
      }
      const tabla = tablas.find((t) => t.y < titulo.y);
      const descripcion = renglones(
        utiles.filter(
          (it) =>
            it.y < titulo.y - 1 &&
            tabla &&
            it.y > tabla.y + 1 &&
            it.x < tabla.xResultado &&
            !/^(N\.º|OBSERVACIONES|CASO USADO|\d+ pruebas)$/.test(it.str.trim()),
        ),
      ).join(" ");
      const info = nombresModulo.get(titulo.nombre);
      const anterior = modulos.at(-1);
      moduloActual = {
        prefijo: null,
        nombre: titulo.nombre,
        descripcion: limpiar(descripcion),
        orden: modulos.length + 1,
        cantidadSegunPdf: info.cantidad,
        pagina: pagina.numero,
        _y: titulo.y,
      };
      if (anterior && anterior.nombre === moduloActual.nombre) throw new Error(`Módulo repetido: ${titulo.nombre}`);
      modulos.push(moduloActual);
    }

    // Cada código abre una fila que llega hasta el código siguiente (o el título siguiente).
    const cortes = [...codigos.map((c) => c.y), ...titulos.map((t) => t.y)].sort((a, b) => b - a);
    for (const cod of codigos) {
      // ¿A qué módulo pertenece? Al último título que esté por encima en la página;
      // si no hay ninguno, al módulo que venía de la página anterior.
      const tituloArriba = titulos.filter((t) => t.y > cod.y).sort((a, b) => a.y - b.y)[0];
      const modulo = tituloArriba ? modulos.find((m) => m.nombre === tituloArriba.nombre) : moduloActual;
      if (!modulo) throw new Error(`Página ${pagina.numero}: ${cod.str} sin módulo`);
      const tabla = tablas.filter((t) => t.y > cod.y).sort((a, b) => a.y - b.y)[0];
      if (!tabla) throw new Error(`Página ${pagina.numero}: ${cod.str} sin tabla`);

      // La fila va desde el renglón del código hasta el renglón del código (o título) siguiente.
      const siguiente = cortes.filter((y) => y < cod.y - 1).sort((a, b) => b - a)[0] ?? -Infinity;
      const enFila = (it) => it.y <= cod.y + 1.5 && it.y > siguiente + 1.5;

      const xCodigoMax = tabla.xQue - 2;
      const perfil = utiles.find((it) => RE_PERFIL.test(it.str.trim()) && it.x < xCodigoMax && it.y < cod.y && it.y > siguiente);
      const que = utiles.filter((it) => enFila(it) && it.x >= tabla.xQue - 2 && it.x < tabla.xEsperado - 2);
      const esperado = utiles.filter(
        (it) => enFila(it) && it.x >= tabla.xEsperado - 2 && it.x < tabla.xResultado - 2 && !ETIQUETAS_RESULTADO.has(it.str.trim()),
      );

      const m = RE_CODIGO.exec(cod.str.trim());
      if (modulo.prefijo == null) modulo.prefijo = m[1];
      else if (modulo.prefijo !== m[1]) throw new Error(`${cod.str}: prefijo distinto del módulo ${modulo.nombre} (${modulo.prefijo})`);

      pruebas.push({
        codigo: cod.str.trim(),
        modulo: modulo.prefijo,
        numero: Number(m[2]),
        perfil: perfil?.str.trim() ?? null,
        queProbar: unirRenglones(renglones(que)),
        resultadoEsperado: unirRenglones(renglones(esperado)),
        pagina: pagina.numero,
      });
    }
  }
  return { modulos, pruebas };
}

const { paginas, total } = await leerPaginas();
const indice = leerIndice(paginas[0]);
const perfiles = leerPerfiles(paginas[0]);
const exclusiones = leerExclusiones(paginas[total - 1]);
const { modulos, pruebas } = extraerPruebas(paginas, indice);

const catalogo = {
  fuente: path.basename(PDF),
  titulo: "DIM360: checklist de prueba funcional",
  fecha: "2026-11-05",
  totalSegunPdf: 217,
  perfiles,
  resultados: [
    { clave: "funciona", nombre: "Funciona", ayuda: "Se hizo la prueba y el resultado coincide con el esperado y con lo que muestra el sistema de origen." },
    { clave: "no_funciona", nombre: "No funciona", ayuda: "Da error, no deja hacerlo o el resultado no es el correcto. Anotar el caso y lo que se vio." },
    { clave: "parcial", nombre: "Parcial", ayuda: "Funciona con algunos casos y con otros no, o falta una parte del resultado. Anotar cuál." },
    { clave: "no_probado", nombre: "No probado", ayuda: "No se pudo probar (falta de datos, permisos o tiempo) o la DIM no lo usa. Anotar el motivo." },
  ],
  exclusiones,
  modulos: modulos.map((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== "_y"))),
  pruebas,
};

fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
fs.writeFileSync(SALIDA, JSON.stringify(catalogo, null, 2) + "\n");

if (VER) for (const p of pruebas) console.log(`${p.codigo} [${p.perfil}] ${p.queProbar}\n    → ${p.resultadoEsperado}`);
console.log(`Módulos: ${modulos.length} · Pruebas: ${pruebas.length} · Perfiles: ${Object.keys(perfiles).join("")} · Exclusiones: ${exclusiones.length}`);
for (const m of modulos) {
  const n = pruebas.filter((p) => p.modulo === m.prefijo).length;
  console.log(`${n === m.cantidadSegunPdf ? "ok " : "MAL"} ${m.prefijo.padEnd(4)} ${String(n).padStart(2)}/${m.cantidadSegunPdf}  ${m.nombre}`);
}
const bien = pruebas.length === catalogo.totalSegunPdf && modulos.every((m) => pruebas.filter((p) => p.modulo === m.prefijo).length === m.cantidadSegunPdf);
if (!bien) process.exitCode = 1;
console.log(bien ? "Control: OK, coincide con el índice del PDF." : "Control: NO coincide con el índice del PDF.");
console.log(VERIFICAR ? (process.exitCode ? "Verificación: FALLÓ" : "Verificación: el JSON versionado coincide con el PDF.") : `Escrito en ${path.relative(RAIZ, SALIDA)}`);
