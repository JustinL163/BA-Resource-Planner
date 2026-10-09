import { calculateStudentResources } from '../resources/calculator';
import { xpCost } from '../resources/upgrade-costs';
import { integer, type Resources } from '../resources/types';
import type { OwnedInventory, PlannerCharacter, PlannerDataset, ResourceTotals } from './types';

export function aggregateResources(
  dataset: PlannerDataset, characters: PlannerCharacter[], disabled: string[],
  inventory: OwnedInventory, levelCap: number, cached?: Record<string, Resources>
): ResourceTotals {
  const required: Resources = {};
  const context = dataset.context;
  const needed: Resources = {};
  const leftover: Resources = {};
  const owned = { ...inventory };
  const perCharacter: Record<string, Resources> = {};
  const excluded = new Set(disabled);
  for (const character of characters) {
    const resources = cached?.[character.id] ?? calculateStudentResources(context, character, dataset.students[character.id]);
    perCharacter[character.id] = resources;
  }
  for (const [id, resources] of Object.entries(perCharacter)) {
    if (excluded.has(id)) continue;
    const character = characters.find((item) => item.id === id);
    if (!character) throw new Error(`Missing character plan for ${id}.`);
    for (const [key, amount] of Object.entries(resources)) {
      if (key !== 'Xp') required[key] = (required[key] || 0) + amount;
    }
    xpCost(context, character.current.level, Math.min(Number(character.target.level), levelCap), required);
    const fullXp: Resources = {};
    xpCost(context, character.current.level, character.target.level, fullXp);
    if (fullXp.Credit > 0) required.Credit -= fullXp.Credit;
  }
  for (const [key, amount] of Object.entries(required)) needed[key] = Math.max(amount - Number(owned[key] ?? 0), 0);
  for (const [key, amount] of Object.entries(owned)) leftover[key] = Math.max(Number(amount) - (required[key] ?? 0), 0);
  let raidCoins = 0;
  for (const [key, amount] of Object.entries(needed)) {
    if (key.length === 4 && key.startsWith('3')) raidCoins += ([10, 20, 50, 100][Number(key[3])] ?? 0) * amount;
    else if (key.length === 4 && key.startsWith('4')) raidCoins += ([3, 5, 10, 25][Number(key[3])] ?? 0) * amount;
    else if (key === '9999') raidCoins += 500 * amount;
  }
  needed.RaidTokenCost = raidCoins;
  for (const character of characters) {
    if (!excluded.has(character.id) && perCharacter[character.id].RaidTokenCost) {
      needed.RaidTokenCost += perCharacter[character.id].RaidTokenCost;
    }
  }
  for (const [key, prefix, values] of [
    ['Xp', 'XP', [50, 500, 2000, 10000]],
    ['GearXp', 'GXP', [90, 360, 1440, 5760]]
  ] as const) {
    const total = values.reduce((sum, value, index) => sum + integer(owned[`${prefix}_${index + 1}`] ?? 0) * value, 0);
    owned[key] = total;
    needed[key] = Math.max((required[key] ?? 0) - total, 0);
    leftover[key] = Math.max(total - (required[key] ?? 0), 0);
  }
  return { required, needed, leftover, owned, perCharacter };

}

export function weaponXpSummary(totals: ResourceTotals) {
  const xp = (type: string) =>
    [10, 50, 200, 1000].reduce((sum, value, index) =>
      sum + integer(totals.owned[`T${index + 1}_${type}`] ?? 0) * value, 0);
  const rows = ['Spring', 'Hammer', 'Barrel'].map((type) => {
    const owned = xp(type) * 1.5;
    const required = totals.needed[`${type}_Xp`] ?? 0;
    return { type, owned, required, remaining: Math.max(required - owned, 0) };
  });
  const needleOwned = xp('Needle') * 1.5;
  const needleNeeded = rows.reduce((sum, row) => sum + row.remaining, 0);
  const needleRemaining = Math.max(needleNeeded - needleOwned, 0);
  const remainingOwned = rows.reduce((sum, row) => sum + Math.max(Math.floor((row.owned - row.required) / 3 * 2), 0), 0) +
    Math.max(needleOwned - needleNeeded, 0);
  return {
    rows: [...rows, { type: 'Needle', owned: needleOwned, required: needleNeeded, remaining: needleRemaining }],
    remainingOwned, remainingNeeded: needleRemaining, remaining: Math.max(needleRemaining - remainingOwned, 0)
  };
}
