import { test, expect } from './fixtures';
import { calculateEventEnergy, calculateInitialClear } from '../../src/lib/domain/events/budget';
import { calculateInvasionRewards } from '../../src/lib/domain/events/invasion';
import { decodeEventPlan, decodeStandardEvent } from '../../src/lib/domain/events/standard-save';
import { formatAmount } from '../../src/lib/domain/planner/catalog';
import { isRecord } from '../../src/lib/domain/planner/save';
import { readJson } from '../unit/legacy-harness';

const oldConfig = readJson('planner', 'json', 'old_events.json');
const misc = readJson('planner', 'json', 'event_misc.json');
if (!isRecord(oldConfig) || !isRecord(oldConfig.events) || !isRecord(misc) || !isRecord(misc.cafe_energy)) {
  throw new Error('Invalid Invasion browser fixture.');
}
const id = 'valentine-rerun';
const event = decodeStandardEvent(oldConfig.events[id]);
if (!event.invasion) throw new Error('Missing Invasion browser fixture.');
const initial = calculateInitialClear(event);
const eventTime = (event.start_time + 3600) * 1000;
const budget = calculateEventEnergy(id, event, {}, Object.fromEntries(
  Object.entries(misc.cafe_energy).map(([rank, rate]) => {
    if (typeof rate !== 'number') throw new Error(`Invalid cafe rate ${rank}.`);
    return [rank, rate];
  })
), false, initial.cost, eventTime);
const expected = calculateInvasionRewards(event.invasion, budget.resetsTotal, budget.resetsLeft, false);

function savedPlan() {
  const plan = decodeEventPlan({ futureSetting: { keep: true } }, event);
  plan.optimisation_type = 'Manual';
  plan.optimisation_options = {};
  for (const [currency, items] of Object.entries(event.shops)) {
    plan.shop_purchases[currency] = Object.fromEntries(items.map((item) => [String(item.id), 0]));
    plan.currency_needed[currency] = 0;
  }
  return {
    exportVersion: 2, future: { preserve: true },
    events_data: { untouched: { value: 42 }, [id]: plan }
  };
}

test('archived Invasion adds currencies automatically and exposes optional Eleph/XP/Credit rewards', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan());
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${id}"]`).click();
  await expect(page.locator('[data-event-tab="Invasion"]')).toHaveCount(0);
  await page.locator('[data-event-tab="Bonus"]').click();
  const pointBonus = event.currencies.Event_Point.bonus_units[0];
  const eventPointBonus = page.locator('.bonus-total[data-event-currency="Event_Point"]');
  await expect(eventPointBonus).toBeVisible();
  await page.locator(`[data-event-bonus="${pointBonus.id}"]`).click();
  await expect(eventPointBonus).toContainText(`+${Math.round(pointBonus.bonus * 100)}%`);
  await page.locator('[data-event-tab="Targets"]').click();
  await expect(page.locator('[data-event-rewards="currencies"] [data-event-reward="Event_Point"] strong'))
    .toHaveText(formatAmount(initial.rewards.Event_Point + expected.currencies.Event_Point));
  await expect(page.locator('[data-event-rewards="eleph"] [data-event-reward="16008"]')).toHaveCount(0);
  await expect(page.locator('[data-event-rewards="xps"] [data-event-reward="XP_3"]')).toHaveCount(0);

  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.getByRole('checkbox', { name: 'Invasion Rewards', exact: true }).check();
  await expect(page.locator('[data-event-rewards="eleph"] [data-event-reward="16008"] strong'))
    .toHaveText(formatAmount(expected.eleph['16008']));
  await expect(page.locator('[data-event-rewards="xps"] [data-event-reward="XP_3"] strong'))
    .toHaveText(formatAmount(expected.xps.XP_3));
  await expect(page.locator('[data-event-rewards="other"] [data-event-reward="Credit"] strong'))
    .toHaveText(formatAmount(expected.credit));
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('only the reviewed archived Invasion event is exposed in the event selector', async ({ page }) => {
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await expect(page.locator(`[data-event-id="${id}"]`)).toBeVisible();
  await expect(page.locator('[data-event-id="valentine-rerun"]')).toHaveCount(1);
});

test('the Invasion Eleph overflow shop item preserves its capped manual and Currency-mode behavior', async ({ page }) => {
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan());
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Shop"]').click();
  await page.locator('[data-event-shop-tab="Garbage_Bag"]').click();
  const row = page.locator('[data-event-purchase="16008"][data-event-shop="Garbage_Bag"]');
  const purchase = row.locator('input');
  await expect(purchase).toHaveAttribute('max', '620');
  await expect(purchase).toHaveValue('0');
  await purchase.fill('5');
  await purchase.press('Tab');
  await expect.poll(() => page.evaluate((key) =>
    JSON.parse(localStorage.getItem('save-data')!).events_data[key].shop_purchases.Garbage_Bag['16008'], id
  )).toBe(5);

  await page.locator('[data-event-tab="Targets"]').click();
  await page.locator('[data-event-mode="Currency"]').click();
  await expect(page.locator('[data-event-ap]')).toBeVisible({ timeout: 20000 });
  await page.locator('[data-event-tab="Shop"]').click();
  await page.locator('[data-event-shop-tab="Garbage_Bag"]').click();
  await expect(purchase).toHaveValue('0');
  await expect(purchase).toBeDisabled();
});
