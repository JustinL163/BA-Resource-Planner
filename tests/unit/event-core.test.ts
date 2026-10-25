import { describe, expect, it } from 'vitest';
import { runInContext, type Context } from 'node:vm';
import { eventEngine } from '../../src/lib/domain/events';
import { decodeCoreEvent } from '../../src/lib/domain/events/data';
import { isRecord } from '../../src/lib/domain/planner/save';
import type { CoreEvent, EnabledStageGroups, EventEnergySettings, EventModelInputs, EventObjective } from '../../src/lib/domain/events/types';
import { createLegacyContext, evaluate, readJson, readSource } from './legacy-harness';

const definitions: [string, CoreEvent][] = [];
for (const file of ['events.json', 'old_events.json']) {
  const config = readJson('planner', 'json', file);
  if (!isRecord(config) || !isRecord(config.events)) throw new Error('Invalid event fixture.');
  for (const [id, value] of Object.entries(config.events)) definitions.push([id, decodeCoreEvent(value)]);
}
const rawStudents = readJson('planner', 'json', 'skillinfo', 'en.json');
if (!isRecord(rawStudents)) throw new Error('Invalid student fixture.');
const students: Record<string, { SquadType: string }> = {};
for (const [id, student] of Object.entries(rawStudents)) {
  if (!isRecord(student) || typeof student.SquadType !== 'string') throw new Error(`Invalid student ${id}.`);
  students[id] = { SquadType: student.SquadType };
}
const misc = readJson('planner', 'json', 'event_misc.json');
if (!isRecord(misc) || !isRecord(misc.cafe_energy)) throw new Error('Invalid cafe fixture.');
const rates: Record<string, number> = {};
for (const [rank, value] of Object.entries(misc.cafe_energy)) {
  if (typeof value !== 'number') throw new Error('Invalid cafe rate.');
  rates[rank] = value;
}
const referenceSource = readSource('tests', 'fixtures', 'event-core.legacy.js');
const solverSource = readSource('planner', 'packages', 'javascript-lp-solver', 'solver.js');

function reference(id: string, event: CoreEvent): Context {
  const context = createLegacyContext(['config.js', 'common.js'], {
    current_event: id, event_config: { events: { [id]: event } }, charlist: students, enabledBonusUnits: [],
    currencyBonuses: {}, currencyNeeded: {}, energyAvailable: 0, event_point_target: 0, targetedMaterials: {},
    initialClearCost: 0, initialClearRewards: {}, midEvent: false, eventLoading: true,
    event_data: {}, event_misc: { cafe_energy: rates }, cafeDefault: 10,
    stageGroup1: true, stageGroup2: true, stageGroup3: true, resets_left: 0, resets_total: 0
  });
  runInContext(referenceSource, context);
  return context;
}

function inputs(id: string, event: CoreEvent, groups: EnabledStageGroups = [true, true, true]): EventModelInputs {
  return {
    eventId: id,
    bonuses: Object.fromEntries(Object.keys(event.currencies).map((name, index) => [name, [0, 0.375, 0.7000000000000001][index % 3]])),
    needed: Object.fromEntries(Object.keys(event.currencies).map((name, index) => [name, index === 0 ? 0 : 200 + index * 57])),
    energyAvailable: 12000,
    pointTarget: Object.hasOwn(event.currencies, 'Event_Point') ? 1250 : 0,
    enabledGroups: groups,
    upgradeBases: false
  };
}

function setInputs(context: Context, value: EventModelInputs) {
  Object.assign(context, {
    currencyBonuses: value.bonuses, currencyNeeded: value.needed, energyAvailable: value.energyAvailable,
    event_point_target: value.pointTarget,
    stageGroup1: value.enabledGroups[0], stageGroup2: value.enabledGroups[1], stageGroup3: value.enabledGroups[2]
  });
  runInContext(`document.getElementById('upgrade-bases').checked = ${value.upgradeBases};`, context);
}

