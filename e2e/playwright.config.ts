import { defineConfig, devices } from '@playwright/test';

// Runs against the docker compose stack (frontend :5173, MailHog :8025).
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
