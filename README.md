# DIM360 QA · Relevamiento funcional

Plataforma para el traspaso de DIM360 a la **Dirección de Impuestos Municipales (DIM)** de la Municipalidad de San Miguel de Tucumán. El personal de la DIM se identifica con su nombre, prueba cada función del checklist oficial (217 pruebas en 22 módulos) y deja sus observaciones; el equipo de la DIA las prioriza, corrige y pide que se vuelvan a validar.
Desarrollado por la Dirección de Inteligencia Artificial.

- Decisiones: [docs/DECISIONES.md](docs/DECISIONES.md) · Pedido del área: [docs/correcciones/2026-11-13-portales-y-administracion.md](docs/correcciones/2026-11-13-portales-y-administracion.md) · Fuente: [docs/fuentes/](docs/fuentes/README.md)

## Estado

| Pieza | Estado |
|---|---|
| Catálogo de 217 pruebas extraído del PDF y cargado solo en la base | ✅ |
| Portal de relevamiento (`/`): ingreso solo con nombre y apellido (la segunda vez, se elige de una lista del navegador), módulos, reservas, resultados, evidencias, revalidación, sugerencias | ✅ |
| Panel de administración (`/admin`): tablero, pruebas, observaciones, incidencias, correcciones, prioridades, sugerencias, informes, relevadores, equipo, agente | ✅ |
| Sugerencias de los relevadores (D-017): funciones nuevas, mejoras e ideas desde el portal; el equipo las responde en el panel y el relevador ve la respuesta | ✅ |
| Avance de DIM360 hacia el 100 % (`/admin/avance`, desde el tablero): qué porcentaje de las pruebas funciona, semana a semana, reconstruido del historial, y una estimación al ritmo de las últimas semanas | ✅ |
| Informes en Excel y PDF (8 tipos), con las evidencias: enlaces en el Excel y anexo de imágenes en el PDF (D-014) | ✅ |
| Ingreso del equipo con correo y contraseña propios (D-003, D-009) | ✅ |
| Pruebas e2e con Playwright | ⬜ Pendiente: el circuito se probó a mano en el navegador y con tests de integración |

## Dos portales

| | Portal de relevamiento | Panel de administración |
|---|---|---|
| Ruta | `/`, `/relevamiento/…` | `/admin/…` |
| Para | Personal de la DIM | Equipo de la DIA |
| Ingreso | Solo **nombre y apellido** (sin contraseña, correo ni registro) | **Correo y contraseña** propios del panel, no de Supabase (scrypt, límite de intentos, sesión de 60 min) |
| Sesión | Cookie `dim360-relevador` → `sesiones_relevador` (id interno) | Cookie `dim360-admin`, otra audiencia; rol leído de la base |

Escribir el nombre de un administrador en el portal **no** da acceso al panel: son sesiones distintas y cada página del panel exige la suya.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Postgres (PGlite en local, postgres.js en producción) · zod · jose · exceljs · @react-pdf/renderer · Vitest. Sigue los [estándares DIA](../estandares-dia/README.md), con la estética de Applaza (Outfit y DM Sans, barra superior blanca, portadas con ondas: [D-008](docs/DECISIONES.md)).

## 1. Correr en la computadora

Requisitos: Node 24 o más nuevo (los scripts usan el soporte nativo de TypeScript de Node).

```bash
npm install
npm run dev
```

Sin `.env.local` arranca en **modo local**: base PGlite en `.local/pgdata` (se crea sola con las migraciones y las 217 pruebas, sin resultados), evidencias en `.local/archivos` y un usuario de administración de desarrollo:

| Correo | Contraseña | Solo en modo local |
|---|---|---|
| `admin@dim360.local` | `dim360-local` | Se crea si la base no tiene ningún usuario del equipo, y nunca en producción (`NODE_ENV=production`). Una base local creada antes de D-009 conserva el usuario `admin`. |

`npm run db:local:reiniciar` borra la base local (con el servidor detenido).

