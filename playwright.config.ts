import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4173'
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173/planner/credit/',
    reuseExistingServer: false
  }
});
