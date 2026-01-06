// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

/**
 * API expuesta al renderer (window.electron)
 *
 * TICKETS:
 * - printTicket(payload) o printTicket(html, deviceName?, options?)
 * - listPrinters()
 *
 * UPDATES:
 * - checkForUpdates() -> dispara chequeo (y en main salen popups nativos)
 * - installUpdate()   -> instala/reinicia si ya está descargada
 * - onUpdate(cb)      -> escucha eventos 'update:*'
 *
 * OTROS:
 * - getVersion() -> versión actual de la app (útil para mostrar en UI)
 */
contextBridge.exposeInMainWorld('electron', {
  // ----------------- TICKETS -----------------
  printTicket: (htmlOrPayload, deviceName, options) => {
    const payload = (typeof htmlOrPayload === 'string')
      ? Object.assign({ html: htmlOrPayload, deviceName }, options || {})
      : (htmlOrPayload || {});
    return ipcRenderer.invoke('ticket:print', payload);
  },

  listPrinters: () => ipcRenderer.invoke('ticket:listPrinters'),

  // ----------------- UPDATES -----------------
  checkForUpdates: () => ipcRenderer.invoke('app:update-check'),
  installUpdate: () => ipcRenderer.invoke('app:update-install'),

  // ----------------- VERSION -----------------
  getVersion: () => ipcRenderer.invoke('app:version'),

  /**
   * Suscripción a eventos del updater.
   * ch: 'update:checking' | 'update:available' | 'update:not-available'
   *     | 'update:progress' | 'update:downloaded' | 'update:error'
   */
  onUpdate: (callback) => {
    if (typeof callback !== 'function') return;

    const channels = [
      'update:checking',
      'update:available',
      'update:not-available',
      'update:progress',
      'update:downloaded',
      'update:error',
    ];

    channels.forEach((ch) => {
      ipcRenderer.on(ch, (_event, payload) => callback(ch, payload));
    });

    // Devuelve función para desuscribirse
    return () => {
      channels.forEach((ch) => ipcRenderer.removeAllListeners(ch));
    };
  },
});
