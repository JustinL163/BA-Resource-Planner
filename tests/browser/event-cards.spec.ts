import { createContext, runInContext } from 'node:vm';
import { test, expect } from './fixtures';
import { cardEventIds, decodeEventPlan, decodeStandardEvent } from '../../src/lib/domain/events/standard-save';
import { isRecord } from '../../src/lib/domain/planner/save';
import { readJson, readSource } from '../unit/legacy-harness';
import type { CardMath } from '../../src/lib/domain/events/card-statistics';

const config = readJson('planner', 'json', 'events.json');
if (!isRecord(config) || !isRecord(config.events)) throw new Error('Invalid event fixture.');
const events = config.events;
const mathContext = createContext({});
runInContext(readSource('planner', 'packages', 'mathjs', 'math.js'), mathContext);
const math: CardMath = runInContext('math', mathContext);

function savedPlan(id: string) {
  const event = decodeStandardEvent(events[id]);
  const plan = decodeEventPlan({ futureSetting: { keep: true } }, event);
  plan.optimisation_type = 'Manual'; plan.optimisation_options = { '12': 5 };
  plan.pyro_refreshes = 6; plan.pvp_refreshes = 4; plan.energy_pack = true;
  return {
    exportVersion: 2, characters: [], disabled_characters: [], groups: { Existing: [] }, owned_materials: { Credit: 42 },
    language: 'EN', futureField: { keep: true }, events_data: { unrelated: { target: 42 }, [id]: plan }
  };
}