describe('event core against independent frozen legacy functions', () => {
  it.each(definitions)('preserves initial clear, bonus order, and material options for %s', (id, event) => {
    const context = reference(id, event);
    runInContext('CalculateInitalClear(); CalculateBonuses();', context);
    expect(eventEngine.calculateInitialClear(event)).toEqual(evaluate(context, '({ rewards: initialClearRewards, cost: initialClearCost })'));
    expect(eventEngine.calculateEventBonuses(id, event, [], students)).toEqual(evaluate(context, 'currencyBonuses'));
    const enabled = [...new Set(Object.values(event.currencies).flatMap((currency) => currency.bonus_units.map((unit) => unit.id)))];
    context.enabledBonusUnits = enabled;
    runInContext('CalculateBonuses();', context);
    expect(eventEngine.calculateEventBonuses(id, event, enabled, students)).toEqual(evaluate(context, 'currencyBonuses'));
    expect(eventEngine.materialDropOptions(event)).toEqual(evaluate(context, 'GetMatDropOptions()'));
  });

  it.each(definitions)('preserves AP arithmetic, maintenance, partial days and Owned mode for %s', (id, event) => {
    const context = reference(id, event);
    const cost = eventEngine.calculateInitialClear(event).cost;
    context.initialClearCost = cost;
    for (const settings of [
      {}, { cafe_rank: 1 }, { cafe_rank: 10, pyro_refreshes: 3, pvp_refreshes: 4, energy_pack: true, energy_carryover: 3000 },
      { cafe_rank: null, pyro_refreshes: null, pvp_refreshes: null, energy_carryover: null },
      { cafe_rank: 5, pyro_refreshes: 1.5, pvp_refreshes: 0.5, energy_carryover: 123.5 }
    ] satisfies EventEnergySettings[]) {
      for (const [midEvent, nowMs] of [
        [false, event.start_time * 1000],
        [true, (event.reset_time + 86400 * 2 + 3600) * 1000],
        [true, (event.reset_time - 86400 * 2) * 1000],
        [true, (event.end_time - 3600) * 1000]
      ] as const) {
        Object.assign(context, { midEvent, event_data: settings, Date: { now: () => nowMs } });
        let expected: unknown;
        try {
          runInContext('CalculateEnergyAvailable()', context);
          expected = evaluate(context, `({
            sources: {
              natural: document.getElementById('energy-natural-total').innerText,
              cafe: document.getElementById('energy-cafe-total').innerText,
              daily: document.getElementById('energy-dailytask-total').innerText,
              club: document.getElementById('energy-club-total').innerText,
              pyro: document.getElementById('energy-pyro-total').innerText,
              pvp: document.getElementById('energy-arenacoin-total').innerText,
              pack: document.getElementById('energy-energypack-total').innerText,
              carryover: document.getElementById('energy-carryover-total').innerText,
              weekly: document.getElementById('energy-weeklytask-total').innerText,
              arona: document.getElementById('energy-aronalogin-total').innerText
            },
            total: document.getElementById('energy-total').innerText,
            available: energyAvailable, resetsLeft: resets_left, resetsTotal: resets_total
          })`);
        } catch (problem) {
          expect(String(problem)).toContain('Reduce of empty array');
          expect(() => eventEngine.calculateEventEnergy(id, event, settings, rates, midEvent, cost, nowMs)).toThrow();
          continue;
        }
        expect(eventEngine.calculateEventEnergy(id, event, settings, rates, midEvent, cost, nowMs)).toEqual(expected);
      }
    }
  });

  it.each(definitions)('preserves every group mask, objective and bundled LP result for %s', (id, event) => {
    const context = reference(id, event);
    runInContext(solverSource, context);
    const materials = eventEngine.materialDropOptions(event);
    const targets = Object.fromEntries(materials.map((material, index) => [material, index % 2 === 0]));
    for (let mask = 0; mask < 8; mask++) {
      const settings = inputs(id, event, [Boolean(mask & 1), Boolean(mask & 2), Boolean(mask & 4)]);
      setInputs(context, settings);
      const before = structuredClone({ event, settings, targets });
      expect(eventEngine.buildStageVariables(event, settings.bonuses, settings.enabledGroups))
        .toEqual(evaluate(context, 'GetStagesLinearModelVariables()'));
      const objectives: [EventObjective, 'min' | 'max' | '', boolean][] = [
        ['Energy_Cost', 'min', false],
        [Object.keys(event.currencies)[0], 'max', true],
        ['Event_Point', 'max', true],
        [{ [materials[0]]: 'max' }, '', true]
      ];
      for (const [objective, opType, constrained] of objectives) {
        Object.assign(context, { objective, opType, constrained });
        const old = evaluate(context, 'GetStagesLinearModel(objective, opType, constrained)');
        const modern = eventEngine.buildStageModel(event, settings, objective, opType, constrained);
        expect(modern).toEqual(old);
        expect(Object.keys(modern)).toEqual(runInContext('Object.keys(GetStagesLinearModel(objective, opType, constrained))', context));
        if (mask === 7) {
          context.modern = modern;
          expect(evaluate(context, 'solver.Solve(modern)')).toEqual(evaluate(context, 'solver.Solve(GetStagesLinearModel(objective, opType, constrained))'));
        }
      }
      context.targetedMaterials = targets;
      expect(eventEngine.buildMaterialTargetModel(event, settings, targets)).toEqual(evaluate(context, 'GetStagesMaterialsTargetModel()'));
      expect({ event, settings, targets }).toEqual(before);
    }
  }, 30_000);
});

