import Link from "next/link";
import { Aviso } from "@/components/ui";
import { NOMBRE_ROL, puede } from "@/domain/permisos";
import { metricas } from "@/features/admin/consultas";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { Navegacion } from "./navegacion";

/** Panel del equipo: barra lateral institucional. Cada página vuelve a exigir la sesión. */
export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const admin = await exigirAdmin();
  const m = await conBase((q) => metricas(q));
  return (
    <div className="min-h-dvh bg-fondo lg:flex">
      <Navegacion
        nombre={admin.nombre}
        rol={NOMBRE_ROL[admin.rol]}
        puedeUsuarios={puede(admin.rol, "usuarios.gestionar")}
        sinRevisar={m.observaciones_sin_revisar}
        criticas={m.incidencias_criticas}
      />
      <div className="min-w-0 flex-1">
        <main id="contenido" className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {admin.debeCambiarClave ? (
            <Aviso
              tipo="advertencia"
              titulo="Estás usando una contraseña temporal"
              accion={
                <Link href="/admin/cuenta" className="font-semibold text-primario-oscuro underline">
                  Elegí tu contraseña
                </Link>
              }
            />
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
