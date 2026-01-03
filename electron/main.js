// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

let mainWin;

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

  // Si cierran la ventana, evita referencias colgantes
  mainWin.on('closed', () => { mainWin = null; });
}

// =======================
// UPDATER (NUEVO)
// =======================
function sendUpdate(channel, payload) {
  if (mainWin && mainWin.webContents) {
    mainWin.webContents.send(channel, payload);
  }
}

function initAutoUpdater() {
  // Logging recomendado para debug
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';

  // Recomendación: en NSIS normalmente puedes auto-download.
  // Si quieres “preguntar antes de descargar”, ponlo en false y maneja downloadUpdate().
  autoUpdater.autoDownload = true;

  autoUpdater.on('checking-for-update', () => sendUpdate('update:checking'));
  autoUpdater.on('update-available', (info) => sendUpdate('update:available', info));
  autoUpdater.on('update-not-available', (info) => sendUpdate('update:not-available', info));
  autoUpdater.on('download-progress', (p) => {
    sendUpdate('update:progress', {
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond,
    });
  });
  autoUpdater.on('update-downloaded', (info) => sendUpdate('update:downloaded', info));
  autoUpdater.on('error', (err) => sendUpdate('update:error', { message: err?.message || String(err) }));
}

async function safeCheckForUpdates() {
  // En Windows: evitar checar update de inmediato si es primer run tipo squirrel.
  // (Con NSIS usualmente no pasa como squirrel, pero este guard te evita “cosas raras”.)
  if (process.platform === 'win32' && process.argv.some(a => a.includes('--squirrel-firstrun'))) {
    return;
  }

  // Delay corto para que la app esté estable
  await new Promise((r) => setTimeout(r, 10_000));

  try {
    await autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    sendUpdate('update:error', { message: e?.message || String(e) });
  }
}

// IPC para Angular
ipcMain.handle('app:update-check', async () => {
  try {
    return await autoUpdater.checkForUpdates();
  } catch (e) {
    sendUpdate('update:error', { message: e?.message || String(e) });
    return null;
  }
});

ipcMain.handle('app:update-install', async () => {
  // Esto cierra la app y corre el instalador descargado
  try {
    autoUpdater.quitAndInstall();
    return true;
  } catch (e) {
    sendUpdate('update:error', { message: e?.message || String(e) });
    return false;
  }
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

  // chequeo automático al iniciar (con delay)
  safeCheckForUpdates();

  // chequeo periódico (opcional): cada 6 horas
  setInterval(() => safeCheckForUpdates(), 6 * 60 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
