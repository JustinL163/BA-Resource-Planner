import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { runInContext } from 'node:vm';
import { metadata } from '../../.generated-content/planner';
import { eventEngine } from '../../src/lib/domain/events';
import { eventRequirements, summarizeEventRuns } from '../../src/lib/domain/events/standard';
import { decodeEventCatalog, decodeEventPlan, decodeStandardEvent } from '../../src/lib/domain/events/standard-save';
import { summerRetreatEventId, summerRetreatRewards, summerRetreatSandTarget } from '../../src/lib/domain/events/summer-retreat';
import { createEventPlanner } from '../../src/lib/stores/event-planner';
import { isRecord } from '../../src/lib/domain/planner/save';
import { createLegacyContext, readJson, readSource } from './legacy-harness';

const config = readJson('planner', 'json', 'events.json');
if (!isRecord(config) || !isRecord(config.events)) throw new Error('Invalid event fixture.');
const raw = config.events[summerRetreatEventId];
const event = decodeStandardEvent(raw, summerRetreatEventId);

function rewardsForSand(sand: number) {
  const plan = decodeEventPlan(undefined, event);
  plan.optimisation_type = 'Manual';
  const requirements = eventRequirements(event, plan);
  requirements.initial.rewards = { Dream_Sand: sand };
  return summarizeEventRuns(event, plan, requirements, {}, 1000000, {}, false, false, metadata);
}

