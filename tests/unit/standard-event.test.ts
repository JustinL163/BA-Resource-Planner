import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { runInContext } from 'node:vm';
import { metadata } from '../../.generated-content/planner';
import { eventEngine } from '../../src/lib/domain/events';
import { eventRequirements, summarizeEventRuns } from '../../src/lib/domain/events/standard';
import { boxEventIds, decodeEventCatalog, decodeEventPlan, decodeStandardEvent, standardEventIds } from '../../src/lib/domain/events/standard-save';
import { boxPullCurrencyNeeded } from '../../src/lib/domain/events/boxes';
import { createEventPlanner } from '../../src/lib/stores/event-planner';
import { isRecord } from '../../src/lib/domain/planner/save';
import { createLegacyContext, evaluate, readJson, readSource } from './legacy-harness';
import type { EventPlan, EventSummary } from '../../src/lib/domain/events/standard-types';

const config = readJson('planner', 'json', 'events.json');
const students = readJson('planner', 'json', 'skillinfo', 'en.json');
const misc = readJson('planner', 'json', 'event_misc.json');
const resourceMisc = readJson('planner', 'json', 'misc_data.json');
if (!isRecord(config) || !isRecord(config.events)) throw new Error('Invalid event fixture.');
const rawEvents = config.events;

function reference(id: string, plan: EventPlan, includeShop = false, includePoints = false, runs: unknown = { '9': 10 }) {
  const event = decodeStandardEvent(rawEvents[id]);
  const context = createLegacyContext(['config.js', 'common.js', 'eventPlanner.js'], {
    fixture: { config, students, misc, id, plan, includeShop, includePoints, runs },
    BAEventEngine: eventEngine, Date: { now: () => (event.reset_time + 3 * 86400 + 3600) * 1000 }
  });
  runInContext(readSource('tests', 'fixtures', 'event-core.legacy.js'), context);
  runInContext(`
    event_config = fixture.config; charlist = fixture.students; event_misc = fixture.misc; current_event = fixture.id;
    event_data = fixture.plan; enabledBonusUnits = event_data.enabled_bonus_units; currencyNeededPre = event_data.currency_needed;
    stageGroup1 = event_data.enabled_stage_groups[0]; stageGroup2 = event_data.enabled_stage_groups[1]; stageGroup3 = event_data.enabled_stage_groups[2];
    optimisationType = event_data.optimisation_type; midEvent = Object.values(event_data.currency_owned).some(v => parseInt(v) > 0);
    displayIncluded = { ShopPurchases: fixture.includeShop, PointRewards: fixture.includePoints };
    Save = () => {}; UpdateNotifications = () => {}; GenerateStagesTable = () => {}; ClearRewards = () => {};
    eventLoading = true; CalculateBonuses(); CalculateInitalClear(); CalculateEnergyAvailable(); CalculateNeededFinal();
    UpdateRewardsObtained = (currencies, energy, artifacts, schoolMats, eleph, xps, credit, eligma, secretTech, gearBoxes, gear) => {
      fixture.summary = { currencies, energy, artifacts, schoolMats, eleph, xps, credit, eligma, secretTech, gear };
    };
    InfeasibleModel = () => { fixture.infeasible = true; };
  `, context);
  if (runs === 'solve') {
    runInContext(readSource('planner', 'packages', 'javascript-lp-solver', 'solver.js'), context);
    runInContext(`
      targetedMaterials = optimisationType === 'Materials' ? event_data.optimisation_options : {};
      fixture.runs = solver.Solve(optimisationType === 'Shop' ? GetStagesLinearModel('Energy_Cost','min',false) :
        optimisationType === 'Materials' ? GetStagesMaterialsTargetModel() : GetStagesLinearModel(event_data.optimisation_options,'max',true));
    `, context);
  }
  runInContext("CalculateStageDrops(fixture.runs, optimisationType === 'Manual');", context);
  return { context, requirements: evaluate(context, '({needed:currencyNeeded,pointTarget:event_point_target,midEvent,initial:{cost:initialClearCost,rewards:initialClearRewards}})'),
    summary: evaluate(context, 'fixture.summary ?? null'), runs: evaluate(context, 'stage_runs'), bonuses: evaluate(context, 'currencyBonuses'),
    solution: evaluate(context, 'fixture.runs'),
    energy: runInContext('energyAvailable', context), infeasible: runInContext('fixture.infeasible === true', context) };
}

