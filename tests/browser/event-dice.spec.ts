import { createContext, runInContext } from 'node:vm';
import { test, expect } from './fixtures';
import { decodeEventPlan, decodeStandardEvent } from '../../src/lib/domain/events/standard-save';
import { isRecord } from '../../src/lib/domain/planner/save';
import { readJson, readSource } from '../unit/legacy-harness';
import type { CardMath } from '../../src/lib/domain/events/card-statistics';

const config = readJson('planner', 'json', 'events.json');
if (!isRecord(config) || !isRecord(config.events)) throw new Error('Invalid dice fixture.');
const id = 'occult-research-society';
const event = decodeStandardEvent(config.events[id]);
if (!event.dice_race) throw new Error('Missing dice race.');
const mathContext = createContext({});
runInContext(readSource('planner', 'packages', 'mathjs', 'math.js'), mathContext);
const math: CardMath = runInContext('math', mathContext);
const eventTime = (event.reset_time + 3 * 86400 + 3600) * 1000;
function savedPlan() {
  const plan = decodeEventPlan({ futureSetting: { keep: true } }, event);
  plan.optimisation_type = 'Manual'; plan.optimisation_options = { '12': 5 };
  plan.pyro_refreshes = 6; plan.pvp_refreshes = 4; plan.energy_pack = true;
  return { exportVersion: 2, characters: [], disabled_characters: [], owned_materials: { Credit: 42 }, groups: { Existing: [] },
    language: 'EN', future: { keep: true }, events_data: { unrelated: { target: 42 }, [id]: plan } };
}

test('dice simulations preserve original requests, exact statistics/rewards and RNG/save/reload compatibility', async ({ page, context }) => {
  await context.route('**/json/events.json*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...config, event_order: [id] }) }));
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((save) => { if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(save)); }, savedPlan());
  await page.addInitScript(`(() => {
    const NativeWorker=window.Worker;window.dicePaths=[];window.diceStops=[];window.diceMessages=[];window.diceTicks=0;
    setInterval(()=>window.diceTicks++,10);
    window.Worker=class extends NativeWorker {
      constructor(url,options){super(url,options);this.path=String(url);window.dicePaths.push(this.path)}
      postMessage(message){if(this.path.includes('diceGachaWorker'))window.diceMessages.push(message);super.postMessage(message)}
      terminate(){window.diceStops.push(this.path);super.terminate()}
    };
  })()`);
  const errors: string[] = [], missingImages: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() === 404 && response.request().resourceType() === 'image') missingImages.push(response.url()); });
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.locator(`[data-event-id="${id}"]`).click();
  await expect(page.locator('[data-event-ap]')).toBeVisible();
  await page.locator('[data-event-tab="Dice"]').click();
  await page.locator('.dice details summary').click();
  await expect(page.locator('[data-event-dice-tile]')).toHaveCount(18);
  await expect(page.locator('[data-event-dice-lap]')).toHaveCount(20);
  const funds = Number(await page.locator('[data-event-dice-currency]').getAttribute('data-event-dice-currency'));
  const beforeTicks: number = await page.evaluate('window.diceTicks');
  await page.locator('[data-event-dice-simulate]').click();
  await expect(page.locator('.dice .status')).toContainText('Simulation ready', { timeout: 20000 });
  const messages: unknown[][] = await page.evaluate('window.diceMessages');
  expect(messages).toHaveLength(4);
  for (const message of messages) {
    expect(message[0]).toEqual(event.dice_race);
    expect(message[1]).toEqual(Array.from({ length: 18 }, () => []));
    expect(message.slice(2)).toEqual([3000, 100000, funds, [1, 1, 1, 1, 1, 1]]);
  }
  expect((await page.evaluate<string[]>('window.diceStops')).filter((path) => path.includes('diceGachaWorker'))).toHaveLength(4);
  expect(await page.evaluate('window.diceTicks')).toBeGreaterThan(beforeTicks);
  const source = await page.evaluate(() => localStorage.getItem('save-data'));
  const root = JSON.parse(source!);
  const stats = root.events_data[id].dice_roll_rewards;
  expect(root.events_data[id].dice_roll_currency_owned).toBe(funds);
  expect(root.events_data[id].futureSetting).toEqual({ keep: true });
  expect(root.events_data.unrelated).toEqual({ target: 42 });
  expect(root.future).toEqual({ keep: true });
  expect(root.owned_materials).toEqual({ Credit: 42 });
  const status = await page.locator('.dice .status').innerText();
  const trials = Number(status.split('Trials:')[1].trim().replaceAll(',', ''));
  expect(trials).toBeGreaterThanOrEqual(12000); expect(trials).toBeLessThanOrEqual(400000);
  await page.getByRole('checkbox', { name: 'Dice Rewards', exact: true }).check();
  await expect(page.locator('[data-event-rewards="other"] [data-event-reward="Credit"] strong')).toHaveText(math.round(stats.Credit.mean).toLocaleString('en-US'));
  await expect(page.locator('[data-event-reward="Random_Equipment_Box_0"] strong')).toHaveText(math.round(stats.GearBox.mean).toLocaleString('en-US'));
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(source);
  const sd = page.locator('[data-event-dice-sd]');
  await sd.focus(); await sd.press('Home'); await sd.press('ArrowRight'); await sd.press('ArrowRight');
  await expect.poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].standard_deviation, id)).toBe(-1);
  await expect(page.locator('.dice .deviation-info')).toContainText('-1σ');
  await expect(page.locator('[data-event-rewards="other"] [data-event-reward="Credit"] strong')).toHaveText(math.round(stats.Credit.mean - stats.Credit.std).toLocaleString('en-US'));
  expect((await page.evaluate<string[]>('window.dicePaths')).filter((path) => path.includes('diceGachaWorker'))).toHaveLength(4);
  await page.reload();
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Dice"]').click();
  await expect(page.locator('.dice .status')).toContainText('Simulation ready');
  await expect(page.locator('[data-event-dice-simulate]')).toBeDisabled();
  expect((await page.evaluate<string[]>('window.dicePaths')).filter((path) => path.includes('diceGachaWorker'))).toHaveLength(0);
  await page.locator('[data-event-tab="Stages"]').click();
  const runs = page.getByRole('spinbutton', { name: 'Runs Q12', exact: true });
  await runs.fill('6'); await runs.press('Tab');
  await page.locator('[data-event-tab="Dice"]').click();
  await expect(page.locator('[data-event-dice-simulate]')).toBeEnabled();
  expect(errors).toEqual([]); expect(missingImages).toEqual([]);
  const persisted = await page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id], id);
  expect(persisted.standard_deviation).toBe(-1);
  expect(persisted.optimisation_options['12']).toBe(6);
});