for (const id of cardEventIds) {
  test(`${id} runs the original four workers, preserves statistics, updates RNG without resimulating, and reloads compatibly`, async ({ page, context }) => {
    const event = decodeStandardEvent(events[id]);
    const rewardCurrency = Object.keys(event.currencies).find((key) => event.currencies[key].source === 'CardPull');
    if (!event.card_drops || !rewardCurrency) throw new Error('Missing card fixture.');
    const errors: string[] = [], missingImages: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => { if (response.status() === 404 && response.request().resourceType() === 'image') missingImages.push(response.url()); });
    await context.route('**/json/events.json*', (route) => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ ...config, event_order: [id] })
    }));
    await page.clock.setFixedTime((event.reset_time + 3 * 86400 + 3600) * 1000);
    await page.addInitScript((save) => {
      if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(save));
    }, savedPlan(id));
    await page.addInitScript(`(() => {
      const NativeWorker=window.Worker;
      window.cardWorkerPaths=[]; window.cardWorkerStops=[]; window.cardMessages=[]; window.cardTicks=0;
      setInterval(()=>window.cardTicks++,10);
      window.Worker=class extends NativeWorker {
        constructor(url,options){super(url,options);this.path=String(url);window.cardWorkerPaths.push(this.path)}
        postMessage(message){if(this.path.includes('cardGachaWorker'))window.cardMessages.push(message.slice(2));super.postMessage(message)}
        terminate(){window.cardWorkerStops.push(this.path);super.terminate()}
      };
    })()`);
    await page.goto('/planner/event-planner/');
    await page.locator(`[data-event-id="${id}"]`).click();
    await expect(page.locator('[data-event-ap]')).toBeVisible();
    await page.locator('[data-event-tab="Cards"]').click();
    for (const rarity of ['UR', 'SR', 'R', 'N']) {
      await page.locator(`[data-event-card-rarity="${rarity}"]`).click();
      await expect(page.locator('[data-event-card]')).toHaveCount(event.card_drops.filter((card) => card.icon.startsWith(rarity.length === 1 ? `${rarity}_` : rarity)).length);
    }
    await page.getByRole('button', { name: 'Hide Cards', exact: true }).click();
    await expect(page.locator('[data-event-card]')).toHaveCount(0);
    await page.locator('[data-event-card-rarity="UR"]').click();
    await expect(page.locator('[data-event-card]')).not.toHaveCount(0);
    const funds = Number(await page.locator('[data-event-card-currency]').getAttribute('data-event-card-currency'));
    const ticksBefore: number = await page.evaluate('window.cardTicks');
    await page.locator('[data-event-card-simulate]').click();
    await expect(page.locator('.cards .status')).toContainText('Simulation ready', { timeout: 20000 });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
    const stats = stored.events_data[id].card_pull_rewards;
    expect(stored.events_data[id].card_pull_currency_owned).toBe(funds);
    expect(stored.events_data[id].futureSetting).toEqual({ keep: true });
    expect(stored.events_data.unrelated).toEqual({ target: 42 });
    expect(stored.groups).toEqual({ Existing: [] });
    expect(stored.futureField).toEqual({ keep: true });
    const paths: string[] = await page.evaluate('window.cardWorkerPaths');
    const stops: string[] = await page.evaluate('window.cardWorkerStops');
    expect(paths.filter((path) => path.includes('cardGachaWorker'))).toHaveLength(4);
    expect(stops.filter((path) => path.includes('cardGachaWorker'))).toHaveLength(4);
    expect(paths.some((path) => path.includes('card-statistics-worker'))).toBe(true);
    const messages: number[][] = await page.evaluate('window.cardMessages');
    expect(messages).toEqual(Array(4).fill([3000, 100000, funds]));
    expect(await page.evaluate('window.cardTicks')).toBeGreaterThan(ticksBefore);
    const status = await page.locator('.cards .status').innerText();
    const count = Number(status.split('Trials:')[1].trim().replaceAll(',', ''));
    expect(count).toBeGreaterThanOrEqual(12000);
    expect(count).toBeLessThanOrEqual(400000);
    await page.getByRole('checkbox', { name: 'Card Rewards', exact: true }).check();
    await expect(page.locator(`[data-event-rewards="currencies"] [data-event-reward="${rewardCurrency}"] strong`))
      .toHaveText(math.round(stats[rewardCurrency].mean).toLocaleString('en-US'));
    const sd = page.locator('[data-event-card-sd]');
    await sd.focus(); await sd.press('Home'); await sd.press('ArrowRight');
    await expect.poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].standard_deviation, id)).toBe(-1.5);
    await expect(page.locator('.deviation-info')).toContainText('-1.5σ');
    await expect(page.locator('.deviation-info')).toContainText('6.7%');
    await expect(page.locator(`[data-event-rewards="currencies"] [data-event-reward="${rewardCurrency}"] strong`))
      .toHaveText(math.round(stats[rewardCurrency].mean - 1.5 * stats[rewardCurrency].std).toLocaleString('en-US'));
    expect((await page.evaluate<string[]>('window.cardWorkerPaths')).filter((path) => path.includes('cardGachaWorker'))).toHaveLength(4);
    await page.reload();
    await page.locator(`[data-event-id="${id}"]`).click();
    await page.locator('[data-event-tab="Cards"]').click();
    await expect(page.locator('.cards .status')).toContainText('Simulation ready');
    await expect(page.locator('[data-event-card-simulate]')).toBeDisabled();
    expect((await page.evaluate<string[]>('window.cardWorkerPaths')).filter((path) => path.includes('cardGachaWorker'))).toHaveLength(0);
    await page.locator('[data-event-tab="Stages"]').click();
    const runs = page.getByRole('spinbutton', { name: 'Runs Q12', exact: true });
    await runs.fill('6'); await runs.press('Tab');
    await page.locator('[data-event-tab="Cards"]').click();
    await expect(page.locator('[data-event-card-simulate]')).toBeEnabled();
    await expect(page.locator('.cards .status')).not.toContainText('Simulation ready');
    expect(errors).toEqual([]);
    expect(missingImages).toEqual([]);
    await page.getByRole('link', { name: 'Open legacy tools', exact: true }).click();
    await page.locator(`#${id}`).click();
    expect(await page.evaluate('event_data.standard_deviation')).toBe(-1.5);
    expect(await page.evaluate('stage_runs[12]')).toBe(6);
  });
}

test('card simulation cancellation and changed inputs release workers without persisting stale results', async ({ page }) => {
  const id = 'art-for-whom';
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan(id));
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Cards"]').click();
  await page.evaluate(`(() => {
    const NativeWorker=window.Worker;window.delayedCardStops=0;
    window.Worker=class extends NativeWorker {
      constructor(url,options){super(url,options);this.path=String(url)}
      postMessage(message){this.timer=setTimeout(()=>super.postMessage(message),1000)}
      terminate(){clearTimeout(this.timer);if(this.path.includes('cardGachaWorker'))window.delayedCardStops++;super.terminate()}
    };
  })()`);
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.locator('[data-event-card-simulate]').click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Card simulation cancelled' })).toBeVisible();
  expect(await page.evaluate('window.delayedCardStops')).toBe(4);
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
  await page.locator('[data-event-card-simulate]').click();
  await page.locator('[data-event-tab="Stages"]').click();
  const runs = page.getByRole('spinbutton', { name: 'Runs Q12', exact: true });
  await runs.fill('7'); await runs.press('Tab');
  await expect(page.getByRole('status').filter({ hasText: 'event inputs changed' })).toBeVisible();
  expect(await page.evaluate('window.delayedCardStops')).toBe(8);
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].card_pull_rewards, id)).toBeUndefined();
});

