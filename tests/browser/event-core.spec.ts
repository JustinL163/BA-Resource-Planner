import { runInContext } from 'node:vm';
import { test, expect } from './fixtures';
import { decodeCoreEvent } from '../../src/lib/domain/events/data';
import type { EventEnergySettings, EventModel, EventModelInputs } from '../../src/lib/domain/events/types';
import { isRecord } from '../../src/lib/domain/planner/save';
import { createLegacyContext, evaluate, readJson, readSource } from '../unit/legacy-harness';

const config = readJson('planner', 'json', 'events.json');
if (!isRecord(config) || !isRecord(config.events)) throw new Error('Invalid event fixture.');
const eventId = 'lore-pursuit-s2';
const event = decodeCoreEvent(config.events[eventId]);
const eventTime = (event.reset_time + 3 * 86400 + 3600) * 1000;

function savedPlan() {
  return {
    exportVersion: 2, characters: [], disabled_characters: [], owned_materials: { Credit: 42 },
    groups: { Existing: [[null]] }, language: 'EN', futureField: { retained: true },
    events_data: {
      untouched: { target: 42, futureEventSetting: true },
      [eventId]: {
        shop_purchases: {}, currency_needed: {}, cafe_rank: 10,
        futureSetting: { retained: true }
      }
    }
  };
}

interface Snapshot {
  id: string;
  settings: EventEnergySettings;
  midEvent: boolean;
  enabled: string[];
  bonuses: Record<string, number>;
  initial: { rewards: Record<string, number>; cost: number };
  inputs: EventModelInputs;
  now: number;
  available: number;
  total: number;
  resetsLeft: number;
  resetsTotal: number;
}

function expected(snapshot: Snapshot) {
  const context = createLegacyContext(['config.js', 'common.js'], {
    current_event: snapshot.id, event_config: config,
    charlist: readJson('planner', 'json', 'skillinfo', 'en.json'),
    event_misc: readJson('planner', 'json', 'event_misc.json'),
    enabledBonusUnits: snapshot.enabled,
    event_data: snapshot.settings, midEvent: snapshot.midEvent,
    eventLoading: true, cafeDefault: 10, Date: { now: () => snapshot.now },
    ...{
      currencyNeeded: snapshot.inputs.needed, energyAvailable: snapshot.available,
      event_point_target: snapshot.inputs.pointTarget, targetedMaterials: {},
      stageGroup1: snapshot.inputs.enabledGroups[0], stageGroup2: snapshot.inputs.enabledGroups[1], stageGroup3: snapshot.inputs.enabledGroups[2]
    }
  });
  runInContext(readSource('tests', 'fixtures', 'event-core.legacy.js'), context);
  runInContext('CalculateBonuses(); CalculateInitalClear(); CalculateEnergyAvailable();', context);
  return {
    bonuses: evaluate(context, 'currencyBonuses'),
    initial: evaluate(context, '({rewards:initialClearRewards,cost:initialClearCost})'),
    available: runInContext('energyAvailable', context),
    total: runInContext("document.getElementById('energy-total').innerText", context),
    resetsLeft: runInContext('resets_left', context),
    resetsTotal: runInContext('resets_total', context),
    model: evaluate(context, 'GetStagesLinearModel("Energy_Cost","min",false)')
  };
}

const snapshotSource = `({
  id: current_event, settings: event_data, midEvent, enabled: enabledBonusUnits, bonuses: currencyBonuses,
  initial: { rewards: initialClearRewards, cost: initialClearCost },
  inputs: GetEventModelInputs(), now: Date.now(), available: energyAvailable,
  total: Number(document.getElementById('energy-total').innerText), resetsLeft: resets_left, resetsTotal: resets_total
})`;

