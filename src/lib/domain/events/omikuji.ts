import { isRecord } from '../planner/save';
import type { PlannerMetadata } from '../planner/types';
import type { EventSummary, OmikujiDefinition, OmikujiSlip } from './standard-types';
import type { EventAmounts } from './types';
import type { SimulationRequest } from '../../services/simulations/types';

type OmikujiRequest = Extract<SimulationRequest, { kind: 'omikuji' }>;

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid omikuji ${label}.`);
  }
  return value;
}

function freezeDeep<T extends object>(value: T): T {
  for (const nested of Object.values(value)) {
    if (typeof nested === 'object' && nested !== null) freezeDeep(nested);
  }
  Object.freeze(value);
  return value;
}

export function decodeOmikuji(value: unknown): OmikujiDefinition {
  if (!isRecord(value)) throw new Error('Invalid omikuji definition.');
  if (typeof value.pull_currency !== 'string' || value.pull_currency.length === 0) {
    throw new Error('Invalid omikuji pull currency.');
  }

  const pullCost = finiteNumber(value.pull_cost, 'pull cost');
  if (pullCost <= 0) throw new Error('Omikuji pull cost must be positive.');

  const targetGrade = finiteNumber(value.TargetGrade, 'target grade');
  const startCount = finiteNumber(value.ProbModifyStartCount, 'probability modification start count');
  if (!Number.isInteger(startCount) || startCount < 1) {
    throw new Error('Omikuji probability modification start count must be a positive integer.');
  }
  const maxPullCount = finiteNumber(value.MaxPullCount, 'maximum pull count');
  if (!Number.isInteger(maxPullCount) || maxPullCount <= startCount) {
    throw new Error('Omikuji maximum pull count must be an integer greater than its start count.');
  }
  if (!Array.isArray(value.slips) || value.slips.length < 1 || value.slips.length > 128) {
    throw new Error('Omikuji slips must contain between 1 and 128 entries.');
  }

  const slips: OmikujiSlip[] = value.slips.map((slip: unknown, index: number) => {
    if (!isRecord(slip)) throw new Error(`Invalid omikuji slip ${index}.`);

    const grade = finiteNumber(slip.Grade, `slip ${index} grade`);
    if (!Number.isInteger(grade) || grade < 0) {
      throw new Error(`Omikuji slip ${index} grade must be a nonnegative integer.`);
    }
    const probability = finiteNumber(slip.Prob, `slip ${index} probability`);
    if (probability < 0) throw new Error(`Omikuji slip ${index} probability must be nonnegative.`);
    const modifyValue = finiteNumber(slip.ProbModifyValue, `slip ${index} probability modification value`);
    const modifyLimit = finiteNumber(slip.ProbModifyLimit, `slip ${index} probability modification limit`);
    if (modifyLimit < 0) throw new Error(`Omikuji slip ${index} probability modification limit must be nonnegative.`);

    if (!Array.isArray(slip.RewardId) || !Array.isArray(slip.RewardAmount) ||
        slip.RewardId.length === 0 || slip.RewardId.length !== slip.RewardAmount.length) {
      throw new Error(`Omikuji slip ${index} reward IDs and amounts must be nonempty arrays of equal length.`);
    }
    const rewardIds: number[] = [];
    const rewardAmounts: number[] = [];
    for (let rewardIndex = 0; rewardIndex < slip.RewardId.length; rewardIndex += 1) {
      const rewardId = slip.RewardId[rewardIndex];
      if (typeof rewardId !== 'number' || !Number.isSafeInteger(rewardId)) {
        throw new Error(`Omikuji slip ${index} has an invalid reward ID.`);
      }
      rewardIds.push(rewardId);

      const rewardAmount = finiteNumber(slip.RewardAmount[rewardIndex], `slip ${index} reward amount`);
      if (rewardAmount < 0) throw new Error(`Omikuji slip ${index} reward amount must be nonnegative.`);
      rewardAmounts.push(rewardAmount);
    }

    return {
      Grade: grade,
      Prob: probability,
      ProbModifyValue: modifyValue,
      ProbModifyLimit: modifyLimit,
      RewardId: rewardIds,
      RewardAmount: rewardAmounts
    };
  });

  if (!slips.some((slip) => slip.Grade === targetGrade)) {
    throw new Error('Omikuji target grade must match an existing slip grade.');
  }

  return freezeDeep({
    pull_currency: value.pull_currency,
    pull_cost: pullCost,
    TargetGrade: targetGrade,
    ProbModifyStartCount: startCount,
    MaxPullCount: maxPullCount,
    slips
  });
}

function buildChances(omikuji: OmikujiDefinition): number[][] {
  const chances: number[][] = [];
  const chanceCount = omikuji.MaxPullCount - omikuji.ProbModifyStartCount;

  for (let index = 0; index < chanceCount; index += 1) {
    const thresholds: number[] = [];
    let totalChance = 0;

    for (const slip of omikuji.slips) {
      const pullIndex = Math.max(index + 1, 0);
      const adjustedProbability = slip.ProbModifyLimit === 0
        ? Math.max(slip.Prob + pullIndex * slip.ProbModifyValue, 0)
        : Math.min(slip.Prob + pullIndex * slip.ProbModifyValue, slip.ProbModifyLimit);
      if (!Number.isFinite(adjustedProbability)) {
        throw new Error('Omikuji adjusted probability is not finite.');
      }
      thresholds.push(totalChance);
      totalChance += adjustedProbability;
      if (!Number.isFinite(totalChance)) throw new Error('Omikuji cumulative probability is not finite.');
    }

    chances.push(thresholds);
  }

  return chances;
}

export function omikujiChances(omikuji: OmikujiDefinition): number[][] {
  return buildChances(decodeOmikuji(omikuji));
}

export function omikujiRewardNames(omikuji: OmikujiDefinition): string[] {
  const definition = decodeOmikuji(omikuji);
  const rewardNames: Record<string, true> = {};
  for (const slip of definition.slips) {
    for (const rewardId of slip.RewardId) {
      rewardNames[String(rewardId)] = true;
    }
  }
  return Object.keys(rewardNames);
}

export function omikujiSimulationRequest(omikuji: OmikujiDefinition, currency: number): OmikujiRequest {
  const definition = decodeOmikuji(omikuji);
  if (!Number.isFinite(currency) || currency < 0 || currency > 200000) {
    throw new Error('Omikuji currency must be finite and between 0 and 200000.');
  }

  const rewards: OmikujiRequest['rewards'] = definition.slips.map(
    (slip): [number, number[], number[]] => [
      slip.Grade,
      [...slip.RewardId],
      [...slip.RewardAmount]
    ]
  );

  return {
    kind: 'omikuji',
    currencyOwned: currency,
    rewards,
    chances: buildChances(definition),
    pullCost: definition.pull_cost,
    targetGrade: definition.TargetGrade
  };
}

function addTotal(current: number, amount: number, name: string): number {
  const total = current + amount;
  if (!Number.isFinite(current) || !Number.isFinite(total)) {
    throw new Error(`Omikuji reward total for "${name}" is not finite.`);
  }
  return total;
}

function addToDictionary(target: EventAmounts, key: string, amount: number): void {
  const current = Object.prototype.hasOwnProperty.call(target, key) ? target[key] : 0;
  if (typeof current !== 'number' || !Number.isFinite(current)) {
    throw new Error(`Omikuji reward total for "${key}" is not finite.`);
  }
  const total = current + amount;
  if (!Number.isFinite(total)) throw new Error(`Omikuji reward total for "${key}" is not finite.`);
  Object.defineProperty(target, key, {
    value: total,
    enumerable: true,
    writable: true,
    configurable: true
  });
}

export function applyOmikujiRewards(
  summary: EventSummary,
  rounded: EventAmounts,
  metadata: PlannerMetadata
): EventSummary {
  if (!isRecord(rounded)) throw new Error('Rounded omikuji rewards must be an object.');
  for (const [name, amount] of Object.entries(rounded)) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new Error(`Rounded omikuji reward "${name}" must be finite.`);
    }
  }

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
  if (summary.boxes !== undefined) result.boxes = { ...summary.boxes };
  if (summary.overflowPurchases !== undefined) {
    result.overflowPurchases = Object.fromEntries(
      Object.entries(summary.overflowPurchases).map(([currency, purchases]) => [currency, { ...purchases }])
    );
  }

  for (const [rewardName, amount] of Object.entries(rounded)) {
    if (amount === 0) continue;
    const rewardId = Number.parseInt(rewardName);
    if (rewardId === 1) {
      result.credit = addTotal(result.credit, amount, rewardName);
    } else if (rewardId === 23) {
      result.eligma = addTotal(result.eligma, amount, rewardName);
    } else if (rewardId) {
      if (rewardId < 1000) {
        const materialName = metadata.materialNames[String(rewardId)];
        if (typeof materialName !== 'string' || materialName.length === 0) {
          throw new Error(`Omikuji artifact reward "${rewardId}" has no material metadata.`);
        }
        addToDictionary(result.artifacts, materialName, amount);
      } else if (rewardId >= 10000 && rewardId < 30000) {
        addToDictionary(result.eleph, rewardName, amount);
      }
    }
  }

  return result;
}
