// Valida el entorno al arrancar: una app mal configurada no levanta.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/entorno");
  }
}
