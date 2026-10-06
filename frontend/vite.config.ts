import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — відносні шляхи, щоб збірка працювала на GitHub Pages у будь-якому підкаталозі
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: '../docs', emptyOutDir: true },
});
