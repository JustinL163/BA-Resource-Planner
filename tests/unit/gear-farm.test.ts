import { describe, expect, it } from 'vitest';
import { createContext, runInContext } from 'node:vm';
import { buildGearModel, decodeGearFarmPlan, farmServer, farmServers, farmedGeneralConversions, gearResult, leftoverBlueprintXp, optimiseGearFarm,
  type GearFarmData, type GearFarmPlan, type GearSolver } from '../../src/lib/domain/planner/gear-farm';
import { metadata } from '../../.generated-content/planner';
import misc from '../../planner/json/misc_data.json';
import type { Resources } from '../../src/lib/domain/resources/types';
import { createLegacyContext, evaluate, readSource } from './legacy-harness';

const legacyMisc: GearFarmData = { ...misc, universal_bp_cost: undefined,
  gear_rates: Object.fromEntries(Object.entries(misc.gear_rates).map(([area, rows]) => [area, rows.filter((row) => row.Tier !== 'general')])) };

function solver(): GearSolver {
  const context = createContext({ self: {} });
  runInContext(readSource('planner', 'packages', 'javascript-lp-solver', 'solver.js'), context);
  return { Solve(model) { context.model = model; return runInContext('self.solver.Solve(model)', context); } };
}

function plan(needed: Resources, owned: Resources = {}, server: 'Global' | 'JP' | 'CN' = 'Global', multiplier = 1, data: GearFarmData = misc) {
  return optimiseGearFarm({ data, needed, owned, server, multiplier, caps: metadata.worldCaps }, solver());
}

function expectCovered(result: GearFarmPlan, needed: Resources, owned: Resources, server: 'Global' | 'JP' | 'CN' = 'Global', multiplier = 1) {
  const drops: Resources = {};
  const data: GearFarmData = misc;
  for (const { stage, runs } of result.runs) {
    for (const entry of data.gear_rates[stage.split('-')[0]]) {
      const rates = server === 'CN' && entry.OldRates ? entry.OldRates : entry.Rates;
      data.gear_drops[stage].forEach((type, index) => {
        const key = entry.Tier === 'general' ? `G_${type}` : `T${entry.Tier}_${type}`;
        drops[key] = (drops[key] ?? 0) + runs * rates[index] * multiplier;
      });
    }
  }
  const spent: Resources = {};
  for (const [key, amount] of Object.entries(needed)) {
    if (result.unavailable.includes(key)) continue;
    const [tier, type] = key.split('_');
    const conversions = result.generalConversions[key] ?? 0;
    const choice = result.allocation.choiceUsedByGear[key] ?? 0;
    expect(Number.isInteger(conversions)).toBe(true);
    expect(Number.isInteger(choice)).toBe(true);
    expect((drops[key] ?? 0) + conversions + choice + 1e-6).toBeGreaterThanOrEqual(amount);
    const cost = data.universal_bp_cost?.[tier] ?? 0;
    spent[`G_${type}`] = (spent[`G_${type}`] ?? 0) + conversions * cost;
    spent[`Choice_${tier}`] = (spent[`Choice_${tier}`] ?? 0) + choice;
    expect(result.allocation.remainingByGear[key]).toBe(amount - choice - (result.allocation.generalUsedByGear[key] ?? 0) / (cost || 1));
  }
  for (const [key, amount] of Object.entries(spent)) expect(amount).toBeLessThanOrEqual((owned[key] ?? 0) + (drops[key] ?? 0) + 1e-6);
  for (const [key, amount] of Object.entries(result.allocation.specialLeftover)) {
    expect(amount).toBeGreaterThanOrEqual(0);
    const used = Object.entries(key.startsWith('G_') ? result.allocation.generalUsedByGear : result.allocation.choiceUsedByGear)
      .filter(([gear]) => key.startsWith('G_') ? gear.endsWith(`_${key.slice(2)}`) : gear.startsWith(`${key.slice('Choice_'.length)}_`))
      .reduce((sum, [, count]) => sum + count, 0);
    expect(amount + used).toBe(owned[key] ?? 0);
  }
  const farmedUsed: Resources = {};
  const remaindersUsed: Resources = {};
  for (const conversion of farmedGeneralConversions(result, data)) {
    const cost = data.universal_bp_cost![conversion.gear.split('_')[0]];
    expect(conversion.blueprints + (result.allocation.generalUsedByGear[conversion.gear] ?? 0) / cost).toBe(result.generalConversions[conversion.gear]);
    expect(conversion.farmed).toBeGreaterThan(0);
    expect(Number.isSafeInteger(conversion.farmed)).toBe(true);
    expect(conversion.farmed + conversion.owned).toBe(conversion.blueprints * cost);
    farmedUsed[conversion.general] = (farmedUsed[conversion.general] ?? 0) + conversion.farmed;
    remaindersUsed[conversion.general] = (remaindersUsed[conversion.general] ?? 0) + conversion.owned;
  }
  for (const [key, amount] of Object.entries(farmedUsed)) expect(amount).toBeLessThanOrEqual(Math.floor((drops[key] ?? 0) + 1e-6));
  for (const [key, amount] of Object.entries(remaindersUsed)) expect(amount).toBeLessThanOrEqual(result.allocation.specialLeftover[key] ?? 0);
  expect(decodeGearFarmPlan(result)).toEqual(result);
}

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
          fixture: { misc: legacyMisc, multiplier, needed }, data: { server }
        });
        runInContext(readSource('tests', 'fixtures', 'gear-farming.legacy.js'), reference);
        runInContext(readSource('planner', 'packages', 'javascript-lp-solver', 'solver.js'), reference);
        runInContext('misc_data = fixture.misc; campaignMultiplier = fixture.multiplier; neededMatDict = fixture.needed; SolveGearFarm();', reference);
        const { model, unavailable } = buildGearModel(legacyMisc, needed, server, multiplier, metadata.worldCaps);
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

