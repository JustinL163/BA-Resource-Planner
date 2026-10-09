import { test, expect } from './fixtures';
import type { BrowserContext, Page } from '@playwright/test';
import { decodeEventPlan, decodeStandardEvent } from '../../src/lib/domain/events/standard-save';
import { omikujiSimulationRequest } from '../../src/lib/domain/events/omikuji';
import { isRecord } from '../../src/lib/domain/planner/save';
import { readJson } from '../unit/legacy-harness';

const config = readJson('planner', 'json', 'events.json');
if (!isRecord(config) || !isRecord(config.events)) throw new Error('Invalid Omikuji browser fixture.');
const events = config.events;
const id = 'pray-ball-rerun';
const event = decodeStandardEvent(events[id]);
const omikuji = event.omikuji;
if (!omikuji) throw new Error('Missing Omikuji browser data.');
const request = omikujiSimulationRequest(omikuji, 5);
const eventTime = (event.reset_time + 3 * 86400 + 3600) * 1000;

function savedPlan() {
  const plan = decodeEventPlan({ futureSetting: { keep: true } }, event);
  plan.optimisation_type = 'Manual';
  plan.optimisation_options = { '12': 3 };
  for (const [currency, items] of Object.entries(event.shops)) {
    plan.shop_purchases[currency] = Object.fromEntries(items.map((item) => [String(item.id), 0]));
  }
  const overflow = event.shops.Event_Point.find((item) => item.overflow);
  if (!overflow) throw new Error('Missing Omikuji overflow shop row.');
  plan.shop_purchases.Event_Point[String(overflow.id)] = 5;
  return {
    exportVersion: 2, characters: [], disabled_characters: [], owned_materials: { Credit: 42 },
    groups: { Existing: [] }, language: 'EN', future: { keep: true },
    events_data: { unrelated: { target: 42 }, [id]: plan }
  };
}

async function routeCatalog(context: BrowserContext) {
  await context.route('**/json/events.json*', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ events, event_order: [id] })
  }));
}

async function openOmikuji(page: Page) {
  await page.goto('/planner/event-planner/');
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Omikuji"]').click();
}

async function installFakeOmikujiWorkers(page: Page, delayMs: number) {
  await page.addInitScript(`(() => {
    const NativeWorker = window.Worker;
    window.omikujiMessages = [];
    window.omikujiPaths = [];
    window.omikujiStops = [];
    window.omikujiDelay = ${delayMs};
    window.omikujiFailure = false;
    window.Worker = function (url, options) {
      const path = String(url);
      if (!path.includes('omikujiGachaWorker')) return new NativeWorker(url, options);
      const worker = {
        onmessage: null,
        onerror: null,
        onmessageerror: null,
        timer: 0,
        postMessage(message) {
          const workerIndex = window.omikujiMessages.length;
          window.omikujiMessages.push(message);
          window.omikujiPaths.push(path);
          this.timer = window.setTimeout(() => {
            if (window.omikujiFailure) {
              this.onerror?.(new ErrorEvent('error', { message: 'fixture worker failure', cancelable: true }));
              return;
            }
            const names = [...new Set(message[0].flatMap((slip) => slip[1].map(String)))];
            const rewards = Object.fromEntries(names.map((name) => [name, [workerIndex + 1, workerIndex + 2]]));
            this.onmessage?.(new MessageEvent('message', { data: rewards }));
          }, window.omikujiDelay);
        },
        terminate() {
          window.clearTimeout(this.timer);
          window.omikujiStops.push(path);
        }
      };
      return worker;
    };
  })()`);
}

