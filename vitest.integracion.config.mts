import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests contra una base PGlite en memoria con las mismas migraciones que producción.
const raiz = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${raiz}src/` },
      { find: /^server-only$/, replacement: `${raiz}tests/stubs/server-only.ts` },
    ],
  },
  test: {
    include: ["tests/integracion/**/*.test.ts"],
    environment: "node",
    env: { TZ: "UTC" },
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
