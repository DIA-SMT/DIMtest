import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DIM360 · Relevamiento funcional", template: "%s · DIM360" },
  description: "Relevamiento funcional de DIM360 para la Dirección de Impuestos Municipales de San Miguel de Tucumán.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f2f5d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh font-sans antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-superficie focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-elevada"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
