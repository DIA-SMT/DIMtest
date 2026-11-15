// Claves de error estables (las lanzan la base y el dominio) → mensajes para la pantalla.
const ERRORES: Record<string, string> = {
  no_autenticado: "Se venció tu sesión. Ingresá de nuevo.",
  sin_permiso: "No tenés permisos para hacer esto.",
  limite_intentos: "Hiciste muchos intentos. Esperá 15 minutos y probá de nuevo.",
  credenciales: "El usuario o la contraseña no son correctos.",
  usuario_inactivo: "Ese usuario está desactivado. Pedile a un administrador que lo habilite.",
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
  usuario_repetido: "Ya existe un usuario con ese nombre de usuario.",
  clave_actual_incorrecta: "La contraseña actual no es correcta.",
  archivo_tipo: "Solo se aceptan fotos (JPG, PNG o WebP) o PDF.",
  archivo_tamano: "Cada archivo puede pesar hasta 8 MB.",
  archivo_cantidad: "Podés adjuntar hasta 5 archivos por vez.",
  solo_insercion: "Este registro es histórico y no se puede modificar.",
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
