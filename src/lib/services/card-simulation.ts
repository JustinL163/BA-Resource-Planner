import { cardChances } from '../domain/events/cards';
import { decodeCardStatistics, validateStandardDeviation } from '../domain/events/card-statistics';
import type { CardDraw, CardSimulationResult, CardStatistics } from '../domain/events/standard-types';
import type { EventAmounts } from '../domain/events/types';
import { isRecord } from '../domain/planner/save';
import { runSimulation } from './simulations/runner';
import type { RewardArrays, SimulationWorker } from './simulations/types';
import { workerRequest, type WorkerRequestOptions } from './worker-request';

export interface CardSimulationOptions extends WorkerRequestOptions {
  createSimulationWorker?: (url: URL) => SimulationWorker;
}

function result(value: unknown): unknown {
  if (!isRecord(value) || typeof value.ok !== 'boolean') throw new Error('Invalid card statistics worker response.');
  if (!value.ok) throw new Error(typeof value.error === 'string' ? value.error : 'Card statistics worker failed.');
  return value.result;
}

export async function simulateCards(draws: CardDraw[], currency: number, options: CardSimulationOptions = {}): Promise<CardSimulationResult> {
  if (!Number.isFinite(currency) || currency < 0 || currency > Number.MAX_SAFE_INTEGER) throw new Error('Card draw currency is outside the safe simulation range.');
  const samples = await runSimulation({ kind: 'card', rewards: draws, chances: cardChances(draws), currencyOwned: currency }, {
    baseUrl: new URL('/planner/', window.location.href), signal: options.signal, createWorker: options.createSimulationWorker
  });
  return summarizeSimulationSamples(samples, options);
}

export function summarizeSimulationSamples(samples: RewardArrays, options: WorkerRequestOptions = {}): Promise<CardSimulationResult> {
  return workerRequest(new URL('/planner/js/shared/card-statistics-worker.js', window.location.href), { action: 'statistics', samples }, (value) => {
    const summary = result(value);
    if (!isRecord(summary) || typeof summary.sampleCount !== 'number' || !Number.isSafeInteger(summary.sampleCount) || summary.sampleCount < 1) {
      throw new Error('Invalid card simulation statistics.');
    }
    const statistics = decodeCardStatistics(summary.statistics);
    const keys = Object.keys(samples);
    if (summary.sampleCount !== samples[keys[0]].length || Object.keys(statistics).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(statistics, key))) throw new Error('Card simulation statistics do not match its samples.');
    return { type: 'result', value: { statistics, sampleCount: summary.sampleCount } };
  }, options);
}

export function roundCardStatistics(statistics: CardStatistics, deviation: number, options: WorkerRequestOptions = {}): Promise<EventAmounts> {
  validateStandardDeviation(deviation);
  return workerRequest(new URL('/planner/js/shared/card-statistics-worker.js', window.location.href), { action: 'adjust', statistics, deviation }, (value) => {
    const rounded = result(value);
    if (!isRecord(rounded)) throw new Error('Invalid adjusted card rewards.');
    const expected = Object.keys(statistics);
    if (Object.keys(rounded).length !== expected.length) throw new Error('Adjusted card reward keys do not match.');
    const rewards: EventAmounts = Object.create(null);
    for (const key of expected) {
      const amount = rounded[key];
      if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error(`Invalid adjusted card reward "${key}".`);
      rewards[key] = amount;
    }
    return { type: 'result', value: rewards };
  }, options);
}
