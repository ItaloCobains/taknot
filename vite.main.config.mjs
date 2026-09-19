import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron-liquid-glass', 'electron-updater', 'builder-util-runtime'],
    },
  },
});
