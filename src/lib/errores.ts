// Claves de error estables (las lanzan la base y el dominio) → mensajes para la pantalla.
const ERRORES: Record<string, string> = {
  no_autenticado: "Se venció tu sesión. Ingresá de nuevo.",
  sin_permiso: "No tenés permisos para hacer esto.",
  limite_intentos: "Hiciste muchos intentos. Esperá 15 minutos y probá de nuevo.",
  credenciales: "El correo o la contraseña no son correctos.",
  usuario_inactivo: "Esa cuenta está desactivada. Pedile a un administrador que la habilite.",
  reservada_por_otro: "Otra persona está probando esta función ahora. Elegí otra prueba pendiente.",
  reserva_vencida: "Pasó mucho tiempo y la prueba quedó libre. Volvé a tomarla para guardar.",
  sin_reserva: "Primero tocá «Empezar a probar».",
  prueba_inexistente: "Esa prueba no existe en el catálogo.",
  falta_explicacion: "Para este resultado contá qué pasó.",
  falta_solucion: "Escribí la solución aplicada.",
  falta_justificacion: "Escribí por qué se descarta.",
  falta_comentario: "Escribí un comentario.",
  cierre_sin_validacion: "Todavía no hay una revalidación que funcione. Si igual querés cerrarla, dejá un comentario que explique por qué.",
  transicion_invalida: "Ese cambio de estado no está permitido desde el estado actual.",
  incidencia_inexistente: "Esa incidencia no existe.",
  ejecucion_inexistente: "Esa ejecución no existe.",
  usuario_repetido: "Ya existe una cuenta con ese correo.",
  clave_actual_incorrecta: "La contraseña actual no es correcta.",
  archivo_tipo: "Solo se aceptan fotos (JPG, PNG o WebP) o PDF.",
  archivo_tamano: "Cada archivo puede pesar hasta 8 MB.",
  archivo_cantidad: "Podés adjuntar hasta 5 archivos por vez.",
  solo_insercion: "Este registro es histórico y no se puede modificar.",
  // Agente Claude (D-015)
  agente_no_elegible: "Esta incidencia ya está resuelta: no se le puede pedir al agente.",
  agente_ya_pedido: "El agente ya tiene esta incidencia en su cola o la está trabajando.",
  trabajo_inexistente: "Ese trabajo del agente no existe.",
  trabajo_no_en_curso: "Ese trabajo ya no está en curso (lo cancelaron o venció).",
  agente_sin_publicar: "Publicar está apagado: el agente solo puede dejar el PR abierto.",
  whatsapp_invalido: "Escribí el número con el código de país, por ejemplo +54 9 381 555 1234.",
};

export function mensajeError(clave: string | null | undefined): string {
  if (!clave) return "Ocurrió un error. Probá de nuevo.";
  return ERRORES[clave] ?? "Ocurrió un error. Probá de nuevo.";
}

/** Error con clave estable, para cortar una operación y mostrar el mensaje. */
export class ErrorDominio extends Error {
  constructor(public clave: string) {
    super(clave);
  }
}

/** La clave de un error esperable, o null si es inesperado (y tiene que subir). */
export function claveDeError(error: unknown): string | null {
  if (error instanceof ErrorDominio) return error.clave;
  const m = error instanceof Error ? error.message : "";
  return m in ERRORES ? m : null;
}
