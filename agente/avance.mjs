#!/usr/bin/env node
// Lo usa Claude mientras trabaja: avisa un avance al panel y pregunta si puede seguir.
//   node avance.mjs "Reproduje el error en local."
//   node avance.mjs            (solo señal de vida)
// Imprime {"seguir":true,"publicar":true}. Sale con código 3 si NO tiene que seguir:
// en ese caso Claude deja todo como está, no mergea ni publica, y termina.
import { clientePanel } from "./lib.mjs";

const { PANEL_URL, AGENTE_TOKEN, AGENTE_TRABAJO } = process.env;
if (!PANEL_URL || !AGENTE_TOKEN || !/^\d+$/.test(AGENTE_TRABAJO ?? "")) {
  console.error("avance.mjs: faltan PANEL_URL, AGENTE_TOKEN o AGENTE_TRABAJO (los pone el agente).");
  process.exit(2);
}
const mensaje = process.argv.slice(2).join(" ").trim().slice(0, 2000);
try {
  const r = await clientePanel({ url: PANEL_URL.replace(/\/$/, ""), token: AGENTE_TOKEN }).avance(Number(AGENTE_TRABAJO), mensaje);
  console.log(JSON.stringify(r));
  process.exit(r.seguir ? 0 : 3);
} catch (e) {
  // Sin respuesta del panel no se sabe si sigue: por las dudas, no.
  console.log(JSON.stringify({ seguir: false, publicar: false, error: e.clave ?? e.message }));
  process.exit(3);
}
