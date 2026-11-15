-- DIM360 QA · esquema inicial
--
-- Dos mundos separados:
--   * Relevamiento: el personal de la DIM se identifica solo con nombre y apellido
--     (relevadores + sesiones_relevador) y registra ejecuciones de las pruebas del catálogo.
--   * Administración: el equipo de la DIA, con usuario y contraseña (usuarios_admin),
--     clasifica observaciones y gestiona incidencias hasta su validación.
--
-- Reglas que la base hace cumplir:
--   * El catálogo conserva los códigos originales del PDF (ACC-01…MIG-11) como clave.
--   * Las ejecuciones, el historial de incidencias y la auditoría son solo inserción:
--     un resultado nunca se sobrescribe; una nueva evaluación es una fila nueva.
--   * El estado de una incidencia es independiente del resultado de la prueba.
--
-- RLS: activado en todas las tablas y sin políticas. La app se conecta con el rol
-- dueño de las tablas (no le aplica RLS) y es la única puerta; cualquier otro rol
-- (por ejemplo, la Data API de Supabase con anon o authenticated) no ve nada.

-- ---------------------------------------------------------------------------
-- Catálogo (se carga solo desde src/domain/catalogo/catalogo-dim360.json)
-- ---------------------------------------------------------------------------

create table modulos (
  codigo text primary key check (codigo ~ '^[A-Z]{2,4}$'),
  nombre text not null,
  descripcion text not null default '',
  orden smallint not null unique,
  pagina smallint
);

create table pruebas (
  codigo text primary key check (codigo ~ '^[A-Z]{2,4}-[0-9]{2}$'),
  modulo_codigo text not null references modulos (codigo),
  numero smallint not null,
  perfil text not null check (perfil in ('C', 'O', 'A', 'S', 'P')),
  que_probar text not null,
  resultado_esperado text not null,
  pagina smallint,
  unique (modulo_codigo, numero)
);

-- ---------------------------------------------------------------------------
-- Relevadores: nombre declarado, sin contraseña. No es una identidad verificada.
-- ---------------------------------------------------------------------------

create table relevadores (
  id uuid primary key default gen_random_uuid(),
  -- Tal como lo escribió (con mayúsculas y tildes ordenadas).
  nombre text not null check (char_length(nombre) between 3 and 80),
  -- Para detectar el mismo nombre escrito distinto: minúsculas, sin tildes, un espacio.
  -- No es único a propósito: dos personas pueden llamarse igual.
  nombre_clave text not null,
  creado_at timestamptz not null default now(),
  ultimo_ingreso_at timestamptz not null default now()
);
create index relevadores_nombre_clave_idx on relevadores (nombre_clave);

create table sesiones_relevador (
  id uuid primary key default gen_random_uuid(),
  relevador_id uuid not null references relevadores (id),
  creada_at timestamptz not null default now(),
  ultima_actividad_at timestamptz not null default now(),
  cerrada_at timestamptz
);
create index sesiones_relevador_relevador_idx on sesiones_relevador (relevador_id);

-- ---------------------------------------------------------------------------
-- Equipo de administración
-- ---------------------------------------------------------------------------

create table usuarios_admin (
  id uuid primary key default gen_random_uuid(),
  usuario text not null unique check (usuario ~ '^[a-z0-9._-]{3,40}$'),
  nombre text not null check (char_length(nombre) between 3 and 80),
  rol text not null check (rol in ('administrador', 'desarrollador')),
  -- Formato scrypt$N$r$p$sal$hash (src/lib/auth/clave.ts): una contraseña en texto no entra.
  clave_hash text not null check (clave_hash like 'scrypt$%'),
  debe_cambiar_clave boolean not null default true,
  activo boolean not null default true,
  -- Subirla cierra todas las sesiones abiertas de ese usuario.
  sesion_version integer not null default 1,
  creado_at timestamptz not null default now(),
  ultimo_ingreso_at timestamptz
);