test('existing event controls delegate to the new engine while retaining budgets, models and saved fields', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((data) => {
    if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(data));
  }, savedPlan());
  await page.goto('/planner/events.html');
  await page.waitForFunction('typeof event_config !== "undefined" && Boolean(event_config) && Boolean(event_misc) && Boolean(charlist)');
  await page.evaluate(`(() => {
    const calls = {};
    for (const [key, original] of Object.entries(BAEventEngine)) {
      BAEventEngine[key] = (...args) => { calls[key] = (calls[key] ?? 0) + 1; return original(...args); };
    }
    window.eventCoreCalls = calls;
  })()`);
  await page.locator(`#${eventId}`).click();
  await page.locator('#tab-Bonus').click();
  await page.locator('#bonus-chars-all-button').click();
  await page.locator('#tab-Targets').click();
  await page.locator('#tab-opti-Shop').click();
  const before = await page.evaluate<Snapshot>(snapshotSource);
  const reference = expected(before);
  expect(before.bonuses).toEqual(reference.bonuses);
  expect(before.initial).toEqual(reference.initial);
  expect(before.available).toBe(reference.available);
  expect(before.total).toBe(reference.total);
  expect(before.resetsLeft).toBe(reference.resetsLeft);
  expect(before.resetsTotal).toBe(reference.resetsTotal);
  expect(await page.evaluate('GetStagesLinearModel("Energy_Cost","min",false)')).toEqual(reference.model);
  await page.locator('#tab-Stages').click();
  await page.locator('#include-stage-group-1').uncheck();
  const after = await page.evaluate<Snapshot>(snapshotSource);
  const model = await page.evaluate<EventModel>('GetStagesLinearModel("Energy_Cost","min",false)');
  expect(model).toEqual(expected(after).model);
  expect(model.variables['1']).toEqual({});
  await page.locator('#tab-Targets').click();
  await page.locator('#tab-opti-Materials').click();
  await page.locator('#opt-select-Antikythera_1').click();
  expect((await page.evaluate<EventModel>('GetStagesMaterialsTargetModel()')).optimize).toEqual({ Antikythera_1: 'max' });
  await page.locator('#tab-opti-Currency').click();
  expect(await page.evaluate('targetedCurrency')).toBe('Event_Point');
  expect((await page.evaluate<EventModel>('GetStagesLinearModel(targetedCurrency,"max",true)')).constraints.Event_Point).toBeUndefined();
  await page.locator('#tab-opti-Manual').click();
  await page.locator('#input-stage-9').fill('10');
  await page.locator('#input-stage-9').press('Tab');
  expect(await page.evaluate('stage_runs[9]')).toBe(10);
  await page.clock.setFixedTime(eventTime + 6000);
  await expect.poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem('save-data')!).events_data[id].optimisation_type, eventId)).toBe('Manual');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
  expect(stored.owned_materials).toEqual(savedPlan().owned_materials);
  expect(stored.groups).toEqual(savedPlan().groups);
  expect(stored.futureField).toEqual(savedPlan().futureField);
  expect(stored.events_data.untouched).toEqual(savedPlan().events_data.untouched);
  expect(stored.events_data[eventId].futureSetting).toEqual({ retained: true });
  expect(stored.events_data[eventId].optimisation_options).toEqual({ '9': 10 });
  const calls: Record<string, number> = await page.evaluate('window.eventCoreCalls');
  for (const name of ['calculateEventBonuses', 'calculateInitialClear', 'calculateEventEnergy', 'buildStageModel', 'materialDropOptions', 'buildMaterialTargetModel']) {
    expect(calls[name], name).toBeGreaterThan(0);
  }
  await page.reload();
  await page.locator(`#${eventId}`).click();
  expect(await page.evaluate('optimisationType')).toBe('Manual');
  expect(await page.evaluate('stage_runs[9]')).toBe(10);
  expect(errors).toEqual([]);
});

test('AP popup edits and Owned mode keep their original energy and first-clear conventions', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), savedPlan());
  await page.goto('/planner/events.html');
  await page.locator(`#${eventId}`).click();
  await page.locator('#tab-Energy').click();
  await page.locator('#energy-source-pyro').click();
  await page.locator('.swal2-select').selectOption('3');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.locator('#energy-source-cafe').click();
  await page.locator('.swal2-select').selectOption('6');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  const initial = await page.evaluate<Snapshot>(snapshotSource);
  expect(initial.settings.pyro_refreshes).toBe(3);
  expect(initial.settings.cafe_rank).toBe(6);
  expect(initial.available).toBe(expected(initial).available);
  await page.locator('#tab-Owned').click();
  await page.locator('#currency-input-Cooling_Pack').fill('100');
  await page.locator('#currency-input-Cooling_Pack').press('Tab');
  expect(await page.evaluate('midEvent')).toBe(true);
  const owned = await page.evaluate<Snapshot>(snapshotSource);
  expect(owned.available).toBe(expected(owned).available);
  expect(owned.total).toBe(expected(owned).total);
  expect(owned.available).toBe(owned.total - 100 - owned.initial.cost);
  expect(errors).toEqual([]);
});

test('calculation errors are visible and never write a replacement saved plan', async ({ page }) => {
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), savedPlan());
  await page.goto('/planner/events.html');
  await page.locator(`#${eventId}`).click();
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  expect(await page.evaluate(`(() => {
    const old = event_data.cafe_rank;
    event_data.cafe_rank = 999;
    try { CalculateEnergyAvailable(); return 'unexpected success'; }
    catch (error) { return error.message; }
    finally { event_data.cafe_rank = old; }
  })()`)).toContain('cafe');
  await expect(page.getByText('Event calculation failed', { exact: true })).toBeVisible();
  await expect(page.locator('.swal2-html-container')).toContainText('cafe');
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
});
