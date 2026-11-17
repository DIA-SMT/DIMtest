#!/usr/bin/env node
// Agente Claude de DIM360 (D-015). Corre en una máquina de la red municipal.
//   npm run agente                 → pide trabajo cada INTERVALO_SEGUNDOS y lo procesa
//   npm run agente -- --una-vez    → procesa a lo sumo un trabajo y termina
//   npm run agente -- --revisar    → revisa que la máquina tenga todo, sin tomar trabajo
// Configuración en agente/.env (ver agente/.env.example y agente/README.md).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { armarPedido, clientePanel, interpretarSalida, leerConfig, nombreSeguro, reglasDePermisos, validarResultado } from "./lib.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TRABAJOS = path.join(AQUI, "trabajos");
const REGISTRO = path.join(AQUI, "registro.log");
const AVANCE_JS = path.join(AQUI, "avance.mjs");
const modo = process.argv.includes("--revisar") ? "revisar" : process.argv.includes("--una-vez") ? "una-vez" : "continuo";

/** Registro en pantalla y en registro.log. Nunca textos de las incidencias ni secretos. */
function log(mensaje) {
  const linea = `${new Date().toISOString()} ${mensaje}`;
  console.log(linea);
  try {
    fs.appendFileSync(REGISTRO, `${linea}\n`);
  } catch {
    // Sin disco para el registro, igual sigue.
  }
}
const esperar = (segundos) => new Promise((r) => setTimeout(r, segundos * 1000));

const { config, errores } = leerConfig({ ...process.env, AGENTE_CARPETA: AQUI });
if (errores.length) {
  console.error("Falta configurar el agente (agente/.env):");
  for (const e of errores) console.error(`  · ${e}`);
  process.exit(1);
}
const panel = clientePanel({ url: config.panelUrl, token: config.token });

/** Claude Code, o un simulador .mjs para probar el circuito sin gastar uso (agente/simulador-claude.mjs). */
const [comandoClaude, ...prefijoClaude] = /\.m?js$/.test(config.claude) ? [process.execPath, config.claude] : [config.claude];

/** Corre un comando y devuelve su salida (para el diagnóstico). */
function correr(comando, args, opciones = {}) {
  return new Promise((resolve) => {
    let salida = "";
    let hijo;
    try {
      // En Windows, npm y composer son .cmd/.bat: el diagnóstico (comandos fijos, por nombre) los corre con
      // la consola. Una ruta completa (como la de node, con espacios) se arranca directo.
      const conConsola = opciones.shell ?? (process.platform === "win32" && !/[\\/]/.test(comando));
      const base = { cwd: opciones.cwd, env: opciones.env ?? process.env, windowsHide: true };
      hijo = conConsola ? spawn([comando, ...args].join(" "), { ...base, shell: true }) : spawn(comando, args, base);
    } catch (e) {
      resolve({ codigo: -1, salida: e.message });
      return;
    }
    const tope = setTimeout(() => hijo.kill(), (opciones.segundos ?? 30) * 1000);
    hijo.stdout?.on("data", (d) => (salida += d));
    hijo.stderr?.on("data", (d) => (salida += d));
    hijo.on("error", (e) => {
      clearTimeout(tope);
      resolve({ codigo: -1, salida: e.message });
    });
    hijo.on("close", (codigo) => {
      clearTimeout(tope);
      resolve({ codigo: codigo ?? -1, salida });
    });
  });
}