-- Límite de intentos de ingreso (5 cada 15 minutos por usuario y por IP).
create table intentos_ingreso (
  id integer generated always as identity primary key,
  usuario text not null,
  ip text not null,
  exitoso boolean not null,
  creado_at timestamptz not null default now()
);
create index intentos_ingreso_usuario_idx on intentos_ingreso (usuario, creado_at desc);
create index intentos_ingreso_ip_idx on intentos_ingreso (ip, creado_at desc);

-- ---------------------------------------------------------------------------
-- Ejecuciones de pruebas (solo inserción)
-- ---------------------------------------------------------------------------

create table ejecuciones (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity unique,
  prueba_codigo text not null references pruebas (codigo),
  relevador_id uuid not null references relevadores (id),
  sesion_id uuid not null references sesiones_relevador (id),
  -- El nombre con el que se identificó al momento de probar.
  relevador_nombre text not null,
  resultado text not null check (resultado in ('funciona', 'no_funciona', 'parcial', 'no_probado')),
  observaciones text not null default '' check (char_length(observaciones) <= 4000),
  caso_usado text not null default '' check (char_length(caso_usado) <= 300),
  prioridad_sugerida text check (prioridad_sugerida in ('P0', 'P1', 'P2', 'P3')),
  -- Se registró sobre una prueba que ya tenía resultado (aviso confirmado).
  repetida boolean not null default false,
  -- Respondió a un pedido de revalidación del equipo.
  es_revalidacion boolean not null default false,
  creada_at timestamptz not null default now(),
  -- Fallida, parcial o no probada: la explicación es obligatoria.
  constraint ejecuciones_explicacion_check check (resultado = 'funciona' or char_length(btrim(observaciones)) > 0)
);
create index ejecuciones_prueba_idx on ejecuciones (prueba_codigo, creada_at desc);
create index ejecuciones_relevador_idx on ejecuciones (relevador_id);
create index ejecuciones_fecha_idx on ejecuciones (creada_at desc);