test('failed card workers report errors, allow retry, and never save partial statistics', async ({ page, context }) => {
  const id = 'art-for-whom';
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan(id));
  await context.route('**/cardGachaWorker.js', (route) => route.abort());
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Cards"]').click();
  await page.locator('[data-event-card-simulate]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('[data-event-card-simulate]')).toBeEnabled();
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].card_pull_rewards, id)).toBeUndefined();
  await context.unroute('**/cardGachaWorker.js');
  await page.locator('[data-event-card-simulate]').click();
  await expect(page.locator('.cards .status')).toContainText('Simulation ready', { timeout: 20000 });
  expect(await page.evaluate((id) => Object.keys(JSON.parse(localStorage.getItem('save-data')!).events_data[id].card_pull_rewards).length, id)).toBeGreaterThan(0);
});

test('switching events cancels card simulations and compact rarity tables fit mobile screens', async ({ page }) => {
  const id = 'art-for-whom', event = decodeStandardEvent(events[id]);
  if (!event.card_drops) throw new Error('Missing cards.');
  const save = savedPlan(id);
  const drawCurrency = Object.values(event.currencies).find((currency) => currency.source === 'CardPull')?.pull_currency;
  if (!drawCurrency) throw new Error('Missing currency.');
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), save);
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Cards"]').click();
  await page.evaluate(`(() => {
    const NativeWorker=window.Worker;window.switchCardStops=0;
    window.Worker=class extends NativeWorker {
      constructor(url,options){super(url,options);this.path=String(url)}
      postMessage(message){this.timer=setTimeout(()=>super.postMessage(message),1000)}
      terminate(){clearTimeout(this.timer);if(this.path.includes('cardGachaWorker'))window.switchCardStops++;super.terminate()}
    };
  })()`);
  await page.locator('[data-event-card-simulate]').click();
  await page.locator('[data-event-id="lore-pursuit-s2"]').click();
  await expect(page.locator('[data-event-tab="Cards"]')).toHaveCount(0);
  expect(await page.evaluate('window.switchCardStops')).toBe(4);
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].card_pull_rewards, id)).toBeUndefined();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('[data-event-list-control]').click();
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Cards"]').click();
  for (const rarity of ['UR', 'SR', 'R', 'N']) {
    await page.locator(`[data-event-card-rarity="${rarity}"]`).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('RNG-only edits during card processing keep the four-worker simulation valid', async ({ page }) => {
  const id = 'art-for-whom';
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan(id));
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Cards"]').click();
  await page.evaluate(`(() => {
    const NativeWorker=window.Worker;window.rngCardCreates=0;window.rngCardStops=0;
    window.Worker=class extends NativeWorker {
      constructor(url,options){super(url,options);this.path=String(url);if(this.path.includes('cardGachaWorker'))window.rngCardCreates++}
      postMessage(message){this.timer=setTimeout(()=>super.postMessage(message),1000)}
      terminate(){clearTimeout(this.timer);if(this.path.includes('cardGachaWorker'))window.rngCardStops++;super.terminate()}
    };
  })()`);
  await page.locator('[data-event-card-simulate]').click();
  const sd = page.locator('[data-event-card-sd]');
  await sd.focus(); await sd.press('Home'); await sd.press('ArrowRight'); await sd.press('ArrowRight');
  await expect(page.locator('.cards .status')).toContainText('Simulating card draws');
  expect(await page.evaluate('window.rngCardCreates')).toBe(4);
  expect(await page.evaluate('window.rngCardStops')).toBe(0);
  await expect(page.locator('.cards .status')).toContainText('Simulation ready', { timeout: 20000 });
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].standard_deviation, id)).toBe(-1);
  expect(await page.evaluate('window.rngCardCreates')).toBe(4);
  expect(await page.evaluate('window.rngCardStops')).toBe(4);
});

test('statistics-worker failure is explicit and does not persist a successful simulation-shaped fallback', async ({ page, context }) => {
  const id = 'art-for-whom';
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan(id));
  await context.route('**/card-statistics-worker.js', (route) => route.abort());
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Cards"]').click();
  await page.locator('[data-event-card-simulate]').click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-event-card-simulate]')).toBeEnabled();
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].card_pull_rewards, id)).toBeUndefined();
  await context.unroute('**/card-statistics-worker.js');
  await page.locator('[data-event-card-simulate]').click();
  await expect(page.locator('.cards .status')).toContainText('Simulation ready', { timeout: 20000 });
});
