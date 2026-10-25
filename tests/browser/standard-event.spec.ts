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
const unreviewedArchive = oldConfig.events['after-school-sweets'];
if (!isRecord(unreviewedArchive)) throw new Error('Missing unreviewed archive fixture.');
const event = decodeStandardEvent(currentEvents['lore-pursuit-s2']);
const eventTime = (event.reset_time + 3 * 86400 + 3600) * 1000;
const lorePursuitId = 'lore-pursuit';
const lorePursuitEvent = decodeStandardEvent(currentEvents[lorePursuitId], lorePursuitId);
const lorePursuitTime = (lorePursuitEvent.reset_time + 3 * 86400 + 3600) * 1000;
const shadowId = 'box-shadow-looming';
const shadowEvent = decodeStandardEvent(currentEvents[shadowId], shadowId);
const shadowTime = (shadowEvent.reset_time + 3 * 86400 + 3600) * 1000;
const secretId = 'secret-midnight-party';
const secretEvent = decodeStandardEvent(currentEvents[secretId], secretId);
const secretTime = (secretEvent.reset_time + 3 * 86400 + 3600) * 1000;
const honorableId = 'honorable-sea-showdown';
const honorableEvent = decodeStandardEvent(currentEvents[honorableId], honorableId);
const honorableTime = (honorableEvent.reset_time + 3 * 86400 + 3600) * 1000;
const serenadeId = 'serenade-promenade-rerun';
const serenadeEvent = decodeStandardEvent(currentEvents[serenadeId], serenadeId);
const serenadeTime = (serenadeEvent.reset_time + 3 * 86400 + 3600) * 1000;
const winterId = 'winter-skies-renaissance';
const winterEvent = decodeStandardEvent(currentEvents[winterId], winterId);
const winterTime = (winterEvent.reset_time + 3 * 86400 + 3600) * 1000;
const descentId = 'descent-of-five-senses-rerun';
const descentEvent = decodeStandardEvent(currentEvents[descentId], descentId);
const descentTime = (descentEvent.reset_time + 3 * 86400 + 3600) * 1000;
const railroadId = 'railroad-runaway';
const railroadEvent = decodeStandardEvent(currentEvents[railroadId], railroadId);
const railroadTime = (railroadEvent.reset_time + 3 * 86400 + 3600) * 1000;
const iveAliveId = 'ive-alive-rerun';
const iveAliveEvent = decodeStandardEvent(currentEvents[iveAliveId], iveAliveId);
const iveAliveTime = (iveAliveEvent.reset_time + 3 * 86400 + 3600) * 1000;
const summerSkyId = "summer-sky's-promise";
const summerSkyEvent = decodeStandardEvent(currentEvents[summerSkyId], summerSkyId);
const summerSkyTime = (summerSkyEvent.reset_time + 3 * 86400 + 3600) * 1000;
const summerSkyTea = "Shanhaijing_Tea_Garden's_Fine_Tea";
const sheSideId = 'sheside-outside-rerun';
const sheSideEvent = decodeStandardEvent(currentEvents[sheSideId], sheSideId);
const sheSideTime = (sheSideEvent.reset_time + 3 * 86400 + 3600) * 1000;

function savedPlan() {
  const plan = decodeEventPlan({ futureSetting: { keep: true } }, event);
  plan.pyro_refreshes = 6; plan.pvp_refreshes = 4; plan.energy_pack = true;
  return {
    exportVersion: 2, characters: [], disabled_characters: [], owned_materials: { Credit: 42 }, groups: { Existing: [] },
    language: 'EN', futureField: { keep: true }, events_data: { untouched: { target: 42 }, 'lore-pursuit-s2': plan }
  };
}

function savedLorePursuitPlan() {
  const plan = decodeEventPlan({ futureSetting: { keep: true } }, lorePursuitEvent);
  return {
    exportVersion: 2, events_data: { [lorePursuitId]: plan }
  };
}

