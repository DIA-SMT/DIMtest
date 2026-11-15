import type { NextConfig } from "next";

/**
 * Encabezados de seguridad (estándar DIA 03 §6). Si el despliegue va detrás de nginx
 * con su propio snippet, se pueden apagar con ENCABEZADOS_SEGURIDAD=nginx para que
 * no salgan dos veces.
 */
const ENCABEZADOS_SEGURIDAD = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
];
const CSP = "frame-ancestors 'self'; base-uri 'self'; object-src 'none'";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Todo depende de la sesión (relevador o equipo): no hay nada que prerenderizar.
  cacheComponents: false,
  // PGlite trae su propio WASM y sharp binarios nativos: que Next no los empaquete.
  serverExternalPackages: ["@electric-sql/pglite", "sharp", "@react-pdf/renderer", "exceljs"],
  experimental: {
    // Evidencias: hasta 5 archivos de 8 MB por prueba (src/lib/almacenamiento.ts), más el formulario.
    serverActions: { bodySizeLimit: "42mb" },
    proxyClientMaxBodySize: "42mb",
  },
  async headers() {
    if (process.env.ENCABEZADOS_SEGURIDAD === "nginx") return [];
    return [
      { source: "/:path*", headers: ENCABEZADOS_SEGURIDAD },
      // /evidencias/… manda su propia CSP (sandbox), y un encabezado de next.config le gana al del route handler.
      { source: "/:path((?!evidencias/).*)", headers: [{ key: "Content-Security-Policy", value: CSP }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
