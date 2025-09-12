import { HttpContextToken } from '@angular/common/http';

/**
 * Si true, el interceptor NO mostrará notificación.
 * Úsalo en requests donde el componente quiera manejar el error (UI local).
 */
export const NO_GLOBAL_ERROR_TOAST = new HttpContextToken<boolean>(() => true);