test('archived Lore Pursuit exposes Route Map rewards and saves finite Currency overflow across reload', async ({ page }) => {
  await page.clock.setFixedTime(lorePursuitTime);
  await page.addInitScript((data) => { if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(data)); }, savedLorePursuitPlan());
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  const archivedEvent = page.locator(`[data-event-id="${lorePursuitId}"]`);
  await expect(archivedEvent).toBeVisible();
  await archivedEvent.click();
  await expect(page.getByRole('heading', { name: 'Special Operation: Lore Pursuit', exact: true })).toBeVisible();
  await page.locator('[data-event-mode="Currency"]').click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
  expect(saved.events_data[lorePursuitId].currency_needed.Event_Point).toBe(24000);
  expect(saved.events_data[lorePursuitId].shop_purchases.Event_Point.Route_Map).toBe(0);
  expect(saved.events_data[lorePursuitId].shop_purchases).not.toHaveProperty('overflow_Event_Point');

  await page.reload();
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${lorePursuitId}"]`).click();
  await expect(page.locator('[data-event-mode="Currency"]')).toHaveAttribute('aria-pressed', 'true');
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
  expect(saved.events_data[lorePursuitId].currency_needed.Event_Point).toBe(24000);
  expect(saved.events_data[lorePursuitId].futureSetting).toEqual({ keep: true });
});

test('standard event tabs use a real solver worker and preserve legacy-compatible saves across reload', async ({ page }) => {
  const errors: string[] = [];
  const failedImages: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() === 404 && response.request().resourceType() === 'image') failedImages.push(response.url()); });
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((data) => { if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(data)); }, savedPlan());
  await page.goto('/planner/event-planner/?show-earlier-events=1');
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
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['lore-pursuit-s2']);
  expect(persisted.shop_purchases.Cooling_Pack.XP_1).toBe(10);
  expect(persisted.optimisation_options['9']).toBe(12);
  expect(errors).toEqual([]);
  expect(failedImages).toEqual([]);
});

test('Lore Pursuit S2 renders a valid Antikythera target despite the solver midpoint rounding flag', async ({ page }) => {
  const plan = decodeEventPlan(undefined, event);
  plan.enabled_bonus_units = [...new Set(Object.values(event.currencies)
    .flatMap((currency) => currency.bonus_units.map((unit) => unit.id)))];
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((plan) => {
    localStorage.setItem('save-data', JSON.stringify({ exportVersion: 2, events_data: { 'lore-pursuit-s2': plan } }));
  }, plan);
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.locator('[data-event-id="lore-pursuit-s2"]').click();
  await page.locator('[data-event-mode="Materials"]').click();
  await page.locator('[data-event-material="Antikythera_4"]').click();

  await expect(page.locator('[data-event-ap]')).toBeVisible();
  await expect(page.locator('[data-event-run="9"]')).toHaveText('Q9: 235');
  await expect(page.locator('[data-event-reward="Antikythera_4"]')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('worker failures are visible, retry works, and invalid edits never change saved data', async ({ page, context }) => {
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), savedPlan());
  await context.route('**/event-plan-worker.js', (route) => route.abort());
  await page.goto('/planner/event-planner/?show-earlier-events=1');
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

test('original BOX Shadow Looming is available in supported archives and displays its point-based Eleph reward', async ({ page }) => {
  const plan = decodeEventPlan({ futureSetting: { keep: true } }, shadowEvent);
  plan.optimisation_type = 'Manual';
  plan.optimisation_options = { '9': 10 };
  plan.currency_owned = { Event_Point: '600' };
  const save = { exportVersion: 2, futureField: { keep: true }, events_data: { [shadowId]: plan } };
  await page.clock.setFixedTime(shadowTime);
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save);
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${shadowId}"]`).click();
  await expect(page.getByRole('heading', { name: 'BOX Shadow Looming Over Millennium', exact: true })).toBeVisible();
  await page.locator('[data-event-tab="Stages"]').click();
  const runs = page.getByRole('spinbutton', { name: 'Runs Q9', exact: true });
  await expect(runs).toHaveValue('10');
  await expect(page.locator('[data-event-reward="26014"]')).toContainText('131');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).futureField)).toEqual({ keep: true });
});

