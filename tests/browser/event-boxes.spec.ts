import { runInContext } from 'node:vm';
import { test, expect } from './fixtures';
import { boxEventIds, decodeStandardEvent, decodeEventPlan } from '../../src/lib/domain/events/standard-save';
import { isRecord } from '../../src/lib/domain/planner/save';
import { createLegacyContext, evaluate, readJson, readSource } from '../unit/legacy-harness';

const config = readJson('planner', 'json', 'events.json');
if (!isRecord(config) || !isRecord(config.events)) throw new Error('Invalid event fixture.');
const events = config.events;

function sourceSave(id: string) {
  const event = decodeStandardEvent(events[id]);
  const plan = decodeEventPlan({ futureSetting: { keep: true } }, event);
  plan.pyro_refreshes = 10; plan.pvp_refreshes = 4; plan.energy_pack = true;
  return {
    exportVersion: 2, characters: [], disabled_characters: [], owned_materials: { Credit: 123 }, groups: { Existing: [] },
    language: 'EN', futureField: { keep: true }, events_data: { unrelated: { untouched: 42 }, [id]: plan }
  };
}

for (const id of boxEventIds) {
  test(`${id} exposes complete cycle browsing and exact legacy box rewards with session-only toggles`, async ({ page }) => {
    const event = decodeStandardEvent(events[id]);
    const boxCurrency = Object.keys(event.currencies).find((key) => event.currencies[key].source === 'BoxPull');
    const pull = boxCurrency ? event.currencies[boxCurrency].pull_currency : undefined;
    if (!boxCurrency || !pull || !event.boxes || !event.box_clear_cost) throw new Error('Missing box fixture.');
    const errors: string[] = [], missingImages: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => { if (response.status() === 404 && response.request().resourceType() === 'image') missingImages.push(response.url()); });
    await page.clock.setFixedTime((event.reset_time + 3 * 86400 + 3600) * 1000);
    await page.addInitScript((save) => { if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(save)); }, sourceSave(id));
    await page.goto('/planner/event-planner/?show-earlier-events=1');
    await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
    await page.locator(`[data-event-id="${id}"]`).click();
    await expect(page.locator('[data-event-tab="Boxes"]')).toBeVisible();
    await expect(page.locator('[data-event-tab="Points"]')).toHaveCount(0);
    await page.locator('[data-event-tab="Boxes"]').click();
    await expect(page.locator('[data-event-box-cycle]')).toHaveCount(event.boxes.length);
    for (let index = 0; index < event.boxes.length; index++) {
      const box = event.boxes[index];
      const button = page.locator(`[data-event-box-cycle="${index}"]`);
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(button).toHaveText(box.cycle.length > 1 ? box.cycle.join('/') : `${box.cycle[0]}+`);
      await expect(page.locator('[data-event-box-reward]')).toHaveCount(box.rewards.length);
      const product = box.rewards[0];
      await expect(page.locator('[data-event-box-reward]').first()).toHaveAttribute('data-event-box-amount', String(product.amount));
      await expect(page.locator('[data-event-box-reward]').first()).toHaveAttribute('data-event-box-stock', String(product.count));
    }
    await page.locator('[data-event-tab="Targets"]').click();
    await page.locator('[data-event-mode="Manual"]').click();
    const runs = page.getByRole('spinbutton', { name: 'Runs Q12', exact: true });
    await runs.fill('100'); await runs.press('Tab');
    await expect(page.locator('[data-event-ap]')).toBeVisible();
    const pullAmountText = await page.locator(`[data-event-rewards="currencies"] [data-event-reward="${pull}"] strong`).innerText();
    const pullAmount = Number(pullAmountText.replaceAll(',', ''));
    const context = createLegacyContext(['config.js'], { event_config: config, current_event: id, pullAmount });
    runInContext(readSource('tests', 'fixtures', 'boxes.legacy.js'), context);
    const reference = evaluate(context, `(() => {
      const artifacts={},schoolMats={},eleph={},xps={}; const result=AddBoxRewards(pullAmount,artifacts,schoolMats,eleph,xps);
      return { result, clears: Math.floor(pullAmount/event_config.events[current_event].box_clear_cost),
        leftover: ((pullAmount % event_config.events[current_event].box_clear_cost)/event_config.events[current_event].box_clear_cost*100).toFixed(0) };
    })()`);
    if (!isRecord(reference) || !Array.isArray(reference.result)) throw new Error('Invalid box reward reference.');
    const beforeToggle = await page.evaluate(() => localStorage.getItem('save-data'));
    const toggle = page.getByRole('checkbox', { name: 'Box Rewards', exact: true });
    await toggle.check();
    await expect(page.locator('[data-event-box-progress]')).toContainText(`Boxes cleared: ${reference.clears}`);
    await expect(page.locator('[data-event-box-progress]')).toContainText(`${reference.leftover}%`);
    await expect(page.locator(`[data-event-rewards="currencies"] [data-event-reward="${boxCurrency}"] strong`))
      .toHaveText(Number(reference.result[3]).toLocaleString('en-US'));
    expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(beforeToggle);
    await toggle.uncheck();
    await expect(page.locator('[data-event-box-progress]')).toHaveCount(0);
    await expect(page.locator(`[data-event-rewards="currencies"] [data-event-reward="${boxCurrency}"]`)).toHaveCount(0);
    await page.locator('[data-event-tab="Bonus"]').click();
    await expect(page.locator(`.bonus-totals [data-event-currency="${boxCurrency}"]`)).toHaveCount(0);
    await page.locator('[data-event-tab="Owned"]').click();
    await expect(page.getByRole('spinbutton', { name: `Owned ${event.currencies[boxCurrency].shortname}`, exact: true })).toHaveCount(0);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
    expect(stored.events_data.unrelated).toEqual({ untouched: 42 });
    expect(stored.events_data[id].futureSetting).toEqual({ keep: true });
    expect(stored.owned_materials).toEqual({ Credit: 123 });
    expect(stored.futureField).toEqual({ keep: true });
    await page.reload();
    await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
    await page.locator(`[data-event-id="${id}"]`).click();
    await page.locator('[data-event-tab="Stages"]').click();
    await expect(page.getByRole('spinbutton', { name: 'Runs Q12', exact: true })).toHaveValue('100');
    await expect(page.getByRole('checkbox', { name: 'Box Rewards', exact: true })).not.toBeChecked();
    expect(errors).toEqual([]);
    expect(missingImages).toEqual([]);
  });
}

