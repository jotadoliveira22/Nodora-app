import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config de Vite para Tauri: puerto fijo y sin abrir navegador.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