test('Secret Midnight Party keeps its BOOM input and converted Youkai target in saved event settings', async ({ page }) => {
  const plan = decodeEventPlan(undefined, secretEvent);
  const save = { exportVersion: 2, events_data: { [secretId]: plan } };
  await page.clock.setFixedTime(secretTime);
  await page.addInitScript((data) => {
    if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(data));
  }, save);
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${secretId}"]`).click();
  await expect(page.locator('[data-event-tab]')).toHaveCount(6);
  await page.locator('[data-event-mode="Shop"]').click();
  await page.locator('[data-event-tab="Shop"]').click();
  await page.locator('[data-event-shop-tab="BOOM_Classic_Collection"]').click();
  for (const item of secretEvent.shops.BOOM_Classic_Collection) {
    if (String(item.id) === 'Pyroxene-1200') continue;
    const purchase = page.locator(`[data-event-purchase="${item.id}"] input`);
    await purchase.fill('0');
    await purchase.press('Tab');
  }
  const pyroxenePurchase = page.locator('[data-event-purchase="Pyroxene-1200"] input');
  await pyroxenePurchase.fill('1');
  await pyroxenePurchase.press('Tab');
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['secret-midnight-party']);
  expect(stored.currency_needed.BOOM_Classic_Collection).toBe(40);
  expect(stored.currency_needed.Youkai_MAX_Umeboshi_Flavor).toBe(10800);
  await page.locator('[data-event-tab="Owned"]').click();
  await expect(page.locator('input[data-event-currency="BOOM_Classic_Collection"]')).toHaveCount(0);
  const youkaiOwned = page.locator('input[data-event-currency="Youkai_MAX_Umeboshi_Flavor"]');
  await youkaiOwned.fill('500');
  await youkaiOwned.press('Tab');
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['secret-midnight-party']);
  expect(stored.currency_owned.Youkai_MAX_Umeboshi_Flavor).toBe(500);
  expect(stored.currency_needed.Youkai_MAX_Umeboshi_Flavor).toBe(10800);

  await page.evaluate(() => {
    const root = JSON.parse(localStorage.getItem('save-data')!);
    root.events_data['secret-midnight-party'].currency_needed.Youkai_MAX_Umeboshi_Flavor = 999999;
    localStorage.setItem('save-data', JSON.stringify(root));
  });
  await page.reload();
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${secretId}"]`).click();
  await page.locator('[data-event-tab="Owned"]').click();
  await youkaiOwned.fill('501');
  await youkaiOwned.press('Tab');
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['secret-midnight-party']);
  expect(stored.currency_needed.Youkai_MAX_Umeboshi_Flavor).toBe(10800);
  expect(stored.currency_owned.Youkai_MAX_Umeboshi_Flavor).toBe(501);
});

test('Honorable Sea Showdown converts Renge shop costs to Yukari currency and preserves saved ownership', async ({ page }) => {
  const plan = decodeEventPlan(undefined, honorableEvent);
  const save = { exportVersion: 2, events_data: { [honorableId]: plan } };
  await page.clock.setFixedTime(honorableTime);
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save);
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${honorableId}"]`).click();
  await expect(page.getByRole('heading', { name: 'Fair and Square Aquatic Showdown', exact: true })).toBeVisible();
  await page.locator('[data-event-mode="Shop"]').click();
  await page.locator('[data-event-tab="Shop"]').click();
  await page.locator('[data-event-shop-tab="Wooden_Doll_(Renge)"]').click();
  for (const item of honorableEvent.shops['Wooden_Doll_(Renge)']) {
    if (String(item.id) === 'Pyroxene-1200') continue;
    const purchase = page.locator(`[data-event-purchase="${item.id}"] input`);
    await purchase.fill('0');
    await purchase.press('Tab');
  }
  const pyroxenePurchase = page.locator('[data-event-purchase="Pyroxene-1200"] input');
  await pyroxenePurchase.fill('1');
  await pyroxenePurchase.press('Tab');
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['honorable-sea-showdown']);
  expect(stored.currency_needed['Wooden_Doll_(Renge)']).toBe(40);
  expect(stored.currency_needed['Wooden_Doll_(Yukari)']).toBe(10800);

  await page.locator('[data-event-tab="Owned"]').click();
  await expect(page.locator('input[data-event-currency="Wooden_Doll_(Renge)"]')).toHaveCount(0);
  const yukariOwned = page.locator('input[data-event-currency="Wooden_Doll_(Yukari)"]');
  await yukariOwned.fill('500');
  await yukariOwned.press('Tab');
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['honorable-sea-showdown']);
  expect(stored.currency_owned['Wooden_Doll_(Yukari)']).toBe(500);
  expect(stored.currency_needed['Wooden_Doll_(Yukari)']).toBe(10800);
});

