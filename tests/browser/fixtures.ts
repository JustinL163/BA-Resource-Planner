import { test as base } from '@playwright/test';

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
    });
    await use(context);
  }
});

export { expect } from '@playwright/test';
