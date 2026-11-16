# Decisiones

Registro de por qué el sistema es como es. **Las más nuevas van arriba.** Nunca se borra una entrada: si cambia, se escribe otra que la reemplaza y se la cita.

---

## D-013 · Borrar relevadores sin pruebas

**Fecha:** 2026-11-16 · **Pidió:** DIA

**Contexto.** Quienes entran al portal solo a mirarlo (por ejemplo, el equipo de la DIA) quedan en la lista de relevadores.

**Decisión.** Desde Relevadores, un administrador (`usuarios.gestionar`) puede borrar a un relevador que **no registró pruebas ni reportó incidencias**. Se borran su perfil, sus sesiones y su reserva vigente, con un paso de confirmación y una fila en `auditoria` (`relevador.borrar`, con el id, sin el nombre). Quien registró pruebas no se puede borrar: el historial es solo inserción y cada ejecución apunta a su perfil.

**Consecuencias.** Si la persona tenía la sesión abierta, la pierde y vuelve al ingreso; si vuelve a entrar con su nombre, es un perfil nuevo.

---

## D-012 · Segundo ingreso: elegir el nombre de una lista

**Fecha:** 2026-11-16 · **Pidió:** DIA

**Contexto.** Los relevadores escribían su nombre cada vez que la sesión se cerraba o cambiaban de usuario.

**Decisión.** La primera vez se escribe el nombre (D-002). Después, el ingreso muestra una lista desplegable con los nombres que **ya ingresaron desde ese navegador** (la cookie firmada del dispositivo, que ahora recuerda hasta 10 para una computadora compartida). «No estoy en la lista» vuelve a pedir el nombre. La lista no es de todos los relevadores: el ingreso está publicado en internet y no debe mostrar los nombres del personal, y elegir un id que no está en la cookie no sirve.

**Consecuencias.** En otro navegador o con las cookies borradas, se vuelve a escribir el nombre y aplica el «¿Sos vos?» de D-002.

---

## D-011 · Evidencias en un bucket privado de Supabase Storage

**Fecha:** 2026-11-16 · **Pidió:** DIA

**Contexto.** Las evidencias (fotos y PDF) se guardaban en disco. Vercel no tiene disco persistente: adjuntar una evidencia fallaba en producción.

**Decisión.** Con `SUPABASE_URL` y `SUPABASE_SECRET_KEY`, y una base real, las evidencias van a un **bucket privado** (`evidencias` por defecto) con el cliente oficial `@supabase/supabase-js`. El bucket admite 8 MB por archivo y solo JPG, PNG, WebP y PDF, los mismos límites que valida la app (`src/domain/evidencias.ts`). No hay URL pública ni firmada: el servidor lee el archivo con la clave secreta y lo sirve por `/evidencias/<id>` con la misma sesión, CSP y permisos de antes. La base sigue guardando solo la ruta relativa (`AAAA-MM/<uuid>.ext`), igual que en disco. En modo local siempre se usa el disco. `npm run almacenamiento:preparar` crea el bucket y lo prueba.

**Consecuencias.** La clave secreta salta RLS en Supabase: va solo en el servidor (variable de Vercel marcada como sensible y `.env.local`), nunca con prefijo `NEXT_PUBLIC_`. Si borrar un archivo falla después de un error al guardar, queda un archivo huérfano en el bucket; se registra en el log (`almacen.borrar_fallo`).

---

## D-010 · Contraseña del panel a elección de cada persona (excepción al estándar 03)

**Fecha:** 2026-11-16 · **Pidió:** DIA

**Contexto.** El panel exigía 12 caracteres, al menos 5 distintos, que no fuera una contraseña común ni contuviera el usuario. El equipo pidió poder elegir cualquier contraseña, incluso una corta como `123456`.

**Decisión.** La contraseña nueva solo tiene que no estar vacía y no superar 128 caracteres (tope que protege al servidor, no a la cuenta). Se mantienen el cifrado con scrypt, el límite de intentos (5 cada 15 minutos por cuenta y 20 por IP), la sesión de 60 minutos y la contraseña temporal que obliga a elegir una propia.

