import { bondGearCost, gearCost, skillCost, xpCost } from './upgrade-costs';
import { bookCost, eligmaCost, mysticCost, ueCost } from './investment-costs';
import { addResource, type ResourceContext, type Resources, type StudentInfo, type StudentPlan } from './types';

export function calculateStudentResources(
  context: ResourceContext, student: StudentPlan, info: StudentInfo
): Resources {
  if (!info) throw new Error(`Student data is missing for ${student.id}.`);
  const resources: Resources = {};
  const current = student.current;
  const target = student.target;
  skillCost(context, info, 'ex', current?.ex, target?.ex, resources);
  skillCost(context, info, 'normal', current?.basic, target?.basic, resources);
  skillCost(context, info, 'passive', current?.passive, target?.passive, resources);
  skillCost(context, info, 'sub', current?.sub, target?.sub, resources);
  xpCost(context, current?.level, target?.level, resources);
  gearCost(context, info, current?.gear1, target?.gear1, 1, resources);
  gearCost(context, info, current?.gear2, target?.gear2, 2, resources);
  gearCost(context, info, current?.gear3, target?.gear3, 3, resources);
  bondGearCost(context, info, current?.bond_gear, target?.bond_gear, resources);
  bookCost(context, info, current?.book_hp, target?.book_hp, 'HP', resources);
  bookCost(context, info, current?.book_atk, target?.book_atk, 'ATK', resources);
  bookCost(context, info, current?.book_heal, target?.book_heal, 'Heal', resources);
  mysticCost(context, current?.star, target?.star, resources);
  ueCost(context, info, current?.ue, target?.ue, current?.ue_level, target?.ue_level, resources);

  const id = String(student.id);
  const data = context.data;
  const purchase = data.shop_characters[id];
  const price = typeof purchase === 'string' ? data.shop_eleph[purchase] : purchase;
  const currency = typeof purchase === 'string' ? purchase : purchase?.currency;
  const eleph = student.eleph;
  if (eleph?.unlocked === false && (
    ['RaidToken', 'RareRaidToken', 'EliminationRaidToken', 'RareEliminationRaidToken', 'ArenaCoin', 'JECoin']
      .includes(currency ?? '') || data.hard_modes[id]
  )) {
    addResource(resources, 'Eleph', data.unlock_cost[`${info.StarGrade}*`]);
  }
  if (resources.Eleph && Number(eleph?.owned) > 0) {
    resources.Eleph = Math.max(resources.Eleph - Number(eleph?.owned), 0);
  }
  if (eleph?.use_eligma && resources.Eleph) {
    addResource(resources, 'Eligma', eligmaCost(resources.Eleph, eleph.cost, eleph.purchasable));
  }
  if (eleph?.use_shop && resources.Eleph && purchase) {
    if (!price) throw new Error(`Shop pricing is missing for ${id}.`);
    const purchases = Math.ceil(resources.Eleph / price.amount);
    resources[`${currency}Cost`] = purchases * price.cost;
    resources.ShopResets = Math.ceil(purchases / price.times);
  }
  if (data.hard_modes[id] && resources.Eleph) {
    resources.ShopResets = Math.ceil(resources.Eleph / (Number(eleph?.farm_nodes) * 0.4));
  }
  return resources;
}
