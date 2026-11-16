-- El panel acepta el correo como usuario (D-009). Los usuarios cortos existentes siguen valiendo.
-- La regla es la misma que src/domain/usuario-admin.ts. Solo amplía: ninguna fila existente deja de cumplirla.
alter table usuarios_admin drop constraint usuarios_admin_usuario_check;

alter table usuarios_admin add constraint usuarios_admin_usuario_check check (
  usuario ~ '^[a-z0-9._-]{3,40}$'
  or (
    char_length(usuario) <= 254
    and usuario ~ '^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'
  )
);