## 2. Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Portal en http://localhost:3000 y panel en http://localhost:3000/admin |
| `npm run verificar` | typecheck + lint + unitarios + integración + build |
| `npm test` | Unitarios (dominio y catálogo) |
| `npm run test:integracion` | Circuito completo contra PGlite (con `PRUEBAS_DATABASE_URL`, contra un Postgres real) |
| `npm run catalogo:extraer` | Vuelve a extraer el catálogo del PDF de `docs/fuentes/` a `src/domain/catalogo/catalogo-dim360.json` |
| `npm run catalogo:verificar` | Extrae de nuevo y muestra el control de cantidades por módulo |
| `npm run db:migrar` | Aplica migraciones pendientes y asegura el catálogo (producción) |
| `npm run db:semilla` | Carga o actualiza el catálogo en la base (producción) |
| `npm run admin:crear -- --usuario correo@smt.gob.ar --nombre "…"` | Crea una cuenta del equipo con contraseña temporal |
| `npm run almacenamiento:preparar` | Crea o ajusta el bucket privado de evidencias en Supabase y lo prueba |
| `npm run agente` | El agente Claude (solo en su máquina; `-- --revisar` para el diagnóstico, `-- --una-vez` para un trabajo). Ver [agente/README.md](agente/README.md) |

## 3. El catálogo

`docs/fuentes/DIM360-checklist-prueba-funcional-2026-11-05.pdf` es la fuente oficial. `scripts/catalogo-extraer.mjs` lo lee por la **posición** de cada texto (las columnas «Qué probar» y «Resultado esperado» comparten renglón) y escribe el JSON versionado con módulos, códigos, perfiles, textos, resultados posibles y exclusiones. El control:

- 22 módulos y 217 pruebas, con la cantidad de cada módulo igual al índice del PDF;
- códigos únicos (`ACC-01` … `MIG-11`) sin saltos de numeración;
- toda prueba con perfil (C, O, A, S, P), qué probar y resultado esperado.

Lo verifican `src/domain/dominio.test.ts` (sobre el JSON) y `tests/integracion/circuito.test.ts` (sobre la base). La carga es idempotente y por código: nunca borra pruebas ni toca resultados.

## 4. Pruebas

- **Unitarios** (`npm test`): catálogo, nombres, resultados, estados de prueba, ciclo de incidencias, prioridades y permisos.
- **Integración** (`npm run test:integracion`): Luis ingresa solo con su nombre, la segunda vez lo elige de la lista de su navegador, el equipo borra a quien no registró pruebas pero no a Luis, toma ACC-01, Agustín no puede tomarla a la vez, el resultado fallido exige explicación, el historial no se puede sobrescribir, el equipo convierte la observación en incidencia, la prioriza, la asigna, la corrige, la prueba pasa a «Requiere nueva validación», Agustín la revalida y el equipo la cierra (y la reabre). Además, todas las consultas del panel y los 8 informes, con sus evidencias en el Excel y en el PDF.

```bash
PRUEBAS_DATABASE_URL=postgres://postgres@localhost:54360/postgres npm run test:integracion   # ¡borra el esquema public de esa base!
```

- **CI** (`.github/workflows/ci.yml`): en cada PR y en cada push a `main` corre tipos, lint, unitarios, el control del catálogo contra el PDF y el build; en paralelo, la integración sobre PGlite y sobre un PostgreSQL 15 efímero (con `npm run db:migrar` incluido). No necesita secretos.

## 5. Puesta en producción

**Primero migrar, después desplegar.**

```bash
npm run db:migrar
npm run almacenamiento:preparar   # si las evidencias van a Supabase Storage
npm run admin:crear -- --usuario nombre@smt.gob.ar --nombre "Nombre Apellido"
```

### Variables