test('Serenade Promenade rerun calculates capped overflow Eleph', async ({ page }) => {
  const plan = decodeEventPlan(undefined, serenadeEvent);
  plan.optimisation_type = 'Currency';
  plan.optimisation_options = 'Event_Point';
  plan.currency_needed = Object.fromEntries(Object.keys(serenadeEvent.currencies).map((currency) => [currency, 0]));
  plan.shop_purchases.Event_Point = Object.fromEntries(serenadeEvent.shops.Event_Point.map((item) => [String(item.id), 0]));
  plan.currency_owned = { Event_Point: '200000' };
  const save = { exportVersion: 2, events_data: { [serenadeId]: plan } };
  await page.clock.setFixedTime(serenadeTime);
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save);
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${serenadeId}"]`).click();
  await expect(page.getByRole('heading', { name: 'Serenade Promenade', exact: true })).toBeVisible();
  await page.locator('[data-event-tab="Shop"]').click();
  await page.locator('[data-event-shop-tab="Event_Point"]').click();
  const overflowPurchase = page.locator('[data-event-purchase="16016"] input');
  const overflowCount = Number(await overflowPurchase.inputValue());
  expect(overflowCount).toBeGreaterThan(0);
  expect(overflowCount).toBeLessThanOrEqual(999);
  await expect(overflowPurchase).toHaveAttribute('max', '999');
  await expect(overflowPurchase).toBeDisabled();
});

test('Winter Skies preserves point thresholds and derives Event Points from its shop', async ({ page }) => {
  const plan = decodeEventPlan(undefined, winterEvent);
  const save = { exportVersion: 2, futureField: { keep: true }, events_data: { [winterId]: plan } };
  await page.clock.setFixedTime(winterTime);
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save);
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${winterId}"]`).click();
  await expect(page.getByRole('heading', { name: 'Winter Skies Renaissance', exact: true })).toBeVisible();

  await page.locator('[data-event-tab="Points"]').click();
  const countOnlyTier = page.locator('[data-event-point="100"]');
  await expect(countOnlyTier).toContainText('×12');
  await expect(countOnlyTier.locator('img')).toHaveCount(0);
  await countOnlyTier.click();
  await page.locator('[data-event-point="15000"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['winter-skies-renaissance'].point_target)).toBe(15000);

  await page.locator('[data-event-tab="Targets"]').click();
  await page.locator('[data-event-mode="Shop"]').click();
  await page.locator('[data-event-tab="Shop"]').click();
  await page.locator('[data-event-shop-tab="Cultural_Book_Sample"]').click();
  for (const item of winterEvent.shops.Cultural_Book_Sample) {
    const purchase = page.locator(`[data-event-purchase="${item.id}"] input`);
    await purchase.fill('0');
    await purchase.press('Tab');
  }
  const pyroxenePurchase = page.locator('[data-event-purchase="Pyroxene-120"] input');
  await pyroxenePurchase.fill('10');
  await pyroxenePurchase.press('Tab');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['winter-skies-renaissance']);
  expect(stored.currency_needed.Cultural_Book_Sample).toBe(40);
  expect(stored.currency_needed.Event_Point).toBe(4800);

  await page.locator('[data-event-tab="Owned"]').click();
  const owned = page.locator('input[data-event-currency="Event_Point"]');
  await owned.fill('1000');
  await owned.press('Tab');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['winter-skies-renaissance'].currency_owned.Event_Point)).toBe(1000);
});

