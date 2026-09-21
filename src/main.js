const { app, BrowserWindow, Menu, ipcMain, clipboard, shell, dialog } = require('electron');
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


function safePdfFileName(title) {
  const base = String(title || 'note')
    .replace(/[\/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `${base || 'note'}.pdf`;
}

function escapeHtmlText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPdfHtml(title, bodyHtml) {
  let katexHref = '';
  try {
    const katexCss = require.resolve('katex/dist/katex.min.css');
    katexHref = `file://${katexCss}`;
  } catch {
    // KaTeX optional for PDF; math may look unstyled
  }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtmlText(title || 'note')}</title>
${katexHref ? `<link rel="stylesheet" href="${katexHref}" />` : ''}
<style>
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 8px 4px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 12.5pt;
    line-height: 1.55;
    color: #1a1d26;
    background: #fff;
  }
  h1.doc-title {
    font-size: 22pt;
    margin: 0 0 0.8em;
    line-height: 1.25;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 0.35em;
  }
  .markdown h1, .markdown h2, .markdown h3 { margin: 1em 0 0.4em; line-height: 1.3; }
  .markdown h1 { font-size: 18pt; }
  .markdown h2 { font-size: 15pt; }
  .markdown h3 { font-size: 13pt; }
  .markdown p, .markdown ul, .markdown ol { margin: 0.55em 0; }
  .markdown ul, .markdown ol { padding-left: 1.4em; }
  .markdown code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.9em;
    background: #f3f4f6;
    padding: 0.1em 0.35em;
    border-radius: 4px;
  }
  .markdown pre {
    background: #f3f4f6;
    padding: 0.75em 1em;
    border-radius: 8px;
    overflow: auto;
    font-size: 0.88em;
  }
  .markdown pre code { background: transparent; padding: 0; }
  .markdown a { color: #2563eb; }
  .markdown blockquote {
    margin: 0.75em 0;
    padding: 0.2em 0 0.2em 12px;
    border-left: 3px solid #6366f1;
    color: #4b5563;
  }
  .markdown img { max-width: 100%; height: auto; }
  .markdown table { width: 100%; border-collapse: collapse; margin: 0.75em 0; font-size: 0.95em; }
  .markdown th, .markdown td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
  .markdown th { background: #f3f4f6; }
  .markdown hr { border: 0; border-top: 1px solid #e5e7eb; margin: 1.2em 0; }
  .markdown .markdown-alert {
    margin: 0.85em 0;
    padding: 0.65em 0.85em 0.75em;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    border-left-width: 3px;
  }
  .markdown .markdown-alert-title {
    display: flex; align-items: center; gap: 0.4em;
    margin: 0 0 0.35em; font-weight: 650; font-size: 0.95em;
  }
  .markdown .markdown-alert-note { border-left-color: #2563eb; background: #eff6ff; }
  .markdown .markdown-alert-note .markdown-alert-title { color: #1d4ed8; }
  .markdown .markdown-alert-tip { border-left-color: #16a34a; background: #f0fdf4; }
  .markdown .markdown-alert-tip .markdown-alert-title { color: #15803d; }
  .markdown .markdown-alert-important { border-left-color: #7c3aed; background: #f5f3ff; }
  .markdown .markdown-alert-important .markdown-alert-title { color: #6d28d9; }
  .markdown .markdown-alert-warning { border-left-color: #d97706; background: #fffbeb; }
  .markdown .markdown-alert-warning .markdown-alert-title { color: #b45309; }
  .markdown .markdown-alert-caution { border-left-color: #dc2626; background: #fef2f2; }
  .markdown .markdown-alert-caution .markdown-alert-title { color: #b91c1c; }
  .markdown input[type="checkbox"] { margin-right: 0.4em; }
</style>
</head>
<body>
  <h1 class="doc-title">${escapeHtmlText(title || 'Untitled')}</h1>
  <div class="markdown">${bodyHtml || ''}</div>
</body>
</html>`;
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

  ipcMain.handle('note:exportPdf', async (event, payload) => {
    const title = String(payload?.title || 'note');
    const html = String(payload?.html || '');
    const parent = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(parent || undefined, {
      title: 'Export PDF',
      defaultPath: safePdfFileName(title),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    const tmpHtml = path.join(
      app.getPath('temp'),
      `taknot-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.html`,
    );
    const pdfWin = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    try {
      fs.writeFileSync(tmpHtml, buildPdfHtml(title, html), 'utf8');
      await pdfWin.loadFile(tmpHtml);
      // Brief settle so images/fonts can paint
      await new Promise((r) => setTimeout(r, 120));
      const pdfData = await pdfWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
      });
      fs.writeFileSync(filePath, pdfData);
      return { ok: true, filePath };
    } catch (err) {
      console.error('[taknot] export PDF failed', err);
      return { ok: false, error: String(err?.message || err) };
    } finally {
      if (!pdfWin.isDestroyed()) pdfWin.destroy();
      try {
        fs.unlinkSync(tmpHtml);
      } catch {
        // ignore
      }
    }
  });

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
