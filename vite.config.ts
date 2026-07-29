import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Absolutos a partir da raiz — obrigatório com rotas /login, /app, etc.
  base: '/',
  build: {
    outDir: 'dist/sistema',
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
