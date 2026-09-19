const fs = require('fs-extra');
const path = require('node:path');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const { generateUpdateManifests } = require('./scripts/generate-update-manifests.cjs');

// Forge Vite only packs `/.vite` by default. Native glass cannot be bundled.
const KEEP_PREFIXES = [
  '/.vite',
  '/package.json',
  '/node_modules/electron-liquid-glass',
  '/node_modules/bindings',
  '/node_modules/file-uri-to-path',
  '/node_modules/node-addon-api',
  '/node_modules/node-gyp-build',
];

const GLASS_MODULES = [
  'electron-liquid-glass',
  'bindings',
  'file-uri-to-path',
  'node-addon-api',
  'node-gyp-build',
];

function keepPackagedFile(file) {
  if (!file) return true;
  return KEEP_PREFIXES.some(
    (prefix) => file === prefix || file.startsWith(`${prefix}/`),
  );
}

async function copyGlassModules(buildPath) {
  // Packager prune + Vite ignore fight over node_modules; force-copy after.
  if (process.platform !== 'darwin') {
    console.log('[taknot] skip liquid-glass copy (not darwin)');
    return;
  }
  for (const name of GLASS_MODULES) {
    const from = path.join(__dirname, 'node_modules', name);
    const to = path.join(buildPath, 'node_modules', name);
    if (!(await fs.pathExists(from))) {
      console.warn(`[taknot] missing module for glass pack: ${name}`);
      continue;
    }
    await fs.copy(from, to, { dereference: true, overwrite: true });
    console.log(`[taknot] packed ${name}`);
  }
}

module.exports = {
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      await copyGlassModules(buildPath);
    },
    postMake: async (_config, makeResults) => generateUpdateManifests(makeResults),
  },
  packagerConfig: {
    // Don't let galactus prune bypass our keep-list for nested files
    prune: false,
    asar: {
      unpack: '**/node_modules/electron-liquid-glass/**/*',
    },
    name: 'taknot',
    executableName: 'taknot',
    appBundleId: 'app.taknot',
    appCategoryType: 'public.app-category.productivity',
    icon: './icons/icon',
    extraResource: ['./icons'],
    // true = ignore. Keep Vite output + liquid-glass tree only.
    ignore: (file) => !keepPackagedFile(file),
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'taknot',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'taknot',
        format: 'ULFO',
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'Italo Brandão',
          homepage: 'https://github.com/ItaloCobains/taknot',
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          homepage: 'https://github.com/ItaloCobains/taknot',
        },
      },
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'ItaloCobains',
          name: 'taknot',
        },
        prerelease: false,
        draft: false,
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      // liquid-glass .node loads from app.asar.unpacked
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};
