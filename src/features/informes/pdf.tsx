// El Image de react-pdf no admite texto alternativo: se importa con otro nombre para que la
// regla de accesibilidad de <img> no lo confunda con una imagen de la web.
import fs from "node:fs";
import path from "node:path";
import { Document, Font, Image as ImagenPdf, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { fechaHora } from "@/lib/fechas";
import type { Informe } from "./datos";

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
});

function logo(): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", "marca", "logo-smt-neg.png"));
  } catch {
    return null;
  }
}

function DocumentoInforme({ informe, generado, imagen }: { informe: Informe; generado: Date; imagen: Buffer | null }) {
  const total = informe.columnas.reduce((a, c) => a + c.ancho, 0);
  return (
    <Document title={`DIM360 · ${informe.titulo}`} author="Dirección de Inteligencia Artificial" language="es-AR">
      <Page size="A4" orientation="landscape" style={e.pagina}>
        <View style={e.banda} fixed>
          {imagen ? <ImagenPdf src={imagen} style={{ height: 26, width: 80 }} /> : null}
          <View>
            <Text style={e.tituloBanda}>DIM360 · {informe.titulo}</Text>
            <Text style={e.subBanda}>Municipalidad de San Miguel de Tucumán · Dirección de Impuestos Municipales</Text>
          </View>
        </View>
        <View style={e.filete} fixed>
          <View style={{ flex: 46, backgroundColor: COLOR.primario }} />
          <View style={{ flex: 32, backgroundColor: COLOR.celeste }} />
          <View style={{ flex: 22, backgroundColor: COLOR.amarillo }} />
        </View>

        <Text style={e.descripcion}>
          {informe.descripcion} Generado el {fechaHora(generado)} (hora de Tucumán).
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

        <View style={e.pie} fixed>
          <Text>Desarrollado por la Dirección de Inteligencia Artificial</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function generarPdf(informe: Informe, generado: Date): Promise<Buffer> {
  return renderToBuffer(<DocumentoInforme informe={informe} generado={generado} imagen={logo()} />);
}
