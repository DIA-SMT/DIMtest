<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# DIM360 QA: notas para agentes

Sigue los estándares de la DIA (`estandares-dia`). Ante la duda, mandan ellos. Las excepciones están en `docs/DECISIONES.md`.

## Contexto
- Qué es: relevamiento funcional de DIM360 (217 pruebas del PDF de la DIM) y gestión de las correcciones. Área: Dirección de Impuestos Municipales. Público: empleados de la DIM (portal) y equipo de la DIA (panel).
- Fuente oficial: `docs/fuentes/DIM360-checklist-prueba-funcional-2026-11-05.pdf`. **Nunca se renumeran los códigos de prueba.**
- Pedido vigente: `docs/correcciones/2026-11-13-portales-y-administracion.md`.

## Idioma
- UI en español rioplatense con voseo («Elegí», «Guardá»). Nunca «Ingrese».
- Dominio en español (tablas, funciones, archivos). Inglés solo donde lo impone Next. Server Actions con sufijo `Accion`.

## Capas
- `app` (rutas, sin lógica) → `features/*` (`servicio.ts` con la lógica sobre `q`, `actions.ts`, `consultas.ts`, `components/`) → `domain` (puro, con tests) y `lib`.
- La lógica que escribe recibe `q: Consulta` (una transacción) para poder probarla sin Next en `tests/integracion/`.
- `src/lib/db/esquema.ts`, `adaptadores.ts` y `src/lib/auth/clave.ts` no llevan `server-only` ni imports relativos con valor: los importan los scripts de Node.

## Seguridad
- Dos sesiones distintas: relevador (solo nombre, `exigirRelevador()`) y equipo (correo y contraseña propios del panel, `exigirAdmin(permiso)`). El proxy no es la barrera: cada página, acción y route handler pide la suya.
- Un nombre declarado no es una identidad verificada: nunca se fusionan relevadores solos por el nombre.
- `ejecuciones`, `incidencia_eventos` y `auditoria` son solo inserción (trigger). Un resultado nuevo es una fila nueva.
- Marcar una incidencia como corregida **no** cambia el resultado de la prueba: abre un pedido en `revalidaciones`.
- RLS activado en todas las tablas, sin políticas (la app es la única puerta). Nunca loguear nombres, observaciones ni tokens.

## Cambios de esquema
1. Nueva migración en `supabase/migrations/<AAAAMMDDHHMMSS>_<descripcion>.sql` (solo agrega; primero agregar, después borrar).
2. Test en `tests/integracion/`.
3. En producción: `npm run db:migrar` antes del deploy. En local se aplica sola.

## Antes de terminar
```
npm run verificar        # typecheck + lint + test + test:integracion + build
```