-- Reserva temporal: quien abre una prueba la toma por un rato para que nadie la repita en paralelo.
create table reservas (
  prueba_codigo text primary key references pruebas (codigo),
  relevador_id uuid not null references relevadores (id),
  sesion_id uuid not null references sesiones_relevador (id),
  relevador_nombre text not null,
  desde timestamptz not null default now(),
  vence_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Incidencias y correcciones
-- ---------------------------------------------------------------------------

create table incidencias (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity unique,
  prueba_codigo text not null references pruebas (codigo),
  -- La ejecución (y su observación) que la originó, si vino de una.
  ejecucion_id uuid references ejecuciones (id),
  descripcion text not null check (char_length(descripcion) between 3 and 4000),
  resultado_esperado text not null default '' check (char_length(resultado_esperado) <= 2000),
  resultado_observado text not null default '' check (char_length(resultado_observado) <= 4000),
  reportada_por text not null,
  reportada_por_relevador_id uuid references relevadores (id),
  reportada_at timestamptz not null,
  -- La definitiva la administra el equipo; la sugerida es la del relevador.
  prioridad text not null check (prioridad in ('P0', 'P1', 'P2', 'P3')),
  prioridad_sugerida text check (prioridad_sugerida in ('P0', 'P1', 'P2', 'P3')),
  estado text not null default 'reportada' check (
    estado in (
      'reportada', 'en_analisis', 'pendiente_correccion', 'en_correccion',
      'corregida', 'cerrada', 'reabierta', 'descartada'
    )
  ),
  responsable_id uuid references usuarios_admin (id),
  solucion_aplicada text not null default '' check (char_length(solucion_aplicada) <= 4000),
  justificacion_descarte text not null default '' check (char_length(justificacion_descarte) <= 2000),
  creada_por uuid not null references usuarios_admin (id),
  creada_at timestamptz not null default now(),
  actualizada_at timestamptz not null default now(),
  cerrada_at timestamptz,
  constraint incidencias_descarte_check check (estado <> 'descartada' or char_length(btrim(justificacion_descarte)) > 0)
);
create index incidencias_prueba_idx on incidencias (prueba_codigo);
create index incidencias_estado_idx on incidencias (estado, prioridad);

-- Historial de cada incidencia (solo inserción): quién cambió qué y cuándo.
create table incidencia_eventos (
  id integer generated always as identity primary key,
  incidencia_id uuid not null references incidencias (id),
  tipo text not null check (
    tipo in ('creada', 'estado', 'prioridad', 'responsable', 'comentario', 'solucion', 'evidencia', 'revalidacion')
  ),
  valor_anterior text,
  valor_nuevo text,
  comentario text not null default '' check (char_length(comentario) <= 4000),
  usuario_id uuid references usuarios_admin (id),
  usuario_nombre text not null,
  creado_at timestamptz not null default now()
);
create index incidencia_eventos_incidencia_idx on incidencia_eventos (incidencia_id, creado_at);

-- Pedido de nueva validación de una prueba, al marcar una incidencia como corregida.
-- No toca el resultado original: queda pendiente hasta que alguien vuelve a probar.
create table revalidaciones (
  id uuid primary key default gen_random_uuid(),
  prueba_codigo text not null references pruebas (codigo),
  incidencia_id uuid not null references incidencias (id),
  solicitada_at timestamptz not null default now(),
  solicitada_por text not null,
  ejecucion_id uuid references ejecuciones (id),
  resuelta_at timestamptz,
  cancelada_at timestamptz
);
create index revalidaciones_pendientes_idx on revalidaciones (prueba_codigo)
  where ejecucion_id is null and cancelada_at is null;

-- Clasificación de cada observación desde administración (la ejecución no se toca).
create table revisiones_observacion (
  ejecucion_id uuid primary key references ejecuciones (id),
  clasificacion text not null check (clasificacion in ('informativa', 'incidencia')),
  incidencia_id uuid references incidencias (id),
  revisada_por text not null,
  revisada_at timestamptz not null default now()
);

-- Evidencias: archivos de una ejecución (relevador) o de una incidencia (equipo).
create table evidencias (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid references ejecuciones (id),
  incidencia_id uuid references incidencias (id),
  nombre_original text not null check (char_length(nombre_original) between 1 and 200),
  tipo_mime text not null check (tipo_mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  tamano_bytes integer not null check (tamano_bytes > 0),
  ruta text not null unique,
  subida_por text not null,
  creada_at timestamptz not null default now(),
  constraint evidencias_origen_check check (num_nonnulls(ejecucion_id, incidencia_id) = 1)
);
create index evidencias_ejecucion_idx on evidencias (ejecucion_id);
create index evidencias_incidencia_idx on evidencias (incidencia_id);

-- Auditoría de administración (solo inserción).
create table auditoria (
  id integer generated always as identity primary key,
  accion text not null,
  usuario_id uuid,
  usuario_nombre text not null,
  detalle jsonb not null default '{}'::jsonb,
  creado_at timestamptz not null default now()
);
create index auditoria_fecha_idx on auditoria (creado_at desc);

-- ---------------------------------------------------------------------------
-- Solo inserción
-- ---------------------------------------------------------------------------

create function bloquear_cambios() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'solo_insercion' using detail = tg_table_name;
end;
$$;

create trigger ejecuciones_solo_insercion before update or delete on ejecuciones
  for each row execute function bloquear_cambios();
create trigger incidencia_eventos_solo_insercion before update or delete on incidencia_eventos
  for each row execute function bloquear_cambios();
create trigger auditoria_solo_insercion before update or delete on auditoria
  for each row execute function bloquear_cambios();

-- ---------------------------------------------------------------------------
-- RLS en todas las tablas (sin políticas: solo el dueño accede)
-- ---------------------------------------------------------------------------

alter table modulos enable row level security;
alter table pruebas enable row level security;
alter table relevadores enable row level security;
alter table sesiones_relevador enable row level security;
alter table usuarios_admin enable row level security;
alter table intentos_ingreso enable row level security;
alter table ejecuciones enable row level security;
alter table reservas enable row level security;
alter table incidencias enable row level security;
alter table incidencia_eventos enable row level security;
alter table revalidaciones enable row level security;
alter table revisiones_observacion enable row level security;
alter table evidencias enable row level security;
alter table auditoria enable row level security;
