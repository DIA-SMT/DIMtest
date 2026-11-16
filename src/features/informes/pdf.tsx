// El Image de react-pdf no admite texto alternativo: se importa con otro nombre para que la
// regla de accesibilidad de <img> no lo confunda con una imagen de la web.
import fs from "node:fs";
import path from "node:path";
import { Document, Font, Image as ImagenPdf, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { fechaHora } from "@/lib/fechas";
import type { EvidenciaInforme, Informe } from "./datos";
import { urlEvidencia } from "./excel";

/** Tope de imágenes en el anexo, para que el PDF no pese decenas de MB. Las demás van como enlace. */
export const MAX_IMAGENES_PDF = 150;
const ES_IMAGEN = new Set(["image/jpeg", "image/png", "image/webp"]);

// Sin cortes de palabras con guion (las reglas por defecto son del inglés).
Font.registerHyphenationCallback((palabra) => [palabra]);

const COLOR = {
  institucional: "#0f2f5d",
  primario: "#0066ff",
  celeste: "#2eb1ff",
  amarillo: "#f4dc00",
  texto: "#172b4d",
  gris: "#5f6878",
  linea: "#dce3ec",
  fondo: "#f4f7fb",
};

const e = StyleSheet.create({
  pagina: { paddingTop: 70, paddingBottom: 46, paddingHorizontal: 32, fontFamily: "Helvetica", fontSize: 8, color: COLOR.texto },
  banda: { position: "absolute", top: 0, left: 0, right: 0, height: 52, backgroundColor: COLOR.institucional, flexDirection: "row", alignItems: "center", paddingHorizontal: 32 },
  filete: { position: "absolute", top: 52, left: 0, right: 0, height: 3, flexDirection: "row" },
  tituloBanda: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 13, marginLeft: 14 },
  subBanda: { color: "#c7d6eb", fontSize: 8, marginLeft: 14, marginTop: 2 },
  descripcion: { fontSize: 9, color: COLOR.gris, marginBottom: 10 },
  resumen: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  dato: { borderWidth: 1, borderColor: COLOR.linea, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8, marginRight: 6, marginBottom: 4 },
  datoValor: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  datoEtiqueta: { fontSize: 7, color: COLOR.gris },
  cabecera: { flexDirection: "row", backgroundColor: COLOR.institucional, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR.linea },
  celda: { paddingVertical: 4, paddingHorizontal: 4 },
  pie: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: COLOR.gris },
  vacio: { padding: 12, color: COLOR.gris },
  anexoTitulo: { fontFamily: "Helvetica-Bold", fontSize: 12, color: COLOR.institucional, marginBottom: 4 },
  grupoTitulo: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginTop: 10,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.linea,
  },
  imagenes: { flexDirection: "row", flexWrap: "wrap" },
  imagenCaja: { width: 250, marginRight: 8, marginBottom: 8, borderWidth: 0.5, borderColor: COLOR.linea, borderRadius: 4, padding: 4 },
  imagen: { width: "100%", height: 170, objectFit: "contain" },
  pieImagen: { fontSize: 7, color: COLOR.primario, marginTop: 3 },
  enlace: { fontSize: 8, color: COLOR.primario, marginBottom: 2 },
});

function logo(): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", "marca", "logo-smt-neg.png"));
  } catch {
    return null;
  }
}

/** Banda, filete y pie de cada página. */
function Marco({ titulo, imagen }: { titulo: string; imagen: Buffer | null }) {
  return (
    <>
      <View style={e.banda} fixed>
        {imagen ? <ImagenPdf src={imagen} style={{ height: 26, width: 80 }} /> : null}
        <View>
          <Text style={e.tituloBanda}>DIM360 · {titulo}</Text>
          <Text style={e.subBanda}>Municipalidad de San Miguel de Tucumán · Dirección de Impuestos Municipales</Text>
        </View>
      </View>
      <View style={e.filete} fixed>
        <View style={{ flex: 46, backgroundColor: COLOR.primario }} />
        <View style={{ flex: 32, backgroundColor: COLOR.celeste }} />
        <View style={{ flex: 22, backgroundColor: COLOR.amarillo }} />
      </View>
      <View style={e.pie} fixed>
        <Text>Desarrollado por la Dirección de Inteligencia Artificial</Text>
        <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </View>
    </>
  );
}

interface GrupoAnexo {
  titulo: string;
  archivos: (EvidenciaInforme & { imagen: Buffer | null })[];
}

/** Imágenes por renglón del anexo (A4 apaisado: 3 cajas de 250 pt). */
const POR_RENGLON = 3;

/**
 * Las evidencias de una fila. El título va pegado al primer renglón de imágenes (o a los
 * enlaces), así nunca queda solo al pie de una página.
 */
function GrupoEvidencias({ grupo, base }: { grupo: GrupoAnexo; base: string }) {
  const imagenes = grupo.archivos.filter((a) => a.imagen);
  const enlaces = grupo.archivos.filter((a) => !a.imagen);
  const renglones = Array.from({ length: Math.ceil(imagenes.length / POR_RENGLON) }, (_, i) =>
    imagenes.slice(i * POR_RENGLON, (i + 1) * POR_RENGLON),
  );
  const titulo = <Text style={e.grupoTitulo}>{grupo.titulo}</Text>;
  const listaEnlaces = enlaces.map((a) => (
    <Link key={a.id} src={urlEvidencia(base, a.id)} style={e.enlace}>
      {ES_IMAGEN.has(a.mime) ? "Imagen" : "Documento PDF"}: {a.nombre} (abrir en el panel)
    </Link>
  ));
  if (renglones.length === 0) {
    return (
      <View wrap={false}>
        {titulo}
        {listaEnlaces}
      </View>
    );
  }
  return (
    <View>
      {renglones.map((renglon, r) => (
        <View key={r} wrap={false}>
          {r === 0 ? titulo : null}
          <View style={e.imagenes}>
            {renglon.map((a) => (
              <View key={a.id} style={e.imagenCaja}>
                <ImagenPdf src={a.imagen!} style={e.imagen} />
                <Link src={urlEvidencia(base, a.id)} style={e.pieImagen}>
                  {a.nombre}
                </Link>
              </View>
            ))}
          </View>
        </View>
      ))}
      {listaEnlaces}
    </View>
  );
}