describe('joint gear blueprint allocation', () => {
  it('farms high-area General drops to cover a lower tier without counting future drops as already owned', () => {
    const needed = { T2_Hat: 100 };
    const result = plan(needed);
    expect(result.energy).toBe(140);
    expect(result.runs).toEqual([{ stage: '28-1', runs: 14 }]);
    expect(result.allocation.remainingByGear).toEqual(needed);
    expect(result.allocation.generalUsedByGear).toEqual({});
    expect(farmedGeneralConversions(result, misc)).toEqual([
      { gear: 'T2_Hat', general: 'G_Hat', blueprints: 100, farmed: 200, owned: 0 }
    ]);
    expectCovered(result, needed, {});
  });

  it('allocates owned Choice and General stock jointly instead of spending General on a tier Choice can cover', () => {
    const needed = { T2_Hat: 100, T10_Hat: 100 };
    const owned = { G_Hat: 200, Choice_T2: 100 };
    const result = plan(needed, owned);
    expect(result.energy).toBe(1500);
    expect(result.allocation.choiceUsedByGear).toEqual({ T2_Hat: 100 });
    expect(result.allocation.generalUsedByGear).toEqual({ T10_Hat: 200 });
    expect(result.allocation.remainingByGear).toEqual({ T2_Hat: 0, T10_Hat: 96 });
    expectCovered(result, needed, owned);
  });

  it('repairs a rounded route that otherwise requires fractional General conversions', () => {
    const needed = { T10_Hat: 100 };
    const result = plan(needed);
    expect(result.energy).toBe(1570);
    expectCovered(result, needed, {});
  });

  it('combines partial owned General stock with future drops without displaying a fractional owned conversion', () => {
    const needed = { T10_Hat: 1 };
    const owned = { G_Hat: 49 };
    const result = plan(needed, owned);
    expect(result.energy).toBe(10);
    expect(result.allocation.generalUsedByGear).toEqual({});
    expect(result.allocation.specialLeftover.G_Hat).toBe(49);
    expect(farmedGeneralConversions(result, misc)).toEqual([
      { gear: 'T10_Hat', general: 'G_Hat', blueprints: 1, farmed: 1, owned: 49 }
    ]);
    expectCovered(result, needed, owned);
  });

  it('handles stock-only plans, surplus stocks, and empty plans without unnecessary farming', () => {
    const needed = { T2_Hat: 3, T3_Bag: 2 };
    const owned = { G_Hat: 10, Choice_T3: 4 };
    const result = plan(needed, owned);
    expect(result.runs).toEqual([]);
    expect(result.allocation.remainingByGear).toEqual({ T2_Hat: 0, T3_Bag: 0 });
    expect(result.allocation.specialLeftover).toEqual({ G_Hat: 4, Choice_T3: 2 });
    expect(farmedGeneralConversions(result, misc)).toEqual([]);
    expectCovered(result, needed, owned);
    expect(plan({}, owned).allocation.specialLeftover).toEqual(owned);
  });

  it('shares an owned remainder between planned farmed conversions without changing inventory allocations', () => {
    const needed = { T2_Hat: 100, T3_Hat: 100, T4_Hat: 100 };
    const owned = { G_Hat: 7 };
    const result = plan(needed, owned);
    const before = structuredClone(result);
    const conversions = farmedGeneralConversions(result, misc);
    expect(conversions.length).toBeGreaterThan(1);
    expect(conversions.reduce((sum, conversion) => sum + conversion.owned, 0)).toBe(result.allocation.specialLeftover.G_Hat);
    expect(result).toEqual(before);
    expectCovered(result, needed, owned);
  });

  it.each(farmServers)('conserves pools across every tier/type on %s with campaign multipliers and Choice stock', (server) => {
    const needed = Object.fromEntries(Object.keys(misc.universal_bp_cost).flatMap((tier, index) =>
      ['Hat', 'Gloves', 'Shoes', 'Bag', 'Hairpin', 'Badge', 'Watch', 'Necklace', 'Charm'].map((type, typeIndex) =>
        [`${tier}_${type}`, 50 + (index * 43 + typeIndex * 67) % 151])));
    const owned = { G_Hat: 150, G_Bag: 39, G_Watch: 251, Choice_T2: 83, Choice_T5: 44, Choice_T10: 31 };
    for (const multiplier of [1, 2, 3]) {
      const result = plan(needed, owned, server, multiplier);
      expectCovered(result, needed, owned, server, multiplier);
      for (const row of result.runs) expect(Number(row.stage.split('-')[0])).toBeLessThanOrEqual(metadata.worldCaps[server] ?? Infinity);
      if (server === 'CN') expect(result.unavailable).toContain('T10_Hat');
    }
  });

  it('supports owned General stock in older data that has no General stage drops', () => {
    const data = { ...legacyMisc, universal_bp_cost: misc.universal_bp_cost };
    const result = plan({ T10_Hat: 100 }, { G_Hat: 49 }, 'Global', 1, data);
    expect(result.energy).toBeGreaterThan(0);
    expect(Object.values(result.generalConversions).every(Number.isInteger)).toBe(true);
  });

  it('rejects invalid stocks, conversion costs, and malformed worker allocations', () => {
    expect(() => plan({ T2_Hat: 10 }, { Choice_T2: -1 })).toThrow('inventory');
    expect(() => plan({ T2_Hat: 10 }, { G_Hat: 0.5 })).toThrow('inventory');
    expect(() => plan({ T2_Hat: 10 }, {}, 'Global', 1, { ...misc, universal_bp_cost: { T2: 0 } })).toThrow('cost');
    expect(() => decodeGearFarmPlan({ runs: [], energy: 0 })).toThrow('worker allocation');
    const valid = plan({ T2_Hat: 1 });
    expect(() => decodeGearFarmPlan({ ...valid, energy: valid.energy + 10 })).toThrow('AP total');
  });
});
