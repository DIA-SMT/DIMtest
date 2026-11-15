# 2026-11-13 · Dos portales, ingreso por nombre y panel de administración

**Fuente:** pedido escrito del equipo de la DIA, «Actualización de requerimientos — DIM360 QA» (13 puntos y criterios de aceptación), más el pedido de cargar automáticamente las 217 pruebas del PDF `docs/fuentes/DIM360-checklist-prueba-funcional-2026-11-05.pdf`.

> «Esta instrucción tiene prioridad sobre los requisitos anteriores que indicaban que todos los usuarios debían registrarse con contraseña.»

> «Objetivo final: que el personal de DIM solamente tenga que identificarse, probar y dejar sus observaciones; mientras nuestro equipo administra, prioriza y resuelve los problemas detectados.»

## Cómo quedó cada punto

| # | Pedido | Dónde |
|---|---|---|
| 1 | Dos portales: relevamiento sin contraseña; administración separada y con autenticación segura | `/` y `/relevamiento/…` · `/admin/…` (D-002, D-003) |
| 2 | Pantalla de ingreso institucional con «Nombre y apellido» y «Comenzar relevamiento»; sesión interna; sin duplicar por mayúsculas, espacios o tildes; sin fusionar personas distintas | `src/app/page.tsx`, `src/domain/nombres.ts`, `features/relevamiento/servicio.ts` → `identificar()` |
| 3 | Elegir módulo, ver pruebas, quién las probó, leer qué probar y el esperado, 4 resultados, explicación obligatoria si no funciona, observaciones, evidencias, guardar y seguir, avance por módulo | `/relevamiento`, `/relevamiento/[modulo]`, `/relevamiento/prueba/[codigo]` |
| 4 | Sin realizar, en ejecución, realizadas, para revalidar; quién, cuándo, resultado y observaciones; aviso antes de repetir; reserva temporal | `domain/estado-prueba.ts`, `reservas` (D-006, D-007) |
| 5 | Dashboard en `/admin` calculado sobre la base | `/admin` |
| 6 | Tabla de todas las ejecuciones con filtros e historial por prueba, sin sobrescribir | `/admin/pruebas`, `/admin/pruebas/[codigo]`, trigger `solo_insercion` |
| 7 | Bandeja de observaciones con búsqueda, filtros y orden; informativa o incidencia; incidencia con todos sus campos e historial | `/admin/observaciones`, `/admin/incidencias/nueva`, `/admin/incidencias/[numero]` |
| 8 | P0–P3, sugerida por el relevador, definitiva del equipo con registro de quién y cuándo; vista ordenada y filtros combinados | `/admin/incidencias` (D-005) |
| 9 | Revisar, asignar, priorizar, comentar, corregir, revalidar, cerrar, reabrir, descartar con justificación; 8 estados; corregida no toca el resultado | `domain/incidencias.ts`, `features/incidencias/servicio.ts` (D-004) |
| 10 | Pantalla «Prioridades» con cambio rápido | `/admin/prioridades` |
| 11 | Informes en Excel y PDF, con el código original | `/admin/informes` (8 informes × 2 formatos) |
| 12 | Identidad municipal; portal simple y cómodo en celular; panel tipo SaaS con barra lateral | `src/app/globals.css` (tokens DIA), barra lateral de 256 px |

## Criterios de aceptación

| # | Criterio | Cómo se verificó |
|---|---|---|
| 1 | Luis ingresa solo con nombre y apellido | Navegador + `circuito.test.ts` |
| 2 | Luis prueba sin registrarse | Navegador: ACC-01 «No funciona» con observación, caso, P1 sugerida y una captura |
| 3 | Agustín ingresa después y ve lo que probó Luis | Navegador: «Cambiar usuario» → Agustín ve el resultado, la observación y la evidencia; al repetir, aviso |
| 4 | Observaciones visibles en administración | Navegador: `/admin/observaciones` |
| 5 | Filtrar pruebas por relevador y resultado | Navegador + `consultas.test.ts` |
| 6 | Clasificar incidencias por prioridad | Navegador: P1 → P0 desde «Prioridades», con historial |
| 7 | Asignar y seguir correcciones | Navegador: asignada, en análisis, en corrección |
| 8 | Una corrección vuelve a validación | Navegador: corregida → «Requiere nueva validación» en el portal → Agustín revalida → cerrada |
| 9 | Se conserva todo el historial | Triggers `solo_insercion` + `circuito.test.ts` |
| 10 | Dashboard con resultados reales | `/admin` + `consultas.test.ts` |
| 11 | Portal cómodo desde el celular | Navegador a 375 px: sin desplazamiento lateral |
| 12 | Panel protegido y separado | `/admin` redirige al ingreso aunque haya sesión de relevador |
| 13 | Se preservan las 217 pruebas del PDF | `dominio.test.ts`, `circuito.test.ts`, `npm run catalogo:verificar` |

## Migraciones

- `20261113120000_esquema_inicial.sql`: esquema completo. En local se aplica sola; en producción, `npm run db:migrar` antes del deploy.
