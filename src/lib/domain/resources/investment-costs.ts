import {
  addResource, integer, isZero, type BookType, type InvestmentValue,
  type Resources, type ResourceContext, type StudentInfo
} from './types';

export function bookCost(
  context: ResourceContext, student: StudentInfo, current: InvestmentValue,
  target: InvestmentValue, type: BookType, resources: Resources
): void {
  const currentTier = integer(current);
  const targetTier = integer(target);
  if ((currentTier || currentTier === 0) && targetTier > currentTier) {
    const from = context.data.cumulative_limit_break_cost[currentTier];
    const to = context.data.cumulative_limit_break_cost[targetTier];
    if (!from || !to) return;
    if (to.books) addResource(resources, context.materialId(`Book_${type}`), to.books - (from.books ?? 0));
    for (let index = 0; index < 2; index++) {
      const property = index === 0 ? 'artifact_1' : 'artifact_2';
      const amount = to[property];
      if (amount) {
        addResource(resources, Number(student.PotentialMaterial) + index, amount - (from[property] ?? 0));
      }
    }
    if (typeof from.credit === 'number' && to.credit) addResource(resources, 'Credit', to.credit - from.credit);
  }
}

export function mysticCost(
  context: ResourceContext, current: InvestmentValue, target: InvestmentValue, resources: Resources
): void {
  if (current && target) {
    const from = context.data.cumulative_mystic_cost[`${current}*`];
    const to = context.data.cumulative_mystic_cost[`${target}*`];
    if (from && to) {
      if ((from.credit || from.credit === 0) && to.credit) addResource(resources, 'Credit', to.credit - from.credit);
      if ((from.eleph || from.eleph === 0) && to.eleph) addResource(resources, 'Eleph', to.eleph - from.eleph);
    }
  }
}

export function eligmaCost(needed: number, price: InvestmentValue, remaining: InvestmentValue): number {
  let cost = Number(price);
  let purchasable = Number(remaining);
  let total = 0;
  while (cost < 5 && needed > 0) {
    const amount = Math.min(purchasable, needed);
    if (amount > 0) {
      needed -= amount;
      total += amount * cost;
      cost++;
      purchasable = 20;
    } else {
      break;
    }
  }
  if (needed > 0) total += needed * 5;
  return total;
}

export function ueCost(
  context: ResourceContext, student: StudentInfo,
  currentStar: InvestmentValue, targetStar: InvestmentValue,
  currentLevel: InvestmentValue, targetLevel: InvestmentValue, resources: Resources
): void {
  const star = isZero(currentStar) ? 1 : currentStar;
  const level = isZero(currentLevel) ? 1 : currentLevel;
  const levelTarget = isZero(targetLevel) ? 1 : targetLevel;
  if (star && targetStar) {
    const from = context.data.cumulative_mystic_cost[`U${star}*`];
    const to = context.data.cumulative_mystic_cost[`U${targetStar}*`];
    if (from && to) {
      if ((from.credit || from.credit === 0) && to.credit) addResource(resources, 'Credit', to.credit - from.credit);
      if ((from.eleph || from.eleph === 0) && to.eleph) addResource(resources, 'Eleph', to.eleph - from.eleph);
    }
  }
  if ((level || isZero(level)) && levelTarget) {
    const from = context.data.ue_xp[Number(level) - 1];
    const to = context.data.ue_xp[Number(levelTarget) - 1];
    if ((from || from === 0) && to) {
      addResource(resources, `${context.data.gun_ue_category[student.WeaponType]}_Xp`, to - from);
      addResource(resources, 'Credit', (to - from) * 180);
    }
  }
}
