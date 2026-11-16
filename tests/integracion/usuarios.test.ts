// La base acepta el correo como usuario del panel (migración 20261116120000, D-009)
// con la misma regla que src/domain/usuario-admin.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { problemaUsuario } from "@/domain/usuario-admin";
import { baseDePrueba } from "./base";

let base: Awaited<ReturnType<typeof baseDePrueba>>;
beforeAll(async () => {
  base = await baseDePrueba();
});
afterAll(async () => {
  await base.cerrar();
});

async function alta(usuario: string) {
  return base.tx((q) =>
    q("insert into usuarios_admin (usuario, nombre, rol, clave_hash) values ($1, 'Equipo DIA', 'administrador', 'scrypt$1$1$1$x$y')", [usuario]),
  );
}

describe("usuarios del panel con correo", () => {
  it("guarda correos y sigue aceptando los usuarios cortos", async () => {
    await expect(alta("direccion.ia@smt.gob.ar")).resolves.toBeDefined();
    await expect(alta("nombre.apellido")).resolves.toBeDefined();
  });

  it("la base rechaza lo mismo que la app", async () => {
    for (const malo of ["sin-arroba@", "a@b", "MAYUS@smt.gob.ar", "con espacio@smt.gob.ar"]) {
      expect(problemaUsuario(malo), malo).not.toBeNull();
      await expect(alta(malo), malo).rejects.toThrow(/usuarios_admin_usuario_check/);
    }
  });

  it("no se repite un correo", async () => {
    await expect(alta("direccion.ia@smt.gob.ar")).rejects.toThrow();
  });
});
