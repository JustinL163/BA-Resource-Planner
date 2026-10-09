import { afterEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { createContext, runInContext } from 'node:vm';
import { metadata } from '../../.generated-content/planner';
import { adjustedCardAmounts, simulationInputFingerprint, type CardMath } from '../../src/lib/domain/events/card-statistics';
import { applyOmikujiRewards, decodeOmikuji, omikujiChances, omikujiRewardNames, omikujiSimulationRequest } from '../../src/lib/domain/events/omikuji';
import { eventRequirements, summarizeEventRuns } from '../../src/lib/domain/events/standard';
import { decodeEventCatalog, decodeEventPlan, decodeStandardEvent, omikujiEventIds } from '../../src/lib/domain/events/standard-save';
import type { CardStatistics, EventSummary, OmikujiDefinition } from '../../src/lib/domain/events/standard-types';
import { createEventPlanner } from '../../src/lib/stores/event-planner';
import { isRecord } from '../../src/lib/domain/planner/save';
import { simulateOmikuji } from '../../src/lib/services/omikuji-simulation';
import type { SimulationWorker } from '../../src/lib/services/simulations/types';
import type { TaskWorker } from '../../src/lib/services/worker-request';
import { createLegacyContext, evaluate, readJson, readSource, seededRandom } from './legacy-harness';

const config = readJson('planner', 'json', 'events.json');
if (!isRecord(config) || !isRecord(config.events)) throw new Error('Invalid Omikuji event fixture.');
const events = config.events;
const mathContext = createContext({});
runInContext(readSource('planner', 'packages', 'mathjs', 'math.js'), mathContext);
const math: CardMath = runInContext('math', mathContext);
const students = readJson('planner', 'json', 'skillinfo', 'en.json');
const misc = readJson('planner', 'json', 'event_misc.json');
const resourceMisc = readJson('planner', 'json', 'misc_data.json');

function eventFor(id: string) {
  const raw = events[id];
  if (!isRecord(raw)) throw new Error(`Missing Omikuji event ${id}.`);
  const event = decodeStandardEvent(raw);
  if (!event.omikuji) throw new Error(`Missing Omikuji data for ${id}.`);
  return { raw, event, omikuji: event.omikuji };
}

function emptySummary(): EventSummary {
  return {
    runs: {}, currencies: {}, artifacts: {}, schoolMats: {}, eleph: {}, xps: {}, gear: {},
    credit: 0, eligma: 0, secretTech: 0, energy: 0, feasible: true
  };
}

function legacyChances(omikuji: OmikujiDefinition) {
  const context = createContext({ omikuji });
  runInContext(readSource('tests', 'fixtures', 'omikuji-chances.legacy.js'), context);
  return evaluate(context, 'LegacyOmikujiChances(omikuji)');
}

function seededWorker(omikuji: OmikujiDefinition, currency: number, attempts = 12, seed = 163) {
  const request = omikujiSimulationRequest(omikuji, currency);
  const controlledMath: Math = Object.create(Math);
  controlledMath.random = seededRandom(seed);
  const message = [
    request.rewards, request.chances, 3000, attempts, request.currencyOwned, request.pullCost, request.targetGrade
  ];
  const context = createContext({
    Math: controlledMath,
    self: { close() {} },
    postMessage(samples: unknown) { context.result = samples; },
    message
  });
  runInContext(readSource('planner', 'js', 'omikujiGachaWorker.js'), context, { filename: 'omikujiGachaWorker.js' });
  runInContext('onmessage({ data: message });', context);
  return context;
}

function legacyRewards(id: string, statistics: CardStatistics, deviation: number) {
  const context = createLegacyContext([], {
    event_config: config,
    current_event: id,
    omikujiGachaAvgSD: statistics,
    setSD: deviation,
    math,
    matLookup: { map: metadata.materialNames }
  });
  runInContext(readSource('tests', 'fixtures', 'omikuji-rewards.legacy.js'), context);
  return evaluate(context, `(() => {
    const eleph = {}, artifacts = {};
    const [credit, eligma] = AddOmikujiRewards(eleph, artifacts);
    return { eleph, artifacts, credit, eligma };
  })()`);
}

interface LegacyOverflowOutput {
  currencies: Record<string, number>;
  overflow: Record<string, number>;
}

function legacyOverflowSummary(id: string, plan: ReturnType<typeof decodeEventPlan>, runs: Record<string, number>) {
  const { event } = eventFor(id);
  const context = createLegacyContext(['config.js', 'common.js', 'eventPlanner.js'], {
    fixture: { config, students, misc, id, plan, runs },
    Date: { now: () => (event.reset_time + 3 * 86400 + 3600) * 1000 },
    cafeDefault: 10
  });
  runInContext(readSource('tests', 'fixtures', 'event-core.legacy.js'), context);
  runInContext(`
    event_config = fixture.config; charlist = fixture.students; event_misc = fixture.misc; current_event = fixture.id;
    event_data = fixture.plan; enabledBonusUnits = []; currencyNeededPre = event_data.currency_needed;
    stageGroup1 = true; stageGroup2 = true; stageGroup3 = true;
    optimisationType = event_data.optimisation_type;
    midEvent = Object.values(event_data.currency_owned).some((value) => parseInt(value) > 0);
    displayIncluded = { ShopPurchases: false, PointRewards: false, OmikujiRewards: false };
    Save = () => {}; UpdateNotifications = () => {}; GenerateStagesTable = () => {}; ClearRewards = () => {};
    eventLoading = true; CalculateBonuses(); CalculateInitalClear(); CalculateEnergyAvailable(); CalculateNeededFinal();
    UpdateRewardsObtained = (currencies) => { fixture.summary = { currencies }; };
    InfeasibleModel = () => { fixture.infeasible = true; };
    CalculateStageDrops(fixture.runs, optimisationType === 'Manual');
  `, context);
  const result: unknown = evaluate(context, `({
    currencies: fixture.summary.currencies,
    overflow: event_data.shop_purchases.overflow_Event_Point || event_data.shop_purchases.Event_Point
  })`);
  if (!isRecord(result) || !isRecord(result.currencies) || !isRecord(result.overflow)) {
    throw new Error('Invalid legacy Omikuji overflow output.');
  }
  const amounts = (value: Record<string, unknown>): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const [key, amount] of Object.entries(value)) {
      if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error(`Invalid legacy amount for "${key}".`);
      result[key] = amount;
    }
    return result;
  };
  return { currencies: amounts(result.currencies), overflow: amounts(result.overflow) } satisfies LegacyOverflowOutput;
}

