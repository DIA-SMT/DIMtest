import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { RE_RUTA } from "@/domain/evidencias";
import { almacenDisco, almacenSupabase, nuevaRuta, type Almacen } from "./almacenamiento";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

/** Cliente de Supabase de mentira: un Map por bucket, con los mismos retornos {data, error}. */
function clienteFalso() {
  const buckets = new Map<string, Map<string, { datos: Buffer; tipo: string }>>();
  const llamadas: string[] = [];
  const storage = {
    from(bucket: string) {
      const b = buckets.get(bucket) ?? new Map();
      buckets.set(bucket, b);
      return {
        async upload(ruta: string, datos: Buffer, op: { contentType: string; upsert: boolean }) {
          llamadas.push(`upload ${bucket}/${ruta} ${op.contentType} upsert=${op.upsert}`);
          if (b.has(ruta)) return { data: null, error: { message: "The resource already exists" } };
          b.set(ruta, { datos, tipo: op.contentType });
          return { data: { path: ruta }, error: null };
        },
        async download(ruta: string) {
          const a = b.get(ruta);
          return a ? { data: new Blob([new Uint8Array(a.datos)]), error: null } : { data: null, error: { message: "Object not found" } };
        },
        async remove(rutas: string[]) {
          for (const r of rutas) b.delete(r);
          return { data: [], error: null };
        },
      };
    },
  };
  return { cliente: { storage } as unknown as Parameters<typeof almacenSupabase>[0], buckets, llamadas };
}

async function idaYVuelta(almacen: Almacen) {
  const ruta = nuevaRuta("image/png");
  await almacen.guardar(ruta, png, "image/png");
  expect(await almacen.leer(ruta)).toEqual(png);
  await expect(almacen.guardar(ruta, png, "image/png"), "no pisa un archivo existente").rejects.toThrow();
  await almacen.borrar([ruta]);
  await expect(almacen.leer(ruta)).rejects.toThrow();
}

describe("almacén de evidencias", () => {
  it("las rutas nuevas tienen mes y un id al azar, y no se repiten", () => {
    const r = nuevaRuta("application/pdf", new Date("2026-11-16T12:00:00Z"));
    expect(r).toMatch(/^2026-11\/[0-9a-f-]{36}\.pdf$/);
    expect(RE_RUTA.test(r)).toBe(true);
    expect(nuevaRuta("image/png")).not.toBe(nuevaRuta("image/png"));
    expect(RE_RUTA.test("../../etc/passwd")).toBe(false);
  });

  const carpeta = path.join(os.tmpdir(), `dim360-almacen-${process.pid}`);
  afterAll(() => fs.rm(carpeta, { recursive: true, force: true }));

  it("disco: guarda, lee, no pisa y borra; no sale de su carpeta", async () => {
    const disco = almacenDisco(carpeta);
    await idaYVuelta(disco);
    await expect(disco.leer("../fuera.png")).rejects.toThrow("ruta_invalida");
  });

  it("bucket de Supabase: guarda con su tipo, sin pisar, lee y borra", async () => {
    const { cliente, buckets, llamadas } = clienteFalso();
    const bucket = almacenSupabase(cliente, "evidencias");
    expect(bucket.tipo).toBe("supabase");
    await idaYVuelta(bucket);
    expect(llamadas[0]).toMatch(/^upload evidencias\/\d{4}-\d{2}\/[0-9a-f-]{36}\.png image\/png upsert=false$/);
    expect(buckets.get("evidencias")?.size).toBe(0);
  });
});
