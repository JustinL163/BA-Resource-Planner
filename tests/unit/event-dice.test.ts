import { describe, expect, it, vi, afterEach } from 'vitest';
import { createContext, runInContext } from 'node:vm';
import { get } from 'svelte/store';
import { metadata } from '../../.generated-content/planner';
import { decodeDiceRace, diceRewardNames, diceSimulationRequest, applyDiceRewards } from '../../src/lib/domain/events/dice';
import { decodeEventCatalog, decodeEventPlan, decodeStandardEvent, diceEventIds } from '../../src/lib/domain/events/standard-save';
import { simulationInputFingerprint, adjustedCardAmounts, summarizeCardSamples, type CardMath } from '../../src/lib/domain/events/card-statistics';
import { eventRequirements, summarizeEventRuns } from '../../src/lib/domain/events/standard';
import { eventEngine } from '../../src/lib/domain/events';
import { simulateDice } from '../../src/lib/services/dice-simulation';
import { createEventPlanner } from '../../src/lib/stores/event-planner';
import { isRecord } from '../../src/lib/domain/planner/save';
import { createLegacyContext, evaluate, readJson, readSource, seededRandom } from './legacy-harness';
import type { CardStatistics, EventSummary } from '../../src/lib/domain/events/standard-types';
import type { TaskWorker } from '../../src/lib/services/worker-request';
import type { SimulationWorker } from '../../src/lib/services/simulations/types';

const config = readJson('planner', 'json', 'events.json');
if (!isRecord(config) || !isRecord(config.events)) throw new Error('Invalid dice fixture.');
const events = config.events;
const id = 'occult-research-society';
const raw = events[id];
if (!isRecord(raw)) throw new Error('Missing dice event.');
const race = decodeDiceRace(raw.dice_race);
const event = decodeStandardEvent(raw);
const mathContext = createContext({});
runInContext(readSource('planner', 'packages', 'mathjs', 'math.js'), mathContext);
const math: CardMath = runInContext('math', mathContext);
const students = readJson('planner', 'json', 'skillinfo', 'en.json');
const misc = readJson('planner', 'json', 'event_misc.json');

function empty(): EventSummary {
  return { runs: {}, currencies: {}, artifacts: {}, schoolMats: {}, eleph: {}, xps: {}, gear: {}, credit: 0, eligma: 0, secretTech: 0, energy: 0, feasible: true };
}
function seededWorker(currency: number) {
  const request = diceSimulationRequest(race, currency);
  const controlledMath: Math = Object.create(Math);
  controlledMath.random = seededRandom(163);
  const context = createContext({
    Math: controlledMath, self: { close() {} }, postMessage(samples: unknown) { context.result = samples; },
    message: [request.race, request.targets, 3000, 12, request.currencyOwned, request.tickets]
  });
  runInContext(readSource('planner', 'js', 'diceGachaWorker.js'), context);
  runInContext('onmessage({data:message})', context);
  return context;
}

