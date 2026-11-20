# Agente Claude de DIM360 — instalación en la máquina de la Dirección

El agente corre en una **máquina de la Dirección dentro de la red municipal** que queda prendida. Cada 2 minutos le pregunta al panel si hay incidencias para corregir; cuando hay una, corre Claude Code con la cuenta **Team** sobre los repositorios de DIM360, avisa su avance y cierra el trabajo en el panel. Cómo decide y qué no hace nunca: [instrucciones.md](instrucciones.md). Protocolo con el panel: [docs/AGENTE.md](../docs/AGENTE.md). Decisión: D-015.

> **Las credenciales se crean en esta máquina y se quedan acá.** No se mandan por chat, WhatsApp ni correo.

## 1. Programas

| Programa | Para qué | Cómo |
|---|---|---|
| **Node.js 22.12 o más** | Corre el agente | https://nodejs.org (LTS) |
| **Git for Windows** | Repos, y la consola Bash que usa Claude | https://git-scm.com/download/win |
| **GitHub CLI** | Abrir el PR «Agente» y comentar cada corrección | `winget install GitHub.cli` |
| **PHP 8.2 y Composer** | Verificar el back antes de publicar | Los mismos que usa el equipo |
| **Claude Code** | El agente en sí | En PowerShell: `irm https://claude.ai/install.ps1 \| iex` (instalador nativo, deja `claude.exe`) |
| **OpenSSH** | Desplegar en el servidor de test | Viene con Windows 10/11 (`ssh -V`) |

## 2. Carpetas

En una carpeta **sin espacios** (por ejemplo `C:\agente-dim360`):

```bash
git clone https://github.com/DIA-SMT/DIMtest C:\agente-dim360
```

La carpeta de DIM360 (por ejemplo `C:\repos\dim360`), igual que la de quien desarrolla:

```bash
gh repo clone dim-desarrollo/Dim360_back-copia C:\repos\dim360\Dim360_back-copia
gh repo clone dim-desarrollo/Dim360_front-copia C:\repos\dim360\Dim360_front-copia
```

- Copiá la skill `dim360` a `C:\repos\dim360\.claude\skills\dim360\SKILL.md`. La tiene el equipo.
- Instalá las dependencias: `composer install` en el back y `npm ci` en el front.
- **No copies** `docs\desarrollo` (tiene credenciales) ni ningún `.env.local` con datos reales: el agente no los necesita.

## 3. Credenciales (las cuatro, en esta máquina)

1. **Claude (cuenta Team).** Conviene un asiento propio para el agente, así no gasta los límites de nadie. Iniciá sesión con `claude` y después corré `claude setup-token`; copiá lo que muestra a `CLAUDE_CODE_OAUTH_TOKEN` (paso 4). Dura un año.
2. **GitHub.** `gh auth login` con una cuenta que pueda escribir en `dim-desarrollo`. Y la firma de los commits:
   ```bash
   git config --global user.name "Agente Claude (DIA)"
   git config --global user.email "<correo de la cuenta de GitHub>"
   ```
3. **Servidor de test, con una clave propia del agente** (nunca la contraseña de una persona):
   ```bash
   ssh-keygen -t ed25519 -f %USERPROFILE%\.ssh\dim360_agente -N ""
   ```
   Quien administra el servidor crea un usuario para el agente, le agrega la clave **pública** (`dim360_agente.pub`) y le da permiso para lo que hace el despliegue: escribir en las carpetas del back y del front, correr `bin/console` y `npm run build` como `www-data`, y reiniciar `dim360-worker`. Lo más acotado es sumarlo al grupo `www-data` con escritura en esas carpetas, y usar `sudo` sin contraseña solo para esos comandos. Después, en `%USERPROFILE%\.ssh\config`:
   ```
   Host dim360-test
     HostName <IP del servidor de test>
     User <usuario del agente>
     IdentityFile ~/.ssh/dim360_agente
   ```
   Probalo con `ssh dim360-test echo ok`: tiene que responder sin pedir contraseña.
4. **Panel.** Entrá al panel **desde esta máquina** con tu cuenta de administrador → **Agente → Conexión de la máquina → Generar el token**. Se muestra una sola vez.

## 4. Configuración

Copiá `agente\.env.example` a `agente\.env` (no se sube a git) y completalo:

| Variable | Qué va |
|---|---|
| `PANEL_URL` | `https://dim-test.vercel.app` |
| `AGENTE_TOKEN` | El token del panel (paso 3.4) |
| `CLAUDE_CODE_OAUTH_TOKEN` | Lo de `claude setup-token` (paso 3.1) |
| `CARPETA_DIM360` | `C:\repos\dim360` |
| `SSH_DESTINO` | `dim360-test` |

No pongas `ANTHROPIC_API_KEY`: le ganaría a la cuenta Team y se cobraría por uso.

## 5. Revisar que esté todo

```bash
cd C:\agente-dim360
npm run agente -- --revisar
```

Tiene que dar todo ✓. Si algo da ✗, dice qué falta.

## 6. Primera vuelta, mirando

1. En **Panel → Agente**: **«Puede publicar en test» apagado**, **encendido**, guardar.
2. En una incidencia sencilla: **«Pedirle al agente que la corrija»**.
3. En la máquina: `npm run agente -- --una-vez`. Procesa ese trabajo y termina.
4. Mirá el historial de la incidencia, su commit en el PR «Agente» y la carpeta `agente\trabajos\<número>-<fecha>` (qué recibió, qué contestó Claude).

Para probar el circuito sin gastar uso ni tocar DIM360, con `CLAUDE_COMANDO=agente/simulador-claude.mjs` en `agente\.env`, el agente usa un simulador.

## 7. Dejarlo andando

Para que arranque solo con la máquina, en el **Programador de tareas** de Windows crear una tarea:

- **Desencadenador:** al iniciar el sistema.
- **Acción:** `cmd` con argumentos `/c cd /d C:\agente-dim360 && npm run agente >> agente\trabajos\consola.log 2>&1`.
- **Opciones:** «Ejecutar tanto si el usuario inició sesión como si no», con el usuario de Windows que tiene las credenciales.

El agente escribe solo su registro en `agente\registro.log`. A `consola.log` va el resto de la salida (y los errores, si se cae). No redirijas la consola a `registro.log`: serían dos procesos escribiendo el mismo archivo. Los dos quedan fuera de git.

Mientras lo prueban, también se puede dejar una consola abierta con `npm run agente`.

## Frenarlo

- **Al instante, desde cualquier lado:** apagá el interruptor en **Panel → Agente**. Si estaba trabajando, se entera en su próxima señal (máximo 5 minutos) y para sin publicar.
- **Un pedido puntual:** en la incidencia, «Pedirle que pare».
- **En la máquina:** Ctrl+C (termina el trabajo actual y sale; Ctrl+C otra vez, sale ya).
- **Si la máquina o el token quedaron expuestos:** en el panel, «Desconectar la máquina (revocar el token)». Y revocá también la clave SSH en el servidor y la sesión de GitHub.
