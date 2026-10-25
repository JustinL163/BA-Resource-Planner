import { isRecord } from '../planner/save';
import { simulationInputFingerprint } from './card-statistics';
import type { PlannerMetadata } from '../planner/types';
import type { CardDraw, EventPlan, EventSummary, StandardEvent } from './standard-types';
import type { EventAmounts } from './types';

export function decodeCardDraws(value: unknown): CardDraw[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Card draws must be a nonempty array.');
  }

  const draws: CardDraw[] = [];
  let chanceTotal = 0;
  let chance4Total = 0;
  let inLeadingRareDraws = true;
  let leadingRareCount = 0;

  for (const item of value) {
    if (!isRecord(item)) throw new Error('Each card draw must be an object.');
    const { icon, chance, chance4, drops } = item;
    if (
      typeof icon !== 'string' ||
      !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(icon) ||
      icon.includes('..')
    ) {
      throw new Error('Card draw icons must be safe ASCII basenames.');
    }
    if (typeof chance !== 'number' || !Number.isFinite(chance) || chance < 0) {
      throw new Error(`Card draw "${icon}" has an invalid chance.`);
    }
    if (chance4 !== undefined && (typeof chance4 !== 'number' || !Number.isFinite(chance4) || chance4 < 0)) {
      throw new Error(`Card draw "${icon}" has an invalid chance4.`);
    }
    if (!isRecord(drops) || Object.keys(drops).length === 0) {
      throw new Error(`Card draw "${icon}" must have nonempty drops.`);
    }

    const decodedDrops: EventAmounts = {};
    for (const [name, amount] of Object.entries(drops)) {
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
        throw new Error(`Card draw "${icon}" has an invalid drop amount.`);
      }
      Object.defineProperty(decodedDrops, name, {
        value: amount,
        enumerable: true,
        writable: true,
        configurable: true
      });
    }

    chanceTotal += chance;
    if (!Number.isFinite(chanceTotal)) throw new Error('Card draw chance total is not finite.');

    const draw: CardDraw = { icon, chance, drops: decodedDrops };
    if (chance4 !== undefined) draw.chance4 = chance4;
    draws.push(draw);

    const isRare = icon.startsWith('UR') || icon.startsWith('SR');
    if (inLeadingRareDraws && isRare) {
      if (chance4 === undefined) throw new Error(`Leading rare card "${icon}" requires chance4.`);
      chance4Total += chance4;
      if (!Number.isFinite(chance4Total)) throw new Error('Leading rare card chance4 total is not finite.');
      leadingRareCount += 1;
    } else {
      inLeadingRareDraws = false;
    }
  }

  if (chanceTotal <= 0) throw new Error('Card draw chance total must be greater than zero.');
  if (leadingRareCount === 0) {
    throw new Error('Card draws must begin with at least one rare card.');
  }
  if (chance4Total <= 0) {
    throw new Error('Leading rare card chance4 total must be greater than zero.');
  }
  return draws;
}

export function cardChances(draws: readonly CardDraw[]): number[][] {
  const validatedDraws = decodeCardDraws(draws);
  const total = validatedDraws.reduce((sum, draw) => sum + draw.chance, 0);
  let cumulative = 0;
  const normal: number[] = [];
  for (const draw of validatedDraws) {
    cumulative += draw.chance;
    normal.push(cumulative / total);
  }

  let rareTotal = 0;
  const rareCumulative: number[] = [];
  for (const draw of validatedDraws) {
    if (!(draw.icon.startsWith('UR') || draw.icon.startsWith('SR'))) break;
    if (draw.chance4 === undefined) throw new Error(`Leading rare card "${draw.icon}" requires chance4.`);
    rareTotal += draw.chance4;
    rareCumulative.push(rareTotal);
  }
  for (let i = 0; i < rareCumulative.length; i += 1) {
    rareCumulative[i] /= rareTotal;
  }

  return [normal, normal, normal, rareCumulative];
}

export function cardPullRequirement(target: number, ownedDraw: number, initialDraw: number): number {
  for (const [name, value] of Object.entries({ target, ownedDraw, initialDraw })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Card pull ${name} must be a finite nonnegative number.`);
    }
  }
  const required = Math.max(
    Math.ceil(target * 0.544811320) * 200 - (ownedDraw > 0 ? ownedDraw : initialDraw),
    0
  );
  if (!Number.isFinite(required)) throw new Error('Card pull requirement is not finite.');
  return required;
}

function addTotal(current: number, amount: number, name: string): number {
  const total = current + amount;
  if (!Number.isFinite(current) || !Number.isFinite(total)) {
    throw new Error(`Card reward total for "${name}" is not finite.`);
  }
  return total;
}

function addToDictionary(target: EventAmounts, key: string, amount: number): void {
  const current = Object.prototype.hasOwnProperty.call(target, key) ? target[key] : 0;
  if (typeof current !== 'number' || !Number.isFinite(current)) {
    throw new Error(`Card reward total for "${key}" is not finite.`);
  }
  const total = current + amount;
  if (!Number.isFinite(total)) throw new Error(`Card reward total for "${key}" is not finite.`);
  target[key] = total;
}

export function applyCardRewards(
  event: StandardEvent,
  summary: EventSummary,
  rounded: EventAmounts,
  metadata: PlannerMetadata
): EventSummary {
  if (!isRecord(rounded)) throw new Error('Rounded card rewards must be an object.');
  for (const [name, amount] of Object.entries(rounded)) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new Error(`Rounded card reward "${name}" must be finite.`);
    }
  }

  const rewardCurrencies = isRecord(event.currencies)
    ? Object.entries(event.currencies).filter(([, currency]) => isRecord(currency) && currency.source === 'CardPull')
    : [];
  if (rewardCurrencies.length !== 1) {
    throw new Error('Card rewards require exactly one currency with source "CardPull".');
  }
  const rewardCurrency = rewardCurrencies[0][0];

  const result: EventSummary = {
    ...summary,
    runs: { ...summary.runs },
    currencies: { ...summary.currencies },
    artifacts: { ...summary.artifacts },
    schoolMats: { ...summary.schoolMats },
    eleph: { ...summary.eleph },
    xps: { ...summary.xps },
    gear: { ...summary.gear }
  };

  for (const [name, amount] of Object.entries(rounded)) {
    if (amount === 0) continue;
    if (name === 'Credit') {
      result.credit = addTotal(result.credit, amount, name);
    } else if (name === 'Eligma') {
      result.eligma = addTotal(result.eligma, amount, name);
    } else if (name === rewardCurrency) {
      addToDictionary(result.currencies, name, amount);
    } else if (name.includes('XP_')) {
      addToDictionary(result.xps, name, amount);
    } else {
      const numericId = Number.parseInt(name, 10);
      if (numericId) {
        if (numericId !== 0 && numericId >= 10000 && numericId < 30000) {
          addToDictionary(result.eleph, name, amount);
        }
        continue;
      }

      const materialEntry = Object.entries(metadata.materialNames).find(
        ([, canonicalName]) => canonicalName === name
      );
      const materialId = materialEntry ? Number(materialEntry[0]) : Number.NaN;
      if (Number.isFinite(materialId) && materialId < 1000) {
        addToDictionary(result.artifacts, name, amount);
      }
    }
  }
  return result;
}

export function cardInputFingerprint(plan: EventPlan): string {
  return simulationInputFingerprint(plan);
}
