import { EncabezadoPagina, Tarjeta } from "@/components/ui";
import { FormCambioClave } from "@/features/admin/components/gestion-usuarios";
import { MiWhatsapp } from "@/features/agente/components/formularios";
import { whatsappDe } from "@/features/agente/servicio";
import { exigirAdmin } from "@/lib/auth/admin";
import { conBase } from "@/lib/db";

export const metadata = { title: "Mi cuenta" };

export default async function Cuenta() {
  const admin = await exigirAdmin();
  const w = await conBase((q) => whatsappDe(q, admin.id));
  return (
    <div className="max-w-xl space-y-6">
      <EncabezadoPagina antetitulo={admin.usuario} titulo="Mi cuenta" />
      <Tarjeta className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-bold">Mi contraseña</h2>
          <p className="text-sm text-texto-secundario">Al cambiarla se cierran tus otras sesiones abiertas.</p>
        </div>
        <FormCambioClave />
      </Tarjeta>
      <Tarjeta className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-bold">Avisos del agente por WhatsApp</h2>
          <p className="text-sm text-texto-secundario">
            El agente Claude avisa cuando empieza a trabajar en una incidencia, cuando publica una corrección y cuando necesita a una persona.
          </p>
        </div>
        <MiWhatsapp whatsapp={w.whatsapp} avisos={w.avisos_agente} />
      </Tarjeta>
    </div>
  );
}
