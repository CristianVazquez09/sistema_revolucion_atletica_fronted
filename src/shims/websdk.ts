declare global {
  interface Window { WebSdk: any }
}
const WebSdk = (globalThis as any).WebSdk;
if (!WebSdk) {
  console.warn('[WebSdk shim] window.WebSdk no está cargado. Asegúrate de incluir src/assets/websdk/websdk.js');
}
export default WebSdk;
export { WebSdk };