| Variable | Obligatoria | Para qué | Secreta |
|---|---|---|---|
| `DATABASE_URL` | Sí (sin ella, modo local) | Postgres de la app | Sí |
| `DIRECT_URL` | No | Conexión directa para `db:migrar` (si la app usa un pooler) | Sí |
| `DATABASE_SSL` | No | `requerido` o `desactivado` (por defecto: requerido salvo localhost) | No |
| `SESSION_SECRET` | Sí en producción | Firma de las sesiones (32+ caracteres) | Sí |
| `SUPABASE_URL` | En Vercel | URL del proyecto (`https://<ref>.supabase.co`), para el bucket de evidencias | No |
| `SUPABASE_SECRET_KEY` | En Vercel | Clave secreta de Supabase (`sb_secret_…` o la `service_role`), solo en el servidor | **Sí** |
| `SUPABASE_BUCKET` | No | Nombre del bucket (por defecto `evidencias`) | No |
| `WHATSAPP_TOKEN` | Para los avisos del agente | Token de acceso de WhatsApp Cloud API (Meta) | **Sí** |
| `WHATSAPP_NUMERO_ID` | Junto con el token | Id del número de WhatsApp en Meta | No |
| `WHATSAPP_PLANTILLA` / `WHATSAPP_IDIOMA` / `WHATSAPP_VERSION_API` | No | Plantilla aprobada (`aviso_dim360`), idioma (`es_AR`) y versión de la API (`v23.0`) | No |
| `CARPETA_ARCHIVOS` | No | Dónde guardar las evidencias si no hay bucket (por defecto `.local/archivos`) | No |
| `RESERVA_MINUTOS` | No | Duración de la reserva de una prueba (por defecto 30) | No |
| `ENCABEZADOS_SEGURIDAD` | No | `nginx` si los encabezados de seguridad los pone el proxy | No |

### Evidencias (D-011)

- **Con `SUPABASE_URL` y `SUPABASE_SECRET_KEY`** (y una base real): van a un **bucket privado** de Supabase Storage. Es lo que hace falta en Vercel, que no tiene disco persistente. El bucket no tiene URL pública: la app lo lee con la clave secreta y sirve cada archivo por `/evidencias/<id>`, solo a quien tiene sesión.
- **Sin ellas, o en modo local**: van a disco (`CARPETA_ARCHIVOS`). En la computadora nunca se sube nada al bucket, aunque `.env.local` tenga la clave (la usan los scripts).
- `npm run almacenamiento:preparar` crea el bucket (privado, 8 MB por archivo, JPG, PNG, WebP y PDF) y prueba subir, leer y borrar.

### Agente Claude (D-015)

Corrige incidencias de DIM360 desde una máquina de la red municipal y publica en el servidor de test. Arranca **apagado**.

1. **Panel → Agente:** generá el token de la máquina (se muestra una vez) y elegí la configuración: encendido, si puede publicar, si se le piden solas las incidencias nuevas y de qué prioridades.
2. **En la máquina del agente:** el programa está en [agente/](agente/README.md), con la guía de instalación; el token va en `AGENTE_TOKEN`. El protocolo con el panel está en [docs/AGENTE.md](docs/AGENTE.md).
3. **Avisos por WhatsApp:** cada persona carga su número en **Mi cuenta**. Para enviarlos hacen falta `WHATSAPP_TOKEN` y `WHATSAPP_NUMERO_ID` (WhatsApp Cloud API de Meta, número dedicado) y una plantilla aprobada `aviso_dim360` con un parámetro `{{1}}`. Sin eso, los avisos quedan registrados en la página del agente.
4. **Panel → Correcciones** (todo el equipo): la cola del agente (lo que está haciendo y lo que espera, en el orden en que lo va a tomar) y lo que terminó, con su resumen, sus PR y cómo salió la revalidación de la DIM (confirmada, volvió a fallar o pendiente).
5. **Del lado de los relevadores:** lo que se publicó en test aparece en el portal como «Para volver a probar» (en la barra de todas las páginas y al principio del inicio), con qué se corrigió y sin enlaces internos. A quien lo reportó le llega un aviso propio. Al volver a probarla, el resultado vuelve al equipo y a «Correcciones».

## Pendientes

- Unificar a mano perfiles de relevadores que resulten ser la misma persona (hoy se muestran y se marcan, pero no se fusionan).
- Pruebas e2e con Playwright para el circuito del portal a 375 px.
