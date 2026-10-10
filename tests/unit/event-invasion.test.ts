import { describe, expect, it } from 'vitest';
import { createContext, runInContext } from 'node:vm';
import { calculateEventEnergy, calculateInitialClear } from '../../src/lib/domain/events/budget';
import { applyInvasionRewards, calculateInvasionRewards, decodeInvasion } from '../../src/lib/domain/events/invasion';
import { eventRequirements } from '../../src/lib/domain/events/standard';
import { decodeEventCatalog, decodeEventPlan, decodeStandardEvent, invasionEventIds, lessonEventIds } from '../../src/lib/domain/events/standard-save';
import type { EventSummary } from '../../src/lib/domain/events/standard-types';
import { isRecord } from '../../src/lib/domain/planner/save';
import { createLegacyContext, evaluate, readJson, readSource } from './legacy-harness';

const currentConfig = readJson('planner', 'json', 'events.json');
const oldConfig = readJson('planner', 'json', 'old_events.json');
const cafeData = readJson('planner', 'json', 'event_misc.json');
if (!isRecord(currentConfig) || !isRecord(currentConfig.events) ||
  !isRecord(oldConfig) || !isRecord(oldConfig.events) || !isRecord(cafeData) || !isRecord(cafeData.cafe_energy)) {
  throw new Error('Invalid Invasion fixtures.');
}
const oldEvents = oldConfig.events;
const cafeEnergy: Record<string, number> = {};
for (const [rank, amount] of Object.entries(cafeData.cafe_energy)) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error(`Invalid cafe energy rate ${rank}.`);
  cafeEnergy[rank] = amount;
}
const raw = oldEvents['valentine-rerun'];
if (!isRecord(raw)) throw new Error('Missing Invasion event fixture.');
const invasionConfig = raw.invasion_config;
const invasionStages = raw.invasion_stages;
const event = decodeStandardEvent(raw);
if (!event.invasion) throw new Error('Missing Invasion configuration.');
const invasion = event.invasion;
const pointTarget = event.event_point_target;
if (pointTarget === undefined) throw new Error('Missing Invasion event point target.');
const reviewedArchive = {
  events: Object.fromEntries([...lessonEventIds, ...invasionEventIds].map((id) => {
    const archived = oldEvents[id];
    if (!isRecord(archived)) throw new Error(`Missing reviewed archive event ${id}.`);
    return [id, archived];
  }))
};

function emptySummary(): EventSummary {
  return {
    runs: {}, currencies: {}, artifacts: {}, schoolMats: {}, eleph: {}, xps: {}, gear: {},
    credit: 0, eligma: 0, secretTech: 0, energy: 0, feasible: true
  };
}

function legacyRewards(resetsTotal: number, resetsLeft: number, midEvent: boolean) {
  const context = createContext({
    invasionStages,
    invasionConfig,
    resetsTotal,
    resetsLeft,
    midEvent
  });
  runInContext(readSource('tests', 'fixtures', 'invasion.legacy.js'), context);
  return evaluate(context, 'LegacyInvasionRewards(invasionStages, invasionConfig, resetsTotal, resetsLeft, midEvent)');
}

