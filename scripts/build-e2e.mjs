import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const require = createRequire(import.meta.url);
const ViteConfig = require('@electron-forge/plugin-vite/dist/ViteConfig.js').default;
const forge = require('../forge.config.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = forge.plugins.find((item) => item.name === '@electron-forge/plugin-vite');
const gen = new ViteConfig(plugin.config, root, true);

for (const config of await gen.getBuildConfigs()) {
  await build({
    ...config,
    configFile: false,
    build: { ...config.build, minify: false },
  });
}
for (const config of await gen.getRendererConfig()) {
  await build({ ...config, configFile: false });
}
