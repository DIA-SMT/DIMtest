// Crea un usuario del panel de administración con una contraseña temporal.
//   npm run admin:crear -- --usuario nombre@smt.gob.ar --nombre "Nombre Apellido" [--rol administrador|desarrollador]
// La contraseña temporal se muestra una sola vez; al ingresar, el panel pide cambiarla.
// Sirve para el primer administrador en producción (en modo local ya existe admin@dim360.local).
import { normalizarUsuario, problemaUsuario } from "../src/domain/usuario-admin.ts";
import { generarClaveTemporal, hashearClave } from "../src/lib/auth/clave.ts";
import { argumento, conectar } from "./lib.mjs";

const usuario = normalizarUsuario(argumento("usuario") ?? "");
const nombre = (argumento("nombre") ?? "").trim();
const rol = argumento("rol") ?? "administrador";
const problema = problemaUsuario(usuario);
if (problema || nombre.length < 3 || !["administrador", "desarrollador"].includes(rol)) {
  if (problema) console.error(problema);
  console.error('Uso: npm run admin:crear -- --usuario nombre@smt.gob.ar --nombre "Nombre Apellido" [--rol administrador|desarrollador]');
  process.exit(1);
}

const { db, cerrar } = await conectar();
try {
  const [existe] = await db.query("select 1 from usuarios_admin where usuario = $1", [usuario]);
  if (existe) {
    console.error(`Ya existe el usuario ${usuario}. Para darle otra contraseña, usá «Nueva contraseña temporal» en /admin/usuarios.`);
    process.exitCode = 1;
  } else {
    const temporal = generarClaveTemporal();
    await db.query("insert into usuarios_admin (usuario, nombre, rol, clave_hash, debe_cambiar_clave) values ($1, $2, $3, $4, true)", [
      usuario,
      nombre,
      rol,
      await hashearClave(temporal),
    ]);
    await db.query("insert into auditoria (accion, usuario_nombre, detalle) values ('usuario.crear', 'script admin:crear', $1::text::jsonb)", [
      JSON.stringify({ usuario, rol }),
    ]);
    console.log(`Usuario ${usuario} (${rol}) creado. Contraseña temporal: ${temporal}`);
  }
} finally {
  await cerrar();
}
