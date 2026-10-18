import { test, expect } from './fixtures';

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
