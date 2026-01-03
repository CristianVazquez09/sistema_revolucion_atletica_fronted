// src/app/shared/huella/huella-reader-singleton.ts
import { FingerprintReader } from '@digitalpersona/devices';

/**
 * Mantén una sola instancia del FingerprintReader por proceso.
 * Evita múltiples sockets / sesiones contra el Agent.
 */
let _instance: FingerprintReader | null = null;

export function getHuellaReaderSingleton(): FingerprintReader {
  if (!_instance) _instance = new FingerprintReader();
  return _instance;
}

/** Solo si alguna vez quieres liberar el reader “global”. */
export function disposeHuellaReaderSingleton() {
  // Ojo: normalmente no es necesario. Se deja por completitud.
  _instance = null;
}
