import { describe, expect, it } from 'vitest';
import { runInContext } from 'node:vm';
import { buildGearModel, farmServer, farmServers, gearResult, leftoverBlueprintXp } from '../../src/lib/domain/planner/gear-farm';
import { metadata } from '../../.generated-content/planner';
import misc from '../../planner/json/misc_data.json';
import type { Resources } from '../../src/lib/domain/resources/types';
import { createLegacyContext, evaluate, readSource } from './legacy-harness';

describe('gear farming parity', () => {
  const requirements: Resources[] = [
    { T10_Hat: 50, T9_Bag: 100, T8_Watch: 80 },
    { T2_Gloves: 500, T5_Hairpin: 23, T7_Necklace: 81 },
    {}
  ];
  it.each(farmServers)('preserves the %s model, rounded runs and AP for every campaign multiplier', (server) => {
    for (const multiplier of [1, 2, 3]) {
      for (const needed of requirements) {
        const reference = createLegacyContext(['config.js', 'common.js', 'pageLogic.js'], {
          fixture: { misc, multiplier, needed }, data: { server }
        });
        runInContext(readSource('tests', 'fixtures', 'gear-farming.legacy.js'), reference);
        runInContext(readSource('planner', 'packages', 'javascript-lp-solver', 'solver.js'), reference);
        runInContext('misc_data = fixture.misc; campaignMultiplier = fixture.multiplier; neededMatDict = fixture.needed; SolveGearFarm();', reference);
        const { model, unavailable } = buildGearModel(misc, needed, server, multiplier, metadata.worldCaps);
        expect(model).toEqual(evaluate(reference, 'GenerateGearLinearModel()'));
        reference.model = model;
        const result = gearResult(runInContext('solver.Solve(model)', reference), unavailable);
        expect(result.runs).toEqual(evaluate(reference, 'OptimalStageRuns'));
        expect(result.energy).toBe(Number(String(runInContext('document.getElementById("gear-farm-energy").innerText', reference)).replaceAll(',', '')));
      }
    }
  });

  it('reports requirements unavailable on the chosen server instead of claiming they are met', () => {
    const { unavailable } = buildGearModel(misc, { T10_Hat: 50 }, 'CN', 1, metadata.worldCaps);
    expect(unavailable).toContain('T10_Hat');
  });

  it('preserves leftover blueprint XP', () => {
    const leftover = { T2_Hat: 5, T3_Gloves: 10, T10_Watch: 12, Credit: 1000 };
    const reference = createLegacyContext(['config.js', 'pageLogic.js'], { fixture: { leftover, misc } });
    runInContext(readSource('tests', 'fixtures', 'gear-farming.legacy.js'), reference);
    runInContext('leftoverMatDict = fixture.leftover; misc_data = fixture.misc;', reference);
    expect(leftoverBlueprintXp(leftover, misc, metadata.equipment)).toBe(runInContext('CalculateLeftoverGearXp()', reference));
  });

  it('validates settings and infeasible/invalid solver responses explicitly', () => {
    expect(farmServer(undefined)).toBe('Global');
    expect(() => farmServer('unknown')).toThrow('Choose Global');
    expect(() => buildGearModel(misc, {}, 'Global', 0, metadata.worldCaps)).toThrow('Invalid farming');
    expect(() => gearResult({ feasible: false, bounded: true, result: 0 }, [])).toThrow('no feasible');
    expect(() => gearResult({ feasible: true, bounded: true, result: 1, '4-1': NaN }, [])).toThrow('invalid stage');
  });
});
