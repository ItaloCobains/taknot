const { app, BrowserWindow, ipcMain } = require('electron');
const liquidGlass = require('electron-liquid-glass');
const path = require('node:path');
const vault = require('./vault');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    transparent: true,
    backgroundColor: '#00000000',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setWindowButtonVisibility(true);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.webContents.once('did-finish-load', () => {
    const glassId = liquidGlass.addView(mainWindow.getNativeWindowHandle(), {
      cornerRadius: 12,
    });
    if (glassId >= 0) {
      liquidGlass.unstable_setVariant(
        glassId,
        liquidGlass.GlassMaterialVariant.dock,
      );
    }
  });
};

app.whenReady().then(async () => {
  await vault.ensureVault();

  ipcMain.handle('vault:listNotebooks', () => vault.listNotebooks());
  ipcMain.handle('vault:listTags', () => vault.listTags());
  ipcMain.handle('vault:listNotes', (_e, filter) => vault.listNotes(filter));
  ipcMain.handle('vault:getNote', (_e, id) => vault.getNote(id));
  ipcMain.handle('vault:saveNote', (_e, note) => vault.saveNote(note));
  ipcMain.handle('vault:createNote', (_e, opts) => vault.createNote(opts));
  ipcMain.handle('vault:createNotebook', (_e, name) => vault.createNotebook(name));
  ipcMain.handle('vault:renameNotebook', (_e, id, name) =>
    vault.renameNotebook(id, name),
  );
  ipcMain.handle('vault:deleteNotebook', (_e, id) => vault.deleteNotebook(id));
  ipcMain.handle('vault:getNotebookExport', (_e, id) =>
    vault.getNotebookExport(id),
  );
  ipcMain.handle('vault:duplicateNote', (_e, id) => vault.duplicateNote(id));
  ipcMain.handle('vault:deleteNote', (_e, id) => vault.deleteNote(id));

  ipcMain.handle('window:toggleMaximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });

  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? win.isMaximized() : false;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