describe('event core boundaries and compatibility quirks', () => {
  const event = definitions.find(([id]) => id === 'lore-pursuit-s2')?.[1];
  if (!event) throw new Error('Missing current event.');

  it('keeps empty disabled variables and rounds at five decimal places before ceil', () => {
    const synthetic: CoreEvent = {
      ...event, currencies: { Coin: { source: 'StageDrop', bonus_units: [] } },
      stages: [
        { type: 'Quest', number: 1, group: 1, cost: 10, drops: { Coin: 10, Artifact: 0.125 } },
        { type: 'Quest', number: 2, group: 2, cost: 15, drops: { Coin: 7 } },
        { type: 'Quest', number: 3, group: 1.5, cost: 20, drops: { Coin: 3 } }
      ]
    };
    expect(eventEngine.buildStageVariables(synthetic, { Coin: 1e-8 }, [false, true, true])).toEqual({
      1: {}, 2: { Coin: 7, Energy_Cost: 15 }, 3: { Coin: 3, Energy_Cost: 20 }
    });
    expect(eventEngine.buildStageVariables(synthetic, { Coin: 0.00001 }, [true, true, true])[1])
      .toEqual({ Coin: 11, Artifact: 0.125, Energy_Cost: 10 });
  });

  it('uses original bonus-unit order instead of silently preferring higher bonuses', () => {
    const synthetic: CoreEvent = {
      ...event, currencies: { Coin: { source: 'StageDrop', bonus_units: [
        ...[1, 2, 3, 4].map((id) => ({ id: String(id), bonus: 0.1 })),
        { id: '5', bonus: 0.5 }, { id: '6', bonus: 0.1 }, { id: '7', bonus: 0.1 }, { id: '8', bonus: 0.5 }
      ] } }
    };
    const bonusStudents = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((id) => [String(id), { SquadType: id < 6 ? 'Main' : 'Support' }]));
    const enabled = Object.keys(bonusStudents);
    const context = reference('test', synthetic);
    Object.assign(context, { charlist: bonusStudents, enabledBonusUnits: enabled });
    runInContext('CalculateBonuses()', context);
    expect(eventEngine.calculateEventBonuses('test', synthetic, enabled, bonusStudents)).toEqual(evaluate(context, 'currencyBonuses'));
    expect(eventEngine.calculateEventBonuses('test', synthetic, enabled, bonusStudents).Coin).toBeLessThan(0.7);
  });

  it('retains Momoyodou base-upgrade constraints and reserved AP', () => {
    const synthetic: CoreEvent = {
      ...event, currencies: Object.fromEntries(['Momoyodou_Glitter_Coin', 'Turban_Shell', 'Summer_Ninjutsu_Instructions_Scroll']
        .map((name) => [name, { source: 'StageDrop', bonus_units: [] }]))
    };
    const settings = { ...inputs('momoyodou-beach-house', synthetic), upgradeBases: true };
    const context = reference('momoyodou-beach-house', synthetic);
    setInputs(context, settings);
    expect(eventEngine.buildStageModel(synthetic, settings, 'Energy_Cost', 'min', false)).toEqual(evaluate(context, 'GetStagesLinearModel("Energy_Cost", "min", false)'));
    const normal = eventEngine.calculateEventEnergy('normal', event, {}, rates, false, 50, event.start_time * 1000);
    const special = eventEngine.calculateEventEnergy('momoyodou-beach-house', event, {}, rates, false, 50, event.start_time * 1000);
    expect(special.available).toBe(normal.available - 800);
  });

  it('does not silently invent AP when no resets remain', () => {
    const context = reference('ended', event);
    Object.assign(context, { midEvent: true, Date: { now: () => (event.end_time + 86400) * 1000 } });
    expect(() => runInContext('CalculateEnergyAvailable()', context)).toThrow();
    expect(() => eventEngine.calculateEventEnergy('ended', event, {}, rates, true, 0, (event.end_time + 86400) * 1000)).toThrow();
  });

  it('ignores legacy inactive point targets and irrelevant non-stage currency requirements', () => {
    const synthetic: CoreEvent = {
      ...event, currencies: {
        Coin: { source: 'StageDrop', bonus_units: [] },
        Ticket: { source: 'CardPull', bonus_units: [] }
      }
    };
    const settings = { ...inputs('test', synthetic), pointTarget: NaN, needed: { Coin: 125, Ticket: NaN, Unknown: NaN } };
    const context = reference('test', synthetic);
    setInputs(context, settings);
    expect(eventEngine.buildStageModel(synthetic, settings, 'Energy_Cost', 'min')).toEqual(evaluate(context, 'GetStagesLinearModel("Energy_Cost", "min", false)'));
    expect(eventEngine.buildStageModel(synthetic, settings, 'Energy_Cost', 'min').constraints).toEqual({ Coin: { min: 125 } });
  });

  it('rejects invalid costs, bonus IDs, settings, coefficients and data explicitly', () => {
    expect(() => eventEngine.calculateInitialClear({ ...event, stages: [{ type: 'Story', cost: Infinity }] })).toThrow();
    expect(() => eventEngine.calculateEventBonuses('test', event,
      Object.values(event.currencies)[0].bonus_units.map((unit) => unit.id), {})).toThrow('missing');
    expect(() => eventEngine.calculateEventEnergy('test', event, { cafe_rank: 999 }, rates, false, 0, 0)).toThrow('cafe');
    expect(() => eventEngine.buildStageVariables({ ...event, stages: [{ type: 'Quest', cost: 10 }] }, {}, [true, true, true])).toThrow();
    expect(() => eventEngine.buildStageModel(event, { ...inputs('test', event), energyAvailable: NaN }, 'Energy_Cost', 'min')).toThrow();
    expect(() => decodeCoreEvent({ ...event, currencies: { Broken: {} } })).toThrow();
    expect(() => decodeCoreEvent({ ...event, stages: [{ type: 'Story', cost: '10' }] })).toThrow();
  });
});
