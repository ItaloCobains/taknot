const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron');
let liquidGlass = null;
try {
  liquidGlass = require('electron-liquid-glass');
} catch {
  // optionalDependency — darwin only; win/linux builds skip glass
}
const path = require('node:path');
const vault = require('./vault');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  const glassOk = Boolean(liquidGlass?.isGlassSupported?.());
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    transparent: glassOk,
    backgroundColor: glassOk ? '#00000000' : '#10121c',
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
    if (!glassOk || !liquidGlass) return;
    try {
      const glassId = liquidGlass.addView(mainWindow.getNativeWindowHandle(), {
        cornerRadius: 12,
      });
      if (glassId >= 0) {
        liquidGlass.unstable_setVariant(
          glassId,
          liquidGlass.GlassMaterialVariant.dock,
        );
      }
    } catch (err) {
      console.warn('[taknot] liquidGlass failed', err);
    }
  });
};

app.whenReady().then(async () => {
  await vault.ensureVault();

  ipcMain.handle('vault:listCustomTemplates', () => vault.listCustomTemplates());
  ipcMain.handle('vault:saveTemplate', (_e, tpl) => vault.saveTemplate(tpl));
  ipcMain.handle('vault:deleteTemplate', (_e, id) => vault.deleteTemplate(id));
  ipcMain.handle('vault:listNotebooks', () => vault.listNotebooks());
  ipcMain.handle('vault:listTags', () => vault.listTags());
  ipcMain.handle('vault:saveTag', (_e, tag) => vault.saveTag(tag));
  ipcMain.handle('vault:deleteTag', (_e, id) => vault.deleteTag(id));
  ipcMain.handle('vault:listNotes', (_e, filter) => vault.listNotes(filter));
  ipcMain.handle('vault:getNote', (_e, id) => vault.getNote(id));
  ipcMain.handle('vault:saveNote', (_e, note) => vault.saveNote(note));
  ipcMain.handle('vault:createNote', (_e, opts) => vault.createNote(opts));
  ipcMain.handle('vault:createNotebook', (_e, name, parentId) =>
    vault.createNotebook(name, parentId),
  );
  ipcMain.handle('vault:renameNotebook', (_e, id, name) =>
    vault.renameNotebook(id, name),
  );
  ipcMain.handle('vault:setNotebookIcon', (_e, id, icon) =>
    vault.setNotebookIcon(id, icon),
  );
  ipcMain.handle('vault:moveNotebook', (_e, id, parentId) =>
    vault.moveNotebook(id, parentId),
  );
  ipcMain.handle('vault:deleteNotebook', (_e, id) => vault.deleteNotebook(id));
  ipcMain.handle('vault:duplicateNote', (_e, id) => vault.duplicateNote(id));
  ipcMain.handle('vault:deleteNote', (_e, id) => vault.deleteNote(id));
  ipcMain.handle('clipboard:writeText', (_e, text) => {
    clipboard.writeText(String(text ?? ''));
    return true;
  });
  ipcMain.handle('shell:openExternal', async (_e, url) => {
    const href = String(url || '');
    if (!/^https?:\/\//i.test(href)) return false;
    await shell.openExternal(href);
    return true;
  });

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
