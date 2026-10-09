import { runInContext } from 'node:vm';
import { test, expect } from './fixtures';
import { createLegacyContext, readJson, readSource } from '../unit/legacy-harness';
import type { Resources, StudentPlan } from '../../src/lib/domain/resources/types';

const students = readJson('planner', 'json', 'skillinfo', 'en.json');
const misc = readJson('planner', 'json', 'misc_data.json');

test('the existing resource screen delegates to the shared engine without changing totals', async ({ page }) => {
  const investment = {
    level: 1, bond: 1, star: 3, ue: 0, ue_level: 0,
    ex: 1, basic: 1, passive: 1, sub: 1,
    gear1: 0, gear2: 0, gear3: 0, bond_gear: 0, book_hp: 0, book_atk: 0, book_heal: 0
  };
  const student = {
    id: '10000', name: 'Aru', enabled: true, hasBondGear: true,
    current: investment,
    target: {
      ...investment, level: 90, star: 5, ue: 4, ue_level: 60,
      ex: 5, basic: 10, passive: 10, sub: 10, gear1: 10, gear2: 10, gear3: 10,
      bond_gear: 2, book_hp: 25, book_atk: 25, book_heal: 25
    },
    eleph: { owned: 100, unlocked: true, cost: 1, purchasable: 20, farm_nodes: 1, use_eligma: true, use_shop: false }
  };
  await page.addInitScript((character) => localStorage.setItem('save-data', JSON.stringify({
    exportVersion: 2, characters: [character], character_order: ['10000'],
    disabled_characters: [], owned_materials: {}, groups: {}, language: 'EN', level_cap: 90
  })), student);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/planner/index.html');
  await page.waitForFunction('typeof loaded !== "undefined" && loaded && Boolean(misc_data)');
  await expect(page.locator('#char_10000')).toBeVisible();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('#button-resources').click();
  await expect(page.locator('#resourceModal')).toBeVisible();
  const actual = await page.evaluate<{
    plan: StudentPlan; resources: Resources; calls: number; credit: number
  }>(`(() => {
    let calls = 0;
    const original = BAResourceEngine.calculateStudentResources;
    BAResourceEngine.calculateStudentResources = (...args) => { calls++; return original(...args); };
    try {
      return { plan: data.characters[0], resources: calculateCharResources(data.characters[0], true), calls, credit: requiredMatDict.Credit };
    } finally {
      BAResourceEngine.calculateStudentResources = original;
    }
  })()`);
  const reference = createLegacyContext(['config.js'], {
    charlist: students, misc_data: misc, plan: actual.plan
  });
  runInContext(readSource('tests', 'fixtures', 'resource-calculations.legacy.js'), reference);
  expect(actual.resources).toEqual(runInContext('calculateCharResources(plan, true)', reference));
  expect(actual.credit).toBe(runInContext('calculateCharResources(plan, true).Credit', reference));
  expect(actual.calls).toBe(1);
  expect(errors).toEqual([]);
});

test('the shared coordinator uses four real workers, stays responsive, and cleans up', async ({ page }) => {
  await page.goto('/planner/credit/');
  await page.addScriptTag({ url: '/planner/js/shared/simulations.js' });
  const result = await page.evaluate(async () => {
    const OriginalWorker = window.Worker;
    let created = 0;
    let terminated = 0;
    let ticks = 0;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        created++;
      }
      terminate() { terminated++; super.terminate(); }
    };
    const timer = setInterval(() => ticks++, 10);
    try {
      const rewards = await window.BAEventSimulations.run({
        kind: 'card', currencyOwned: 20000,
        rewards: [{ drops: { Credit: 1 } }, { drops: { Credit: 2 } }],
        chances: [[0.5, 1], [0.5, 1], [0.5, 1], [0.5, 1]]
      });
      return { created, terminated, ticks, count: rewards.Credit.length, budget: window.BAEventSimulations.budget };
    } finally {
      clearInterval(timer);
      window.Worker = OriginalWorker;
    }
  });
  expect(result.created).toBe(4);
  expect(result.terminated).toBe(4);
  expect(result.ticks).toBeGreaterThan(0);
  expect(result.count).toBeGreaterThanOrEqual(12000);
  expect(result.count).toBeLessThanOrEqual(400000);
  expect(result.budget).toEqual({ workers: 4, timeoutMs: 3000, maxTrials: 100000 });
});

