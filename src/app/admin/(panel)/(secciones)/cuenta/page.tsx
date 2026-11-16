import { EncabezadoPagina, Tarjeta } from "@/components/ui";
import { FormCambioClave } from "@/features/admin/components/gestion-usuarios";
import { exigirAdmin } from "@/lib/auth/admin";

export const metadata = { title: "Mi contraseña" };

export default async function Cuenta() {
  const admin = await exigirAdmin();
  return (
    <div className="max-w-xl space-y-6">
      <EncabezadoPagina antetitulo={admin.usuario} titulo="Mi contraseña" descripcion="Al cambiarla se cierran tus otras sesiones abiertas." />
      <Tarjeta className="p-5">
        <FormCambioClave />
      </Tarjeta>
    </div>
  );
}
