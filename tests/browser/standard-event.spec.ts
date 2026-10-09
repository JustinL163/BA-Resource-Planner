import { test, expect } from './fixtures';
import { decodeEventPlan, decodeStandardEvent } from '../../src/lib/domain/events/standard-save';
import { isRecord } from '../../src/lib/domain/planner/save';
import { readJson } from '../unit/legacy-harness';

const config = readJson('planner', 'json', 'events.json');
const oldConfig = readJson('planner', 'json', 'old_events.json');
if (!isRecord(config) || !isRecord(config.events) || !isRecord(oldConfig) || !isRecord(oldConfig.events)) {
  throw new Error('Invalid event fixture.');
}
const catalog = config;
const currentEvents = config.events;
const valentine = oldConfig.events['valentine-rerun'];
if (!isRecord(valentine)) throw new Error('Missing invasion event fixture.');
const event = decodeStandardEvent(currentEvents['lore-pursuit-s2']);
const eventTime = (event.reset_time + 3 * 86400 + 3600) * 1000;

function savedPlan() {
  const plan = decodeEventPlan({ futureSetting: { keep: true } }, event);
  plan.pyro_refreshes = 6; plan.pvp_refreshes = 4; plan.energy_pack = true;
  return {
    exportVersion: 2, characters: [], disabled_characters: [], owned_materials: { Credit: 42 }, groups: { Existing: [] },
    language: 'EN', futureField: { keep: true }, events_data: { untouched: { target: 42 }, 'lore-pursuit-s2': plan }
  };
}

test('standard event tabs use a real solver worker and preserve legacy-compatible saves across reload', async ({ page }) => {
  const errors: string[] = [];
  const failedImages: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() === 404 && response.request().resourceType() === 'image') failedImages.push(response.url()); });
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((data) => { if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(data)); }, savedPlan());
  await page.goto('/planner/event-planner/');
  await page.evaluate(`(() => {
    const NativeWorker = window.Worker;
    window.eventWorkers = 0; window.eventWorkerStops = 0;
    window.Worker = class extends NativeWorker {
      constructor(url, options) { super(url,options); window.eventWorkers++; }
      terminate() { window.eventWorkerStops++; super.terminate(); }
    };
  })()`);
  await page.locator('[data-event-id="lore-pursuit-s2"]').click();
  await expect(page.locator('[data-event-tab]')).toHaveCount(7);
  await page.locator('[data-event-tab="Bonus"]').click();
  await page.getByRole('button', { name: 'Enable All', exact: true }).click();
  await page.locator('[data-event-tab="Targets"]').click();
  await page.locator('[data-event-mode="Shop"]').click();
  await expect(page.locator('[data-event-ap]')).toBeVisible();
  expect(await page.evaluate('window.eventWorkers')).toBeGreaterThan(0);
  expect(await page.evaluate('window.eventWorkerStops')).toBeGreaterThan(0);
  await page.locator('[data-event-tab="Shop"]').click();
  await page.locator('[data-event-purchase="XP_1"] input').fill('10');
  await page.locator('[data-event-purchase="XP_1"] input').press('Tab');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
  expect(stored.events_data['lore-pursuit-s2'].shop_purchases.Cooling_Pack.XP_1).toBe(10);
  expect(stored.owned_materials).toEqual(savedPlan().owned_materials);
  expect(stored.groups).toEqual(savedPlan().groups);
  expect(stored.events_data.untouched).toEqual(savedPlan().events_data.untouched);
  expect(stored.futureField).toEqual(savedPlan().futureField);
  expect(stored.events_data['lore-pursuit-s2'].futureSetting).toEqual({ keep: true });
  await page.locator('[data-event-tab="Targets"]').click();
  await page.locator('[data-event-mode="Materials"]').click();
  await page.locator('[data-event-material="Antikythera_1"]').click();
  await expect(page.locator('[data-event-ap]')).toBeVisible();
  await page.locator('[data-event-mode="Currency"]').click();
  await expect(page.locator('[data-event-currency="Event_Point"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-event-ap]')).toBeVisible();
  await page.locator('[data-event-mode="Manual"]').click();
  const runs = page.getByRole('spinbutton', { name: 'Runs Q9', exact: true });
  await runs.fill('12'); await runs.press('Tab');
  await expect(page.locator('[data-event-run="9"]')).toHaveText('Q9: 12');
  await page.locator('[data-event-tab="Points"]').click();
  await page.locator('[data-event-point="15000"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['lore-pursuit-s2'].point_target)).toBe(15000);
  await page.reload();
  await page.locator('[data-event-id="lore-pursuit-s2"]').click();
  await page.locator('[data-event-tab="Stages"]').click();
  await expect(page.getByRole('spinbutton', { name: 'Runs Q9', exact: true })).toHaveValue('12');
  await page.getByRole('link', { name: 'Open legacy tools', exact: true }).click();
  await page.locator('#lore-pursuit-s2').click();
  expect(await page.evaluate('event_data.shop_purchases.Cooling_Pack.XP_1')).toBe(10);
  expect(await page.evaluate('stage_runs[9]')).toBe(12);
  expect(errors).toEqual([]);
  expect(failedImages).toEqual([]);
});

