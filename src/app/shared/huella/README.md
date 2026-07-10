# Huella digital (DigitalPersona)

Cadena completa de la integración:

1. `src/assets/websdk/websdk.js` — SDK real de HID/DigitalPersona, cargado como
   script global vía `angular.json` ("scripts"). Define `window.WebSdk`.
2. `src/shims/WebSdk/` — paquete npm falso (`"WebSdk": "file:src/shims/WebSdk"` en
   package.json). Resuelve el `require('WebSdk')` del bundle UMD de
   `@digitalpersona/devices` reexportando el global.
3. `@digitalpersona/devices` — parchado vía patch-package
   (`patches/@digitalpersona+devices+0.2.6.patch`). NO quitar el patch.
4. `huella-reader-singleton.ts` — UNA sola instancia de FingerprintReader por
   proceso (evita sockets duplicados contra el agente local).
5. `huella-modal/` — UI de captura; la usan inscripción, reinscripción,
   agregar-membresía, asesoría, asistencia y socio-modal.

El agente de DigitalPersona corre local (ver FINGERPRINT_CAPTURE_URL en environments).
Si la huella "no funciona": primero verificar que el agente local está corriendo,
luego esta cadena EN ESTE ORDEN.