describe('reviewed Invasion definition and reward schedule', () => {
  it('exposes only the explicitly reviewed archived Invasion event', () => {
    expect(decodeEventCatalog(currentConfig, true, reviewedArchive)
      .filter((entry) => entry.event?.invasion).map((entry) => entry.id)).toEqual(invasionEventIds);
    expect(invasionEventIds).toEqual(['valentine-rerun']);
    expect(event.invasion?.max_stage).toBe(8);
    expect(event.invasion?.stages).toHaveLength(8);
    expect(event.currencies.Event_Point.source).toBeUndefined();
    const plan = decodeEventPlan(undefined, event);
    const overflow = event.shops.Garbage_Bag.find((item) => item.overflow);
    if (!overflow) throw new Error('Missing Invasion Eleph overflow shop item.');
    expect(overflow.type).toBe('Eleph');
    expect(overflow.count).toBe(-1);
    expect(overflow.overflow_cap).toBe(620);
    expect(plan.shop_purchases.Garbage_Bag[String(overflow.id)]).toBe(0);
    const currencyMode = decodeEventPlan({
      optimisation_type: 'Currency',
      optimisation_options: 'Garbage_Bag',
      currency_needed: { Garbage_Bag: 2400 },
      shop_purchases: { Garbage_Bag: { [String(overflow.id)]: 12 } }
    }, event);
    expect(currencyMode.shop_purchases.Garbage_Bag[String(overflow.id)]).toBe(0);
    expect(currencyMode.currency_needed.Garbage_Bag).toBe(0);
    expect(() => decodeStandardEvent({ ...raw, invasion_config: { max_stage: 99 } })).toThrow();
    expect(() => decodeInvasion({ max_stage: 1, daily_attempts: 1, first_day_attempts: 1 }, [])).toThrow();
    expect(() => decodeStandardEvent({ ...raw, lessons: { malformed: true } })).toThrow();
  });

  it.each([
    { name: 'full event with one reset', midEvent: false, nowOffsetDays: 0 },
    { name: 'full event with all resets', midEvent: false, nowOffsetDays: 2 },
    { name: 'Owned mode before later resets', midEvent: true, nowOffsetDays: 2 },
    { name: 'Owned mode near event end', midEvent: true, nowOffsetDays: 8 }
  ])('matches AddInvasionRewards exactly for $name', ({ midEvent, nowOffsetDays }) => {
    const now = (event.reset_time + nowOffsetDays * 86400 + 3600) * 1000;
    const initial = calculateInitialClear(event);
    const budget = calculateEventEnergy('valentine-rerun', event, {}, cafeEnergy,
      midEvent, initial.cost, now);
    const modern = calculateInvasionRewards(invasion, budget.resetsTotal, budget.resetsLeft, midEvent);
    expect(modern).toEqual(legacyRewards(budget.resetsTotal, budget.resetsLeft, midEvent));
    expect(Object.keys(modern.currencies)).toEqual(expect.arrayContaining(['Event_Point', 'Apology_Letter', 'Seized_Illegal_Candy', 'Garbage_Bag']));
    expect(modern.eleph['16008']).toBeGreaterThan(0);
    expect(modern.xps.XP_3).toBeGreaterThan(0);
    expect(modern.credit).toBeGreaterThan(0);
  });

  it('always includes Invasion currencies, while optional Eleph, XP and Credit match the display toggle', () => {
    const fullBudget = calculateEventEnergy('valentine-rerun', event, {}, cafeData.cafe_energy as Record<string, number>,
      false, calculateInitialClear(event).cost, (event.start_time + 3600) * 1000);
    const rewards = calculateInvasionRewards(invasion, fullBudget.resetsTotal, fullBudget.resetsLeft, false);
    const base = emptySummary();
    base.currencies = { Apology_Letter: 3 };
    base.eleph = { '10001': 7 };
    base.xps = { XP_1: 2 };
    base.credit = 11;
    base.boxes = { clears: 1, leftoverPercent: '50' };
    base.overflowPurchases = { Existing: { Ticket: 2 } };
    const currenciesOnly = applyInvasionRewards(base, rewards, false);
    expect(currenciesOnly.currencies).toEqual({
      ...rewards.currencies,
      Apology_Letter: 3 + rewards.currencies.Apology_Letter
    });
    expect(currenciesOnly.eleph).toEqual(base.eleph);
    expect(currenciesOnly.xps).toEqual(base.xps);
    expect(currenciesOnly.credit).toBe(base.credit);
    const displayed = applyInvasionRewards(base, rewards, true);
    expect(displayed.currencies).toEqual(currenciesOnly.currencies);
    expect(displayed.eleph['16008']).toBe(rewards.eleph['16008']);
    expect(displayed.xps.XP_3).toBe(rewards.xps.XP_3);
    expect(displayed.credit - base.credit).toBe(rewards.credit);
    if (!displayed.boxes || !displayed.overflowPurchases) throw new Error('Optional summary fields were not preserved.');
    displayed.boxes.clears = 2;
    displayed.overflowPurchases.Existing.Ticket = 1;
    expect(base.boxes?.clears).toBe(1);
    expect(base.overflowPurchases.Existing.Ticket).toBe(2);
  });
});

describe('Invasion requirements preserve first-clear and point-target conventions', () => {
  it.each([false, true])('subtracts fixed Invasion currencies in Owned mode=%s', (midEvent) => {
    const plan = decodeEventPlan(undefined, event);
    if (midEvent) plan.currency_owned = { Apology_Letter: '1000' };
    const initial = calculateInitialClear(event);
    const now = (event.reset_time + 2 * 86400 + 3600) * 1000;
    const budget = calculateEventEnergy('valentine-rerun', event, {}, cafeEnergy,
      midEvent, initial.cost, now);
    const rewards = calculateInvasionRewards(invasion, budget.resetsTotal, budget.resetsLeft, midEvent);
    const requirements = eventRequirements(event, plan, rewards.currencies);
    for (const currency of ['Apology_Letter', 'Seized_Illegal_Candy', 'Garbage_Bag']) {
      const target = Number(plan.currency_needed[currency] ?? 0);
      const subtractOwnedOrClear = midEvent
        ? Math.max(Number.parseInt(String(plan.currency_owned[currency] ?? 0)) || 0, 0)
        : initial.rewards[currency] ?? 0;
      expect(requirements.needed[currency]).toBe(
        Math.max(target - subtractOwnedOrClear - (rewards.currencies[currency] ?? 0), 0)
      );
    }
    expect(requirements.pointTarget).toBe(Math.max(pointTarget -
      (midEvent ? Number.parseInt(String(plan.currency_owned.Event_Point ?? 0)) || 0 : initial.rewards.Event_Point ?? 0), 0));
    expect(requirements.needed.Garbage_Bag).toBeLessThanOrEqual(Number(plan.currency_needed.Garbage_Bag));
  });
});
