import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

function copySpellDicts() {
  const copy = () => {
    const srcDir = path.join(root, 'src', 'dicts');
    const destDir = path.join(root, '.vite', 'build', 'dicts');
    if (!fs.existsSync(srcDir)) return;
    fs.mkdirSync(destDir, { recursive: true });
    for (const name of fs.readdirSync(srcDir)) {
      fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name));
    }
  };
  return {
    name: 'copy-spell-dicts',
    buildStart() {
      copy();
    },
    closeBundle() {
      copy();
    },
  };
}

// Forge Vite packs only `/.vite` into the asar (no node_modules).
// Anything required at runtime must be bundled here, except optional
// native deps that are try/caught (electron-liquid-glass).
// Spell dictionaries are copied beside the bundle (see copySpellDicts).
export default defineConfig({
  plugins: [copySpellDicts()],
  build: {
    rollupOptions: {
      external: ['electron-liquid-glass'],
    },
  },
});
