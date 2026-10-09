import { describe, expect, it } from 'vitest';
import { runInContext } from 'node:vm';
import { metadata } from '../../.generated-content/planner';
import { boxesNeeded, boxPullCurrencyNeeded, boxCurrencyObtained, boxRewards } from '../../src/lib/domain/events/boxes';
import { boxEventIds, decodeEventCatalog, decodeStandardEvent, decodeEventPlan } from '../../src/lib/domain/events/standard-save';
import { eventRequirements, summarizeEventRuns } from '../../src/lib/domain/events/standard';
import { eventEngine } from '../../src/lib/domain/events';
import type { BoxEvent, EventPlan } from '../../src/lib/domain/events/standard-types';
import type { EventAmounts } from '../../src/lib/domain/events/types';
import { isRecord } from '../../src/lib/domain/planner/save';
import { createLegacyContext, evaluate, readJson, readSource } from './legacy-harness';

const config = readJson('planner', 'json', 'events.json');
if (!isRecord(config) || !isRecord(config.events)) throw new Error('Invalid box event fixture.');
const events = config.events;
const students = readJson('planner', 'json', 'skillinfo', 'en.json');
const misc = readJson('planner', 'json', 'event_misc.json');

function definition(id: string) {
  const event = decodeStandardEvent(events[id]);
  if (!event.boxes || event.box_clear_cost === undefined) throw new Error('Missing box definition.');
  return { event, boxes: { boxes: event.boxes, box_clear_cost: event.box_clear_cost } };
}

function boxReference(id: string, boxes: BoxEvent) {
  const context = createLegacyContext(['config.js'], {
    current_event: id, event_config: { events: { [id]: boxes } }
  });
  runInContext(readSource('tests', 'fixtures', 'boxes.legacy.js'), context);
  return context;
}

