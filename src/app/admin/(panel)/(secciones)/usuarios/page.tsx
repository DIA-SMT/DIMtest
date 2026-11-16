import { EncabezadoPagina, Tarjeta } from "@/components/ui";
import { NOMBRE_ROL } from "@/domain/permisos";
import { listarUsuarios } from "@/features/admin/consultas";
import { AccionesUsuario, NuevoUsuario } from "@/features/admin/components/gestion-usuarios";
import { CLASE_TABLA, CLASE_TD, CLASE_TH, CLASE_THEAD } from "@/features/admin/components/filtros";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";

export const metadata = { title: "Equipo" };

export default async function Usuarios() {
  const admin = await exigirAdmin("usuarios.gestionar");
  const filas = await conBase((q) => listarUsuarios(q));
  return (
    <div className="space-y-6">
      <EncabezadoPagina
        antetitulo="Acceso al panel"
        titulo="Equipo"
        descripcion="Usuarios del panel de administración. Los desarrolladores gestionan incidencias; solo los administradores gestionan usuarios."
      />
      <Tarjeta className="p-5">
        <h2 className="mb-4 text-base font-bold">Nuevo usuario</h2>
        <NuevoUsuario />
      </Tarjeta>
      <Tarjeta className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className={CLASE_TABLA}>
            <caption className="sr-only">Usuarios del equipo</caption>
            <thead className={CLASE_THEAD}>
              <tr>
                <th scope="col" className={CLASE_TH}>Correo</th>
                <th scope="col" className={CLASE_TH}>Rol</th>
                <th scope="col" className={CLASE_TH}>Estado</th>
                <th scope="col" className={`${CLASE_TH} text-right`}>Incid. asignadas</th>
                <th scope="col" className={CLASE_TH}>Último ingreso</th>
                <th scope="col" className={CLASE_TH}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {filas.map((u) => (
                <tr key={u.id} className="hover:bg-fondo">
                  <td className={CLASE_TD}>
                    <span className="font-semibold">{u.nombre}</span>
                    <span className="block font-mono text-xs text-texto-secundario">{u.usuario}</span>
                  </td>
                  <td className={CLASE_TD}>{NOMBRE_ROL[u.rol]}</td>
                  <td className={CLASE_TD}>
                    {u.activo ? (u.debe_cambiar_clave ? "Con contraseña temporal" : "Activo") : <span className="text-texto-secundario">Desactivado</span>}
                  </td>
                  <td className={`${CLASE_TD} text-right tabular-nums`}>{u.asignadas}</td>
                  <td className={`${CLASE_TD} whitespace-nowrap`}>{u.ultimo_ingreso_at ? fechaHora(u.ultimo_ingreso_at) : "—"}</td>
                  <td className={CLASE_TD}>
                    <AccionesUsuario id={u.id} rol={u.rol} activo={u.activo} esYo={u.id === admin.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  );
}
