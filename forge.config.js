const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const { generateUpdateManifests } = require('./scripts/generate-update-manifests.cjs');

// Forge Vite only packs `/.vite` by default. Native optional glass must ship
// beside it (cannot be bundled by Rollup).
const KEEP_PREFIXES = [
  '/.vite',
  '/package.json',
  '/node_modules/electron-liquid-glass',
  '/node_modules/bindings',
  '/node_modules/file-uri-to-path',
  '/node_modules/node-addon-api',
  '/node_modules/node-gyp-build',
];

function keepPackagedFile(file) {
  if (!file) return true;
  return KEEP_PREFIXES.some(
    (prefix) => file === prefix || file.startsWith(`${prefix}/`),
  );
}

module.exports = {
  hooks: {
    postMake: async (_config, makeResults) => generateUpdateManifests(makeResults),
  },
  packagerConfig: {
    // Unpack native .node so dyld can load liquid-glass
    asar: {
      unpack: '**/node_modules/electron-liquid-glass/**/*',
    },
    name: 'taknot',
    executableName: 'taknot',
    appBundleId: 'app.taknot',
    appCategoryType: 'public.app-category.productivity',
    // Forge picks .icns / .ico / .png per platform
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
      // Must be false: liquid-glass .node loads from app.asar.unpacked
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};