describe('standard event compatibility and frozen reward outputs', () => {
  for (const id of standardEventIds) {
    const event = decodeStandardEvent(rawEvents[id]);
    it.each([false, true])(`${id} requirements before/after Owned mode=%s`, (owned) => {
      const plan = decodeEventPlan(undefined, event);
      if (owned) plan.currency_owned = { Event_Point: '1234' };
      const old = reference(id, plan);
      expect(eventRequirements(event, plan)).toEqual(old.requirements);
    });
    for (const owned of [false, true]) for (const includeShop of [false, true]) for (const includePoints of [false, true]) {
      it(`${id} Manual rewards owned=${owned} shop=${includeShop} points=${includePoints}`, () => {
        const plan = decodeEventPlan(undefined, event);
        plan.optimisation_type = 'Manual';
        plan.optimisation_options = { '9': 10, '12': 5 };
        if (owned) plan.currency_owned = { Event_Point: '1234', [Object.keys(event.currencies)[1]]: '200' };
        const old = reference(id, plan, includeShop, includePoints, plan.optimisation_options);
        const requirements = eventRequirements(event, plan);
        const bonuses = eventEngine.calculateEventBonuses(id, event, [], {});
        const summary = summarizeEventRuns(event, plan, requirements, bonuses, old.energy, plan.optimisation_options, includeShop, includePoints, metadata);
        const { runs, feasible, ...rewards } = summary;
        expect(feasible).toBe(!old.infeasible);
        expect(runs).toEqual(old.runs);
        expect(rewards).toEqual(old.summary);
        expect(old.summary).toMatchSnapshot();
      });
    }
    it(`${id} does not count initial rewards or Owned currency toward the farm-only feasibility check`, () => {
      const plan = decodeEventPlan(undefined, event);
      plan.optimisation_type = 'Shop';
      const old = reference(id, plan, false, false, { '9': 10 });
      const summary = summarizeEventRuns(event, plan, eventRequirements(event, plan), eventEngine.calculateEventBonuses(id, event, [], {}), old.energy, { '9': 10 }, false, false, metadata);
      expect(summary.feasible).toBe(!old.infeasible);
    });
    it.each(['Shop', 'Currency', 'Materials'] as const)(`${id} solver mode %s matches complete legacy rewards`, (mode) => {
      const plan = decodeEventPlan(undefined, event);
      plan.optimisation_type = mode;
      plan.pyro_refreshes = 6; plan.pvp_refreshes = 4; plan.energy_pack = true; plan.energy_carryover = 2000;
      plan.enabled_bonus_units = [...new Set(Object.values(event.currencies).flatMap((currency) => currency.bonus_units.map((unit) => unit.id)))];
      if (mode === 'Currency') plan.optimisation_options = event.currency_targets[0];
      if (mode === 'Materials') {
        const material = eventEngine.materialDropOptions(event).find((key) => Object.values(metadata.materialNames).includes(key));
        if (!material) throw new Error('Missing material optimization fixture.');
        plan.optimisation_options = { [material]: true };
      }
      const old = reference(id, plan, true, true, 'solve');
      const contextBonuses: Record<string, number> = runInContext('currencyBonuses', old.context);
      const summary = summarizeEventRuns(event, plan, eventRequirements(event, plan), contextBonuses, old.energy, old.solution, true, true, metadata);
      const { runs, feasible, ...rewards } = summary;
      expect(feasible).toBe(!old.infeasible);
      if (feasible) {
        expect(runs).toEqual(old.runs);
        expect(rewards).toEqual(old.summary);
      }
    });
  }
  it('accepts legacy numeric-string Manual runs and does not fabricate solver success', () => {
    const event = decodeStandardEvent(rawEvents['lore-pursuit-s2']);
    const plan = decodeEventPlan(undefined, event);
    plan.optimisation_type = 'Manual';
    plan.optimisation_options = { '9': '10' };
    expect(summarizeEventRuns(event, plan, eventRequirements(event, plan), {}, 10000, plan.optimisation_options, false, false, metadata).runs).toEqual({ '9': 10 });
    expect(summarizeEventRuns(event, plan, eventRequirements(event, plan), {}, 10000, { '9': '3.0' }, false, false, metadata).runs).toEqual({ '9': 3 });
    expect(() => summarizeEventRuns(event, plan, eventRequirements(event, plan), {}, 10000, { feasible: false }, false, false, metadata)).toThrow();
    plan.currency_needed.Unknown = 123;
    expect(() => eventRequirements(event, plan)).toThrow('Unknown required event currency');
  });
});