describe('reviewed Omikuji events, legacy chance order, and exact worker requests', () => {
  it('only enables the five reviewed Omikuji events and normalizes omitted overflow purchase amounts', () => {
    expect(decodeEventCatalog(config, true).filter((entry) => entry.event?.omikuji).map((entry) => entry.id)).toEqual(omikujiEventIds);
    for (const id of omikujiEventIds) {
      const { raw, event, omikuji } = eventFor(id);
      expect(omikuji).toEqual((raw as Record<string, unknown>).omikuji);
      expect(event.card_drops).toBeUndefined();
      expect(event.dice_race).toBeUndefined();
      expect(event.boxes).toBeUndefined();
      const overflow = event.shops.Event_Point.filter((item) => item.overflow);
      expect(overflow).toHaveLength(1);
      expect(overflow[0].id).toBe(omikuji.pull_currency);
      expect(overflow[0].cost).toBe(300);
      expect(overflow[0].overflow_cap).toBe(999);
      expect(overflow[0].amount ?? 1).toBe(1);
      expect(event.currencies[omikuji.pull_currency].source).toMatch(/^Shop(Purchase|Buy)$/);
    }
  });

  it.each(omikujiEventIds)('%s exactly preserves cumulative chance thresholds and ordered worker reward keys', (id) => {
    const { omikuji } = eventFor(id);
    const request = omikujiSimulationRequest(omikuji, 125);
    expect(omikujiChances(omikuji)).toEqual(legacyChances(omikuji));
    expect(request).toEqual({
      kind: 'omikuji',
      currencyOwned: 125,
      rewards: omikuji.slips.map((slip) => [slip.Grade, slip.RewardId, slip.RewardAmount]),
      chances: legacyChances(omikuji),
      pullCost: omikuji.pull_cost,
      targetGrade: omikuji.TargetGrade
    });
    const expectedKeys = Object.keys(Object.fromEntries(omikuji.slips.flatMap((slip) => slip.RewardId.map((reward) => [String(reward), true]))));
    expect(omikujiRewardNames(omikuji)).toEqual(expectedKeys);
  });

  it('retains the legacy limit-without-lower-clamp and zero-limit lower-clamp behavior', () => {
    const definition = decodeOmikuji({
      pull_currency: 'Ticket', pull_cost: 1, TargetGrade: 1,
      ProbModifyStartCount: 1, MaxPullCount: 4,
      slips: [
        { Grade: 1, Prob: 100, ProbModifyValue: -500, ProbModifyLimit: 50, RewardId: [1], RewardAmount: [1] },
        { Grade: 2, Prob: 200, ProbModifyValue: -500, ProbModifyLimit: 0, RewardId: [23], RewardAmount: [1] }
      ]
    });
    expect(omikujiChances(definition)).toEqual(legacyChances(definition));
    expect(omikujiChances(definition)).toEqual([[0, -400], [0, -900], [0, -1400]]);
  });

  it.each([-1, NaN, Infinity, 200001])('rejects unsafe simulation currency %s', (currency) => {
    expect(() => omikujiSimulationRequest(eventFor(omikujiEventIds[0]).omikuji, currency)).toThrow();
  });

  it('rejects malformed definitions, mismatched reward arrays and incompatible saved statistics', () => {
    const omikuji = eventFor(omikujiEventIds[0]).omikuji;
    for (const bad of [
      { ...omikuji, pull_cost: 0 },
      { ...omikuji, ProbModifyStartCount: 0 },
      { ...omikuji, MaxPullCount: omikuji.ProbModifyStartCount },
      { ...omikuji, TargetGrade: 999 },
      { ...omikuji, slips: [{ ...omikuji.slips[0], RewardAmount: [] }] }
    ]) expect(() => decodeOmikuji(bad)).toThrow();
    expect(() => decodeEventPlan({ omikuji_pull_rewards: { Unknown: { mean: 1, std: 1 } } }, eventFor(omikujiEventIds[0]).event))
      .toThrow('match');
    expect(() => decodeEventPlan({ omikuji_pull_rewards: { '1': { mean: 1, std: -1 } } }, eventFor(omikujiEventIds[0]).event))
      .toThrow();
  });
});

