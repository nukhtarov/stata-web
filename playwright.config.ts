import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } }],
  webServer: process.env.BASE_URL ? undefined : { command: 'npm run build && npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: false, timeout: 120_000 },
});
