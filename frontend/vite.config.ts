import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — відносні шляхи.
// mode 'render' → збірка кладеться в backend/static, звідки її віддає FastAPI (один сервіс на Render).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  build: { outDir: mode === 'render' ? '../backend/static' : '../docs', emptyOutDir: true },
}));