/** El entorno de Claude: sin claves de API (le ganarían a la cuenta Team) y con lo que usa avance.mjs. */
function entornoDeClaude(numero) {
  const env = { ...process.env, AGENTE_TRABAJO: String(numero), PANEL_URL: config.panelUrl, AGENTE_TOKEN: config.token };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

// ---------------------------------------------------------------------------
// Diagnóstico de la máquina
// ---------------------------------------------------------------------------

async function revisar() {
  const filas = [];
  const anotar = (ok, que, detalle = "") => filas.push(`${ok ? "✓" : "✗"} ${que}${detalle ? ` — ${detalle}` : ""}`);

  try {
    const e = await panel.estado();
    anotar(true, "Panel y token", `${e.activo ? "encendido" : "APAGADO"}, publicar ${e.publicar ? "sí" : "no"}, ${e.pendientes} en la cola, ${e.enCurso} en curso`);
  } catch (e) {
    anotar(false, "Panel y token", e.status === 401 ? "el token no vale: generá uno nuevo en Panel → Agente" : e.message);
  }
  const claude = await correr(comandoClaude, [...prefijoClaude, "--version"], { env: entornoDeClaude(0) });
  anotar(claude.codigo === 0, "Claude Code", claude.codigo === 0 ? claude.salida.trim() : "no se encontró: instalalo o configurá CLAUDE_COMANDO");
  if (claude.codigo === 0) {
    // El trabajo real lo arranca sin consola (los permisos llevan paréntesis y asteriscos): tiene que ser un ejecutable.
    const directo = await correr(comandoClaude, [...prefijoClaude, "--version"], { env: entornoDeClaude(0), shell: false });
    anotar(directo.codigo === 0, "Claude Code se puede arrancar directo", directo.codigo === 0 ? "" : "usá el instalador nativo (claude.exe) o poné en CLAUDE_COMANDO la ruta completa al .exe");
  }
  const gh = await correr("gh", ["auth", "status"]);
  anotar(gh.codigo === 0, "GitHub CLI con sesión", gh.codigo === 0 ? "" : "corré `gh auth login`");
  for (const repo of ["Dim360_back-copia", "Dim360_front-copia"]) {
    const ruta = path.join(config.carpeta, repo);
    const git = await correr("git", ["-C", ruta, "status", "--porcelain"]);
    anotar(git.codigo === 0, `Repo ${repo}`, git.codigo !== 0 ? `no está en ${ruta}` : git.salida.trim() ? "tiene cambios sin commitear" : "limpio");
  }
  anotar(fs.existsSync(path.join(config.carpeta, ".claude", "skills", "dim360", "SKILL.md")), "Skill dim360", "en .claude/skills/dim360/SKILL.md");
  const ssh = await correr("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", config.sshDestino, "echo ok"], { segundos: 20 });
  anotar(ssh.salida.includes("ok"), `SSH a ${config.sshDestino}`, ssh.salida.includes("ok") ? "" : "sin acceso con clave (sin contraseña)");
  for (const [comando, args] of [
    ["php", ["-v"]],
    ["composer", ["--version"]],
    ["npm", ["--version"]],
  ]) {
    const r = await correr(comando, args, { segundos: 20 });
    anotar(r.codigo === 0, comando, r.codigo === 0 ? r.salida.split(/\r?\n/)[0].trim() : "no está instalado o no está en el PATH");
  }
  console.log(filas.join("\n"));
  return filas.every((f) => f.startsWith("✓"));
}

// ---------------------------------------------------------------------------
// Un trabajo
// ---------------------------------------------------------------------------

