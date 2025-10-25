// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWin;

/** Crea o devuelve una ventana invisible temporal para imprimir */
async function printHtml({ html, deviceName }) {
  const tmp = new BrowserWindow({
    show: false,                      // no mostrar
    webPreferences: {
      offscreen: true,                // no interactiva
    },
  });

  // Carga el HTML como data URL
  await tmp.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(html));

  // Imprime en silencio a la impresora indicada (o default)
  return new Promise((resolve, reject) => {
    tmp.webContents.print(
      { silent: true, printBackground: true, deviceName: deviceName || undefined },
      (success, failureReason) => {
        try { tmp.destroy(); } catch {}
        if (!success) reject(new Error(failureReason || 'PRINT_FAILED'));
        else resolve();
      }
    );
  });
}

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      // 🔴 PRELOAD: aquí exponemos window.electron a Angular
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  if (process.env.ELECTRON_START_URL) {
    mainWin.loadURL(process.env.ELECTRON_START_URL);
  } else {
    mainWin.loadFile(
      path.join(__dirname, '../dist/revolucion-atletica-frontend/browser/index.html')
    );
  }
}

// ───────── IPC HANDLERS ─────────
ipcMain.handle('ticket:print', async (event, payload) => {
  return printHtml(payload);
});

// Lista las impresoras desde el webContents que hizo el invoke
ipcMain.handle('ticket:listPrinters', async (event) => {
  const printers = await event.sender.getPrintersAsync(); // Electron >= v7
  return printers;
});

// ───────── Ciclo de vida ─────────
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
