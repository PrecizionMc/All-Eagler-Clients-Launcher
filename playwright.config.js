import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: { baseURL: 'http://localhost:4173', browserName: 'chromium' },
  webServer: { command: 'node e2e/server.mjs', url: 'http://localhost:4173', reuseExistingServer: false },
  reporter: 'list'
});
