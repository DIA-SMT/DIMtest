-- Agente Claude (D-015): corrige incidencias de DIM360 desde una máquina de la red municipal.
-- Este panel es la cola de trabajo y el registro: qué se le pidió, qué hizo y a quién avisó.
-- Solo agrega; la única regla que cambia (tipos de evento) se amplía, ninguna fila deja de cumplirla.

-- Personas del equipo: WhatsApp para los avisos y la cuenta del agente.
alter table usuarios_admin add column es_agente boolean not null default false;
alter table usuarios_admin add column whatsapp text check (whatsapp ~ '^\+[1-9][0-9]{7,14}$');
alter table usuarios_admin add column avisos_agente boolean not null default false;

-- La cuenta del agente firma sus eventos en el historial. No puede ingresar al panel:
-- su clave no es un hash válido y el ingreso rechaza las cuentas de agente.
insert into usuarios_admin (usuario, nombre, rol, clave_hash, debe_cambiar_clave, es_agente)
values ('agente@dim360.local', 'Claude (agente)', 'desarrollador', 'scrypt$sin-ingreso', false, true);

-- Una sola fila de configuración. Arranca apagado.
create table agente_config (
  id boolean primary key default true check (id),
  -- Interruptor general: apagado, el agente no recibe trabajos.
  activo boolean not null default false,
  -- Pedir trabajo solo al crear cada incidencia (con las prioridades de abajo).
  automatico boolean not null default false,
  prioridades_automaticas text[] not null default '{P2,P3}'
    check (prioridades_automaticas <@ array['P0', 'P1', 'P2', 'P3']),
  -- Si puede mergear y publicar en test; si no, deja el PR abierto.
  publicar boolean not null default true,
  -- sha256 del token del agente (el token se muestra una sola vez).
  token_hash text check (token_hash ~ '^[0-9a-f]{64}$'),
  token_creado_at timestamptz,
  ultimo_contacto_at timestamptz,
  actualizado_por text not null default 'sistema',
  actualizado_at timestamptz not null default now()
);
insert into agente_config default values;

-- Cada pedido al agente sobre una incidencia.
create table trabajos_agente (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity unique,
  incidencia_id uuid not null references incidencias (id),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'terminado', 'fallido', 'cancelado')),
  origen text not null check (origen in ('manual', 'automatico')),
  pedido_por text not null,
  pedido_at timestamptz not null default now(),
  tomado_at timestamptz,
  latido_at timestamptz,
  terminado_at timestamptz,
  resultado text check (resultado in ('desplegado', 'ya_resuelto', 'pr_abierto', 'requiere_ok', 'bloqueado')),
  resumen text not null default '' check (char_length(resumen) <= 4000),
  -- [{ "texto": "PR #12", "url": "https://github.com/..." }]
  enlaces jsonb not null default '[]'::jsonb check (jsonb_typeof(enlaces) = 'array'),
  -- Solo un trabajo terminado tiene resultado.
  constraint trabajos_agente_terminado_check check ((estado = 'terminado') = (resultado is not null))
);
-- A lo sumo un trabajo vivo por incidencia.
create unique index trabajos_agente_vivo_idx on trabajos_agente (incidencia_id) where estado in ('pendiente', 'en_curso');
create index trabajos_agente_cola_idx on trabajos_agente (estado, pedido_at);

-- Avisos a personas (WhatsApp). Se guardan antes de enviarse: si el envío falla, queda registrado.
create table notificaciones (
  id integer generated always as identity primary key,
  usuario_id uuid references usuarios_admin (id),
  destino text,
  canal text not null default 'whatsapp' check (canal in ('whatsapp')),
  texto text not null check (char_length(texto) between 1 and 1000),
  incidencia_id uuid references incidencias (id),
  trabajo_id uuid references trabajos_agente (id),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviada', 'fallida', 'sin_canal')),
  intentos integer not null default 0,
  error text,
  creada_at timestamptz not null default now(),
  enviada_at timestamptz
);
create index notificaciones_pendientes_idx on notificaciones (creada_at) where estado = 'pendiente';

-- El historial de la incidencia registra también lo que informa el agente.
alter table incidencia_eventos drop constraint incidencia_eventos_tipo_check;
alter table incidencia_eventos add constraint incidencia_eventos_tipo_check check (
  tipo in ('creada', 'estado', 'prioridad', 'responsable', 'comentario', 'solucion', 'evidencia', 'revalidacion', 'agente')
);

alter table agente_config enable row level security;
alter table trabajos_agente enable row level security;
alter table notificaciones enable row level security;
