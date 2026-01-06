// electron/main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

let mainWin = null;

// =======================
// PRINT (TU CÓDIGO)
// =======================
async function printHtml({ html, deviceName, pageWidthMicrons = 57000, dpi = 203, waitMs = 150 }) {
  if (!html || typeof html !== 'string') {
    throw new Error('printHtml: "html" es requerido y debe ser string.');
  }

  const tmp = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
    },
  });

  try {
    await tmp.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(html));

    await tmp.webContents.insertCSS(`
      @page { size: ${pageWidthMicrons / 1000}mm auto; margin: 0 !important; }
      html, body { margin: 0 !important; padding: 0 !important; }
    `);

    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));

    const printOpts = {
      silent: true,
      deviceName: deviceName || undefined,
      printBackground: true,
      margins: { marginType: 'custom', top: 0, right: 0, bottom: 0, left: 0 },
      pageSize: { width: pageWidthMicrons, height: 5_000_000 },
      dpi: { horizontal: dpi, vertical: dpi },
      color: false,
      landscape: false,
    };

    await new Promise((resolve, reject) => {
      tmp.webContents.print(printOpts, (ok, reason) => {
        ok ? resolve() : reject(new Error(reason || 'PRINT_FAILED'));
      });
    });
  } finally {
    try { tmp.destroy(); } catch {}
  }
}

function appIconPath() {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
  if (isWin) return path.join(base, 'assets', 'icon.ico');
  if (isMac) return path.join(base, 'assets', 'icon.icns');
  return path.join(base, 'assets', 'icon.png');
}

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: appIconPath(),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.ELECTRON_START_URL) {
    mainWin.loadURL(process.env.ELECTRON_START_URL);
  } else {
    mainWin.loadFile(
      path.join(__dirname, '../dist/revolucion-atletica-frontend/browser/index.html')
    );
  }

  mainWin.on('closed', () => { mainWin = null; });
}

// =======================
// UPDATER (CON POPUPS)
// =======================
function sendUpdate(channel, payload) {
  if (mainWin && mainWin.webContents) {
    mainWin.webContents.send(channel, payload);
  }
}

function getDialogParent() {
  if (mainWin && !mainWin.isDestroyed()) return mainWin;
  return null;
}

async function showMessageBoxSafe(options) {
  const parent = getDialogParent();
  if (parent) return dialog.showMessageBox(parent, options);
  return dialog.showMessageBox(options);
}

let updatePromptShown = false;

function initAutoUpdater() {
  // Logging para debug
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';

  // IMPORTANTE: para preguntar antes de descargar
  autoUpdater.autoDownload = false;

  autoUpdater.on('checking-for-update', () => {
    sendUpdate('update:checking');
  });

  autoUpdater.on('update-not-available', (info) => {
    sendUpdate('update:not-available', info);
    updatePromptShown = false; // permite preguntar de nuevo en siguientes checks
  });

  autoUpdater.on('update-available', async (info) => {
    sendUpdate('update:available', info);

    // Evita spam de popups si hay checks periódicos
    if (updatePromptShown) return;
    updatePromptShown = true;

    try {
      const { response } = await showMessageBoxSafe({
        type: 'info',
        title: 'Actualización disponible',
        message: `Hay una nueva versión (${info.version}).`,
        detail: '¿Deseas descargarla ahora?',
        buttons: ['Descargar', 'Más tarde'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });

      if (response === 0) {
        await autoUpdater.downloadUpdate();
      }
    } catch (e) {
      updatePromptShown = false;
      sendUpdate('update:error', { message: e?.message || String(e) });
    }
  });

  autoUpdater.on('download-progress', (p) => {
    sendUpdate('update:progress', {
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', async (info) => {
    sendUpdate('update:downloaded', info);

    try {
      const { response } = await showMessageBoxSafe({
        type: 'question',
        title: 'Actualización lista',
        message: `Se descargó la versión ${info.version}.`,
        detail: '¿Deseas instalar y reiniciar ahora?',
        buttons: ['Instalar y reiniciar', 'Después'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });

      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    } catch (e) {
      sendUpdate('update:error', { message: e?.message || String(e) });
    }
  });

  autoUpdater.on('error', async (err) => {
    const msg = err?.message || String(err);
    sendUpdate('update:error', { message: msg });

    // (Opcional) popup de error
    try {
      await showMessageBoxSafe({
        type: 'error',
        title: 'Error de actualización',
        message: 'No se pudo buscar/descargar la actualización.',
        detail: msg,
        buttons: ['OK'],
        noLink: true,
      });
    } catch {}
  });
}

async function safeCheckForUpdates() {
  // Evitar comportamiento raro en el primer run de instaladores tipo squirrel
  if (process.platform === 'win32' && process.argv.some(a => a.includes('--squirrel-firstrun'))) {
    return;
  }

  // Delay corto para que la app esté estable
  await new Promise((r) => setTimeout(r, 10_000));

  try {
    // IMPORTANTE: checkForUpdates (no regreses objetos raros al renderer)
    await autoUpdater.checkForUpdates();
  } catch (e) {
    sendUpdate('update:error', { message: e?.message || String(e) });
  }
}

// IPC UPDATER (DEVUELVE OBJETO CLONABLE)
ipcMain.handle('app:update-check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();

    // NO regreses result completo (trae cancellationToken y cosas no clonables)
    const info = result?.updateInfo;

    return {
      isUpdateAvailable: !!info,
      updateInfo: info ? {
        version: info.version,
        tag: info.tag,
        releaseName: info.releaseName,
        files: info.files?.map(f => ({ url: f.url, name: f.name, size: f.size })) ?? [],
      } : null,
    };
  } catch (e) {
    sendUpdate('update:error', { message: e?.message || String(e) });
    return { isUpdateAvailable: false, updateInfo: null, error: e?.message || String(e) };
  }
});

ipcMain.handle('app:update-install', async () => {
  try {
    autoUpdater.quitAndInstall();
    return true;
  } catch (e) {
    sendUpdate('update:error', { message: e?.message || String(e) });
    return false;
  }
});

// (Opcional pero útil) versión actual para mostrarla en tu UI
ipcMain.handle('app:version', async () => {
  return app.getVersion();
});

// =======================
// IPC TICKETS (TU CÓDIGO)
// =======================
ipcMain.handle('ticket:print', async (_event, payload, maybeDeviceName) => {
  const args = typeof payload === 'string'
    ? { html: payload, deviceName: maybeDeviceName }
    : (payload || {});
  return printHtml(args);
});

ipcMain.handle('ticket:listPrinters', async (event) => {
  return event.sender.getPrintersAsync();
});

// =======================
// LIFECYCLE
// =======================
app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.revolucion.atletica');

  createWindow();
  initAutoUpdater();

  // Chequeo automático al iniciar
  safeCheckForUpdates();

  // Chequeo periódico cada 6 horas
  setInterval(() => safeCheckForUpdates(), 6 * 60 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
