import { expect, test } from './fixtures';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('renders migrated documentation and uses client navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/planner/credit/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Credits');
  await expect(page.getByRole('heading', { name: 'Translation', exact: true })).toBeVisible();
  await expect(page.getByText('goldencrater', { exact: true })).toBeVisible();
  await page.evaluate(() => { document.documentElement.dataset.navigationMarker = 'retained'; });
  await page.getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy Policy');
  await expect(page.locator('html')).toHaveAttribute('data-navigation-marker', 'retained');
  await expect(page.getByText('This is an optional part', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test('retains changelog history', async ({ page }) => {
  await page.goto('/planner/changelog/');
  await expect(page.getByRole('heading', { name: 'Version 1.4.23', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Version 1', exact: true })).toHaveCount(1);
});

for (const name of ['credit', 'privacy', 'changelog']) {
  test(`preserves all original ${name} document text`, async ({ page }) => {
    const source = readFileSync(resolve('planner', `${name}.html`), 'utf8');
    await page.goto(`/planner/${name}/`);
    const content = await page.evaluate((html) => {
      const original = new DOMParser().parseFromString(html, 'text/html');
      return {
        original: original.querySelector('.bodyText')?.textContent,
        migrated: document.querySelector('.document')?.textContent
      };
    }, source);
    const normalise = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim();
    expect(normalise(content.migrated)).toBe(normalise(content.original));
  });
}

test('old debug URLs preserve queries and translation output', async ({ page }) => {
  await page.goto('/planner/debug.html?untranslated=KR');
  await expect(page).toHaveURL(/\/planner\/debug\/\?untranslated=KR$/);
  const result = JSON.parse(await page.locator('#text-body').innerText());
  expect(Object.keys(result).length).toBeGreaterThan(0);
  expect(Object.values(result).every((entry) => typeof entry === 'object' && entry !== null && 'KR' in entry)).toBe(true);
  await page.goto('/planner/debug/?translated=KR');
  expect(Object.keys(JSON.parse(await page.locator('#text-body').innerText())).length).toBeGreaterThan(0);
});

test('preferences preserve existing planner data and survive reload', async ({ page }) => {
  const save = { exportVersion: 2, characters: [], events_data: { sample: { target: 42 } }, language: 'EN', page_theme: 'dark' };
  await page.addInitScript((data) => {
    if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(data));
  }, save);
  await page.goto('/planner/credit/');
  await page.getByRole('button', { name: 'Light theme', exact: true }).click();
  await expect(page.locator('.site')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('Kr');
  const actual = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
  expect(actual).toEqual({ ...save, page_theme: 'light', language: 'Kr' });
  await page.reload();
  await expect(page.locator('.site')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('Kr');
});

test('corrupt saves are reported without replacement', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('save-data', '{broken'));
  await page.goto('/planner/privacy/');
  await expect(page.getByRole('alert')).toContainText('Existing planner data has not been replaced');
  await page.getByRole('button', { name: 'Light theme', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe('{broken');
});

test('mobile navigation is keyboard accessible without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/planner/credit/');
  const button = page.getByRole('button', { name: 'Toggle navigation' });
  await expect(button).toBeEnabled();
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'Resource Planner', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('denied browser storage is reported without breaking the page', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage is unavailable', 'SecurityError'); }
    });
  });
  await page.goto('/planner/credit/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Credits');
  await expect(page.getByRole('alert')).toContainText('Unable to read or save preferences');
});

test('all unmigrated feature pages and worker scripts remain byte-identical', async ({ request }) => {
  for (const file of [
    ['planner', 'index.html'], ['planner', 'events.html'], ['planner', 'raids.html'],
    ['planner', 'tournaments.html'], ['game', 'guesser.html'],
    ['planner', 'js', 'cardGachaWorker.js'], ['planner', 'js', 'omikujiGachaWorker.js'],
    ['planner', 'js', 'diceGachaWorker.js'], ['planner', 'js', 'lzma_worker.js']
  ]) {
    const response = await request.get('/' + file.join('/'));
    expect(response.status()).toBe(200);
    expect(await response.body()).toEqual(readFileSync(resolve(...file)));
  }
});

test('the root redirect still loads the original resource planner', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveURL(/\/planner\/$/);
  await expect(page).toHaveTitle('Blue Archive Resource Planner');
  await expect(page.locator('#languages')).toHaveValue('En');
  expect(errors).toEqual([]);
});

test('four real simulation workers leave the browser event loop responsive', async ({ page }) => {
  await page.goto('/planner/credit/');
  const result = await page.evaluate(async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 10);
    const workers: Worker[] = [];
    try {
      const counts = await Promise.all(Array.from({ length: 4 }, () => new Promise<number>((resolve, reject) => {
        const worker = new Worker('/planner/js/cardGachaWorker.js');
        workers.push(worker);
        worker.onerror = (error) => reject(new Error(error.message));
        worker.onmessage = (event) => resolve(event.data.Credit.length);
        worker.postMessage([
          [{ drops: { Credit: 1 } }, { drops: { Credit: 2 } }],
          [[0.5, 1], [0.5, 1], [0.5, 1], [0.5, 1]],
          1000, 100000, 20000
        ]);
      })));
      return { ticks, counts };
    } finally {
      clearInterval(timer);
      workers.forEach((worker) => worker.terminate());
    }
  });
  expect(result.ticks).toBeGreaterThan(0);
  expect(result.counts).toHaveLength(4);
  expect(result.counts.every((count) => count >= 3000 && count <= 100000)).toBe(true);
});

test('prerendered documents are usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()
  );
  const page = await context.newPage();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:4173/planner/privacy/');
  await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cloud saves', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Resource Planner', exact: true })).toBeVisible();
  await context.close();
});
