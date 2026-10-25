import { describe, expect, it, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { createContext, runInContext } from 'node:vm';
import { metadata } from '../../.generated-content/planner';
import { applyCardRewards, cardChances, cardInputFingerprint, cardPullRequirement, decodeCardDraws } from '../../src/lib/domain/events/cards';
import { adjustedCardAmounts, decodeCardStatistics, summarizeCardSamples, validateStandardDeviation, type CardMath } from '../../src/lib/domain/events/card-statistics';
import { cardEventIds, decodeEventCatalog, decodeEventPlan, decodeStandardEvent, omikujiEventIds } from '../../src/lib/domain/events/standard-save';
import { eventRequirements, summarizeEventRuns } from '../../src/lib/domain/events/standard';
import { createEventPlanner } from '../../src/lib/stores/event-planner';
import { eventEngine } from '../../src/lib/domain/events';
import { isRecord } from '../../src/lib/domain/planner/save';
import type { CardStatistics, EventSummary } from '../../src/lib/domain/events/standard-types';
import { createLegacyContext, evaluate, readJson, readSource } from './legacy-harness';
import { simulateCards, roundCardStatistics } from '../../src/lib/services/card-simulation';
import type { TaskWorker } from '../../src/lib/services/worker-request';
import type { SimulationWorker } from '../../src/lib/services/simulations/types';

const config = readJson('planner', 'json', 'events.json');
if (!isRecord(config) || !isRecord(config.events)) throw new Error('Invalid card event fixture.');
const events = config.events;
const mathSource = readSource('planner', 'packages', 'mathjs', 'math.js');
const mathContext = createContext({});
runInContext(mathSource, mathContext);
const math: CardMath = runInContext('math', mathContext);
const students = readJson('planner', 'json', 'skillinfo', 'en.json');
const misc = readJson('planner', 'json', 'event_misc.json');
const resourceMisc = readJson('planner', 'json', 'misc_data.json');

function emptySummary(): EventSummary {
  return { runs: {}, currencies: {}, artifacts: {}, schoolMats: {}, eleph: {}, xps: {}, gear: {}, credit: 0, eligma: 0, secretTech: 0, energy: 0, feasible: true };
}

describe('card definitions, exact chances and legacy reward classification', () => {
  for (const id of cardEventIds) {
    const event = decodeStandardEvent(events[id]);
    if (!event.card_drops) throw new Error('Missing card draws.');
    const draws = event.card_drops;
    it(`${id} retains exact cumulative probabilities and repeated normal group references`, () => {
      const context = createLegacyContext(['config.js'], { event_config: config, current_event: id, cardGachaChances: [] });
      runInContext(readSource('tests', 'fixtures', 'cards.legacy.js'), context);
      runInContext('LoadCardGachaChances()', context);
      const modern = cardChances(draws);
      expect(modern).toEqual(evaluate(context, 'cardGachaChances'));
      expect(modern[0]).toBe(modern[1]);
      expect(modern[1]).toBe(modern[2]);
      expect(modern[3].length).toBe(draws.filter((draw) => /^(UR|SR)/.test(draw.icon)).length);
    });
    it.each([-2, -1.5, -1, -0.5, 0, 0.5, 1])(`${id} preserves RNG-adjusted rewards at %s sigma`, (deviation) => {
      const statistics: CardStatistics = Object.fromEntries([...new Set(draws.flatMap((draw) => Object.keys(draw.drops)))]
        .map((key, index) => [key, { mean: 0.5 + index * 2, std: 1 + index }]));
      const context = createLegacyContext(['config.js'], { event_config: config, current_event: id, cardGachaAvgSD: statistics, setSD: deviation });
      runInContext(mathSource, context);
      runInContext(readSource('tests', 'fixtures', 'cards.legacy.js'), context);
      const rewardCurrency = Object.keys(event.currencies).find((key) => event.currencies[key].source === 'CardPull');
      context.rewardCurrency = rewardCurrency;
      const legacy = evaluate(context, `(() => {
        const currencies={},artifacts={},eleph={},xps={};
        const [credit,eligma]=AddCardRewards(rewardCurrency,currencies,artifacts,eleph,xps);
        return {currencies,artifacts,eleph,xps,credit,eligma};
      })()`);
      const rounded = adjustedCardAmounts(statistics, deviation, math);
      const summary = emptySummary();
      const modern = applyCardRewards(event, summary, rounded, metadata);
      expect({ currencies: modern.currencies, artifacts: modern.artifacts, eleph: modern.eleph, xps: modern.xps, credit: modern.credit, eligma: modern.eligma }).toEqual(legacy);
      expect(summary).toEqual(emptySummary());
      expect(legacy).toMatchSnapshot();
    });
    it.each([false, true])(`${id} keeps CardPull requirement conversion in Owned mode=%s`, (owned) => {
      const plan = decodeEventPlan(undefined, event);
      const currency = Object.values(event.currencies).find((currency) => currency.source === 'CardPull')?.pull_currency;
      if (!currency) throw new Error('Missing draw currency.');
      if (owned) plan.currency_owned = { [currency]: '123' };
      const context = createLegacyContext(['config.js', 'common.js', 'eventPlanner.js'], { fixture: { config, id, plan }, BAEventEngine: eventEngine });
      runInContext(readSource('tests', 'fixtures', 'event-core.legacy.js'), context);
      runInContext(`
        event_config=fixture.config;current_event=fixture.id;event_data=fixture.plan;currencyNeededPre=event_data.currency_needed;
        midEvent=Object.values(event_data.currency_owned).some(v=>parseInt(v)>0);
        CalculateInitalClear();CalculateNeededFinal();
      `, context);
      const requirements = eventRequirements(event, plan);
      expect(requirements).toEqual(runInContext('({needed:currencyNeeded,pointTarget:event_point_target,midEvent,initial:{rewards:initialClearRewards,cost:initialClearCost}})', context));
    });
    it.each([-2, 0, 1])(`${id} complete farming/shop/card summaries match the legacy at %s sigma`, (deviation) => {
      const plan = decodeEventPlan(undefined, event);
      plan.optimisation_type = 'Manual'; plan.optimisation_options = { '9': 10, '12': 10 };
      const statistics: CardStatistics = Object.fromEntries([...new Set(draws.flatMap((draw) => Object.keys(draw.drops)))]
        .map((key, index) => [key, { mean: 500 + index * 10, std: 5 + index }]));
      const context = createLegacyContext(['config.js', 'common.js', 'eventPlanner.js'], {
        fixture: { config, id, plan, students, misc, statistics, deviation }, BAEventEngine: eventEngine,
        Date: { now: () => event.start_time * 1000 }, math
      });
      runInContext(readSource('tests', 'fixtures', 'event-core.legacy.js'), context);
      runInContext(readSource('tests', 'fixtures', 'cards.legacy.js'), context);
      runInContext(`
        event_config=fixture.config; current_event=fixture.id; event_data=fixture.plan; events_data={[current_event]:event_data};
        charlist=fixture.students; event_misc=fixture.misc; currencyNeededPre=event_data.currency_needed;enabledBonusUnits=[];
        optimisationType='Manual';eventLoading=true;midEvent=false;displayIncluded={ShopPurchases:true,CardRewards:true};
        Save=()=>{};ClearRewards=()=>{};InfeasibleModel=()=>{throw new Error('Fixture is infeasible')};
        CalculateBonuses();CalculateInitalClear();CalculateEnergyAvailable();CalculateNeededFinal();
        const drawCurrency=Object.values(event_config.events[current_event].currencies).find(c=>c.source==='CardPull').pull_currency;
        cardPullCurrencyOwned=initialClearRewards[drawCurrency]+
          Object.entries(event_data.optimisation_options).reduce((sum,[q,runs])=>sum+event_config.events[current_event].stages.filter(s=>s.type==='Quest')[q-1].drops[drawCurrency]*runs,0);
        cardGachaAvgSD=fixture.statistics;setSD=fixture.deviation;
        UpdateRewardsObtained=(currencies,energy,artifacts,schoolMats,eleph,xps,credit,eligma,secretTech,gearBoxes,gear)=>{
          fixture.summary={currencies,energy,artifacts,schoolMats,eleph,xps,credit,eligma,secretTech,gear};
        };
        CalculateStageDrops(event_data.optimisation_options,true);
      `, context);
      const bonuses = runInContext('currencyBonuses', context);
      const requirements = eventRequirements(event, plan);
      const summary = summarizeEventRuns(event, plan, requirements, bonuses, runInContext('energyAvailable', context), plan.optimisation_options, true, false, metadata);
      const modern = applyCardRewards(event, summary, adjustedCardAmounts(statistics, deviation, math), metadata);
      const { runs, feasible, ...rewards } = modern;
      expect(feasible).toBe(true);
      expect(rewards).toEqual(evaluate(context, 'fixture.summary'));
      expect(runs).toEqual(evaluate(context, 'stage_runs'));
    });
  }
  it('keeps funding approximation, half-step adjustments, negative rounding and sample standard deviation', () => {
    expect(cardPullRequirement(215, 0, 2018)).toBe(Math.ceil(215 * 0.544811320) * 200 - 2018);
    expect(cardPullRequirement(215, 123, 2018)).toBe(Math.ceil(215 * 0.544811320) * 200 - 123);
    expect(adjustedCardAmounts({ Reward: { mean: 0, std: 1 } }, -0.5, math)).toEqual({ Reward: -1 });
    expect(summarizeCardSamples({ Credit: [1, 2, 3], Item: [3, 3, 3] }, math)).toEqual({
      statistics: { Credit: { mean: 2, std: 1 }, Item: { mean: 3, std: 0 } }, sampleCount: 3
    });
    expect(summarizeCardSamples({ Credit: [10] }, math).statistics.Credit.std).toBe(0);
  });
  it('rejects malformed chances, samples, adjustments and statistics explicitly', () => {
    expect(() => decodeCardDraws([{ icon: 'N_Test', chance: 1, drops: { Credit: 1 } }])).toThrow();
    expect(() => decodeCardDraws([{ icon: '../bad', chance: 1, chance4: 1, drops: { Credit: 1 } }])).toThrow();
    expect(() => decodeCardDraws([{ icon: 'UR_Test', chance: 1, chance4: 0, drops: { Credit: 1 } }])).toThrow();
    expect(() => decodeCardStatistics({ Credit: { mean: 1, std: -1 } })).toThrow();
    expect(() => summarizeCardSamples({ Credit: [1, 2], Item: [1] }, math)).toThrow();
    expect(() => summarizeCardSamples({ Credit: [] }, math)).toThrow();
    for (const adjustment of [NaN, Infinity, -3, 2, 0.1]) expect(() => validateStandardDeviation(adjustment)).toThrow();
  });
  it('simulation fingerprints ignore RNG/statistics but include changed farming inputs', () => {
    const event = decodeStandardEvent(events['art-for-whom']);
    const plan = decodeEventPlan(undefined, event);
    const key = cardInputFingerprint(plan);
    plan.standard_deviation = -1;
    plan.card_pull_rewards = { Credit: { mean: 1, std: 1 } };
    plan.card_pull_currency_owned = 200;
    expect(cardInputFingerprint(plan)).toBe(key);
    plan.cafe_rank = 6;
    expect(cardInputFingerprint(plan)).not.toBe(key);
  });
});

class FakeWorker implements TaskWorker {
  onmessage: TaskWorker['onmessage'] = null;
  onerror: TaskWorker['onerror'] = null;
  onmessageerror: TaskWorker['onmessageerror'] = null;
  message: unknown;
  terminated = false;
  postMessage(message: unknown) { this.message = message; }
  terminate() { this.terminated = true; }
  reply(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: value })); }
}
class SimulationFake implements SimulationWorker {
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

describe('card simulation and statistics worker lifecycle', () => {
  it('keeps four original simulation workers/budgets and summarizes arrival-order samples off the main thread', async () => {
    vi.stubGlobal('window', { location: { href: 'https://example.invalid/planner/event-planner/' } });
    const event = decodeStandardEvent(events['art-for-whom']);
    if (!event.card_drops) throw new Error('Missing card fixture.');
    const pool: SimulationFake[] = [];
    const stats = new FakeWorker();
    const pending = simulateCards(event.card_drops, 200, { createSimulationWorker: (url) => {
      expect(url.pathname).toBe('/planner/js/cardGachaWorker.js');
      const worker = new SimulationFake(); pool.push(worker); return worker;
    }, createWorker: (url) => { expect(url.pathname).toContain('card-statistics-worker'); return stats; } });
    expect(pool).toHaveLength(4);
    for (const worker of pool) expect(worker.message.slice(2)).toEqual([3000, 100000, 200]);
    pool[2].reply({ Credit: [3] }); pool[0].reply({ Credit: [1] }); pool[3].reply({ Credit: [4] }); pool[1].reply({ Credit: [2] });
    await Promise.resolve();
    expect(stats.message).toEqual({ action: 'statistics', samples: { Credit: [3, 1, 4, 2] } });
    expect(pool.every((worker) => worker.terminated)).toBe(true);
    stats.reply({ ok: true, result: { statistics: { Credit: { mean: 2.5, std: 1.2909944487358056 } }, sampleCount: 4 } });
    await expect(pending).resolves.toEqual({ statistics: { Credit: { mean: 2.5, std: 1.2909944487358056 } }, sampleCount: 4 });
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

  describe('card save compatibility and asynchronous conflict safety', () => {
    async function create() {
      const event = decodeStandardEvent(events['art-for-whom']);
      const storage = new MemoryStorage();
      storage.setItem('save-data', JSON.stringify({
        exportVersion: 2, characters: [{ retained: true }], groups: { Team: [] }, futureField: { keep: true },
        events_data: { other: { keep: true }, 'art-for-whom': { futureSetting: { keep: true } } }
      }));
      const planner = createEventPlanner(metadata, () => storage);
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        const value = url.includes('event_misc') ? misc : url.includes('misc_data') ? resourceMisc : url.includes('events.json') ? config : students;
        return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
      try { await planner.initialise(); } finally { fetchMock.mockRestore(); }
      expect(planner.select('art-for-whom')).toBe(true);
      if (!event.card_drops) throw new Error('Missing card data.');
      const statistics: CardStatistics = Object.fromEntries([...new Set(event.card_drops.flatMap((draw) => Object.keys(draw.drops)))]
        .map((key) => [key, { mean: 10, std: 2 }]));
      return { planner, storage, event, statistics };
    }
    it('stores original mean/std fields and permits RNG-only changes during a simulation', async () => {
      const { planner, storage, statistics } = await create();
      const plan = get(planner).plan;
      if (!plan) throw new Error('Plan not ready.');
      const inputs = cardInputFingerprint(plan);
      expect(planner.setStandardDeviation(-1)).toBe(true);
      expect(planner.saveCardSimulation(statistics, 2000, { id: 'art-for-whom', inputs })).toBe(true);
      const source = JSON.parse(storage.getItem('save-data')!);
      expect(source.events_data['art-for-whom'].card_pull_rewards).toEqual(statistics);
      expect(source.events_data['art-for-whom'].card_pull_currency_owned).toBe(2000);
      expect(source.events_data['art-for-whom'].standard_deviation).toBe(-1);
      expect(source.events_data['art-for-whom'].futureSetting).toEqual({ keep: true });
      expect(source.events_data.other).toEqual({ keep: true });
      expect(source.characters).toEqual([{ retained: true }]);
      expect(source.futureField).toEqual({ keep: true });
    });
    it('refuses stale, different-event or malformed statistics without overwriting the save', async () => {
      const { planner, storage, statistics } = await create();
      const plan = get(planner).plan;
      if (!plan) throw new Error('Plan not ready.');
      const inputs = cardInputFingerprint(plan);
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect(planner.setEnergy('pyro_refreshes', 3)).toBe(true);
        const before = storage.getItem('save-data');
        expect(planner.saveCardSimulation(statistics, 2000, { id: 'art-for-whom', inputs })).toBe(false);
        expect(storage.getItem('save-data')).toBe(before);
        const next = get(planner).plan;
        if (!next) throw new Error('Plan not ready.');
        expect(planner.saveCardSimulation({ Credit: { mean: 1, std: 1 } }, 2000, { id: 'art-for-whom', inputs: cardInputFingerprint(next) })).toBe(false);
        expect(storage.getItem('save-data')).toBe(before);
        expect(planner.saveCardSimulation(statistics, 2000, { id: 'get-hyped-and-march-on-rerun', inputs: cardInputFingerprint(next) })).toBe(false);
        expect(storage.getItem('save-data')).toBe(before);
      } finally { log.mockRestore(); }
    });
    it('keeps reviewed card and Omikuji archives available', () => {
      const entries = decodeEventCatalog(config, true);
      expect(entries.filter((entry) => entry.event?.card_drops).map((entry) => entry.id)).toEqual(cardEventIds);
      expect(entries.filter((entry) => entry.event?.omikuji).map((entry) => entry.id)).toEqual(omikujiEventIds);
      const event = decodeStandardEvent(events['art-for-whom']);
      expect(() => decodeEventPlan({ card_pull_rewards: { Credit: { mean: '10', std: 1 } } }, event)).toThrow();
      expect(() => decodeEventPlan({ standard_deviation: 2 }, event)).toThrow();
      expect(() => decodeEventPlan({ currency_owned: { Shop_Card: Number.MAX_VALUE } }, event)).toThrow();
    });
  });
  it('cancels statistics work after the pool completes and rejects malformed output', async () => {
    vi.stubGlobal('window', { location: { href: 'https://example.invalid/' } });
    const controller = new AbortController(), worker = new FakeWorker();
    const pending = roundCardStatistics({ Credit: { mean: 1, std: 1 } }, 0, { createWorker: () => worker, signal: controller.signal });
    const rejected = expect(pending).rejects.toHaveProperty('name', 'AbortError');
    controller.abort(); await rejected;
    expect(worker.terminated).toBe(true);
    const invalid = new FakeWorker();
    const bad = roundCardStatistics({ Credit: { mean: 1, std: 1 } }, 0, { createWorker: () => invalid });
    invalid.reply({ ok: true, result: { Wrong: 1 } });
    await expect(bad).rejects.toThrow();
  });
});
