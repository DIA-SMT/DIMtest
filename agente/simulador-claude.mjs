#!/usr/bin/env node
// Simulador de Claude Code para probar el circuito del agente sin gastar uso ni tocar DIM360.
//   CLAUDE_COMANDO=agente/simulador-claude.mjs  (en agente/.env, solo para probar)
//   SIMULAR_RESULTADO=pr_abierto | desplegado | bloqueado | ... | sin_resultado | limite
// Recibe los mismos argumentos y el pedido por stdin, avisa un avance con avance.mjs
// (como haría Claude), guarda lo que recibió en la carpeta del trabajo y deja RESULTADO.json.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.includes("--version")) {
  console.log("simulador-claude 1.0 (no es Claude Code)");
  process.exit(0);
}
const valor = (flag) => args[args.indexOf(flag) + 1];
const carpeta = valor("--add-dir");
const pedido = fs.readFileSync(0, "utf8");
fs.writeFileSync(path.join(carpeta, "simulador-recibio.json"), JSON.stringify({ args, pedido, trabajo: process.env.AGENTE_TRABAJO, conApiKey: !!process.env.ANTHROPIC_API_KEY }, null, 2));

const avance = path.join(path.dirname(fileURLToPath(import.meta.url)), "avance.mjs");
const r = spawnSync(process.execPath, [avance, "Simulación: diagnóstico listo."], { env: process.env, encoding: "utf8" });
const respuesta = JSON.parse(r.stdout || "{}");
if (r.status !== 0) {
  // Como Claude: si el panel dice que pare, no escribe RESULTADO.json.
  console.log(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "Me pidieron parar.", num_turns: 2 }));
  process.exit(0);
}

const modo = process.env.SIMULAR_RESULTADO || "pr_abierto";
if (modo === "limite") {
  console.log(JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, errors: ["Claude AI usage limit reached"] }));
  process.exit(1);
}
if (modo !== "sin_resultado") {
  fs.writeFileSync(
    path.join(carpeta, "RESULTADO.json"),
    JSON.stringify({
      resultado: modo,
      resumen: `Simulación (publicar=${respuesta.publicar}). No se tocó DIM360.`,
      enlaces: [{ texto: "PR de prueba", url: "https://github.com/dim-desarrollo/Dim360_back-copia/pulls" }],
    }),
  );
}
console.log(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "Listo (simulado).", num_turns: 3 }));
