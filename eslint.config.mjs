import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// jsx-a11y ya viene registrado por eslint-config-next: acá se suben sus reglas recomendadas
// (estándar DIA 04 §8) sin volver a declarar el plugin.
import jsxA11y from "eslint-plugin-jsx-a11y";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Las opciones de resultado y de estado son tarjetas: <label> con el radio y dos renglones de texto.
      "jsx-a11y/label-has-associated-control": ["error", { depth: 4 }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".local/**", ".data/**", "test-results/**", "playwright-report/**"]),
]);
