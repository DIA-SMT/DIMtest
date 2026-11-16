import { describe, expect, it } from "vitest";
import { problemasDeClave } from "@/lib/auth/clave";
import datos from "./catalogo/catalogo-dim360.json";
import { estadoPrueba, estaDisponible } from "./estado-prueba";
import { ESTADOS_INCIDENCIA, transicionesDesde, validarTransicion, pideRevalidacion, cancelaRevalidacion } from "./incidencias";
import { claveNombre, iniciales, normalizarNombre, problemaNombre, primerNombre } from "./nombres";
import { puede } from "./permisos";
import { compararPrioridad, prioridadMaxima, type Prioridad } from "./prioridades";
import { requiereExplicacion, RESULTADOS } from "./resultados";

describe("catálogo extraído del PDF", () => {
  it("tiene las 217 pruebas en 22 módulos, como dice el PDF", () => {
    expect(datos.pruebas).toHaveLength(217);
    expect(datos.totalSegunPdf).toBe(217);
    expect(datos.modulos).toHaveLength(22);
  });

  it("cada módulo tiene la cantidad del índice del PDF y numeración sin saltos", () => {
    for (const m of datos.modulos) {
      const nums = datos.pruebas.filter((p) => p.modulo === m.prefijo).map((p) => p.numero);
      expect(nums.length, m.nombre).toBe(m.cantidadSegunPdf);
      expect(nums, m.nombre).toEqual(nums.map((_, i) => i + 1));
    }
  });

  it("los códigos son únicos, con el formato original y el prefijo de su módulo", () => {
    const codigos = datos.pruebas.map((p) => p.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const p of datos.pruebas) {
      expect(p.codigo).toMatch(/^[A-Z]{2,4}-\d{2}$/);
      expect(p.codigo).toBe(`${p.modulo}-${String(p.numero).padStart(2, "0")}`);
    }
  });

  it("toda prueba tiene perfil, qué probar y resultado esperado", () => {
    for (const p of datos.pruebas) {
      expect(["C", "O", "A", "S", "P"], p.codigo).toContain(p.perfil);
      expect(p.queProbar.length, p.codigo).toBeGreaterThan(8);
      expect(p.resultadoEsperado.length, p.codigo).toBeGreaterThan(8);
      expect(p.queProbar + p.resultadoEsperado, p.codigo).not.toMatch(/Funciona|No probado|OBSERVACIONES/);
    }
  });

  it("conserva casos puntuales tal como figuran en el PDF", () => {
    const porCodigo = new Map(datos.pruebas.map((p) => [p.codigo, p]));
    expect(porCodigo.get("ACC-01")).toMatchObject({
      perfil: "C",
      queProbar: "Ingresar con usuario y clave.",
      resultadoEsperado: "Entra al portal con su perfil. Con clave errada no entra.",
    });
    expect(porCodigo.get("TRA-17")?.perfil).toBe("P");
    expect(porCodigo.get("OT-18")?.queProbar).toBe("App de inspectores: bajar las órdenes asignadas y subir respuestas.");
    expect(porCodigo.get("MIG-11")).toBeDefined();
  });
});

describe("nombres de relevadores", () => {
  it("ordena espacios y mayúsculas sin perder tildes", () => {
    expect(normalizarNombre("  luis   PÉREZ ")).toBe("Luis Pérez");
    expect(normalizarNombre("maría de los ángeles díaz-garcía")).toBe("María de los Ángeles Díaz-García");
    expect(normalizarNombre("agustín o'connor")).toBe("Agustín O'Connor");
  });

  it("la clave ignora mayúsculas, espacios y tildes", () => {
    const clave = claveNombre("Luis Pérez");
    expect(claveNombre("  luis   perez")).toBe(clave);
    expect(claveNombre("LUIS PÉREZ")).toBe(clave);
    expect(claveNombre("Luis Perez.")).toBe(clave);
    expect(claveNombre("Luisa Pérez")).not.toBe(clave);
  });

  it("pide nombre y apellido", () => {
    expect(problemaNombre("")).not.toBeNull();
    expect(problemaNombre("Luis")).toMatch(/nombre y apellido/);
    expect(problemaNombre("12345 678")).not.toBeNull();
    expect(problemaNombre("Luis <script>")).not.toBeNull();
    expect(problemaNombre("Luis Pérez")).toBeNull();
    expect(primerNombre("Luis Pérez")).toBe("Luis");
    expect(iniciales("Luis Pérez")).toBe("LP");
    expect(iniciales("Equipo (desarrollo local)")).toBe("EL");
    expect(iniciales("Ágata")).toBe("ÁG");
  });
});