**Consecuencias.** Se advirtió que el panel está publicado en internet y que una contraseña corta o común se adivina en los primeros intentos, antes de que actúe el límite. Si una cuenta de administrador queda expuesta, puede crear cuentas y descargar todos los informes. Revisar esta decisión si el panel pasa a tener más usuarios o datos sensibles.

---

## D-009 · El equipo ingresa al panel con su correo

**Fecha:** 2026-11-16 · **Pidió:** DIA

**Contexto.** D-003 dejó un ingreso propio con usuario y contraseña, y el usuario tenía la forma `nombre.apellido`. El equipo prefiere ingresar con el correo, como en sus otros sistemas.

**Decisión.** El usuario del panel es un **correo** (en minúsculas, hasta 254 caracteres). Los usuarios cortos anteriores siguen valiendo. La regla está en `src/domain/usuario-admin.ts` y la misma, como check, en la base (`20261116120000_usuario_admin_con_correo.sql`). La contraseña sigue siendo la del panel (scrypt): **no** se usan las cuentas de Supabase Auth, y D-003 sigue vigente en todo lo demás. Las reglas de la contraseña están en D-010. El administrador local pasa a ser `admin@dim360.local`.

**Consecuencias.** Las cuentas se siguen creando con `npm run admin:crear -- --usuario correo@… --nombre "…"` o desde Equipo. No se manda ningún correo: la contraseña temporal se muestra una sola vez a quien la crea.

---

## D-008 · La estética sigue a Applaza, no a CementerIA (excepción al estándar 04)

**Fecha:** 2026-11-15 · **Pidió:** DIA

**Contexto.** El estándar 04 toma CementerIA como referente visual (barra lateral azul noche, Inter). El área prefiere el lenguaje de Applaza para DIM360 QA.

**Decisión.** Se adopta el kit visual de Applaza (`Applaza/app/globals.css`, sección «Rediseño identidad municipal»):

- Paleta: azul `#0166ff` dominante, marino `#09234c` para títulos, celeste `#2db0ff`, amarillo `#f4dc00` solo como acento, fondo `#f5f8fe`. Siguen siendo tokens con nombre de rol en `src/app/globals.css`.
- Tipografía: **Outfit** para títulos y **DM Sans** para el texto, autoalojadas con `@fontsource-variable/*` (nunca Google Fonts).
- Barra superior blanca con la marca combinada (isologo + «Ciudad San Miguel de Tucumán» + DIM360 QA) en lugar de la barra lateral; debajo de 1280 px, menú que entra desde la derecha.
- Portadas azules con ondas celeste, amarilla y blanca en los inicios del portal y del panel; pantallas de ingreso con portada clara y tarjeta con filete amarillo.
- Tarjetas de 18 px de radio, botones píldora, antetítulos y títulos de sección con la hoja amarilla.

No se trae a Migue: es la mascota de Applaza.

**Consecuencias.** El estándar 04 sigue valiendo en todo lo demás (contraste, foco visible, 375 px sin desplazamiento horizontal, sin colores sueltos en componentes). Los informes PDF conservan su diseño.

---

## D-007 · Reserva temporal de pruebas de 30 minutos

**Fecha:** 2026-11-13 · **Decidió:** DIA

**Contexto.** El pedido exige evitar que dos personas prueben la misma función a la vez, sin bloquear el trabajo si alguien abandona.

**Decisión.** «Empezar a probar» crea una fila en `reservas` (una por prueba, `vence_at`). Dura `RESERVA_MINUTOS` (30 por defecto) y el formulario abierto la renueva cada 4 minutos. Otra persona no puede tomarla ni guardar mientras esté vigente; vencida, queda libre. Al guardar o cancelar se libera.

**Consecuencias.** Si alguien deja el formulario abierto, la prueba sigue reservada a su nombre: el portal muestra quién la tiene y hasta qué hora.

---

## D-006 · Repetir una prueba evaluada: aviso, no bloqueo

**Fecha:** 2026-11-13 · **Pidió:** DIA (pedido del 2026-11-13, punto 4)

**Decisión.** Si una prueba ya tiene resultado, «Registrar una nueva evaluación» muestra quién la probó, cuándo y con qué resultado, y pide confirmar. Si el equipo pidió revalidarla (incidencia corregida), no se pregunta: es una revalidación autorizada. Cada evaluación es una fila nueva (`repetida` o `es_revalidacion`), nunca se pisa la anterior.