describe('unchanged Omikuji worker outcomes and legacy reward classification', () => {
  it.each([
    ['magical-girl-trinity', 20],
    ['pray-ball-rerun', 30]
  ])('pins seeded original worker outcomes for %s with %i tickets', (id, currency) => {
    const { omikuji } = eventFor(id);
    const context = seededWorker(omikuji, currency);
    const samples = evaluate(context, 'result');
    expect(samples).toMatchSnapshot();
    if (!isRecord(samples)) throw new Error('Invalid seeded Omikuji output.');
    const names = omikujiRewardNames(omikuji);
    expect(Object.keys(samples)).toEqual(names);
    expect(Object.values(samples).every((values) => Array.isArray(values) && values.length === 12)).toBe(true);
  });

  it('runs zero-funded and partial-ticket cases through the original worker rather than short-circuiting', () => {
    const { omikuji } = eventFor(omikujiEventIds[0]);
    const empty = evaluate(seededWorker(omikuji, 0), 'result');
    const partial = evaluate(seededWorker(omikuji, 3), 'result');
    if (!isRecord(empty) || !isRecord(partial)) throw new Error('Invalid Omikuji worker results.');
    expect(Object.values(empty).every((values) => Array.isArray(values) && values.length === 12 && values.every((value) => value === 0))).toBe(true);
    expect(Object.values(partial).every((values) => Array.isArray(values) && values.length === 12)).toBe(true);
  });

  for (const id of omikujiEventIds) {
    const { omikuji } = eventFor(id);
    const names = omikujiRewardNames(omikuji);
    const statistics: CardStatistics = Object.fromEntries([
      ...names.map((name, index) => [name, { mean: index === 0 ? -0.5 : 50.5 + index, std: index % 2 ? 0.25 : 1.5 }] as const),
      ['3000', { mean: 12.5, std: 0.5 }],
      ['10000', { mean: 3.5, std: 0.5 }],
      ['Credit', { mean: 999, std: 1 }],
      ['XP_1', { mean: 999, std: 1 }]
    ]);
    for (const deviation of [-2, -1.5, -1, -0.5, 0, 0.5, 1]) {
      it(`${id} matches AddOmikujiRewards at ${deviation} sigma without clamping signed rounding`, () => {
        const legacy = legacyRewards(id, statistics, deviation);
        const base = emptySummary();
        const modern = applyOmikujiRewards(base, adjustedCardAmounts(statistics, deviation, math), metadata);
        expect({ eleph: modern.eleph, artifacts: modern.artifacts, credit: modern.credit, eligma: modern.eligma }).toEqual(legacy);
        expect(base).toEqual(emptySummary());
        if (deviation === 0) expect(modern.credit).toBe(-1);
      });
    }
  }
});

