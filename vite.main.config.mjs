import { defineConfig } from 'vite';

// Forge Vite packs only `/.vite` into the asar (no node_modules).
// Anything required at runtime must be bundled here, except optional
// native deps that are try/caught (electron-liquid-glass).
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron-liquid-glass'],
    },
  },
});