test('dice cancellation, changed farming inputs and event switches terminate pending pools without saving stale rewards', async ({ page }) => {
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan());
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Dice"]').click();
  await page.evaluate(`(() => {
    const NativeWorker=window.Worker;window.pendingDiceStops=0;
    window.Worker=class extends NativeWorker {
      constructor(url,options){super(url,options);this.path=String(url)}
      postMessage(message){this.timer=setTimeout(()=>super.postMessage(message),1000)}
      terminate(){clearTimeout(this.timer);if(this.path.includes('diceGachaWorker'))window.pendingDiceStops++;super.terminate()}
    };
  })()`);
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.locator('[data-event-dice-simulate]').click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Dice simulation cancelled' })).toBeVisible();
  expect(await page.evaluate('window.pendingDiceStops')).toBe(4);
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
  await page.locator('[data-event-dice-simulate]').click();
  await page.locator('[data-event-tab="Stages"]').click();
  const runs = page.getByRole('spinbutton', { name: 'Runs Q12', exact: true });
  await runs.fill('7'); await runs.press('Tab');
  await expect(page.getByRole('status').filter({ hasText: 'event inputs changed' })).toBeVisible();
  expect(await page.evaluate('window.pendingDiceStops')).toBe(8);
  await page.locator('[data-event-tab="Dice"]').click();
  await page.locator('[data-event-dice-simulate]').click();
  await page.locator('[data-event-id="lore-pursuit-s2"]').click();
  await expect(page.locator('[data-event-tab="Dice"]')).toHaveCount(0);
  expect(await page.evaluate('window.pendingDiceStops')).toBe(12);
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].dice_roll_rewards, id)).toBeUndefined();
});

