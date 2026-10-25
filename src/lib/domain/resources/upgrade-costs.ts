import {
  addResource, integer, type InvestmentValue, type Resources, type ResourceContext, type StudentInfo
} from './types';

export function skillCost(
  context: ResourceContext, student: StudentInfo, skill: string,
  current: InvestmentValue, target: InvestmentValue, resources: Resources
): null | void {
  const ex = skill === 'ex';
  const materials = ex ? student.SkillExMaterial : student.SkillMaterial;
  const amounts = ex ? student.SkillExMaterialAmount : student.SkillMaterialAmount;
  if (materials === undefined || amounts === undefined) return null;
  let currentLevel = integer(current);
  const targetLevel = integer(target);
  if (currentLevel === 0 && targetLevel > 0) currentLevel = 1;
  if (targetLevel === 10 && currentLevel < 10) addResource(resources, '9999', 1);
  for (let level = currentLevel; level < targetLevel; level++) {
    addResource(resources, 'Credit', context.data.skill_credit_cost[ex ? 'ex' : 'other'][level - 1]);
    const items = materials[level - 1];
    if (items === undefined) return null;
    for (let index = 0; index < items.length; index++) {
      if (items[index] !== undefined && amounts[level - 1][index] !== undefined) {
        addResource(resources, items[index], amounts[level - 1][index]);
      }
    }
  }
}

export function xpCost(
  context: ResourceContext, current: InvestmentValue, target: InvestmentValue, resources: Resources
): void {
  if (current && target) {
    const xp = Math.max(context.data.level_xp[integer(target) - 1] - context.data.level_xp[integer(current) - 1], 0);
    addResource(resources, 'Xp', xp);
    addResource(resources, 'Credit', xp * 7);
  }
}

export function gearCost(
  context: ResourceContext, student: StudentInfo, current: InvestmentValue,
  target: InvestmentValue, slot: number, resources: Resources
): void {
  const currentTier = integer(current);
  const targetTier = integer(target);
  if ((currentTier || currentTier === 0) && targetTier > currentTier) {
    const from = context.data.cumulative_gear_cost[`T${currentTier}`];
    const to = context.data.cumulative_gear_cost[`T${targetTier}`];
    if (from && to) {
      if ((from.xp || from.xp === 0) && to.xp) addResource(resources, 'GearXp', to.xp - from.xp);
      if ((from.credit || from.credit === 0) && to.credit) addResource(resources, 'Credit', to.credit - from.credit);
      if (student?.Equipment) {
        const equipment = student.Equipment[slot - 1];
        for (let tier = 2; tier <= 10; tier++) {
          const difference = to[`T${tier}`] - (from[`T${tier}`] ?? 0);
          if (to[`T${tier}`] && difference > 0) {
            addResource(resources, `T${tier}_${equipment}`, difference);
          }
        }
      }
    }
  }
}

export function bondGearCost(
  context: ResourceContext, student: StudentInfo, current: InvestmentValue,
  target: InvestmentValue, resources: Resources
): void {
  const currentTier = Math.max(integer(current), 1);
  const targetTier = integer(target);
  if (currentTier && targetTier > currentTier) {
    const materials = student.Gear?.TierUpMaterial;
    const amounts = student.Gear?.TierUpMaterialAmount;
    if (!materials || !amounts) return;
    for (let tier = currentTier; tier < targetTier; tier++) {
      const index = tier - 1;
      for (let material = 0; material < materials[index].length; material++) {
        addResource(resources, materials[index][material], amounts[index][material]);
      }
      addResource(resources, 'Credit', context.data.bond_gear_credit_cost[index]);
    }
  }
}