test('Descent rerun derives its Voucher target from Firecracker purchases and keeps Firecrackers out of Owned', async ({ page }) => {
  const plan = decodeEventPlan(undefined, descentEvent);
  const save = { exportVersion: 2, events_data: { [descentId]: plan } };
  await page.clock.setFixedTime(descentTime);
  await page.addInitScript((data) => {
    if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(data));
  }, save);
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${descentId}"]`).click();
  await expect(page.getByRole('heading', { name: 'Descent of the Five Senses', exact: true })).toBeVisible();

  await page.locator('[data-event-tab="Shop"]').click();
  await page.locator('[data-event-shop-tab="Moonlight_Festival_Firecrackers"]').click();
  for (const item of descentEvent.shops.Moonlight_Festival_Firecrackers) {
    if (String(item.id) === 'Pyroxene-1200') continue;
    const purchase = page.locator(`[data-event-purchase="${String(item.id)}"] input`);
    await purchase.fill('0');
    await purchase.press('Tab');
  }
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['descent-of-five-senses-rerun']);
  expect(stored.currency_needed.Moonlight_Festival_Firecrackers).toBe(40);
  expect(stored.currency_needed.Moonlight_Festival_Voucher).toBe(10800);

  await page.locator('[data-event-tab="Owned"]').click();
  await expect(page.locator('input[data-event-currency="Moonlight_Festival_Firecrackers"]')).toHaveCount(0);

  await page.reload();
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${descentId}"]`).click();
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['descent-of-five-senses-rerun']);
  expect(stored.currency_needed.Moonlight_Festival_Voucher).toBe(10800);
});

test('Railroad Runaway is available in the supported archive', async ({ page }) => {
  const plan = decodeEventPlan(undefined, railroadEvent);
  const save = { exportVersion: 2, events_data: { [railroadId]: plan } };
  await page.clock.setFixedTime(railroadTime);
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save);
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${railroadId}"]`).click();
  await expect(page.getByRole('heading', { name: 'Highlander Railroad Runaway', exact: true })).toBeVisible();
  await expect(page.locator('[data-event-tab]')).toHaveCount(6);

  await page.locator('[data-event-tab="Shop"]').click();
  await expect(page.locator('[data-event-shop-tab="Iron_Pipe"]')).toBeVisible();
  await page.locator('[data-event-tab="Owned"]').click();
  await expect(page.locator('input[data-event-currency="Iron_Pipe"]')).toHaveCount(0);
  await expect(page.locator('input[data-event-currency="Highlander_Commemorative_Sticker"]')).toBeVisible();
});

test('I\u2019ve aLIVE rerun exposes its points, Owned currencies, and safe unlimited Eleph purchase', async ({ page }) => {
  const plan = decodeEventPlan(undefined, iveAliveEvent);
  const save = { exportVersion: 2, events_data: { [iveAliveId]: plan } };
  await page.clock.setFixedTime(iveAliveTime);
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save);
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${iveAliveId}"]`).click();
  await expect(page.getByRole('heading', { name: '-ive aLIVE!', exact: true })).toBeVisible();
  await expect(page.locator('[data-event-tab]')).toHaveCount(7);

  await page.locator('[data-event-tab="Points"]').click();
  await expect(page.locator('[data-event-point="15000"]')).toBeVisible();
  await page.locator('[data-event-tab="Owned"]').click();
  await expect(page.locator('input[data-event-currency="Countdown_Calendar"]')).toBeVisible();
  await expect(page.locator('input[data-event-currency="Event_Point"]')).toBeVisible();

  await page.locator('[data-event-tab="Shop"]').click();
  await page.locator('[data-event-shop-tab="Event_Point"]').click();
  const overflow = page.locator('[data-event-purchase="16016"] input');
  await expect(overflow).toHaveAttribute('max', '200000');
  await overflow.fill('3');
  await overflow.press('Tab');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['ive-alive-rerun']);
  expect(stored.shop_purchases.Event_Point['16016']).toBe(3);
  expect(stored.currency_needed.Event_Point).toBe(23010);
});