describe('box-cycle formulas against frozen legacy reference', () => {
  for (const id of boxEventIds) {
    const { boxes } = definition(id);
    it(`${id} keeps every currency target and partial box boundary`, () => {
      const context = boxReference(id, boxes);
      for (const target of [0, 0.1, 10, 20, 30, 119, 120, 121, 159, 160, 161, 180, 200, 1000]) {
        context.target = target;
        expect(boxesNeeded(boxes, target)).toBe(runInContext('CalculateBoxesNeeded(target)', context));
        expect(boxPullCurrencyNeeded(boxes, target)).toBe(runInContext('CalculateBoxCurrencyNeeded(target)', context));
      }
      for (const pull of [0, 1, 1791, 1799.99, 1800, 1801, 3599, 10800, 14399, 14400, 16200, 18000, 90000]) {
        context.pull = pull;
        expect(boxCurrencyObtained(boxes, pull)).toBe(runInContext('CalculateBoxDropCurrencyFromBoxCurrency(pull)', context));
        const modern = boxRewards(boxes, pull, metadata.materialNames);
        const legacy = evaluate(context, `(() => {
          const artifacts={},schoolMats={},eleph={},xps={};
          const result = AddBoxRewards(pull,artifacts,schoolMats,eleph,xps) ?? [0,0,0,0,''];
          return { artifacts,schoolMats,eleph,xps,credit:result[0],eligma:result[1],secretTech:result[2],currency:result[3],currencyName:result[4] };
        })()`);
        const { clears, leftoverPercent, ...rewards } = modern;
        expect(rewards, `${id} pull ${pull}`).toEqual(legacy);
        expect(clears).toBe(Math.floor(pull / boxes.box_clear_cost));
        expect(leftoverPercent).toBe(((pull - clears * boxes.box_clear_cost) / boxes.box_clear_cost * 100).toFixed(0));
      }
    });
    it(`${id} preserves completed-cycle reward snapshots`, () => {
      const context = boxReference(id, boxes);
      expect(evaluate(context, `(() => {
        const artifacts={},schoolMats={},eleph={},xps={};
        const result=AddBoxRewards(18000,artifacts,schoolMats,eleph,xps);
        return {artifacts,schoolMats,eleph,xps,result};
      })()`)).toMatchSnapshot();
    });
  }

  it('preserves reward classification quirks and zero keys while omitting partial box rewards', () => {
    const boxes: BoxEvent = {
      box_clear_cost: 100,
      boxes: [{ cycle: ['1'], rewards: [
        { id: 'Coin', type: 'EventCurrency', amount: 3, count: 2 },
        { id: 'XP_1', type: 'XpReport', amount: 50, count: 2 },
        { id: 'GXP_2', type: 'XpOrb', amount: 0, count: 0 },
        { id: '100', type: 'Material', amount: 50, count: 3 },
        { id: '3000', type: 'Material', amount: 50, count: 0 },
        { id: '10000', type: 'Eleph', amount: 5, count: 2 },
        { id: 'Credit', type: 'Credit', amount: 1000, count: 2 },
        { id: 'Eligma', type: 'Eligma', amount: 50, count: 3 },
        { id: 'SecretTech', type: 'SecretTech', amount: 50, count: 1 },
        { id: 'Pyroxene', type: 'Pyroxene', amount: 100, count: 9 }
      ] }]
    };
    const result = boxRewards(boxes, 199.99, { '100': 'Artifact', '3000': 'School' });
    expect(result).toEqual({
      clears: 1, leftoverPercent: '100', artifacts: { Artifact: 3 }, schoolMats: { School: 0 },
      xps: { XP_1: 2, GXP_2: 0 }, eleph: { '10000': 10 }, credit: 2000, eligma: 3, secretTech: 1, currency: 6, currencyName: 'Coin'
    });
  });

  it('handles a large repeating tail without simulating each box', () => {
    const { boxes } = definition('moonlight-dream');
    const started = performance.now();
    expect(boxesNeeded(boxes, 1_000_000_000)).toBe(99_999_992);
    expect(boxCurrencyObtained(boxes, 1_000_000_000 * 1800)).toBe(10_000_000_080);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('uses the legacy unique-label repeat mapping and last assignment for duplicate labels', () => {
    const boxes: BoxEvent = {
      box_clear_cost: 100,
      boxes: [
        { cycle: ['1', '3'], rewards: [{ id: 'Coin', type: 'EventCurrency', amount: 10, count: 1 }] },
        { cycle: ['2', '2'], rewards: [{ id: 'Coin', type: 'EventCurrency', amount: 100, count: 1 }] }
      ]
    };
    const reference = boxReference('synthetic', boxes);
    for (const target of [1, 10, 11, 111, 121, 500]) {
      reference.target = target;
      expect(boxesNeeded(boxes, target)).toBe(runInContext('CalculateBoxesNeeded(target)', reference));
    }
    expect(boxCurrencyObtained(boxes, 1000)).toBe(190);
  });

  it('rejects invalid and unreachable inputs instead of looping or returning a fabricated result', () => {
    const { boxes } = definition('moonlight-dream');
    for (const value of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => boxesNeeded(boxes, value)).toThrow();
      expect(() => boxRewards(boxes, value, metadata.materialNames)).toThrow();
    }
    expect(() => boxesNeeded({ ...boxes, box_clear_cost: 0 }, 100)).toThrow();
    expect(() => boxesNeeded({ box_clear_cost: 100, boxes: [{ cycle: ['1'], rewards: [] }] }, 1)).toThrow();
    expect(() => boxesNeeded({ box_clear_cost: 100, boxes: [{ cycle: ['2'], rewards: [] }] }, 1)).toThrow();
    expect(() => boxRewards(boxes, 1800, {})).toThrow('material');
  });
});

function fullReference(id: string, plan: EventPlan, includeBoxes: boolean, includeShop: boolean, mode: 'Manual' | 'Shop' | 'Currency' | 'Materials') {
  const { event } = definition(id);
  const context = createLegacyContext(['config.js', 'common.js', 'eventPlanner.js'], {
    fixture: { config, students, misc, id, plan, includeBoxes, includeShop },
    BAEventEngine: eventEngine,
    Date: { now: () => (event.reset_time + 3 * 86400 + 3600) * 1000 }
  });
  runInContext(readSource('tests', 'fixtures', 'event-core.legacy.js'), context);
  runInContext(readSource('tests', 'fixtures', 'boxes.legacy.js'), context);
  runInContext(`
    event_config=fixture.config; charlist=fixture.students; event_misc=fixture.misc; current_event=fixture.id; event_data=fixture.plan;
    enabledBonusUnits=event_data.enabled_bonus_units; currencyNeededPre=event_data.currency_needed; optimisationType=event_data.optimisation_type;
    stageGroup1=true;stageGroup2=true;stageGroup3=true; eventLoading=true;
    midEvent=Object.values(event_data.currency_owned).some(v=>parseInt(v)>0);
    displayIncluded={BoxRewards:fixture.includeBoxes,ShopPurchases:fixture.includeShop};
    Save=()=>{}; ClearRewards=()=>{}; GenerateStagesTable=()=>{};
    CalculateBonuses();CalculateInitalClear();CalculateEnergyAvailable();CalculateNeededFinal();
    fixture.requirements={needed:currencyNeeded,pointTarget:event_point_target,midEvent,initial:{cost:initialClearCost,rewards:initialClearRewards}};
    UpdateRewardsObtained=(currencies,energy,artifacts,schoolMats,eleph,xps,credit,eligma,secretTech,gearBoxes,gear)=>{
      fixture.summary={currencies,energy,artifacts,schoolMats,eleph,xps,credit,eligma,secretTech,gear};
    };
    InfeasibleModel=()=>{fixture.infeasible=true};
  `, context);
  if (mode === 'Manual') runInContext('fixture.solution=event_data.optimisation_options', context);
  else {
    runInContext(readSource('planner', 'packages', 'javascript-lp-solver', 'solver.js'), context);
    runInContext(`targetedMaterials=optimisationType==='Materials'?event_data.optimisation_options:{};
      fixture.solution=solver.Solve(optimisationType==='Shop'?GetStagesLinearModel('Energy_Cost','min',false):
      optimisationType==='Materials'?GetStagesMaterialsTargetModel():GetStagesLinearModel(event_data.optimisation_options,'max',true));`, context);
  }
  const solution: unknown = runInContext('fixture.solution', context);
  runInContext("CalculateStageDrops(fixture.solution,optimisationType==='Manual')", context);
  return { context, solution, requirements: runInContext('fixture.requirements', context), summary: evaluate(context, 'fixture.summary ?? null'),
    runs: evaluate(context, 'stage_runs'), infeasible: runInContext('fixture.infeasible===true', context),
    bonuses: runInContext('currencyBonuses', context), energy: runInContext('energyAvailable', context) };
}

describe('complete box event requirements, models and reward parity', () => {
  for (const id of boxEventIds) {
    const { event } = definition(id);
    it.each([false, true])(`${id} keeps legacy Owned/first-clear requirement conversion owned=%s`, (owned) => {
      const plan = decodeEventPlan(undefined, event);
      const currency = Object.keys(event.currencies).find((key) => event.currencies[key].source === 'BoxPull');
      if (!currency) throw new Error('Missing BoxPull currency.');
      if (owned) plan.currency_owned = { [currency]: '15', [event.currencies[currency].pull_currency ?? '']: '1000' };
      plan.optimisation_type = 'Manual'; plan.optimisation_options = { '12': 10 };
      const reference = fullReference(id, plan, false, false, 'Manual');
      expect(eventRequirements(event, plan)).toEqual(reference.requirements);
    });
    for (const owned of [false, true]) for (const includeBoxes of [false, true]) for (const includeShop of [false, true]) {
      it(`${id} complete rewards owned=${owned} boxes=${includeBoxes} shop=${includeShop}`, () => {
        const plan = decodeEventPlan(undefined, event);
        plan.optimisation_type = 'Manual'; plan.optimisation_options = { '9': 40, '12': 100 };
        const pull = Object.values(event.currencies).find((currency) => currency.source === 'BoxPull')?.pull_currency;
        if (!pull) throw new Error('Missing draw currency.');
        if (owned) plan.currency_owned = { [pull]: '18000' };
        const reference = fullReference(id, plan, includeBoxes, includeShop, 'Manual');
        const summary = summarizeEventRuns(event, plan, eventRequirements(event, plan), reference.bonuses, reference.energy, reference.solution, includeShop, false, metadata, includeBoxes);
        const { runs, feasible, boxes, ...rewards } = summary;
        expect(feasible).toBe(!reference.infeasible);
        if (feasible) { expect(rewards).toEqual(reference.summary); expect(runs).toEqual(reference.runs); }
        expect(Boolean(boxes)).toBe(includeBoxes);
      });
    }
    it.each(['Shop', 'Currency', 'Materials'] as const)(`${id} worker optimization input/result parity for %s`, (mode) => {
      const plan = decodeEventPlan(undefined, event);
      plan.optimisation_type = mode;
      plan.pyro_refreshes = 20; plan.pvp_refreshes = 4; plan.energy_pack = true; plan.energy_carryover = 3000;
      plan.enabled_bonus_units = [...new Set(Object.values(event.currencies).flatMap((currency) => currency.bonus_units.map((unit) => unit.id)))];
      if (mode === 'Currency') plan.optimisation_options = event.currency_targets[0];
      if (mode === 'Materials') {
        const material = eventEngine.materialDropOptions(event).find((key) => Object.values(metadata.materialNames).includes(key));
        if (!material) throw new Error('Missing target material.');
        plan.optimisation_options = { [material]: true };
      }
      const reference = fullReference(id, plan, true, true, mode);
      const summary = summarizeEventRuns(event, plan, eventRequirements(event, plan), reference.bonuses, reference.energy, reference.solution, true, false, metadata, true);
      const { runs, feasible, boxes, ...rewards } = summary;
      expect(feasible).toBe(!reference.infeasible);
      if (feasible) { expect(rewards).toEqual(reference.summary); expect(runs).toEqual(reference.runs); }
      expect(boxes).toBeDefined();
    });
  }
  it('enables reviewed box/card/Omikuji events while validating cycles and rejecting mixed mechanics', () => {
    const entries = decodeEventCatalog({ ...config, event_order: [...boxEventIds, 'art-for-whom', 'magical-girl-trinity'] });
    expect(entries.map((entry) => Boolean(entry.event))).toEqual([true, true, true, true, true, true, true]);
    const raw = events['moonlight-dream'];
    if (!isRecord(raw)) throw new Error('Invalid fixture.');
    expect(() => decodeStandardEvent({ ...raw, box_clear_cost: 0 })).toThrow();
    const omikuji = events['magical-girl-trinity'];
    if (!isRecord(omikuji)) throw new Error('Missing Omikuji fixture.');
    expect(() => decodeStandardEvent({ ...raw, omikuji: omikuji.omikuji })).toThrow('Mixed gacha mechanics');
    expect(() => decodeStandardEvent({ ...raw, boxes: [] })).toThrow();
    const archives = decodeEventCatalog(config, true);
    expect(archives.filter((entry) => entry.archived && entry.event?.boxes).map((entry) => entry.id)).toEqual(boxEventIds);
  });
});