interface PropsDocumento {
  informe: Informe;
  generado: Date;
  imagen: Buffer | null;
  anexo: GrupoAnexo[];
  base: string;
  omitidas: number;
}

function DocumentoInforme({ informe, generado, imagen, anexo, base, omitidas }: PropsDocumento) {
  const total = informe.columnas.reduce((a, c) => a + c.ancho, 0);
  return (
    <Document title={`DIM360 · ${informe.titulo}`} author="Dirección de Inteligencia Artificial" language="es-AR">
      <Page size="A4" orientation="landscape" style={e.pagina}>
        <Marco titulo={informe.titulo} imagen={imagen} />

        <Text style={e.descripcion}>
          {`${informe.descripcion} Generado el ${fechaHora(generado)} (hora de Tucumán).${anexo.length ? " Las evidencias adjuntas están en el anexo, al final." : ""}`}
        </Text>
        <View style={e.resumen}>
          {informe.resumen.map(([etiqueta, valor]) => (
            <View key={etiqueta} style={e.dato}>
              <Text style={e.datoValor}>{String(valor)}</Text>
              <Text style={e.datoEtiqueta}>{etiqueta}</Text>
            </View>
          ))}
        </View>

        <View style={e.cabecera} fixed>
          {informe.columnas.map((c) => (
            <Text key={c.clave} style={[e.celda, { width: `${(c.ancho / total) * 100}%` }]}>
              {c.titulo}
            </Text>
          ))}
        </View>
        {informe.filas.length === 0 ? <Text style={e.vacio}>No hay datos para este informe.</Text> : null}
        {informe.filas.map((f, i) => (
          <View key={i} style={[e.fila, i % 2 === 1 ? { backgroundColor: COLOR.fondo } : {}]} wrap={false}>
            {informe.columnas.map((c) => (
              <Text key={c.clave} style={[e.celda, { width: `${(c.ancho / total) * 100}%` }]}>
                {String(f[c.clave] ?? "")}
              </Text>
            ))}
          </View>
        ))}
      </Page>

      {anexo.length ? (
        <Page size="A4" orientation="landscape" style={e.pagina}>
          <Marco titulo={`${informe.titulo} · Anexo`} imagen={imagen} />
          <Text style={e.anexoTitulo}>Anexo · Evidencias</Text>
          <Text style={e.descripcion}>
            Las imágenes adjuntas, agrupadas por fila del informe. Los PDF adjuntos van como enlace: abren en el panel y piden ingresar con tu
            cuenta.
            {omitidas ? ` Se incluyen las primeras ${MAX_IMAGENES_PDF} imágenes; las otras ${omitidas} también van como enlace.` : ""}
          </Text>
          {anexo.map((g, i) => (
            <GrupoEvidencias key={i} grupo={g} base={base} />
          ))}
        </Page>
      ) : null}
    </Document>
  );
}

/** Reduce una foto para el anexo: 1200 px como máximo y JPEG (react-pdf no lee WebP). */
async function paraPdf(datos: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(datos)
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();
}

/** Carga las imágenes del anexo de a 4, hasta MAX_IMAGENES_PDF. Si una no se puede leer, queda como enlace. */
async function armarAnexo(informe: Informe, leer: (ruta: string) => Promise<Buffer>) {
  const grupos = (informe.evidencias ?? []).filter((g) => g.archivos.length > 0);
  const imagenes = grupos.flatMap((g) => g.archivos).filter((a) => ES_IMAGEN.has(a.mime));
  const pendientes = imagenes.slice(0, MAX_IMAGENES_PDF);
  const cargadas = new Map<string, Buffer>();
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let ev = pendientes.shift(); ev; ev = pendientes.shift()) {
        const datos = await leer(ev.ruta)
          .then(paraPdf)
          .catch(() => null);
        if (datos) cargadas.set(ev.id, datos);
      }
    }),
  );
  const anexo: GrupoAnexo[] = grupos.map((g) => ({
    titulo: g.titulo,
    archivos: g.archivos.map((a) => ({ ...a, imagen: cargadas.get(a.id) ?? null })),
  }));
  return { anexo, omitidas: Math.max(0, imagenes.length - MAX_IMAGENES_PDF) };
}

/**
 * El informe en PDF. Si tiene evidencias, suma al final un anexo con las imágenes.
 * `leer` trae cada archivo del almacén (en los tests, uno de mentira).
 */
export async function generarPdf(
  informe: Informe,
  generado: Date,
  { base, leer }: { base: string; leer: (ruta: string) => Promise<Buffer> },
): Promise<Buffer> {
  const { anexo, omitidas } = await armarAnexo(informe, leer);
  return renderToBuffer(
    <DocumentoInforme informe={informe} generado={generado} imagen={logo()} anexo={anexo} base={base} omitidas={omitidas} />,
  );
}