test('box-currency shop edits preserve converted targets and work in real solver workers', async ({ page, context }) => {
  const id = 'moonlight-dream';
  const event = decodeStandardEvent(events[id]);
  await context.route('**/json/events.json*', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ ...config, event_order: [id] })
  }));
  await page.clock.setFixedTime((event.reset_time + 3 * 86400 + 3600) * 1000);
  await page.addInitScript((save) => { if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(save)); }, sourceSave(id));
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Bonus"]').click();
  await page.getByRole('button', { name: 'Enable All', exact: true }).click();
  await page.locator('[data-event-tab="Shop"]').click();
  await page.locator('[data-event-shop-tab="Lucky_Keychain"]').click();
  const firstItem = event.shops.Lucky_Keychain[0];
  const product = page.locator(`[data-event-purchase="${firstItem.id}"] input`);
  await product.fill('1'); await product.press('Tab');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
  const saved = stored.events_data[id];
  const expectedCurrency = event.shops.Lucky_Keychain.reduce((sum, item) => sum + Number(saved.shop_purchases.Lucky_Keychain[String(item.id)] ?? 0) * item.cost, 0);
  expect(saved.currency_needed.Lucky_Keychain).toBe(expectedCurrency);
  const ref = createLegacyContext(['config.js'], { event_config: config, current_event: id, amount: expectedCurrency });
  runInContext(readSource('tests', 'fixtures', 'boxes.legacy.js'), ref);
  expect(saved.currency_needed.Souvenir_Doll).toBe(runInContext('CalculateBoxCurrencyNeeded(amount)', ref));
  await page.locator('[data-event-tab="Targets"]').click();
  await page.locator('[data-event-mode="Shop"]').click();
  await expect(page.locator('[data-event-ap]')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Box Rewards', exact: true }).check();
  await expect(page.locator('[data-event-reward="Lucky_Keychain"]')).toBeVisible();
  const persisted = await page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id], id);
  expect(persisted.currency_needed.Lucky_Keychain).toBe(expectedCurrency);
  expect(persisted.currency_needed.Souvenir_Doll).toBe(saved.currency_needed.Souvenir_Doll);
  expect(persisted.shop_purchases.Lucky_Keychain[String(firstItem.id)]).toBe(1);
});

test('box events fit mobile screens and keyboard cycle changes do not touch saved settings', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), sourceSave('say-bing-rerun'));
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator('[data-event-id="say-bing-rerun"]').click();
  await page.locator('[data-event-tab="Boxes"]').click();
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  const cycle = page.locator('[data-event-box-cycle="2"]');
  await cycle.focus(); await cycle.press('Enter');
  await expect(cycle).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
  await expect(page.locator('#event-list')).not.toBeVisible();
  await page.locator('[data-event-list-control]').click();
  await page.locator('[data-event-id="moonlight-dream"]').click();
  await page.locator('[data-event-tab="Boxes"]').click();
  await expect(page.locator('[data-event-box-cycle="0"]')).toHaveAttribute('aria-pressed', 'true');
  const tiles = await page.locator('[data-event-box-reward]').evaluateAll((nodes) =>
    nodes.slice(0, 3).map((node) => node.getBoundingClientRect().top));
  expect(new Set(tiles).size).toBe(1);
});
