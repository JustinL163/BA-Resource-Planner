import { defineConfig } from '@playwright/test';
import production from './playwright.config';

export default defineConfig({
  ...production,
  testDir: './tests/dev',
  use: {
    ...production.use,
    baseURL: 'http://127.0.0.1:5174'
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174/planner/resources/',
    reuseExistingServer: false
  }
});
