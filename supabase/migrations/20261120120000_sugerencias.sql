-- Sugerencias de los relevadores (D-017): funciones nuevas, mejoras e ideas para DIM360.
-- Las escriben en el portal; el equipo las ve en el panel, les cambia el estado y les
-- responde, y el relevador ve la respuesta. Solo agrega.

create table sugerencias (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity unique,
  relevador_id uuid not null references relevadores (id),
  -- El nombre declarado al momento de escribirla, como en ejecuciones.
  relevador_nombre text not null,
  tipo text not null check (tipo in ('nueva_funcion', 'mejora', 'otra')),
  -- Módulo del checklist al que se refiere; null si es general.
  modulo_codigo text references modulos (codigo),
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  detalle text not null check (char_length(btrim(detalle)) between 10 and 2000),
  estado text not null default 'nueva'
    check (estado in ('nueva', 'en_evaluacion', 'planificada', 'hecha', 'descartada')),
  -- Lo que el equipo le contesta al relevador (lo ve en el portal).
  respuesta text not null default '' check (char_length(respuesta) <= 2000),
  respondida_por text,
  respondida_at timestamptz,
  creada_at timestamptz not null default now()
);
create index sugerencias_estado_idx on sugerencias (estado, creada_at desc);
create index sugerencias_relevador_idx on sugerencias (relevador_id, creada_at desc);

alter table sugerencias enable row level security;