test('worker failures are visible, retry works, and invalid edits never change saved data', async ({ page, context }) => {
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), savedPlan());
  await context.route('**/event-plan-worker.js', (route) => route.abort());
  await page.goto('/planner/event-planner/');
  await page.locator('[data-event-id="lore-pursuit-s2"]').click();
  await page.locator('[data-event-mode="Shop"]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await context.unroute('**/event-plan-worker.js');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('[data-event-ap]')).toBeVisible();
  await page.locator('[data-event-tab="Energy"]').click();
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  const cafe = page.locator('[data-event-energy="cafe_rank"]');
  await cafe.fill(''); await cafe.press('Tab');
  await expect(page.getByRole('alert')).toContainText('Invalid event cafe_rank');
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
  await cafe.fill('6'); await cafe.press('Tab');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['lore-pursuit-s2'].cafe_rank)).toBe(6);
  await page.locator('[data-event-tab="Owned"]').click();
  const owned = page.getByRole('spinbutton', { name: 'Owned Cooling Pack', exact: true });
  await owned.fill('200'); await owned.press('Tab');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['lore-pursuit-s2'].currency_owned.Cooling_Pack)).toBe(200);
});

test('cross-tab event changes block stale edits but unrelated save changes are retained', async ({ context }) => {
  const first = await context.newPage();
  await first.clock.setFixedTime(eventTime);
  await first.goto('/planner/event-planner/');
  await first.evaluate((data) => localStorage.setItem('save-data', JSON.stringify(data)), savedPlan());
  await first.reload();
  const second = await context.newPage();
  await second.clock.setFixedTime(eventTime);
  await second.goto('/planner/event-planner/');
  for (const page of [first, second]) {
    await page.locator('[data-event-id="lore-pursuit-s2"]').click();
    await page.locator('[data-event-tab="Energy"]').click();
  }
  await first.locator('[data-event-energy="pyro_refreshes"]').fill('8');
  await first.locator('[data-event-energy="pyro_refreshes"]').press('Tab');
  await expect(second.getByRole('alert')).toContainText('changed in another window');
  await second.locator('[data-event-energy="pyro_refreshes"]').fill('7');
  await second.locator('[data-event-energy="pyro_refreshes"]').press('Tab');
  expect(await first.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['lore-pursuit-s2'].pyro_refreshes)).toBe(8);
  await second.getByRole('button', { name: 'Reload event settings', exact: true }).click();
  await expect(second.locator('[data-event-energy="pyro_refreshes"]')).toHaveValue('8');
  await first.evaluate(() => {
    const root = JSON.parse(localStorage.getItem('save-data')!);
    root.groups.Newer = [];
    localStorage.setItem('save-data', JSON.stringify(root));
  });
  await second.locator('[data-event-energy="pyro_refreshes"]').fill('7');
  await second.locator('[data-event-energy="pyro_refreshes"]').press('Tab');
  expect(await second.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Newer)).toEqual([]);
});

test('changing to Manual mode cancels a pending worker and cannot receive stale optimization output', async ({ page }) => {
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), savedPlan());
  await page.goto('/planner/event-planner/');
  await page.evaluate(`(() => {
    const NativeWorker = window.Worker; window.stoppedEventWorkers = 0;
    window.Worker = class extends NativeWorker {
      postMessage(value) { this.timer = setTimeout(() => super.postMessage(value), 500); }
      terminate() { clearTimeout(this.timer); window.stoppedEventWorkers++; super.terminate(); }
    };
  })()`);
  await page.locator('[data-event-id="lore-pursuit-s2"]').click();
  await page.locator('[data-event-mode="Shop"]').click();
  await expect(page.getByRole('status').filter({ hasText: 'Optimizing stages' })).toBeVisible();
  await page.locator('[data-event-mode="Manual"]').click();
  const runs = page.getByRole('spinbutton', { name: 'Runs Q9', exact: true });
  await runs.fill('5'); await runs.press('Tab');
  await expect(page.locator('[data-event-run="9"]')).toHaveText('Q9: 5');
  expect(await page.evaluate('window.stoppedEventWorkers')).toBeGreaterThan(0);
  await expect(page.getByRole('status').filter({ hasText: 'Optimizing stages' })).toHaveCount(0);
});

test('unreviewed Invasion events remain gated and mobile standard tabs stay within the viewport', async ({ page, context }) => {
  await page.clock.setFixedTime(eventTime);
  await context.route('**/json/events.json*', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      ...catalog,
      events: { ...currentEvents, 'valentine-rerun': valentine },
      event_order: ['lore-pursuit-s2', 'valentine-rerun']
    })
  }));
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), savedPlan());
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/planner/event-planner/');
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.locator('[data-event-id="valentine-rerun"]').click();
  await expect(page.getByText('This event has special mechanics', { exact: false })).toBeVisible();
  await expect(page.locator('[data-event-tab]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
  await page.locator('[data-event-list-control]').click();
  await page.locator('[data-event-id="lore-pursuit-s2"]').click();
  for (const tab of ['Targets', 'Energy', 'Bonus', 'Shop', 'Stages', 'Points', 'Owned']) {
    await page.locator(`[data-event-tab="${tab}"]`).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), tab).toBe(true);
    if (tab === 'Stages') expect(await page.locator('.table-scroll').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
});