---

## D-005 · Prioridad de la incidencia separada de la sugerida

**Fecha:** 2026-11-13 · **Pidió:** DIA (punto 8)

**Decisión.** El relevador puede sugerir P0–P3 al marcar «No funciona» o «Parcial» (`ejecuciones.prioridad_sugerida`). La definitiva vive en `incidencias.prioridad`, la cambia el equipo y cada cambio queda en `incidencia_eventos` con quién y cuándo.

---

## D-004 · Marcar como corregida pide revalidación; no cambia el resultado

**Fecha:** 2026-11-13 · **Pidió:** DIA (punto 9)

**Decisión.** El paso a «Corregida, pendiente de validar» exige la solución aplicada y crea un pedido en `revalidaciones`. La prueba aparece en el portal como «Requiere nueva validación» hasta que alguien la vuelve a probar; esa ejecución resuelve el pedido y queda en el historial de la incidencia. Cerrar sin una revalidación que funcione exige un comentario. Reabrir exige decir qué sigue fallando.

---

## D-003 · El panel usa usuario y contraseña propios (excepción al estándar 03)

**Fecha:** 2026-11-15 · **Decidió:** DIA

**Contexto.** El panel lo usan pocas personas del equipo de la DIA. Integrar un ingreso externo complejizaría el sistema sin necesidad.

**Decisión.** Usuario y contraseña con scrypt (copia de `CementerIA/src/lib/auth/clave.ts`), límite de 5 intentos fallidos cada 15 minutos por usuario (y 20 por IP) en la base, sesión `jose` de 60 minutos renovada por el proxy y 10 horas como máximo, `sesion_version` para cerrar sesiones, contraseña temporal que obliga a elegir una propia. El primer usuario en producción se crea con `npm run admin:crear`.

**Consecuencias.** Es el ingreso definitivo del panel: no hay integración pendiente con otro sistema de ingreso.

---

## D-002 · Relevadores sin contraseña: nombre declarado + sesión interna

**Fecha:** 2026-11-13 · **Pidió:** DIA (pedido del 2026-11-13, puntos 1 y 2)

**Contexto.** El pedido reemplaza el registro con contraseña por un ingreso solo con nombre y apellido.

**Decisión.**
- Cada ingreso crea una fila en `sesiones_relevador`; su id viaja firmado en la cookie y cada ejecución guarda `relevador_id`, `sesion_id` y el nombre declarado.
- El nombre se normaliza para mostrar (`normalizarNombre`) y se compara con una clave sin mayúsculas, espacios ni tildes (`claveNombre`).
- Si la clave coincide con alguien que ya ingresó **desde este navegador** (cookie `dim360-dispositivo`, firmada), es esa persona. Si coincide con alguien de otro dispositivo, se pregunta «¿Sos vos?»; «Soy otra persona» crea otro perfil. Nunca se fusionan solos.
- El panel muestra los perfiles con el mismo nombre para que el equipo los distinga.

**Consecuencias.** Un nombre no prueba la identidad: cualquiera puede escribir cualquier nombre. Por eso el portal no da ningún permiso de administración y todo queda trazado por sesión.

---

## D-001 · Seguimos los estándares DIA

**Fecha:** 2026-11-13 · **Decidió:** Dirección de Inteligencia Artificial

**Decisión.** El proyecto sigue `estandares-dia` (Next 16, Tailwind 4, zod, Postgres con PGlite local, guía visual con `#0066FF`, voseo, capas `app → features → domain/lib`).

**Excepciones a la fecha:**
- D-003 (ingreso al panel con usuario y contraseña propios).
- Motor: postgres.js sin fijar rol por transacción. RLS está activado en todas las tablas y sin políticas: la app se conecta como dueña y es la única puerta; la Data API de Supabase (anon/authenticated) no ve nada.
- Migraciones en `migraciones_aplicadas` (no en `supabase_migrations.schema_migrations`), porque la base puede no ser Supabase.
- Todavía sin e2e de Playwright (pendiente en el README).
