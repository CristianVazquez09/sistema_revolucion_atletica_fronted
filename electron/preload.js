// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  printTicket: (html, deviceName) => ipcRenderer.invoke('ticket:print', { html, deviceName }),
  listPrinters: () => ipcRenderer.invoke('ticket:listPrinters')
});
