import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Las pruebas de e2e/ las ejecuta Playwright (pnpm test:ui), no Vitest.
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
