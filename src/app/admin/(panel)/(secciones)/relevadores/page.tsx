import Link from "next/link";
import { Users } from "lucide-react";
import { Aviso, EncabezadoPagina, EstadoVacio, Tarjeta } from "@/components/ui";
import { puede } from "@/domain/permisos";
import { listarRelevadores } from "@/features/admin/consultas";
import { BorrarRelevador } from "@/features/admin/components/borrar-relevador";
import { CLASE_TABLA, CLASE_TD, CLASE_TH, CLASE_THEAD } from "@/features/admin/components/filtros";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";

export const metadata = { title: "Relevadores" };

export default async function Relevadores() {
  const admin = await exigirAdmin();
  const puedeBorrar = puede(admin.rol, "usuarios.gestionar");
  const filas = await conBase((q) => listarRelevadores(q));
  const conHomonimos = filas.filter((f) => f.homonimos > 1).length;
  return (
    <div className="space-y-6">
      <EncabezadoPagina
        antetitulo="Personal de la DIM"
        titulo="Relevadores"
        descripcion={`Cada relevador se identificó solo con nombre y apellido: es un nombre declarado, no una identidad verificada. Cada ejecución queda atada además a la sesión interna desde la que se hizo.${puedeBorrar ? " Se puede borrar a quien todavía no registró pruebas." : ""}`}
      />
      {conHomonimos > 0 ? (
        <Aviso tipo="advertencia" titulo="Hay perfiles con el mismo nombre">
          El sistema no los une solo: puede tratarse de dos personas distintas. Se distinguen por el número de perfil.
        </Aviso>
      ) : null}
      {filas.length === 0 ? (
        <EstadoVacio icono={Users} titulo="Todavía no ingresó nadie al portal" />
      ) : (
        <Tarjeta className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className={CLASE_TABLA}>
              <caption className="sr-only">Relevadores</caption>
              <thead className={CLASE_THEAD}>
                <tr>
                  <th scope="col" className={CLASE_TH}>Nombre declarado</th>
                  <th scope="col" className={CLASE_TH}>Perfil</th>
                  <th scope="col" className={`${CLASE_TH} text-right`}>Pruebas registradas</th>
                  <th scope="col" className={`${CLASE_TH} text-right`}>Sesiones</th>
                  <th scope="col" className={CLASE_TH}>Primer ingreso</th>
                  <th scope="col" className={CLASE_TH}>Último ingreso</th>
                  <th scope="col" className={CLASE_TH}>Última prueba</th>
                  {puedeBorrar ? (
                    <th scope="col" className={CLASE_TH}>
                      Acciones
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {filas.map((r) => (
                  <tr key={r.id} className="hover:bg-fondo">
                    <td className={`${CLASE_TD} font-semibold`}>
                      {r.ejecuciones > 0 ? (
                        <Link href={`/admin/pruebas?relevador=${r.id}`} className="hover:text-primario-oscuro hover:underline">
                          {r.nombre}
                        </Link>
                      ) : (
                        r.nombre
                      )}
                      {r.homonimos > 1 ? <span className="ml-2 text-xs font-normal text-advertencia">mismo nombre que otro perfil</span> : null}
                    </td>
                    <td className={`${CLASE_TD} font-mono text-xs text-texto-secundario`}>#{r.id.slice(0, 8)}</td>
                    <td className={`${CLASE_TD} text-right tabular-nums`}>{r.ejecuciones}</td>
                    <td className={`${CLASE_TD} text-right tabular-nums`}>{r.sesiones}</td>
                    <td className={`${CLASE_TD} whitespace-nowrap`}>{fechaHora(r.creado_at)}</td>
                    <td className={`${CLASE_TD} whitespace-nowrap`}>{fechaHora(r.ultimo_ingreso_at)}</td>
                    <td className={`${CLASE_TD} whitespace-nowrap`}>{r.ultima_ejecucion ? fechaHora(r.ultima_ejecucion) : "—"}</td>
                    {puedeBorrar ? (
                      <td className={CLASE_TD}>
                        {r.ejecuciones > 0 ? (
                          <span className="text-xs text-texto-secundario">Tiene pruebas: se conserva</span>
                        ) : r.sugerencias > 0 ? (
                          <span className="text-xs text-texto-secundario">Dejó sugerencias: se conserva</span>
                        ) : (
                          <BorrarRelevador id={r.id} nombre={r.nombre} />
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