test("Summer Sky's Promise keeps its milestone currency out of solver and Owned controls", async ({ page }) => {
  const plan = decodeEventPlan(undefined, summerSkyEvent);
  const save = { exportVersion: 2, events_data: { [summerSkyId]: plan } };
  await page.clock.setFixedTime(summerSkyTime);
  await page.addInitScript((data) => { if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(data)); }, save);
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${summerSkyId}"]`).click();
  await expect(page.getByRole('heading', { name: "Summer Sky's Promise", exact: true })).toBeVisible();

  await page.locator('[data-event-tab="Targets"]').click();
  await page.locator('[data-event-mode="Currency"]').click();
  await expect(page.locator('[data-event-currency="Justice_Task_Force_Armband"]')).toBeVisible();
  await expect(page.locator(`[data-event-currency="${summerSkyTea}"]`)).toHaveCount(0);

  await page.locator('[data-event-tab="Owned"]').click();
  await expect(page.locator('input[data-event-currency="Justice_Task_Force_Armband"]')).toBeVisible();
  await expect(page.locator(`input[data-event-currency="${summerSkyTea}"]`)).toHaveCount(0);

  await page.locator('[data-event-tab="Shop"]').click();
  await page.locator(`[data-event-shop-tab="${summerSkyTea}"]`).click();
  const pyroxene = page.locator('[data-event-purchase="Pyroxene-1200"] input');
  await pyroxene.fill('0');
  await pyroxene.press('Tab');
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data["summer-sky's-promise"]);
  expect(stored.currency_needed["Shanhaijing_Tea_Garden's_Fine_Tea"]).toBe(141);

  await page.reload();
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${summerSkyId}"]`).click();
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data["summer-sky's-promise"]);
  expect(stored.currency_needed["Shanhaijing_Tea_Garden's_Fine_Tea"]).toBe(141);
});

test('SheSide Outside keeps Tournament Water Gun outside solver and Owned controls while saving shop edits', async ({ page }) => {
  const plan = decodeEventPlan(undefined, sheSideEvent);
  const save = { exportVersion: 2, events_data: { [sheSideId]: plan } };
  await page.clock.setFixedTime(sheSideTime);
  await page.addInitScript((data) => {
    if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(data));
  }, save);
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${sheSideId}"]`).click();
  await expect(page.getByRole('heading', { name: 'Sheside Outside', exact: true })).toBeVisible();
  await expect(page.locator('[data-event-tab]')).toHaveCount(6);

  await page.locator('[data-event-tab="Targets"]').click();
  await page.locator('[data-event-mode="Currency"]').click();
  await expect(page.locator('[data-event-currency="Game_Corner_Ticket"]')).toBeVisible();
  await expect(page.locator('[data-event-currency="Tournament_Water_Gun"]')).toHaveCount(0);

  await page.locator('[data-event-tab="Owned"]').click();
  await expect(page.locator('input[data-event-currency="Game_Corner_Ticket"]')).toBeVisible();
  await expect(page.locator('input[data-event-currency="Tournament_Water_Gun"]')).toHaveCount(0);

  await page.locator('[data-event-tab="Shop"]').click();
  await page.locator('[data-event-shop-tab="Tournament_Water_Gun"]').click();
  const pyroxene = page.locator('[data-event-purchase="Pyroxene-600"] input');
  await pyroxene.fill('0');
  await pyroxene.press('Tab');
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['sheside-outside-rerun']);
  expect(stored.currency_needed.Tournament_Water_Gun).toBe(132);

  await page.reload();
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${sheSideId}"]`).click();
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data['sheside-outside-rerun']);
  expect(stored.currency_needed.Tournament_Water_Gun).toBe(132);
});

test('cross-tab event changes block stale edits but unrelated save changes are retained', async ({ context }) => {
  const first = await context.newPage();
  await first.clock.setFixedTime(eventTime);
  await first.goto('/planner/event-planner/?show-earlier-events=1');
  await first.evaluate((data) => localStorage.setItem('save-data', JSON.stringify(data)), savedPlan());
  await first.reload();
  const second = await context.newPage();
  await second.clock.setFixedTime(eventTime);
  await second.goto('/planner/event-planner/?show-earlier-events=1');
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
  await page.goto('/planner/event-planner/?show-earlier-events=1');
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

test('unreviewed archived events remain gated and mobile standard tabs stay within the viewport', async ({ page, context }) => {
  await page.clock.setFixedTime(eventTime);
  await context.route('**/json/events.json*', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      ...catalog,
      events: { ...currentEvents, 'after-school-sweets': unreviewedArchive },
      event_order: ['lore-pursuit-s2', 'after-school-sweets']
    })
  }));
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), savedPlan());
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/planner/event-planner/?show-earlier-events=1');
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.locator('[data-event-id="after-school-sweets"]').click();
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