describe("resultados", () => {
  it("son los cuatro del PDF y solo «Funciona» no exige explicación", () => {
    expect(RESULTADOS).toEqual(["funciona", "no_funciona", "parcial", "no_probado"]);
    expect(RESULTADOS.filter(requiereExplicacion)).toEqual(["no_funciona", "parcial", "no_probado"]);
  });
});

describe("estado de una prueba en el portal", () => {
  it("la reserva manda sobre todo lo demás", () => {
    expect(estadoPrueba({ tieneEjecucion: true, reservaVigente: true, revalidacionPendiente: true })).toBe("en_ejecucion");
  });
  it("una revalidación pendiente se destaca aunque ya tenga resultado", () => {
    expect(estadoPrueba({ tieneEjecucion: true, reservaVigente: false, revalidacionPendiente: true })).toBe("revalidar");
    expect(estaDisponible("revalidar")).toBe(true);
  });
  it("realizada y sin realizar", () => {
    expect(estadoPrueba({ tieneEjecucion: true, reservaVigente: false, revalidacionPendiente: false })).toBe("realizada");
    expect(estadoPrueba({ tieneEjecucion: false, reservaVigente: false, revalidacionPendiente: false })).toBe("sin_realizar");
    expect(estaDisponible("realizada")).toBe(false);
  });
});

describe("prioridades", () => {
  it("P0 es la más urgente", () => {
    const lista: Prioridad[] = ["P2", "P0", "P3", "P1"];
    expect([...lista].sort(compararPrioridad)).toEqual(["P0", "P1", "P2", "P3"]);
    expect(prioridadMaxima(["P3", "P1"])).toBe("P1");
    expect(prioridadMaxima([])).toBeNull();
  });
});

describe("ciclo de una incidencia", () => {
  it("todo estado tiene una salida", () => {
    for (const e of ESTADOS_INCIDENCIA) expect(transicionesDesde(e).length, e).toBeGreaterThan(0);
  });

  it("marcar como corregida exige la solución y pide revalidación", () => {
    expect(validarTransicion({ desde: "en_correccion", hacia: "corregida" })).toBe("falta_solucion");
    expect(validarTransicion({ desde: "en_correccion", hacia: "corregida", solucion: "Se corrigió el cálculo." })).toBeNull();
    expect(pideRevalidacion("corregida")).toBe(true);
  });

  it("no se salta pasos: de reportada no se pasa a corregida ni a cerrada", () => {
    expect(validarTransicion({ desde: "reportada", hacia: "corregida", solucion: "x" })).toBe("transicion_invalida");
    expect(validarTransicion({ desde: "reportada", hacia: "cerrada" })).toBe("transicion_invalida");
  });

  it("cerrar sin una revalidación que funcione exige un comentario", () => {
    expect(validarTransicion({ desde: "corregida", hacia: "cerrada", ultimaRevalidacion: "funciona" })).toBeNull();
    expect(validarTransicion({ desde: "corregida", hacia: "cerrada", ultimaRevalidacion: null })).toBe("cierre_sin_validacion");
    expect(validarTransicion({ desde: "corregida", hacia: "cerrada", ultimaRevalidacion: "no_funciona", comentario: "Validado en reunión." })).toBeNull();
  });

  it("descartar exige justificación y reabrir exige comentario", () => {
    expect(validarTransicion({ desde: "reportada", hacia: "descartada" })).toBe("falta_justificacion");
    expect(validarTransicion({ desde: "cerrada", hacia: "reabierta" })).toBe("falta_comentario");
    expect(validarTransicion({ desde: "cerrada", hacia: "reabierta", comentario: "Sigue fallando con el CUIT 20-…" })).toBeNull();
    expect(cancelaRevalidacion("reabierta")).toBe(true);
  });
});

describe("permisos", () => {
  it("solo el administrador gestiona usuarios; los dos gestionan incidencias", () => {
    expect(puede("administrador", "usuarios.gestionar")).toBe(true);
    expect(puede("desarrollador", "usuarios.gestionar")).toBe(false);
    expect(puede("desarrollador", "incidencias.gestionar")).toBe(true);
    expect(puede(null, "panel.ver")).toBe(false);
  });
});

describe("contraseña del panel (D-010)", () => {
  it("cada persona elige la que quiera: solo no puede estar vacía ni ser gigante", () => {
    expect(problemasDeClave("123456")).toEqual([]);
    expect(problemasDeClave("a")).toEqual([]);
    expect(problemasDeClave("")).toEqual(["Escribí la contraseña nueva."]);
    expect(problemasDeClave("x".repeat(129))).toHaveLength(1);
  });
});