class FakeTask implements TaskWorker {
  onmessage: TaskWorker['onmessage'] = null;
  onerror: TaskWorker['onerror'] = null;
  onmessageerror: TaskWorker['onmessageerror'] = null;
  message: unknown;
  terminated = false;
  postMessage(message: unknown) { this.message = message; }
  terminate() { this.terminated = true; }
  reply(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: value })); }
}

class FakeSimulation implements SimulationWorker {
  onmessage: SimulationWorker['onmessage'] = null;
  onerror: SimulationWorker['onerror'] = null;
  onmessageerror: SimulationWorker['onmessageerror'] = null;
  message: readonly unknown[] = [];
  terminated = false;
  postMessage(message: readonly unknown[]) { this.message = message; }
  terminate() { this.terminated = true; }
  reply(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: value })); }
}

afterEach(() => vi.unstubAllGlobals());

describe('four-worker Omikuji service and compatible event-save lifecycle', () => {
  it('uses the original worker path, exact seven-field request, and shared statistics worker', async () => {
    vi.stubGlobal('window', { location: { href: 'https://example.invalid/planner/event-planner/' } });
    const { omikuji } = eventFor('magical-girl-trinity');
    const request = omikujiSimulationRequest(omikuji, 50);
    const pool: FakeSimulation[] = [];
    const stats = new FakeTask();
    const pending = simulateOmikuji(omikuji, 50, {
      createSimulationWorker(url) {
        expect(url.pathname).toBe('/planner/js/omikujiGachaWorker.js');
        expect(url.search).toBe('?1');
        const worker = new FakeSimulation();
        pool.push(worker);
        return worker;
      },
      createWorker(url) {
        expect(url.pathname).toBe('/planner/js/shared/card-statistics-worker.js');
        return stats;
      }
    });
    expect(pool).toHaveLength(4);
    for (const worker of pool) {
      expect(worker.message).toEqual([
        request.rewards, request.chances, 3000, 100000, 50, request.pullCost, request.targetGrade
      ]);
    }
    pool[2].reply({ '1': [3], '23': [4] });
    pool[0].reply({ '1': [1], '23': [2] });
    pool[3].reply({ '1': [4], '23': [5] });
    pool[1].reply({ '1': [2], '23': [3] });
    await Promise.resolve();
    expect(stats.message).toEqual({
      action: 'statistics',
      samples: { '1': [3, 1, 4, 2], '23': [4, 2, 5, 3] }
    });
    stats.reply({
      ok: true,
      result: {
        statistics: { '1': { mean: 2.5, std: 1.2909944487358056 }, '23': { mean: 3.5, std: 1.2909944487358056 } },
        sampleCount: 4
      }
    });
    await expect(pending).resolves.toEqual({
      statistics: { '1': { mean: 2.5, std: 1.2909944487358056 }, '23': { mean: 3.5, std: 1.2909944487358056 } },
      sampleCount: 4
    });
    expect(pool.every((worker) => worker.terminated)).toBe(true);
    expect(stats.terminated).toBe(true);
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

  async function createPlanner(id: string) {
    const storage = new MemoryStorage();
    storage.setItem('save-data', JSON.stringify({
      exportVersion: 2, characters: [{ keep: true }], groups: { Team: [] }, futureField: { keep: true },
      events_data: { unrelated: { keep: true }, [id]: { futureSetting: { keep: true } } }
    }));
    const planner = createEventPlanner(metadata, () => storage);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const value = url.includes('misc_data') ? resourceMisc : url.includes('event_misc') ? misc :
        url.includes('events.json') ? config : students;
      return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    try {
      await planner.initialise();
    } finally {
      fetchMock.mockRestore();
    }
    expect(planner.select(id)).toBe(true);
    return { planner, storage };
  }

  it('saves and reloads legacy Omikuji statistics while reusing RNG-only edits and protecting changed plans', async () => {
    const id = 'magical-girl-trinity';
    const { planner, storage } = await createPlanner(id);
    const { event, omikuji } = eventFor(id);
    const plan = get(planner).plan;
    if (!plan) throw new Error('Omikuji plan missing.');
    const statistics: CardStatistics = Object.fromEntries(omikujiRewardNames(omikuji).map((key) => [key, { mean: 10, std: 2 }]));
    const inputs = simulationInputFingerprint(plan);
    expect(planner.setStandardDeviation(-1)).toBe(true);
    expect(planner.saveSimulation('omikuji', statistics, 55, { id, inputs })).toBe(true);
    const saved = JSON.parse(storage.getItem('save-data')!);
    expect(saved.events_data[id].omikuji_pull_rewards).toEqual(statistics);
    expect(saved.events_data[id].omikuji_pull_currency_owned).toBe(55);
    expect(saved.events_data[id].standard_deviation).toBe(-1);
    expect(saved.events_data[id].futureSetting).toEqual({ keep: true });
    expect(saved.events_data.unrelated).toEqual({ keep: true });
    expect(saved.characters).toEqual([{ keep: true }]);
    expect(saved.futureField).toEqual({ keep: true });
    expect(decodeEventPlan(saved.events_data[id], event).omikuji_pull_rewards).toEqual(statistics);
    await planner.reload(true);
    expect(get(planner).plan?.omikuji_pull_rewards).toEqual(statistics);
    expect(planner.setEnergy('pyro_refreshes', 3)).toBe(true);
    const before = storage.getItem('save-data');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(planner.saveSimulation('omikuji', statistics, 55, { id, inputs })).toBe(false);
      expect(storage.getItem('save-data')).toBe(before);
    } finally {
      log.mockRestore();
    }
  });

  it('keeps automatic Currency-mode tickets read-only and supports manual overflow purchases', async () => {
    const id = 'pray-ball-rerun';
    const { planner, storage } = await createPlanner(id);
    const { event, omikuji } = eventFor(id);
    const overflow = event.shops.Event_Point.find((item) => item.overflow);
    if (!overflow) throw new Error('Missing overflow ticket row.');
    expect(planner.setMode('Currency')).toBe(true);
    let saved = JSON.parse(storage.getItem('save-data')!);
    expect(saved.events_data[id].optimisation_options).toBe('Event_Point');
    expect(saved.events_data[id].shop_purchases.Event_Point[String(overflow.id)]).toBe(0);
    expect(saved.events_data[id].currency_needed.Event_Point).toBe(0);
    const before = storage.getItem('save-data');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(planner.setPurchase('Event_Point', String(overflow.id), 1)).toBe(false);
      expect(storage.getItem('save-data')).toBe(before);
    } finally {
      log.mockRestore();
    }
    expect(planner.setMode('Manual')).toBe(true);
    expect(planner.setPurchase('Event_Point', String(overflow.id), 7)).toBe(true);
    saved = JSON.parse(storage.getItem('save-data')!);
    expect(saved.events_data[id].shop_purchases.Event_Point[String(overflow.id)]).toBe(7);
    expect(saved.events_data[id].currency_needed.Event_Point).toBe(2100);
    expect(saved.events_data[id].currency_needed[omikuji.pull_currency]).toBeUndefined();
  });

  it.each(omikujiEventIds)('%s calculates overflow tickets in Currency and manual modes, including owned Event Points', (id) => {
    const { event, omikuji } = eventFor(id);
    const plan = decodeEventPlan(undefined, event);
    plan.optimisation_type = 'Currency';
    plan.optimisation_options = 'Event_Point';
    for (const [currency, items] of Object.entries(event.shops)) {
      plan.shop_purchases[currency] = Object.fromEntries(items.map((item) => [String(item.id), 0]));
      plan.currency_needed[currency] = items.reduce((sum, item) => sum + item.cost * Number(plan.shop_purchases[currency][String(item.id)]), 0);
    }
    plan.currency_needed.Event_Point = 300;
    plan.point_target = 1;
    plan.currency_owned = { Event_Point: '1200' };
    const runs = { '4': 100, '8': 100, '12': 100 };
    const requirements = eventRequirements(event, plan);
    const summary = summarizeEventRuns(event, plan, requirements, {}, 100000, runs, false, false, metadata);
    const overflow = event.shops.Event_Point.find((item) => item.overflow);
    if (!overflow) throw new Error('Missing ticket overflow row.');
    const expected = Math.max(Math.min(Math.floor((summary.currencies.Event_Point - 300) / overflow.cost), overflow.overflow_cap ?? 999), 0);
    expect(requirements.midEvent).toBe(true);
    expect(summary.feasible).toBe(true);
    expect(summary.overflowPurchases?.Event_Point?.[String(overflow.id)]).toBe(expected);
    expect(summary.currencies[omikuji.pull_currency]).toBe(expected * (overflow.amount ?? 1));

    plan.optimisation_type = 'Manual';
    plan.optimisation_options = runs;
    plan.shop_purchases.Event_Point[String(overflow.id)] = 7;
    const manual = summarizeEventRuns(event, plan, eventRequirements(event, plan), {}, 100000, runs, false, false, metadata);
    expect(manual.overflowPurchases?.Event_Point?.[String(overflow.id)]).toBe(7);
    expect(manual.currencies[omikuji.pull_currency]).toBe(7 * (overflow.amount ?? 1));
  });

  it('matches the unchanged legacy stage-drop overflow logic for automatic and manually purchased tickets', () => {
    const id = 'pray-ball-rerun';
    const { event, omikuji } = eventFor(id);
    const runs = { '4': 100, '8': 100, '12': 100 };
    const plan = decodeEventPlan(undefined, event);
    plan.optimisation_type = 'Currency';
    plan.optimisation_options = 'Event_Point';
    for (const [currency, items] of Object.entries(event.shops)) {
      plan.shop_purchases[currency] = Object.fromEntries(items.map((item) => [String(item.id), 0]));
      plan.currency_needed[currency] = 0;
    }
    plan.currency_needed.Event_Point = 0;
    plan.point_target = 1;
    const automatic = summarizeEventRuns(event, plan, eventRequirements(event, plan), {}, 100000, runs, false, false, metadata);
    const legacyAutomatic = legacyOverflowSummary(id, plan, runs);
    expect(automatic.currencies).toEqual(legacyAutomatic.currencies);
    expect(automatic.currencies[omikuji.pull_currency]).toBe(
      legacyAutomatic.overflow[omikuji.pull_currency] * (event.shops.Event_Point.find((item) => item.overflow)?.amount ?? 1)
    );

    plan.optimisation_type = 'Manual';
    plan.optimisation_options = runs;
    const overflow = event.shops.Event_Point.find((item) => item.overflow);
    if (!overflow) throw new Error('Missing overflow ticket row.');
    plan.shop_purchases.Event_Point[String(overflow.id)] = 7;
    const manual = summarizeEventRuns(event, plan, eventRequirements(event, plan), {}, 100000, runs, false, false, metadata);
    const legacyManual = legacyOverflowSummary(id, plan, runs);
    expect(manual.currencies).toEqual(legacyManual.currencies);
    expect(manual.currencies[omikuji.pull_currency]).toBe(7 * (overflow.amount ?? 1));
  });
});