class MemoryStorage implements Storage {
  private entries = new Map<string, string>();
  get length() { return this.entries.size; }
  clear() { this.entries.clear(); }
  key(index: number) { return [...this.entries.keys()][index] ?? null; }
  removeItem(key: string) { this.entries.delete(key); }
  getItem(key: string) { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string) { this.entries.set(key, value); }
}

async function store(storage: MemoryStorage) {
  const planner = createEventPlanner(metadata, () => storage);
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const value = url.includes('misc_data') ? resourceMisc : url.includes('event_misc') ? misc : url.includes('events.json') ? config : students;
    return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  try { await planner.initialise(); } finally { fetchMock.mockRestore(); }
  planner.select('lore-pursuit-s2');
  return planner;
}

describe('event saves, state safety and explicit standard-event gating', () => {
  it('exposes reviewed standard/Omikuji events and retains the coming-soon flag on supported card events', () => {
    const entries = decodeEventCatalog({ ...config, event_order: ['lore-pursuit-s2', 'magical-girl-trinity', '|art-for-whom'] });
    expect(entries.map((entry) => Boolean(entry.event))).toEqual([true, true, true]);
    expect(entries[2].comingSoon).toBe(true);
    expect(() => decodeEventPlan({ enabled_stage_groups: [false, false, false] }, decodeStandardEvent(rawEvents['lore-pursuit-s2']))).toThrow();
  });

  it('preserves prototype-shaped unknown zero shop keys as inert saved data', () => {
    const event = decodeStandardEvent(rawEvents['lore-pursuit-s2']);
    const raw: unknown = JSON.parse('{"shop_purchases":{"__proto__":{"unused":0}}}');
    const plan = decodeEventPlan(raw, event);
    expect(Object.hasOwn(plan.shop_purchases, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(plan.shop_purchases)).toBeNull();
    expect(JSON.parse(JSON.stringify(plan)).shop_purchases['__proto__']).toEqual({ unused: 0 });
  });

  it('preserves all unrelated saves/events and selected-event future fields across edits', async () => {
    const storage = new MemoryStorage();
    const source = { exportVersion: 2, characters: [{ unknown: true }], groups: { Team: [['10000']] }, future: { keep: true },
      events_data: { other: { untouched: true }, 'lore-pursuit-s2': { futureSetting: { keep: true } } } };
    storage.setItem('save-data', JSON.stringify(source));
    const planner = await store(storage);
    expect(planner.setEnergy('pyro_refreshes', 3)).toBe(true);
    expect(planner.setMode('Manual')).toBe(true);
    expect(planner.setManualRuns(9, 12)).toBe(true);
    const result = JSON.parse(storage.getItem('save-data')!);
    expect(result.characters).toEqual(source.characters);
    expect(result.groups).toEqual(source.groups);
    expect(result.future).toEqual(source.future);
    expect(result.events_data.other).toEqual(source.events_data.other);
    expect(result.events_data['lore-pursuit-s2'].futureSetting).toEqual({ keep: true });
    expect(result.events_data['lore-pursuit-s2'].optimisation_options).toEqual({ '9': 12 });
  });

  it.each(boxEventIds)('keeps %s boxed shop targets transactional and rejects edits to reward-only Owned currency', async (id) => {
    const storage = new MemoryStorage();
    const source = {
      exportVersion: 2, futureField: { keep: true }, events_data: { unrelated: { keep: true }, [id]: { futureSetting: { keep: true } } }
    };
    storage.setItem('save-data', JSON.stringify(source));
    const planner = await store(storage);
    expect(planner.select(id)).toBe(true);
    const event = decodeStandardEvent(rawEvents[id]);
    const currency = Object.keys(event.currencies).find((key) => event.currencies[key].source === 'BoxPull');
    const drawCurrency = currency ? event.currencies[currency].pull_currency : undefined;
    if (!currency || !drawCurrency || !event.boxes || event.box_clear_cost === undefined) throw new Error('Missing box data.');
    const reward = event.shops[currency][0];
    expect(planner.setPurchase(currency, String(reward.id), 1)).toBe(true);
    const root = JSON.parse(storage.getItem('save-data')!);
    const eventSave = root.events_data[id];
    const cost = event.shops[currency].reduce((total, item) => total + Number(eventSave.shop_purchases[currency][String(item.id)] ?? 0) * item.cost, 0);
    expect(eventSave.currency_needed[currency]).toBe(cost);
    expect(eventSave.currency_needed[drawCurrency]).toBe(boxPullCurrencyNeeded({ boxes: event.boxes, box_clear_cost: event.box_clear_cost }, cost));
    expect(eventSave.futureSetting).toEqual({ keep: true });
    expect(root.events_data.unrelated).toEqual(source.events_data.unrelated);
    expect(root.futureField).toEqual(source.futureField);
    const snapshot = storage.getItem('save-data');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(planner.setOwnedCurrency(currency, 123)).toBe(false);
      expect(storage.getItem('save-data')).toBe(snapshot);
    } finally { log.mockRestore(); }
  });

  it('reads the newest root save and rejects conflicting selected-event changes', async () => {
    const storage = new MemoryStorage();
    const planner = await store(storage);
    expect(planner.setEnergy('cafe_rank', 6)).toBe(true);
    const raw = JSON.parse(storage.getItem('save-data')!);
    raw.groups = { newer: [] };
    storage.setItem('save-data', JSON.stringify(raw));
    expect(planner.setEnergy('pyro_refreshes', 3)).toBe(true);
    const conflicting = JSON.parse(storage.getItem('save-data')!);
    conflicting.events_data['lore-pursuit-s2'].cafe_rank = 9;
    storage.setItem('save-data', JSON.stringify(conflicting));
    const consoleMock = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(planner.setEnergy('cafe_rank', 7)).toBe(false);
      expect(get(planner).error).toContain('changed in another window');
      expect(JSON.parse(storage.getItem('save-data')!).events_data['lore-pursuit-s2'].cafe_rank).toBe(9);
      await planner.reload(true);
      expect(planner.setEnergy('cafe_rank', 7)).toBe(true);
      expect(JSON.parse(storage.getItem('save-data')!).groups).toEqual({ newer: [] });
    } finally { consoleMock.mockRestore(); }
  });

  it('reports invalid input and storage failure without replacing the saved plan', async () => {
    const storage = new MemoryStorage();
    const planner = await store(storage);
    expect(planner.setMode('Shop')).toBe(true);
    const source = storage.getItem('save-data');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(planner.setEnergy('cafe_rank', NaN)).toBe(false);
      expect(storage.getItem('save-data')).toBe(source);
      const write = vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
      expect(planner.setEnergy('cafe_rank', 6)).toBe(false);
      expect(get(planner).error).toContain('Quota exceeded');
      expect(storage.getItem('save-data')).toBe(source);
      write.mockRestore();
    } finally { log.mockRestore(); }
  });

  it('never overwrites malformed JSON or invalid event settings with defaults', async () => {
    for (const source of ['{broken', JSON.stringify({ events_data: { 'lore-pursuit-s2': { currency_owned: [] } } })]) {
      const storage = new MemoryStorage();
      storage.setItem('save-data', source);
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const planner = await store(storage);
        expect(get(planner).error).not.toBe('');
        expect(planner.setEnergy('cafe_rank', 6)).toBe(false);
        expect(storage.getItem('save-data')).toBe(source);
      } finally { log.mockRestore(); }
    }
  });
});
