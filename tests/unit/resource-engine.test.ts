import { describe, expect, it } from 'vitest';
import { runInContext } from 'node:vm';
import { calculateStudentResources } from '../../src/lib/domain/resources/calculator';
import type { Investment, ResourceContext, StudentInfo, StudentPlan } from '../../src/lib/domain/resources/types';
import studentsJson from '../../planner/json/skillinfo/en.json';
import misc from '../../planner/json/misc_data.json';
import { createLegacyContext, readSource } from './legacy-harness';

const students: Record<string, StudentInfo> = studentsJson;
const reference = createLegacyContext(['config.js'], {
  charlist: students,
  misc_data: misc
});
runInContext(readSource('tests', 'fixtures', 'resource-calculations.legacy.js'), reference);
const context: ResourceContext = {
  data: misc,
  materialId(name) {
    reference.materialName = name;
    const value: unknown = runInContext('matLookup.revGet(materialName)', reference);
    if (typeof value !== 'string' && typeof value !== 'number' && value !== undefined) {
      throw new Error('Invalid material lookup result.');
    }
    return value;
  }
};

function defaults(info: StudentInfo): Investment {
  return {
    level: 1, star: info.StarGrade, ue: 0, ue_level: 0,
    ex: 1, basic: 1, passive: info.StarGrade >= 2 ? 1 : 0, sub: info.StarGrade >= 3 ? 1 : 0,
    gear1: 0, gear2: 0, gear3: 0, bond_gear: 0, book_hp: 0, book_atk: 0, book_heal: 0
  };
}

function plans(id: string, info: StudentInfo): StudentPlan[] {
  const current = defaults(info);
  const target: Investment = {
    ...current, level: 90, star: 5, ue: 4, ue_level: 60,
    ex: 5, basic: 10, passive: 10, sub: 10,
    gear1: 10, gear2: 10, gear3: 10, bond_gear: 2, book_hp: 25, book_atk: 25, book_heal: 25
  };
  return [
    { id, current, target: current },
    { id, current, target },
    {
      id, current: { ...current, level: 80, ex: 3, basic: 7, gear1: 7, ue: 2, ue_level: 40 },
      target
    },
    {
      id: Number(id), current: Object.fromEntries(Object.entries(current).map(([key, value]) => [key, String(value)])),
      target: Object.fromEntries(Object.entries(target).map(([key, value]) => [key, String(value)]))
    },
    {
      id, current, target,
      eleph: { owned: 100, unlocked: false, cost: 3, purchasable: 7, farm_nodes: 2, use_shop: true, use_eligma: true }
    },
    {
      id, current, target, eleph: { owned: 0, unlocked: false, farm_nodes: 0 }
    }
  ];
}

describe('extracted resource engine against the frozen reference', () => {
  it.each(Object.entries(students))('preserves every cost and key for student %s', (id, info) => {
    for (const plan of plans(id, info)) {
      reference.plan = plan;
      const before = JSON.stringify(plan);
      const legacy = runInContext('calculateCharResources(plan, true)', reference);
      const modern = calculateStudentResources(context, plan, info);
      expect(modern).toEqual(legacy);
      expect(Object.keys(modern)).toEqual(Object.keys(legacy));
      expect(JSON.stringify(plan)).toBe(before);
    }
  });

  it('reports missing student definitions', () => {
    expect(() => calculateStudentResources(context, { id: 'missing' }, students.missing))
      .toThrow('Student data is missing for missing.');
  });
});
