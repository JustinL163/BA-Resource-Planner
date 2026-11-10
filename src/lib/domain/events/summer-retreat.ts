import type { EventAmounts } from './types';

export const summerRetreatEventId = "chairman-makoto's-summer-retreat";

// https://bluearchive.wiki/wiki/Set_Sail!_Man-of-Pandemonium:_Chairman_Makoto%27s_Magnificent_Summer_Retreat
// Clear the five Story stages, Normal 1–4 and Challenge 1 once, then farm Normal 4.
const firstClearCost = 5 * 100 + 325 + 350 + 375 + 400 + 400;
const repeatCost = 400;
const initialPebbleTenths = 242; // 16 first-clear + 8.2 default rewards.
const initialElephTenths = 1019; // 16 first-clear + 5.9 default + 80 score rewards.
const artifactTypes = ['Quimbaya', 'Totem', 'Mystery', 'Haniwa'];
// Per-item expected drops, including each group's 25% item probability.
// Integer numerators retain the fractional initial Normal 1–4 drops until the final sum.
const artifactRates = [
  { initial: 9900, repeat: 3000 },
  { initial: 4950, repeat: 1500 },
  { initial: 2475, repeat: 750 },
  { initial: 1089, repeat: 330 }
];
const scoreSchoolMats = {
  TN_1_Gehenna: 50, TN_2_Gehenna: 40, TN_3_Gehenna: 30, TN_4_Gehenna: 15,
  BD_1_Gehenna: 36, BD_2_Gehenna: 21, BD_3_Gehenna: 12, BD_4_Gehenna: 4
};
const scoreXp = { XP_1: 60, XP_2: 30, XP_3: 106, XP_4: 3, GXP_1: 80, GXP_2: 40, GXP_3: 24, GXP_4: 7 };

export function summerRetreatSandTarget(pebbles: number, ownedPebbles = 0, includeInitial = true): number {
  if (![pebbles, ownedPebbles].every((amount) => Number.isFinite(amount) && amount >= 0)) {
    throw new Error('Sea Pebble targets and balances must be finite and non-negative.');
  }
  const remainingTenths = Math.max(0, (pebbles - ownedPebbles) * 10 - (includeInitial ? initialPebbleTenths : 0));
  return Math.max(5000, (includeInitial ? firstClearCost : 0) + Math.ceil(remainingTenths / 20) * repeatCost);
}

export function summerRetreatRewards(sand: number, includeInitial = true) {
  if (!Number.isFinite(sand) || sand < 0) throw new Error('Dream Sand must be finite and non-negative.');
  const initial = includeInitial && sand >= firstClearCost;
  const repeats = includeInitial && !initial ? 0 : Math.floor((sand - (initial ? firstClearCost : 0)) / repeatCost);
  const artifacts: EventAmounts = {};
  for (const type of artifactTypes) artifactRates.forEach((rate, index) => {
    artifacts[`${type}_${index + 1}`] = ((initial ? rate.initial : 0) + repeats * rate.repeat) / 8000;
  });
  return {
    // Keep expected fractions here so callers can sum them with all other rewards before flooring.
    pebbles: ((initial ? initialPebbleTenths : 0) + repeats * 20) / 10,
    eleph: ((initial ? initialElephTenths : 0) + repeats * 13) / 10,
    artifacts,
    schoolMats: initial ? scoreSchoolMats : {},
    xps: initial ? scoreXp : {},
    credit: initial ? 20000000 : 0
  };
}