describe('original dice requests, deterministic simulations and reward mapping', () => {
  it('decodes the race without changing payload shape, ticket setup or empty target arrays', () => {
    expect(race).toEqual(raw.dice_race);
    const request = diceSimulationRequest(race, 0);
    expect(request).toEqual({ kind: 'dice', race, targets: Array.from({ length: 18 }, () => []), currencyOwned: 0, tickets: [1, 1, 1, 1, 1, 1] });
    expect(new Set(request.targets).size).toBe(18);
  });
  it.each([0, 499, 500, 1500, 10000])('pins seeded original worker outcomes for %i roll currency', (currency) => {
    const context = seededWorker(currency);
    const samples: unknown = runInContext('result', context);
    expect(evaluate(context, 'result')).toMatchSnapshot();
    if (!isRecord(samples)) throw new Error('Invalid worker results.');
    expect(Object.keys(samples)).toEqual(diceRewardNames(race));
    const result = summarizeCardSamples(samples, math);
    expect(result.sampleCount).toBe(12);
    expect(Object.values(result.statistics).some((reward) => reward.mean > 0)).toBe(true);
  });
  it.each([-2, -1.5, -1, -0.5, 0, 0.5, 1])('matches the frozen legacy reward summary at %s sigma, including signed outcomes and omissions', (deviation) => {
    const statistics: CardStatistics = Object.fromEntries([...diceRewardNames(race), '10000', '3000', 'Unknown']
      .map((key, index) => [key, { mean: 0.5 + index * 2, std: 1 + index }]));
    const context = createLegacyContext(['config.js'], { event_config: config, current_event: id, diceGachaAvgSD: statistics, setSD: deviation, math });
    runInContext(readSource('tests', 'fixtures', 'dice-rewards.legacy.js'), context);
    const legacy = evaluate(context, `(() => {
      const eleph={},xps={};const [credit,eligma,secretTech,gearBoxes]=AddDiceRewards(eleph,xps);
      return {eleph,xps,credit,eligma,secretTech,gearBoxes};
    })()`);
    const base = empty();
    const modern = applyDiceRewards(base, adjustedCardAmounts(statistics, deviation, math));
    expect({ eleph: modern.eleph, xps: modern.xps, credit: modern.credit, eligma: modern.eligma, secretTech: modern.secretTech, gearBoxes: modern.gearBoxes }).toEqual(legacy);
    expect(modern.artifacts).toEqual({});
    expect(base).toEqual(empty());
    expect(legacy).toMatchSnapshot();
  });
  it.each([-2, 0, 1])('matches complete Manual shop/dice summaries at %s sigma', (deviation) => {
    const plan = decodeEventPlan(undefined, event);
    plan.optimisation_type = 'Manual'; plan.optimisation_options = { '9': 10, '12': 10 };
    const statistics: CardStatistics = Object.fromEntries(diceRewardNames(race).map((key, index) => [key, { mean: 500 + index * 10, std: 2 + index }]));
    const context = createLegacyContext(['config.js', 'common.js', 'eventPlanner.js'], {
      fixture: { config, id, plan, students, misc, statistics, deviation }, BAEventEngine: eventEngine,
      Date: { now: () => event.start_time * 1000 }, math
    });
    runInContext(readSource('tests', 'fixtures', 'event-core.legacy.js'), context);
    runInContext(readSource('tests', 'fixtures', 'dice-rewards.legacy.js'), context);
    runInContext(`
      event_config=fixture.config; current_event=fixture.id; event_data=fixture.plan; events_data={[current_event]:event_data};
      charlist=fixture.students; event_misc=fixture.misc; currencyNeededPre=event_data.currency_needed; enabledBonusUnits=[];
      optimisationType='Manual';midEvent=false;eventLoading=true;displayIncluded={ShopPurchases:true,DiceRewards:true};
      Save=()=>{};ClearRewards=()=>{}; InfeasibleModel=()=>{throw new Error('Fixture infeasible')};
      CalculateBonuses();CalculateInitalClear();CalculateEnergyAvailable();CalculateNeededFinal();
      UpdateRewardsObtained=(currencies,energy,artifacts,schoolMats,eleph,xps,credit,eligma,secretTech,gearBoxes,gear)=>{
        fixture.summary={currencies,energy,artifacts,schoolMats,eleph,xps,credit,eligma,secretTech,gearBoxes,gear};
      };
      displayIncluded.DiceRewards=false;CalculateStageDrops(event_data.optimisation_options,true);
      diceGachaAvgSD=fixture.statistics;setSD=fixture.deviation;displayIncluded.DiceRewards=true;
      CalculateStageDrops(event_data.optimisation_options,true);
    `, context);
    const summary = summarizeEventRuns(event, plan, eventRequirements(event, plan), runInContext('currencyBonuses', context),
      runInContext('energyAvailable', context), plan.optimisation_options, true, false, metadata);
    const modern = applyDiceRewards(summary, adjustedCardAmounts(statistics, deviation, math));
    const { runs, feasible, ...rewards } = modern;
    expect(feasible).toBe(true);
    expect(rewards).toEqual(evaluate(context, 'fixture.summary'));
    expect(runs).toEqual(evaluate(context, 'stage_runs'));
  });
  it('rejects unsafe movement/lap data, unknown types, mixed mechanics and invalid statistic keys explicitly', () => {
    for (const bad of [
      { ...race, roll_cost: 0 },
      { ...race, tiles: race.tiles.slice(0, 17) },
      { ...race, tiles: [{ type: 'Unknown', amount: 1 }, ...race.tiles.slice(1)] },
      { ...race, tiles: race.tiles.map((tile) => tile.type === 'MoveBonus' ? { ...tile, amount: 100 } : tile) },
      { ...race, tiles: [{ type: 'Credit' }, ...race.tiles.slice(1)] },
      { ...race, lap_reward_tiers: [2, 1] }
    ]) expect(() => decodeDiceRace(bad)).toThrow();
    for (const currency of [NaN, Infinity, -1, 200001]) expect(() => diceSimulationRequest(race, currency)).toThrow();
    expect(() => decodeStandardEvent({ ...raw, card_drops: (isRecord(events['art-for-whom']) ? events['art-for-whom'].card_drops : undefined) })).toThrow('Mixed');
    expect(() => decodeEventPlan({ dice_roll_rewards: { Credit: { mean: 1, std: 1 } } }, event)).toThrow('match');
    expect(() => decodeEventPlan({ dice_roll_rewards: { Credit: { mean: 1, std: -1 } } }, event)).toThrow();
    expect(() => decodeStandardEvent({ ...raw, dice_race: { ...race, roll_currency: 'Unknown' } })).toThrow('currency');
  });
  it('accepts plain cross-realm JSON data and keeps the zero GearBox summary scalar', () => {
    const context = createContext({ source: JSON.stringify(race) });
    expect(decodeDiceRace(runInContext('JSON.parse(source)', context))).toEqual(race);
    expect(applyDiceRewards(empty(), { Credit: 0, GearBox: 0 }).gearBoxes).toBe(0);
  });
});

