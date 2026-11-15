import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests unitarios: rápidos, sin base. Los de integración (PGlite) tienen su propia
// configuración (vitest.integracion.config.mts).
const raiz = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${raiz}src/` },
      { find: /^server-only$/, replacement: `${raiz}tests/stubs/server-only.ts` },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // El código no puede depender de la zona de la máquina: los tests corren en UTC.
    env: { TZ: "UTC" },
  },
});
