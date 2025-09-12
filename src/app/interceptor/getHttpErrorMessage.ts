export function getHttpErrorMessage(err: any, fallback = 'Ocurrió un error'): string {
  // Backend comunes: {message}, {error}, {errors:[...]} etc.
  if (!err) return fallback;

  const body = err.error ?? {};
  const fromBody = body.message ?? body.error ?? body.title ?? null;
  const fromErr = err.message ?? null;

  // 422 con detalles de validación
  if (Array.isArray(body.errors) && body.errors.length) {
    const first = body.errors[0];
    const detail = first?.defaultMessage || first?.message || JSON.stringify(first);
    return fromBody ? `${fromBody}: ${detail}` : detail;
  }

  // red amigable por status
  switch (err.status) {
    case 0:   return 'No hay conexión con el servidor.';
    case 400: return fromBody ?? 'Solicitud inválida (400).';
    case 401: return fromBody ?? 'Sesión expirada o credenciales inválidas (401).';
    case 403: return fromBody ?? 'No tienes permisos para esta acción (403).';
    case 404: return fromBody ?? 'Recurso no encontrado (404).';
    case 409: return fromBody ?? 'Conflicto de datos (409).';
    case 422: return fromBody ?? 'Datos inválidos (422).';
    case 500: return fromBody ?? 'Error interno del servidor (500).';
    default:  return fromBody ?? fromErr ?? fallback;
  }
}
