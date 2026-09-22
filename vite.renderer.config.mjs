import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite 8 / Rolldown already default to Oxc for transform + minify.
// Pin minify to 'oxc' so production builds always use oxc-minify
// (https://oxc.rs/#feature-minifier).
export default defineConfig({
  plugins: [react()],
  build: {
    minify: 'oxc',
  },
});