async function procesar(t) {
  const numero = t.trabajo.numero;
  const carpetaTrabajo = path.join(TRABAJOS, `${numero}-${new Date().toISOString().slice(0, 10)}`);
  fs.mkdirSync(path.join(carpetaTrabajo, "evidencias"), { recursive: true });
  fs.writeFileSync(path.join(carpetaTrabajo, "incidencia.json"), JSON.stringify(t, null, 2));
  log(`Trabajo #${numero}: ${t.incidencia.codigo} (${t.prueba.codigo}, ${t.incidencia.prioridad}), publicar=${t.publicar}`);

  const archivosEvidencia = [];
  for (const [k, ev] of t.evidencias.entries()) {
    try {
      const ruta = path.join(carpetaTrabajo, "evidencias", nombreSeguro(ev.nombre, k));
      fs.writeFileSync(ruta, await panel.evidencia(ev.id));
      archivosEvidencia.push({ ruta, mime: ev.mime, origen: ev.origen });
    } catch (e) {
      log(`  No se pudo bajar una evidencia (${e.status ?? e.message}).`);
    }
  }

  const instrucciones = fs
    .readFileSync(path.join(AQUI, "instrucciones.md"), "utf8")
    .replaceAll("{{CARPETA_DIM360}}", config.carpeta)
    .replaceAll("{{SSH_DESTINO}}", config.sshDestino)
    .replaceAll("{{AVANCE}}", `node ${AVANCE_JS.replace(/\\/g, "/")}`);
  const archivoInstrucciones = path.join(carpetaTrabajo, "instrucciones.md");
  fs.writeFileSync(archivoInstrucciones, instrucciones);
  const pedido = armarPedido(t, { carpetaTrabajo, archivosEvidencia });
  const reglas = reglasDePermisos({ sshDestino: config.sshDestino, avanceJs: AVANCE_JS });

  await panel.avance(numero, "La máquina del agente recibió el trabajo y arranca.").catch(() => null);

  const args = [
    "-p",
    "--output-format",
    "json",
    "--max-turns",
    String(config.maxTurnos),
    "--permission-mode",
    "dontAsk",
    "--append-system-prompt-file",
    archivoInstrucciones,
    "--add-dir",
    carpetaTrabajo,
    "--disallowedTools",
    ...reglas.denegadas,
    "--allowedTools",
    ...reglas.permitidas,
  ];
  let cancelado = false;
  let vencido = false;
  let stdout = "";
  let stderr = "";
  const hijo = spawn(comandoClaude, [...prefijoClaude, ...args], { cwd: config.carpeta, env: entornoDeClaude(numero), windowsHide: true });
  hijo.stdin.end(pedido);
  hijo.stdout.on("data", (d) => (stdout = (stdout + d).slice(-200_000)));
  hijo.stderr.on("data", (d) => (stderr = (stderr + d).slice(-20_000)));

  // Señal de vida cada 5 minutos; si lo cancelaron o apagaron el interruptor, se corta Claude.
  const latido = setInterval(async () => {
    const r = await panel.avance(numero).catch(() => null);
    if (r && !r.seguir) {
      cancelado = true;
      log(`  Trabajo #${numero}: el panel pidió parar. Se corta Claude.`);
      hijo.kill();
    }
  }, 5 * 60_000);
  const tope = setTimeout(() => {
    vencido = true;
    log(`  Trabajo #${numero}: pasaron ${config.minutosMaximos} minutos. Se corta Claude.`);
    hijo.kill();
  }, config.minutosMaximos * 60_000);

  const codigo = await new Promise((resolve) => {
    hijo.on("error", (e) => {
      stderr += e.message;
      resolve(-1);
    });
    hijo.on("close", (c) => resolve(c ?? -1));
  });
  clearInterval(latido);
  clearTimeout(tope);
  fs.writeFileSync(path.join(carpetaTrabajo, "salida-claude.json"), stdout);
  if (stderr.trim()) fs.writeFileSync(path.join(carpetaTrabajo, "errores-claude.txt"), stderr);

  if (cancelado) return { pausa: 0 };
  const salida = interpretarSalida(stdout, codigo);
  log(`  Claude terminó (código ${codigo}, ${salida.turnos ?? "?"} pasos${salida.maxTurnos ? ", tope de pasos" : ""}${salida.limite ? ", LÍMITE DE USO" : ""}).`);

  const archivoResultado = path.join(carpetaTrabajo, "RESULTADO.json");
  let resultado = null;
  if (fs.existsSync(archivoResultado)) {
    try {
      resultado = validarResultado(JSON.parse(fs.readFileSync(archivoResultado, "utf8")), { publicar: t.publicar });
    } catch {
      resultado = { ok: false, error: "RESULTADO.json no es JSON válido" };
    }
  }

  try {
    if (resultado?.ok) {
      await panel.terminar(numero, resultado.cierre);
      log(`  Trabajo #${numero} terminado: ${resultado.cierre.resultado}.`);
      return { pausa: 0 };
    }
    const motivo = salida.limite
      ? `Se alcanzó el límite de uso del plan de Claude. El agente espera ${config.pausaLimiteMinutos} minutos antes de seguir; este trabajo hay que volver a pedirlo.`
      : vencido
        ? `Pasaron ${config.minutosMaximos} minutos sin terminar.`
        : salida.maxTurnos
          ? `Llegó al tope de ${config.maxTurnos} pasos sin terminar.`
          : resultado
            ? `El resultado no es válido: ${resultado.error}.`
            : `Claude terminó sin dejar RESULTADO.json${salida.final ? `: ${salida.final.slice(-600)}` : codigo !== 0 ? ` (código ${codigo}; ver errores-claude.txt en la máquina)` : "."}`;
    await panel.fallo(numero, motivo);
    log(`  Trabajo #${numero} no terminó: ${motivo.slice(0, 200)}`);
    return { pausa: salida.limite ? config.pausaLimiteMinutos * 60 : 0 };
  } catch (e) {
    // Lo más común: lo cancelaron justo al final (409 trabajo_no_en_curso).
    log(`  Trabajo #${numero}: el panel no aceptó el cierre (${e.clave ?? e.message}).`);
    return { pausa: 0 };
  }
}

// ---------------------------------------------------------------------------
// Bucle
// ---------------------------------------------------------------------------

if (modo === "revisar") {
  process.exit((await revisar()) ? 0 : 1);
}

log(`Agente iniciado (${modo}). Panel: ${config.panelUrl}. Cada ${config.intervaloSegundos} s.`);
let detenido = false;
for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, () => {
    if (detenido) process.exit(130);
    detenido = true;
    log("Se pidió detener el agente: termina el trabajo actual (si hay) y sale. Ctrl+C otra vez para salir ya.");
  });
}

while (!detenido) {
  let trabajo = null;
  try {
    trabajo = await panel.tomar();
  } catch (e) {
    log(`No se pudo consultar el panel (${e.status ?? e.message}). Se reintenta en ${config.intervaloSegundos} s.`);
  }
  if (trabajo) {
    const { pausa } = await procesar(trabajo);
    if (modo === "una-vez") break;
    if (pausa) {
      log(`Pausa de ${Math.round(pausa / 60)} minutos.`);
      await esperar(pausa);
    }
    continue;
  }
  if (modo === "una-vez") {
    log("No había trabajo.");
    break;
  }
  await esperar(config.intervaloSegundos);
}
log("Agente detenido.");