class FakeTask implements TaskWorker {
  onmessage: TaskWorker['onmessage'] = null; onerror: TaskWorker['onerror'] = null; onmessageerror: TaskWorker['onmessageerror'] = null;
  message: unknown; terminated = false;
  postMessage(message: unknown) { this.message = message; }
  terminate() { this.terminated = true; }
  reply(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: value })); }
}
class FakeSimulation implements SimulationWorker {
  onmessage: SimulationWorker['onmessage'] = null; onerror: SimulationWorker['onerror'] = null; onmessageerror: SimulationWorker['onmessageerror'] = null;
  message: readonly unknown[] = []; terminated = false;
  postMessage(message: readonly unknown[]) { this.message = message; }
  terminate() { this.terminated = true; }
  reply(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: value })); }
}
afterEach(() => vi.unstubAllGlobals());

describe('dice service and save compatibility', () => {
  it('uses four original dice workers with unchanged budgets and forwards arrival-order samples to the shared math worker', async () => {
    vi.stubGlobal('window', { location: { href: 'https://example.invalid/planner/event-planner/' } });
    const pool: FakeSimulation[] = [], stats = new FakeTask();
    const pending = simulateDice(race, 0, {
      createSimulationWorker: (url) => { expect(url.pathname).toBe('/planner/js/diceGachaWorker.js'); expect(url.search).toBe('?2'); const worker = new FakeSimulation(); pool.push(worker); return worker; },
      createWorker: () => stats
    });
    expect(pool).toHaveLength(4);
    for (const worker of pool) expect(worker.message.slice(2)).toEqual([3000, 100000, 0, [1, 1, 1, 1, 1, 1]]);
    pool[2].reply({ Credit: [3] }); pool[0].reply({ Credit: [1] }); pool[3].reply({ Credit: [4] }); pool[1].reply({ Credit: [2] });
    await Promise.resolve();
    expect(stats.message).toEqual({ action: 'statistics', samples: { Credit: [3, 1, 4, 2] } });
    stats.reply({ ok: true, result: { statistics: { Credit: { mean: 2.5, std: 1.2909944487358056 } }, sampleCount: 4 } });
    await expect(pending).resolves.toHaveProperty('sampleCount', 4);
    expect(pool.every((worker) => worker.terminated)).toBe(true);
    expect(stats.terminated).toBe(true);
  });
  class MemoryStorage implements Storage {
    entries = new Map<string, string>();
    get length() { return this.entries.size; } clear() { this.entries.clear(); }
    key(index: number) { return [...this.entries.keys()][index] ?? null; }
    removeItem(key: string) { this.entries.delete(key); } getItem(key: string) { return this.entries.get(key) ?? null; }
    setItem(key: string, value: string) { this.entries.set(key, value); }
  }
  async function store() {
    const storage = new MemoryStorage();
    storage.setItem('save-data', JSON.stringify({ exportVersion: 2, characters: [{ keep: true }], groups: { Team: [] },
      events_data: { other: { keep: true }, [id]: { future: { keep: true } } }, futureField: { keep: true } }));
    const planner = createEventPlanner(metadata, () => storage);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => new Response(JSON.stringify(
      String(url).includes('event_misc') ? misc : String(url).includes('misc_data') ? readJson('planner', 'json', 'misc_data.json') :
      String(url).includes('events.json') ? config : students), { status: 200 }));
    try { await planner.initialise(); } finally { fetchMock.mockRestore(); }
    expect(planner.select(id)).toBe(true);
    const statistics: CardStatistics = Object.fromEntries(diceRewardNames(race).map((key) => [key, { mean: 10, std: 2 }]));
    return { planner, storage, statistics };
  }
  it('retains original dice save fields and permits RNG-only edits while rejecting stale farming inputs', async () => {
    const { planner, storage, statistics } = await store();
    const plan = get(planner).plan; if (!plan) throw new Error('Plan missing.');
    const inputs = simulationInputFingerprint(plan);
    expect(planner.setStandardDeviation(-1)).toBe(true);
    expect(planner.saveSimulation('dice', statistics, 5000, { id, inputs })).toBe(true);
    const root = JSON.parse(storage.getItem('save-data')!);
    expect(root.events_data[id].dice_roll_rewards).toEqual(statistics);
    expect(root.events_data[id].dice_roll_currency_owned).toBe(5000);
    expect(root.events_data[id].standard_deviation).toBe(-1);
    expect(root.events_data[id].future).toEqual({ keep: true });
    expect(root.events_data.other).toEqual({ keep: true });
    expect(root.characters).toEqual([{ keep: true }]);
    expect(root.futureField).toEqual({ keep: true });
    expect(planner.setEnergy('pyro_refreshes', 3)).toBe(true);
    const before = storage.getItem('save-data'), log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try { expect(planner.saveSimulation('dice', statistics, 5000, { id, inputs })).toBe(false); expect(storage.getItem('save-data')).toBe(before); }
    finally { log.mockRestore(); }
  });
  it('enables only the reviewed dice race and does not hide invalid card-currency relationships', () => {
    expect(decodeEventCatalog(config, true).filter((entry) => entry.event?.dice_race).map((entry) => entry.id)).toEqual(diceEventIds);
    const card = events['art-for-whom']; if (!isRecord(card) || !isRecord(card.currencies)) throw new Error('Card fixture missing.');
    const currencies = card.currencies;
    expect(() => decodeStandardEvent({ ...card, currencies: { ...currencies, Book_Band: { source: 'CardPull', shortname: 'Book Band', icon: 'Book_Band.png', bonus_units: [], pull_currency: 'Unknown' } } })).toThrow('currency');
  });
});
