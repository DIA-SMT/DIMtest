import Link from "next/link";
import { Aviso, CONTENEDOR, PieInstitucional } from "@/components/ui";
import { NOMBRE_ROL, puede } from "@/domain/permisos";
import { metricas } from "@/features/admin/consultas";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { Navegacion } from "./navegacion";

/** Panel del equipo: barra superior blanca con la marca de la ciudad. Cada página vuelve a exigir la sesión. */
export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const admin = await exigirAdmin();
  const m = await conBase((q) => metricas(q));
  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <Navegacion
        nombre={admin.nombre}
        rol={NOMBRE_ROL[admin.rol]}
        puedeUsuarios={puede(admin.rol, "usuarios.gestionar")}
        sinRevisar={m.observaciones_sin_revisar}
        criticas={m.incidencias_criticas}
        sugerenciasNuevas={m.sugerencias_nuevas}
      />
      <main id="contenido" className="flex-1">
        {admin.debeCambiarClave ? (
          <div className={`${CONTENEDOR} pt-5`}>
            <Aviso
              tipo="advertencia"
              titulo="Estás usando una contraseña temporal"
              accion={
                <Link href="/admin/cuenta" className="font-semibold text-primario-oscuro underline">
                  Elegí tu contraseña
                </Link>
              }
            />
          </div>
        ) : null}
        {children}
      </main>
      <PieInstitucional />
    </div>
  );
}
