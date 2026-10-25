import { isRecord } from '../planner/save';
import type { RewardArrays } from '../../services/simulations/types';
import type { CardSimulationResult, CardStatistics, EventPlan } from './standard-types';
import type { EventAmounts } from './types';

export interface CardMath {
  mean(samples: number[]): number;
  std(samples: number[]): number;
  round(value: number): number;
}

export function simulationInputFingerprint(plan: EventPlan): string {
  const input = { ...plan };
  for (const key of ['standard_deviation', 'card_pull_rewards', 'card_pull_currency_owned', 'dice_roll_rewards',
    'dice_roll_currency_owned', 'omikuji_pull_rewards', 'omikuji_pull_currency_owned']) delete input[key];
  return JSON.stringify(input);
}

export function validateStandardDeviation(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -2 || value > 1 || !Number.isInteger(value * 2)) {
    throw new Error('RNG adjustment must be between -2 and 1 in half-standard-deviation steps.');
  }
  return value;
}

export function decodeCardStatistics(value: unknown): CardStatistics {
  if (!isRecord(value)) throw new Error('Card statistics must be a reward record.');
  const result: CardStatistics = Object.create(null);
  for (const [key, statistics] of Object.entries(value)) {
    if (!isRecord(statistics) || typeof statistics.mean !== 'number' || !Number.isFinite(statistics.mean) ||
      typeof statistics.std !== 'number' || !Number.isFinite(statistics.std) || statistics.std < 0) {
      throw new Error(`Invalid card statistics for "${key}".`);
    }
    result[key] = { ...statistics, mean: statistics.mean, std: statistics.std };
  }
  return result;
}

export function decodeCardSamples(value: unknown): RewardArrays {
  if (!isRecord(value) || !Object.keys(value).length) throw new Error('Card simulation returned no reward samples.');
  const result: RewardArrays = Object.create(null);
  let count: number | undefined;
  for (const [key, samples] of Object.entries(value)) {
    if (!Array.isArray(samples) || !samples.length || !samples.every((item: unknown) => typeof item === 'number' && Number.isFinite(item))) {
      throw new Error(`Invalid card samples for "${key}".`);
    }
    if (count !== undefined && samples.length !== count) throw new Error('Card reward sample counts do not match.');
    count = samples.length;
    result[key] = samples;
  }
  return result;
}

export function summarizeCardSamples(value: unknown, math: CardMath): CardSimulationResult {
  const samples = decodeCardSamples(value);
  const statistics: CardStatistics = Object.create(null);
  for (const [key, rewards] of Object.entries(samples)) {
    statistics[key] = { std: math.std(rewards), mean: math.mean(rewards) };
  }
  return { statistics: decodeCardStatistics(statistics), sampleCount: samples[Object.keys(samples)[0]].length };
}

export function adjustedCardAmounts(value: unknown, deviation: number, math: CardMath): EventAmounts {
  const statistics = decodeCardStatistics(value);
  validateStandardDeviation(deviation);
  const result: EventAmounts = Object.create(null);
  for (const [key, reward] of Object.entries(statistics)) {
    const amount = math.round(reward.mean + deviation * reward.std);
    if (!Number.isFinite(amount)) throw new Error(`Adjusted card reward "${key}" is not finite.`);
    result[key] = amount;
  }
  return result;
}
