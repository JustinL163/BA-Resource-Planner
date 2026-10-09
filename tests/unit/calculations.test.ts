import { beforeEach, describe, expect, it } from 'vitest';
import { runInContext, type Context } from 'node:vm';
import { createLegacyContext, evaluate, readJson, readSource } from './legacy-harness';
import { resourceEngine } from '../../src/lib/domain/resources';
import { eventEngine } from '../../src/lib/domain/events';

const students = readJson('planner', 'json', 'skillinfo', 'en.json');
const misc = readJson('planner', 'json', 'misc_data.json');
const events = readJson('planner', 'json', 'events.json');
let context: Context;

describe('legacy resource calculation baseline', () => {
  beforeEach(() => {
    context = createLegacyContext(['config.js', 'common.js', 'pageLogic.js'], {
      charlist: students,
      BAResourceEngine: resourceEngine,
      fixture: { misc },
      data: { characters: [], server: 'Global' },
      disabledChars: []
    });
    runInContext('misc_data = fixture.misc;', context);
  });

  it('pins complete upgrade dictionaries for representative students', () => {
    expect(evaluate(context, `['10000', '10001', '10002', '10003'].map(id => {
      const info = charlist[id];
      const student = new Student(info);
      Object.assign(student.target, {
        level: 90, star: 5, ex: 5, basic: 10, passive: 10, sub: 10,
        gear1: 10, gear2: 10, gear3: 10, ue: 4, ue_level: 60,
        bond_gear: 2, book_hp: 25, book_atk: 25, book_heal: 25
      });
      return { id, resources: calculateCharResources(student, true) };
    })`)).toMatchSnapshot();
  });

  it('pins an unchanged investment and an already partially upgraded student', () => {
    expect(evaluate(context, `(() => {
      const student = new Student(charlist['10000']);
      student.target = { ...student.current };
      const unchanged = calculateCharResources(student, true);
      Object.assign(student.current, { level: 80, star: 4, ex: 3, basic: 7, gear1: 7, ue: 2, ue_level: 40 });
      student.target = { ...student.current, level: 90, star: 5, ex: 5, basic: 10, gear1: 10, ue: 4, ue_level: 60 };
      student.eleph.owned = 150;
      student.eleph.use_eligma = true;
      return { unchanged, partial: calculateCharResources(student, true) };
    })()`)).toMatchSnapshot();
  });

  it.each([
    [1, 1], [1, 2], [1, 90], [80, 90], [90, 80]
  ])('pins XP and credit costs from level %i to %i', (current, target) => {
    context.fixture = { current, target };
    expect(evaluate(context, `(() => {
      const result = {};
      calcXpCost(fixture.current, fixture.target, result);
      return result;
    })()`)).toMatchSnapshot();
  });

  it.each([
    [0, 1, 20], [20, 1, 20], [21, 1, 20], [100, 1, 20],
    [50, 3, 10], [50, 5, 0], [50, 1, 0]
  ])('pins eligma price tiers for %i eleph at cost %i with %i remaining', (needed, cost, remaining) => {
    context.fixture = { needed, cost, remaining };
    expect(evaluate(context, 'ligma(fixture.needed, fixture.cost, fixture.remaining)')).toMatchSnapshot();
  });

  it('pins aggregation, inventory subtraction, disabled characters and level cap', () => {
    expect(evaluate(context, `(() => {
      data.characters = ['10000', '10001'].map(id => {
        const student = new Student(charlist[id]);
        Object.assign(student.target, { level: 90, ex: 5, gear1: 10 });
        calculateCharResources(student, false);
        return student;
      });
      disabledChars = ['10001'];
      lvlCalcsCap = 80;
      ownedMatDict = { XP_1: 4, XP_2: 2, XP_3: 10, XP_4: 1, GXP_4: 2, '3000': 100, Credit: 500000 };
      updateAggregateCount();
      return { required: requiredMatDict, needed: neededMatDict, leftover: leftoverMatDict };
    })()`)).toMatchSnapshot();
  });

  it.each(['Global', 'JP', 'CN'])('pins gear farming results for %s', (server) => {
    runInContext(readSource('planner', 'packages', 'javascript-lp-solver', 'solver.js'), context);
    context.fixture = { server };
    expect(evaluate(context, `(() => {
      data.server = fixture.server;
      neededMatDict = { T10_Hat: 50, T9_Bag: 100, T8_Watch: 80 };
      SolveGearFarm();
      return { runs: OptimalStageRuns, model: GenerateGearLinearModel(), energy: document.getElementById('gear-farm-energy').innerText };
    })()`)).toMatchSnapshot();
  });
});

describe('legacy event optimisation baseline', () => {
  beforeEach(() => {
    context = createLegacyContext(['config.js', 'common.js', 'eventPlanner.js'], { fixture: { events }, BAEventEngine: eventEngine });
    runInContext(readSource('planner', 'packages', 'javascript-lp-solver', 'solver.js'), context);
    runInContext(`event_config = fixture.events;`, context);
  });

  it.each([
    'art-for-whom', 'occult-research-society', 'magical-girl-trinity'
  ])('pins rounded currency bonuses and the minimum-energy model for %s', (event) => {
    context.fixture = { event };
    expect(evaluate(context, `(() => {
      current_event = fixture.event;
      const info = event_config.events[current_event];
      const currency = Object.keys(info.currencies).find(key => info.currencies[key].source === 'StageDrop');
      currencyBonuses = { [currency]: 0.375 };
      currencyNeeded = { [currency]: 1000 };
      energyAvailable = 2000;
      event_point_target = 0;
      const model = GetStagesLinearModel('Energy_Cost', 'min', false);
      return { model, solution: solver.Solve(model) };
    })()`)).toMatchSnapshot();
  });
});