test('dice/statistics worker failures stay visible and can be retried without partial statistics', async ({ page, context }) => {
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan());
  await context.route('**/diceGachaWorker.js*', (route) => route.abort());
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Dice"]').click();
  await page.locator('[data-event-dice-simulate]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('[data-event-dice-simulate]')).toBeEnabled();
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].dice_roll_rewards, id)).toBeUndefined();
  await context.unroute('**/diceGachaWorker.js*');
  await context.route('**/card-statistics-worker.js', (route) => route.abort());
  await page.locator('[data-event-dice-simulate]').click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-event-dice-simulate]')).toBeEnabled();
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].dice_roll_rewards, id)).toBeUndefined();
  await context.unroute('**/card-statistics-worker.js');
  await page.locator('[data-event-dice-simulate]').click();
  await expect(page.locator('.dice .status')).toContainText('Simulation ready', { timeout: 20000 });
});

test('RNG changes during dice simulation reuse the pool and compact references fit a 375px screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan());
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Dice"]').click();
  await page.locator('.dice details summary').click();
  await expect(page.locator('[data-event-dice-tile]')).toHaveCount(18);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('[data-event-dice-tile="11"]').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.evaluate(`(() => {
    const NativeWorker=window.Worker;window.rngDiceCreates=0;window.rngDiceStops=0;
    window.Worker=class extends NativeWorker {
      constructor(url,options){super(url,options);this.path=String(url);if(this.path.includes('diceGachaWorker'))window.rngDiceCreates++}
      postMessage(message){this.timer=setTimeout(()=>super.postMessage(message),1000)}
      terminate(){clearTimeout(this.timer);if(this.path.includes('diceGachaWorker'))window.rngDiceStops++;super.terminate()}
    };
  })()`);
  await page.locator('[data-event-dice-simulate]').click();
  const sd = page.locator('[data-event-dice-sd]');
  await sd.focus(); await sd.press('Home'); await sd.press('ArrowRight'); await sd.press('ArrowRight');
  expect(await page.evaluate('window.rngDiceCreates')).toBe(4);
  expect(await page.evaluate('window.rngDiceStops')).toBe(0);
  await expect(page.locator('.dice .status')).toContainText('Simulation ready', { timeout: 20000 });
  expect(await page.evaluate('window.rngDiceCreates')).toBe(4);
  expect(await page.evaluate('window.rngDiceStops')).toBe(4);
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].standard_deviation, id)).toBe(-1);
});

test('zero roll currency still simulates initial fixed tickets rather than returning empty rewards', async ({ page }) => {
  const save = savedPlan();
  save.events_data[id].optimisation_options = {};
  save.events_data[id].currency_owned = { "Kanoe's_Hot_Chocolate": 1 };
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), save);
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Dice"]').click();
  await expect(page.locator('[data-event-dice-currency]')).toHaveAttribute('data-event-dice-currency', '0');
  await page.locator('[data-event-dice-simulate]').click();
  await expect(page.locator('.dice .status')).toContainText('Simulation ready', { timeout: 20000 });
  const statistics: Record<string, { mean: number }> = await page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].dice_roll_rewards, id);
  expect(Object.values(statistics).some((reward) => reward.mean > 0)).toBe(true);
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].dice_roll_currency_owned, id)).toBe(0);
});

test('a competing event edit cancels dice workers and cannot be overwritten by late results', async ({ context }) => {
  const first = await context.newPage();
  await first.goto('/planner/event-planner/?show-earlier-events=1');
  await first.evaluate((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan());
  await first.reload();
  const second = await context.newPage();
  await second.goto('/planner/event-planner/?show-earlier-events=1');
  for (const page of [first, second]) {
    await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
    await page.locator(`[data-event-id="${id}"]`).click();
  }
  await first.locator('[data-event-tab="Dice"]').click();
  await first.evaluate(`(() => {
    const NativeWorker=window.Worker;window.conflictDiceStops=0;
    window.Worker=class extends NativeWorker {
      constructor(url,options){super(url,options);this.path=String(url)}
      postMessage(message){this.timer=setTimeout(()=>super.postMessage(message),1000)}
      terminate(){clearTimeout(this.timer);if(this.path.includes('diceGachaWorker'))window.conflictDiceStops++;super.terminate()}
    };
  })()`);
  await first.locator('[data-event-dice-simulate]').click();
  await second.locator('[data-event-tab="Energy"]').click();
  await second.locator('[data-event-energy="pyro_refreshes"]').fill('8');
  await second.locator('[data-event-energy="pyro_refreshes"]').press('Tab');
  await expect(first.getByRole('alert')).toContainText('changed in another window');
  expect(await first.evaluate('window.conflictDiceStops')).toBe(4);
  expect(await first.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].dice_roll_rewards, id)).toBeUndefined();
  expect(await first.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].pyro_refreshes, id)).toBe(8);
});
