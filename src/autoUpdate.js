const { app, dialog, shell, net } = require('electron');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (err) {
  console.warn('[taknot] electron-updater unavailable', err?.message || err);
}

const REPO = { owner: 'ItaloCobains', name: 'taknot' };
const CHECK_DELAY_MS = 5_000;

let checking = false;
let manualCheck = false;

function isDev() {
  return !app.isPackaged;
}

async function openLatestReleasePage() {
  await shell.openExternal(
    `https://github.com/${REPO.owner}/${REPO.name}/releases/latest`,
  );
}

function pickAsset(assets) {
  const names = assets.map((a) => ({
    a,
    n: String(a.name || '').toLowerCase(),
  }));
  if (process.platform === 'darwin') {
    return (
      names.find((x) => x.n.endsWith('.dmg'))?.a ||
      names.find((x) => x.n.endsWith('.zip'))?.a
    );
  }
  if (process.platform === 'win32') {
    return (
      names.find((x) => x.n.includes('setup') && x.n.endsWith('.exe'))?.a ||
      names.find((x) => x.n.endsWith('.exe'))?.a
    );
  }
  return (
    names.find((x) => x.n.endsWith('.appimage'))?.a ||
    names.find((x) => x.n.endsWith('.deb'))?.a ||
    names.find((x) => x.n.endsWith('.rpm'))?.a
  );
}

async function checkGithubFallback() {
  const res = await net.fetch(
    `https://api.github.com/repos/${REPO.owner}/${REPO.name}/releases/latest`,
    { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'taknot' } },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  const latest = String(data.tag_name || '').replace(/^v/i, '');
  const current = app.getVersion();
  if (!latest || latest === current) {
    if (manualCheck) {
      await dialog.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        title: 'Atualizações',
        message: 'Você já está na versão mais recente.',
        detail: `taknot ${current}`,
      });
    }
    return;
  }

  const { response } = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Baixar atualização', 'Depois'],
    defaultId: 0,
    cancelId: 1,
    title: 'Atualização disponível',
    message: `Nova versão ${latest} disponível`,
    detail: `Você está na ${current}.\n\nVamos abrir o instalador da versão nova.`,
  });
  if (response !== 0) return;
  const asset = pickAsset(data.assets || []);
  if (asset?.browser_download_url) {
    await shell.openExternal(asset.browser_download_url);
  } else {
    await openLatestReleasePage();
  }
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: REPO.owner,
    repo: REPO.name,
  });

  autoUpdater.on('error', (err) => {
    console.warn('[autoUpdate]', err?.message || err);
  });

  autoUpdater.on('update-available', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Atualizar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualização disponível',
      message: `Nova versão ${info.version} disponível`,
      detail: `Você está na ${app.getVersion()}.\n\nQuer baixar e instalar a atualização?`,
    });
    if (response !== 0) return;
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      console.warn('[autoUpdate] download failed, opening asset page', err);
      try {
        await checkGithubFallback();
      } catch {
        await openLatestReleasePage();
      }
    }
  });

  autoUpdater.on('update-not-available', async () => {
    if (!manualCheck) return;
    await dialog.showMessageBox({
      type: 'info',
      buttons: ['OK'],
      title: 'Atualizações',
      message: 'Você já está na versão mais recente.',
      detail: `taknot ${app.getVersion()}`,
    });
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualização pronta',
      message: `A versão ${info.version} foi baixada.`,
      detail: 'Reinicie o taknot para concluir a instalação.',
    });
    if (response === 0) autoUpdater.quitAndInstall(false, true);
  });
}

async function checkForUpdates({ manual = false } = {}) {
  if (!autoUpdater) {
    return { ok: false, reason: 'unavailable' };
  }
  if (checking) return;
  checking = true;
  manualCheck = manual;
  try {
    if (isDev()) {
      if (manual) {
        await dialog.showMessageBox({
          type: 'info',
          buttons: ['OK'],
          title: 'Modo desenvolvimento',
          message: 'Updates automáticos só rodam no app instalado.',
          detail: `Versão atual: ${app.getVersion()}`,
        });
      }
      return;
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      console.warn('[autoUpdate] feed check failed, using GitHub fallback', err);
      await checkGithubFallback();
    }
  } finally {
    checking = false;
    // keep manualCheck until events settle
    setTimeout(() => {
      manualCheck = false;
    }, 2000);
  }
}

function initAutoUpdate() {
  if (!autoUpdater) return;
  if (isDev()) return;
  setupAutoUpdater();
  setTimeout(() => {
    checkForUpdates({ manual: false }).catch((e) =>
      console.warn('[autoUpdate]', e),
    );
  }, CHECK_DELAY_MS);
}

module.exports = { initAutoUpdate, checkForUpdates };
