import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from '../browser/fixtures';

test('development hydrates the resource planner with JavaScript JSON imports', async ({ page }) => {
  const errors: string[] = [];
  const moduleResponses: { status: number; type: string }[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /MIME type|dynamically imported module/.test(message.text())) errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.url().includes('/strings.json?import')) {
      moduleResponses.push({ status: response.status(), type: response.headers()['content-type'] ?? '' });
    }
  });
  const response = await page.goto('/planner/resources/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Add characters', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Add characters', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(moduleResponses.length).toBeGreaterThan(0);
  for (const module of moduleResponses) {
    expect(module.status).toBe(200);
    expect(module.type).toMatch(/(?:java|ecma)script/);
  }
  expect(errors).toEqual([]);
});

test('development preserves legacy JSON assets and hydrates all shared-layout routes', async ({ page, request }) => {
  const response = await request.get('/planner/json/strings.json');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(await response.json()).toEqual(JSON.parse(readFileSync(resolve('planner', 'json', 'strings.json'), 'utf8')));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const route of ['/planner/credit/', '/planner/debug/?untranslated=KR']) {
    await page.goto(route);
    await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toBeEnabled();
    await expect(page).not.toHaveTitle('Internal Error');
  }
  await expect(page.locator('#text-body')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('development serves the event calculation bridge as JavaScript and the existing event page uses it', async ({ page, request }) => {
  const response = await request.get('/planner/js/shared/events.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/(?:java|ecma)script/);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/planner/events.html');
  await page.locator('#lore-pursuit-s2').click();
  await page.locator('#tab-Targets').click();
  await page.locator('#tab-opti-Shop').click();
  expect(await page.evaluate('typeof BAEventEngine.calculateEventEnergy')).toBe('function');
  expect(await page.evaluate('GetStagesLinearModel("Energy_Cost", "min", false).optimize')).toBe('Energy_Cost');
  expect(errors).toEqual([]);
});

test('development hydrates the standard event planner and runs its classic solver worker', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/planner/event-planner/');
  expect(response?.status()).toBe(200);
  await page.locator('[data-event-id="lore-pursuit-s2"]').click();
  await page.locator('[data-event-mode="Manual"]').click();
  const runs = page.getByRole('spinbutton', { name: 'Runs Q9', exact: true });
  await runs.fill('5'); await runs.press('Tab');
  await expect(page.locator('[data-event-run="9"]')).toHaveText('Q9: 5');
  await page.locator('[data-event-tab="Bonus"]').click();
  await page.getByRole('button', { name: 'Enable All', exact: true }).click();
  await page.locator('[data-event-tab="Targets"]').click();
  await page.locator('[data-event-mode="Shop"]').click();
  await expect(page.locator('[data-event-ap]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('development renders reviewed box archives without JSON/module collisions', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator('[data-event-id="moonlight-dream"]').click();
  await page.locator('[data-event-tab="Boxes"]').click();
  await expect(page.locator('[data-event-box-cycle]')).toHaveCount(3);
  await page.locator('[data-event-box-cycle="2"]').click();
  await expect(page.locator('[data-event-box-cycle="2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-event-box-reward]')).not.toHaveCount(0);
  expect(errors).toEqual([]);
});

test('development serves card statistics as a classic worker and renders migrated card browsing', async ({ page, request }) => {
  const response = await request.get('/planner/js/shared/card-statistics-worker.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/(?:java|ecma)script/);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator('[data-event-id="art-for-whom"]').click();
  await page.locator('[data-event-tab="Cards"]').click();
  await expect(page.locator('[data-event-card]')).toHaveCount(4);
  await page.locator('[data-event-card-rarity="R"]').click();
  await expect(page.locator('[data-event-card]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('development renders migrated dice controls and the full race reference without module errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator('[data-event-id="occult-research-society"]').click();
  await page.locator('[data-event-tab="Dice"]').click();
  await expect(page.locator('[data-event-dice-simulate]')).toBeDisabled();
  await page.locator('.dice details summary').click();
  await expect(page.locator('[data-event-dice-tile]')).toHaveCount(18);
  await expect(page.locator('[data-event-dice-lap]')).toHaveCount(20);
  expect(errors).toEqual([]);
});

test('development serves the original Omikuji worker and renders the reviewed slip reference', async ({ page, request }) => {
  const response = await request.get('/planner/js/omikujiGachaWorker.js?1');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/(?:java|ecma)script/);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator('[data-event-id="pray-ball-rerun"]').click();
  await page.locator('[data-event-tab="Omikuji"]').click();
  await expect(page.locator('[data-event-omikuji-simulate]')).toBeDisabled();
  await expect(page.locator('.overflow')).toContainText('300 points per pull');
  await page.locator('[data-event-omikuji-reference] summary').click();
  await expect(page.locator('[data-event-omikuji-slip]')).not.toHaveCount(0);
  expect(errors).toEqual([]);
});

test('development hydrates only the generated Lessons archive and hides inapplicable stage-group filters', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator('[data-event-id="on-your-mark"]').click();
  await page.locator('[data-event-tab="Lessons"]').click();
  await expect(page.locator('[data-event-lesson-location]')).toHaveCount(4);
  await expect(page.locator('.stage-groups')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('development hydrates the reviewed Invasion archive and shows its session-only reward toggle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator('[data-event-id="valentine-rerun"]').click();
  await expect(page.getByRole('checkbox', { name: 'Invasion Rewards', exact: true })).toBeVisible();
  await expect(page.locator('[data-event-tab="Invasion"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('development keeps the Invasion overflow shop rule and preserves the legacy Event Point definition', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator('[data-event-id="valentine-rerun"]').click();
  await page.locator('[data-event-tab="Shop"]').click();
  await page.locator('[data-event-shop-tab="Garbage_Bag"]').click();
  const overflow = page.locator('[data-event-purchase="16008"][data-event-shop="Garbage_Bag"] input');
  await expect(overflow).toHaveAttribute('max', '620');
  await expect(overflow).toHaveValue('0');
  expect(errors).toEqual([]);
});
