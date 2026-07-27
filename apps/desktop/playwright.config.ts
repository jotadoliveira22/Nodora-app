import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de interfaz (spec §12 "pruebas básicas de interfaz").
 * Levantan la aplicación con Vite y ejercitan los flujos de UI contra el
 * backend en memoria de `e2e/fakeBackend.js`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // En este entorno el navegador viene preinstalado; en CI lo resuelve
        // Playwright con su propia descarga.
        ...(process.env['NODORA_CHROMIUM']
          ? { launchOptions: { executablePath: process.env['NODORA_CHROMIUM'] } }
          : {}),
      },
    },
  ],
  webServer: {
    command: 'pnpm dev:vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