describe('Summer Retreat Crab Martial Arts minigame', () => {
  it('exposes the reviewed event and gates its minigame currency to its own schema', () => {
    expect(decodeEventCatalog(config).find((entry) => entry.id === summerRetreatEventId)?.event).toEqual(event);
    expect(() => decodeStandardEvent(raw, 'lore-pursuit-s2')).toThrow('This currency requires the legacy planner');
    const changed = structuredClone(event);
    changed.currencies.Dream_Sand.clear = 1;
    expect(() => decodeStandardEvent(changed, summerRetreatEventId)).toThrow('Invalid Summer Retreat');
  });

  it('derives a whole-run sand target from selected Sea Pebble purchases with a 5000 minimum', () => {
    const plan = decodeEventPlan(undefined, event);
    expect(plan.currency_needed.Sea_Pebble).toBe(138);
    expect(plan.currency_needed.Dream_Sand).toBe(25150); // 2350 first clears + 57 * 400.
    expect(summerRetreatSandTarget(24)).toBe(5000);
    expect(summerRetreatSandTarget(37)).toBe(5150); // Round up to seven full Normal 4 runs.
    plan.shop_purchases.Sea_Pebble = Object.fromEntries(event.shops.Sea_Pebble.map((item) => [String(item.id), 0]));
    plan.currency_needed.Dream_Sand = 999999;
    expect(decodeEventPlan(plan, event).currency_needed.Dream_Sand).toBe(5000);
  });

  it('constrains the stage solver through Dream Sand and subtracts main-event initial rewards once', () => {
    const plan = decodeEventPlan(undefined, event);
    const requirements = eventRequirements(event, plan);
    expect(requirements.needed.Dream_Sand).toBe(25150 - requirements.initial.rewards.Dream_Sand);
    expect(requirements.needed.Sea_Pebble).toBeUndefined();
    const model = eventEngine.buildStageModel(event, {
      eventId: summerRetreatEventId, upgradeBases: false, energyAvailable: 1000000,
      pointTarget: requirements.pointTarget, needed: requirements.needed, bonuses: {}, enabledGroups: [true, true, true]
    }, 'Energy_Cost', 'min');
    expect(model.constraints.Dream_Sand).toEqual({ min: requirements.needed.Dream_Sand });
    expect(model.constraints.Sea_Pebble).toBeUndefined();
  });

  it('includes first-clear plus default rewards, and the complete score reward bundle', () => {
    const summary = rewardsForSand(2350);
    expect(summary.currencies.Sea_Pebble).toBe(24);
    expect(summary.eleph['26016']).toBe(101);
    expect(summary.credit).toBe(20000000);
    expect(summary.schoolMats).toEqual({
      TN_1_Gehenna: 50, TN_2_Gehenna: 40, TN_3_Gehenna: 30, TN_4_Gehenna: 15,
      BD_1_Gehenna: 36, BD_2_Gehenna: 21, BD_3_Gehenna: 12, BD_4_Gehenna: 4
    });
    expect(summary.xps).toEqual({ XP_1: 60, XP_2: 30, XP_3: 106, XP_4: 3, GXP_1: 80, GXP_2: 40, GXP_3: 24, GXP_4: 7 });
  });

  it.each(['Shop', 'Currency'] as const)('solves %s mode with enough minigame rewards for the selected shop', (mode) => {
    const plan = decodeEventPlan(undefined, event);
    plan.optimisation_type = mode;
    plan.optimisation_options = mode === 'Currency' ? 'Dream_Sand' : null;
    const requirements = eventRequirements(event, plan);
    const model = eventEngine.buildStageModel(event, {
      eventId: summerRetreatEventId, upgradeBases: false, energyAvailable: 50000,
      pointTarget: requirements.pointTarget, needed: requirements.needed, bonuses: {}, enabledGroups: [true, true, true]
    }, mode === 'Shop' ? 'Energy_Cost' : 'Dream_Sand', mode === 'Shop' ? 'min' : 'max', mode === 'Currency');
    const context = createLegacyContext([], { model });
    runInContext(readSource('planner', 'packages', 'javascript-lp-solver', 'solver.js'), context);
    const solution: unknown = runInContext('solver.Solve(model)', context);
    const summary = summarizeEventRuns(event, plan, requirements, {}, 50000, solution, true, true, metadata);
    expect(summary.feasible).toBe(true);
    expect(summary.currencies.Dream_Sand).toBeGreaterThanOrEqual(25150);
    expect(summary.currencies.Sea_Pebble).toBeGreaterThanOrEqual(138);
  });

  it('does not award the one-time package before it is affordable, or buy a partial repeat run', () => {
    expect(rewardsForSand(2349).eleph['26016']).toBe(0);
    expect(rewardsForSand(2349).credit).toBe(0);
    expect(rewardsForSand(2749).eleph['26016']).toBe(101);
    expect(rewardsForSand(2750).eleph['26016']).toBe(103);
  });

  it('sums both same-tier artifact groups and fractional first-clear drops before flooring per item', () => {
    const summary = rewardsForSand(2350 + 8 * 400);
    expect(summary.currencies.Sea_Pebble).toBe(40);
    expect(summary.eleph['26016']).toBe(112);
    for (const type of ['Quimbaya', 'Totem', 'Mystery', 'Haniwa']) {
      expect([1, 2, 3, 4].map((tier) => summary.artifacts[`${type}_${tier}`])).toEqual([4, 2, 1, 0]);
    }
    expect(rewardsForSand(25150).currencies.Sea_Pebble).toBe(138);
    expect(rewardsForSand(25150).eleph['26016']).toBe(176);
  });

  it('combines minigame fractions with quest drops before rounding the final item count', () => {
    const plan = decodeEventPlan(undefined, event);
    plan.optimisation_type = 'Manual';
    const requirements = eventRequirements(event, plan);
    requirements.initial.rewards = { Dream_Sand: 2350 };
    const questEvent = { ...event, stages: [{ type: 'Quest', number: 1, cost: 10, drops: { Dream_Sand: 400, Mystery_1: 0.9 } }] };
    const summary = summarizeEventRuns(questEvent, plan, requirements, {}, 1000000, { '1': 1 }, false, false, metadata);
    expect(summary.artifacts.Mystery_1).toBe(2); // 0.9 + 1.2375 + 0.375.
  });

  it('uses Owned balances without re-awarding first clears or score rewards', () => {
    const plan = decodeEventPlan({ ...decodeEventPlan(undefined, event), currency_owned: { Dream_Sand: 800, Sea_Pebble: 5 } }, event);
    plan.optimisation_type = 'Manual';
    expect(plan.currency_needed.Dream_Sand).toBe(26800);
    const requirements = eventRequirements(event, plan);
    expect(requirements.needed.Dream_Sand).toBe(26000);
    const summary = summarizeEventRuns(event, plan, requirements, {}, 1000000, {}, false, false, metadata);
    expect(summary.eleph['26016']).toBe(2);
    expect(summary.currencies.Sea_Pebble).toBe(9);
    expect(summary.credit).toBe(0);
    expect(summary.xps).toEqual({});
    expect(summary.schoolMats).toEqual({});
  });

  it.each([[135, 800, 400], [138, 0, 0]])('uses the remaining shop cost with %i owned Sea Pebbles', (pebbles, target, needed) => {
    const plan = decodeEventPlan({ currency_owned: { Dream_Sand: 400, Sea_Pebble: pebbles } }, event);
    expect(plan.currency_needed.Dream_Sand).toBe(target);
    expect(eventRequirements(event, plan).needed.Dream_Sand).toBe(needed);
  });

  it('rejects invalid minigame budgets and targets', () => {
    expect(() => summerRetreatRewards(NaN)).toThrow('Dream Sand');
    expect(() => summerRetreatRewards(-1)).toThrow('Dream Sand');
    expect(() => summerRetreatSandTarget(Infinity)).toThrow('Sea Pebble');
  });

  it('refreshes and persists the target when shop selections change', async () => {
    const entries = new Map<string, string>();
    const storage: Storage = {
      get length() { return entries.size; }, clear: () => entries.clear(),
      key: (index) => [...entries.keys()][index] ?? null,
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => { entries.set(key, value); }, removeItem: (key) => { entries.delete(key); }
    };
    const students = readJson('planner', 'json', 'skillinfo', 'en.json');
    const misc = readJson('planner', 'json', 'event_misc.json');
    const resourceMisc = readJson('planner', 'json', 'misc_data.json');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const value = url.includes('misc_data') ? resourceMisc : url.includes('event_misc') ? misc : url.includes('events.json') ? config : students;
      return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const planner = createEventPlanner(metadata, () => storage);
    try { await planner.initialise(); } finally { fetchMock.mockRestore(); }
    planner.select(summerRetreatEventId);
    expect(get(planner).plan?.currency_needed.Dream_Sand).toBe(25150);
    expect(planner.setPurchase('Sea_Pebble', 'Pyroxene-600', 0)).toBe(true);
    expect(get(planner).plan?.currency_needed).toMatchObject({ Sea_Pebble: 108, Dream_Sand: 19150 });
    const saved = JSON.parse(storage.getItem('save-data')!).events_data[summerRetreatEventId];
    expect(decodeEventPlan(saved, event).currency_needed.Dream_Sand).toBe(19150);
  });
});
