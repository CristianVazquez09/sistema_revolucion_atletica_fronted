// ESM
// Este módulo no hace nada más que existir para que el import 'WebSdk' no falle.
// La librería real la cargas como script global (websdk.js) en angular.json.
const g = globalThis || window;
export default g.WebSdk;
export const WebSdk = g.WebSdk;
