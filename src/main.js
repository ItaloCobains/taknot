const { app, BrowserWindow, Menu, ipcMain, clipboard, shell } = require('electron');
let liquidGlass = null;
try {
  liquidGlass = require('electron-liquid-glass');
} catch {
  // optionalDependency — darwin only; win/linux builds skip glass
}
const path = require('node:path');
const fs = require('node:fs');
const vault = require('./vault');
const { initAutoUpdate, checkForUpdates } = require('./autoUpdate');
const spellService = require('./spellService');
const { startMcpHttp, stopMcpHttp, getMcpHttpStatus } = require('./mcpHttp');


/** Enable Chromium/macOS spellchecker for the note window (pt-BR + en-US when available). */
function configureSpellChecker(ses) {
  try {
    ses.setSpellCheckerEnabled(true);
  } catch (err) {
    console.warn('[taknot] setSpellCheckerEnabled failed', err?.message || err);
    return;
  }
  // On darwin this is a no-op (OS spellchecker + auto language detect).
  // On win/linux, filter against available Hunspell dictionaries.
  const wanted = ['pt-BR', 'en-US'];
  try {
    const available = ses.availableSpellCheckerLanguages || [];
    const langs = wanted.filter((code) => available.includes(code));
    if (langs.length === 0) {
      console.warn(
        '[taknot] no wanted spellchecker languages available',
        { wanted, availableCount: available.length },
      );
      return;
    }
    if (langs.length < wanted.length) {
      console.warn(
        '[taknot] some spellchecker languages missing; using',
        langs,
        '(wanted',
        wanted,
        ')',
      );
    }
    ses.setSpellCheckerLanguages(langs);
  } catch (err) {
    console.warn('[taknot] setSpellCheckerLanguages failed', err?.message || err);
  }
}

/** Spelling suggestions / replace / add-to-dictionary. Skip when not a misspelling so renderer note/tag/notebook menus keep working. */
function attachSpellcheckContextMenu(win) {
  win.webContents.on('context-menu', (_event, params) => {
    const word = params.misspelledWord;
    const suggestions = params.dictionarySuggestions || [];
    if (!word && suggestions.length === 0) return;

    const template = [];
    for (const suggestion of suggestions) {
      template.push({
        label: suggestion,
        click: () => {
          win.webContents.replaceMisspelling(suggestion);
        },
      });
    }
    if (suggestions.length > 0) {
      template.push({ type: 'separator' });
    }
    if (word) {
      template.push({
        label: 'Add to dictionary',
        click: () => {
          win.webContents.session.addWordToSpellCheckerDictionary(word);
        },
      });
    }
    if (template.length === 0) return;
    Menu.buildFromTemplate(template).popup({ window: win });
  });
}


/** Debounced fs.watch → renderer when MCP/other process mutates the vault. */
function watchVault() {
  const root = vault.vaultRoot();
  let timer = null;
  const emit = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('vault:changed');
        }
      }
    }, 180);
  };
  try {
    fs.watch(root, { recursive: true }, emit);
    console.log('[taknot] watching vault', root);
  } catch (err) {
    console.warn('[taknot] vault watch failed', err?.message || err);
  }
}

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  const glassOk = Boolean(liquidGlass?.isGlassSupported?.());
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icons', 'icon.png')
    : path.join(__dirname, '../../icons/icon.png');
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    transparent: glassOk,
    backgroundColor: glassOk ? '#00000000' : '#10121c',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 18 },
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: true,
    },
  });

  configureSpellChecker(mainWindow.webContents.session);
  // Native CM spellcheck broken on Electron 44; JS dictionaries + renderer menu handle notes.
  // attachSpellcheckContextMenu(mainWindow);

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
  ipcMain.handle('vault:getWikiGraph', () => vault.getWikiGraph());
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

  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('mcp:getInfo', () => {
    const status = getMcpHttpStatus();
    return {
      vault: vault.vaultRoot(),
      url: status.url,
      port: status.port,
      running: status.running,
      startedByApp: true,
    };
  });
  ipcMain.handle('app:checkForUpdates', async () => {
    await checkForUpdates({ manual: true });
    return true;
  });

  ipcMain.handle('spell:checkWords', async (_e, words) => {
    await spellService.whenReady();
    return spellService.checkWords(Array.isArray(words) ? words : []);
  });
  ipcMain.handle('spell:suggest', async (_e, word) => {
    await spellService.whenReady();
    return spellService.suggest(String(word || ''));
  });

  spellService.initSpellService();
  try {
    await startMcpHttp({ vault, version: app.getVersion() });
  } catch (err) {
    console.warn('[taknot] MCP HTTP failed to start', err?.message || err);
  }
  createWindow();
  watchVault();
  initAutoUpdate();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  stopMcpHttp().catch((err) => {
    console.warn('[taknot] MCP HTTP stop failed', err?.message || err);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