test('Omikuji tab preserves the worker contract, saves compatible stats, and fits a mobile viewport', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await routeCatalog(context);
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan());
  await installFakeOmikujiWorkers(page, 10);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openOmikuji(page);

  await page.locator('[data-event-omikuji-reference] summary').click();
  await expect(page.locator('[data-event-omikuji-slip]')).toHaveCount(omikuji.slips.length);
  const firstSlip = omikuji.slips[0];
  await expect(page.locator('[data-event-omikuji-slip="0"]')).toHaveAttribute(
    'data-event-omikuji-base-prob', String(firstSlip.Prob / 10000)
  );
  await expect(page.locator('[data-event-omikuji-currency]')).toHaveAttribute('data-event-omikuji-currency', '5');
  await expect(page.locator('.overflow')).toContainText('300 points per pull');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const includeRewards = page.getByRole('checkbox', { name: 'Omikuji Rewards', exact: true });
  await includeRewards.check();
  await expect(page.getByRole('status').filter({ hasText: 'Run the Omikuji simulation' })).toBeVisible();
  await includeRewards.uncheck();
  await page.locator('[data-event-omikuji-simulate]').click();
  await expect(page.locator('.omikuji .status')).toContainText('Simulation ready', { timeout: 10000 });
  const messages = await page.evaluate<unknown[][]>('window.omikujiMessages');
  expect(messages).toHaveLength(4);
  for (const message of messages) {
    expect(message).toEqual([
      request.rewards, request.chances, 3000, 100000, 5, request.pullCost, request.targetGrade
    ]);
  }
  expect(await page.evaluate<string[]>('window.omikujiPaths')).toHaveLength(4);
  expect((await page.evaluate<string[]>('window.omikujiStops')).filter((path) => path.includes('omikujiGachaWorker'))).toHaveLength(4);

  const source = await page.evaluate(() => localStorage.getItem('save-data'));
  const root = JSON.parse(source!);
  const stats = root.events_data[id].omikuji_pull_rewards;
  expect(Object.keys(stats).sort()).toEqual([...new Set(omikuji.slips.flatMap((slip) => slip.RewardId.map(String)))].sort());
  expect(root.events_data[id].omikuji_pull_currency_owned).toBe(5);
  expect(root.events_data[id].futureSetting).toEqual({ keep: true });
  expect(root.events_data.unrelated).toEqual({ target: 42 });
  expect(root.future).toEqual({ keep: true });
  expect(root.owned_materials).toEqual({ Credit: 42 });

  await includeRewards.check();
  await expect(page.locator('[data-event-rewards="other"] [data-event-reward="Credit"] strong')).toHaveText('3');
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(source);
  const sigma = page.locator('[data-event-omikuji-sd]');
  await sigma.focus();
  await sigma.press('Home');
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem('save-data')!).events_data[key].standard_deviation, id)).toBe(-2);
  expect((await page.evaluate<string[]>('window.omikujiPaths')).filter((path) => path.includes('omikujiGachaWorker'))).toHaveLength(4);
  await expect(page.locator('[data-event-rewards="other"] [data-event-reward="Credit"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Omikuji cancellation and changed farming inputs terminate all pending workers without saving stale results', async ({ page }) => {
  await routeCatalog(page.context());
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan());
  await installFakeOmikujiWorkers(page, 1500);
  await openOmikuji(page);
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.locator('[data-event-omikuji-simulate]').click();
  await expect.poll(() => page.evaluate<number>('window.omikujiMessages.length')).toBe(4);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Omikuji simulation cancelled' })).toBeVisible();
  expect((await page.evaluate<string[]>('window.omikujiStops')).filter((path) => path.includes('omikujiGachaWorker'))).toHaveLength(4);
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);

  await page.locator('[data-event-omikuji-simulate]').click();
  await expect.poll(() => page.evaluate<number>('window.omikujiMessages.length')).toBe(8);
  await page.locator('[data-event-tab="Stages"]').click();
  const runs = page.getByRole('spinbutton', { name: 'Runs Q12', exact: true });
  await runs.fill('4');
  await runs.press('Tab');
  await expect(page.getByRole('status').filter({ hasText: 'event inputs changed' })).toBeVisible();
  expect((await page.evaluate<string[]>('window.omikujiStops')).filter((path) => path.includes('omikujiGachaWorker'))).toHaveLength(8);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem('save-data')!).events_data[key].omikuji_pull_rewards, id)).toBeUndefined();
});

test('Omikuji simulation worker errors remain visible and can be retried', async ({ page }) => {
  await routeCatalog(page.context());
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan());
  await installFakeOmikujiWorkers(page, 10);
  await openOmikuji(page);
  await page.evaluate('window.omikujiFailure = true');
  await page.locator('[data-event-omikuji-simulate]').click();
  await expect(page.getByRole('alert')).toContainText('fixture worker failure');
  await expect(page.locator('[data-event-omikuji-simulate]')).toBeEnabled();
  expect((await page.evaluate<string[]>('window.omikujiStops')).filter((path) => path.includes('omikujiGachaWorker'))).toHaveLength(4);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem('save-data')!).events_data[key].omikuji_pull_rewards, id)).toBeUndefined();
  await page.evaluate('window.omikujiFailure = false');
  await page.locator('[data-event-omikuji-simulate]').click();
  await expect(page.locator('.omikuji .status')).toContainText('Simulation ready', { timeout: 10000 });
});
