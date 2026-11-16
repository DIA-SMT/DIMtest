import { redirect } from "next/navigation";
import { CircleCheck, ClipboardCheck, MessageSquareText, UserRound } from "lucide-react";
import { PantallaIngreso } from "@/components/ingreso";
import { FormIngreso } from "@/features/relevamiento/components/form-ingreso";
import { leerRelevador, relevadoresDelDispositivo } from "@/lib/auth/relevador";
import { conBase } from "@/lib/db";
import { relevadoresConocidos } from "@/features/relevamiento/servicio";
import { TOTAL_MODULOS, TOTAL_PRUEBAS } from "@/domain/catalogo/catalogo";

export const metadata = { title: "Ingreso al relevamiento" };

/** Ingreso del personal de la DIM: solo nombre y apellido. */
export default async function Ingreso() {
  if (await leerRelevador()) redirect("/relevamiento");
  const ids = await relevadoresDelDispositivo();
  const conocidos = ids.length ? await conBase((q) => relevadoresConocidos(q, ids)) : [];

  return (
    <PantallaIngreso
      subtitulo="Relevamiento funcional"
      antetitulo="Municipalidad de San Miguel de Tucumán"
      titulo="Probemos"
      remate="DIM360"
      texto={
        <p>
          Probá el sistema con casos reales y contanos qué funciona y qué no. Tu trabajo define el traspaso de DIM360 a la Dirección de
          Impuestos Municipales.
        </p>
      }
      rasgos={[
        { icono: CircleCheck, texto: `${TOTAL_PRUEBAS} pruebas en ${TOTAL_MODULOS} módulos, del checklist oficial` },
        { icono: ClipboardCheck, texto: "Elegí el módulo que conocés: no hace falta probar todo" },
        { icono: MessageSquareText, texto: "Dejá el caso que usaste y lo que viste" },
      ]}
      icono={UserRound}
      tituloTarjeta="Ingresá para empezar"
      bajada={
        <p>
          {conocidos.length
            ? "Elegí tu nombre de la lista. Si es tu primera vez en este navegador, escribilo."
            : "Solo necesitamos tu nombre. No hace falta registrarse ni crear una contraseña."}
        </p>
      }
      nota={<p>Tus datos se usan solo para registrar quién hizo cada prueba (Ley 25.326 de Protección de Datos Personales).</p>}
    >
      <FormIngreso conocidos={conocidos} />
    </PantallaIngreso>
  );
}