test('omikuji and dice requests run through real worker threads', async ({ page }) => {
  await page.goto('/planner/credit/');
  await page.addScriptTag({ url: '/planner/js/shared/simulations.js' });
  const results = await page.evaluate(async () => {
    const omikuji = await window.BAEventSimulations.run({
      kind: 'omikuji', currencyOwned: 0,
      rewards: [[1, [10001], [1]]], chances: [[0]], pullCost: 10, targetGrade: 1
    });
    const dice = await window.BAEventSimulations.run({
      kind: 'dice', currencyOwned: 0,
      race: {
        roll_cost: 10, tiles: [{ type: 'Credit', amount: 1 }],
        lap_reward_tiers: [], lap_rewards: []
      },
      targets: [[]], tickets: []
    });
    return {
      omikujiCount: omikuji['10001'].length, diceCount: dice.Credit.length,
      omikujiZero: omikuji['10001'].every((value) => value === 0),
      diceZero: dice.Credit.every((value) => value === 0)
    };
  });
  expect(results.omikujiCount).toBeGreaterThanOrEqual(12000);
  expect(results.diceCount).toBeGreaterThanOrEqual(12000);
  expect(results.omikujiZero && results.diceZero).toBe(true);
});

test('worker failure is visible in the event screen and retry succeeds', async ({ page, context }) => {
  const config = readJson('planner', 'json', 'events.json');
  if (typeof config !== 'object' || config === null) throw new Error('Invalid event fixture.');
  const fixture = JSON.stringify({ ...config, event_order: ['art-for-whom'] });
  await context.route('**/json/events.json*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: fixture
  }));
  await context.route('**/cardGachaWorker.js', (route) => route.abort());
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/planner/events.html');
  await page.locator('#art-for-whom').click();
  await page.locator('#tab-Cards').click();
  const button = page.locator('#gacha-sim-button');
  await button.click();
  await expect(page.getByText('Simulation failed. Please try again.', { exact: true })).toBeVisible();
  await expect(button).not.toHaveClass(/active/);
  expect(await page.evaluate('cardGachaProcessing')).toBe(false);
  expect(await page.evaluate('cardGachaProcessed')).toBe(false);
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await context.unroute('**/cardGachaWorker.js');
  await button.click();
  await page.waitForFunction('cardGachaProcessed && !cardGachaProcessing', undefined, { timeout: 15000 });
  expect(await page.evaluate('Object.keys(events_data[current_event].card_pull_rewards).length')).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('aborting a real pool terminates every worker and returns no partial result', async ({ page }) => {
  await page.goto('/planner/credit/');
  await page.addScriptTag({ url: '/planner/js/shared/simulations.js' });
  const result = await page.evaluate(async () => {
    const OriginalWorker = window.Worker;
    let terminated = 0;
    window.Worker = class extends OriginalWorker {
      terminate() { terminated++; super.terminate(); }
    };
    const controller = new AbortController();
    try {
      const pending = window.BAEventSimulations.run({
        kind: 'card', currencyOwned: 20000,
        rewards: [{ drops: { Credit: 1 } }], chances: [[1], [1], [1], [1]]
      }, { signal: controller.signal });
      controller.abort();
      try {
        await pending;
        return { error: 'Unexpected success', terminated };
      } catch (error) {
        return { error: error instanceof DOMException ? error.name : String(error), terminated };
      }
    } finally {
      window.Worker = OriginalWorker;
    }
  });
  expect(result).toEqual({ error: 'AbortError', terminated: 4 });
});
