// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

/**
 * API expuesta al renderer (window.electron)
 * - printTicket(payload)  -> payload: { html, deviceName?, pageWidthMicrons?, dpi?, waitMs? }
 * - printTicket(html, deviceName?, options?) -> compatibilidad con firma corta
 * - listPrinters()
 *
 * UPDATES (Windows):
 * - checkForUpdates() -> fuerza chequeo manual (opcional)
 * - installUpdate()   -> reinicia e instala (cuando ya esté descargada)
 * - onUpdate(...)     -> escucha eventos del updater
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

  /**
   * Suscripción a eventos del updater.
   * event: 'checking' | 'available' | 'not-available' | 'progress' | 'downloaded' | 'error'
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

    // Devuelve función para desuscribirse (buena práctica)
    return () => {
      channels.forEach((ch) => ipcRenderer.removeAllListeners(ch));
    };
  },
});
