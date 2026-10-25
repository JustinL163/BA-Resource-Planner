import type { RewardArrays, SimulationOptions, SimulationRequest, SimulationWorker } from './types';

export const simulationBudget = Object.freeze({ workers: 4, timeoutMs: 3000, maxTrials: 100000 });
const workerPaths = {
  card: 'js/cardGachaWorker.js',
  omikuji: 'js/omikujiGachaWorker.js?1',
  dice: 'js/diceGachaWorker.js?2'
};

function isRewardArrays(value: unknown): value is RewardArrays {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const arrays = Object.values(value);
  return arrays.length > 0 && arrays.every((array: unknown) =>
    Array.isArray(array) && array.length > 0 &&
    array.every((item: unknown) => typeof item === 'number' && Number.isFinite(item))
  );
}

function messageFor(request: SimulationRequest): readonly unknown[] {
  const { timeoutMs, maxTrials } = simulationBudget;
  if (request.kind === 'card') {
    return [request.rewards, request.chances, timeoutMs, maxTrials, request.currencyOwned];
  }
  if (request.kind === 'omikuji') {
    return [
      request.rewards, request.chances, timeoutMs, maxTrials,
      request.currencyOwned, request.pullCost, request.targetGrade
    ];
  }
  return [
    request.race, request.targets, timeoutMs, maxTrials, request.currencyOwned, request.tickets
  ];
}

export function runSimulation(request: SimulationRequest, options: SimulationOptions): Promise<RewardArrays> {
  return new Promise((resolve, reject) => {
    const workers: SimulationWorker[] = [];
    const results: RewardArrays = {};
    const finished = new Set<SimulationWorker>();
    let rewardNames: string[] | undefined;
    let settled = false;
    const cleanup = () => {
      options.signal?.removeEventListener('abort', abort);
      for (const worker of workers) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
      }
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const abort = () => fail(new DOMException('Simulation cancelled.', 'AbortError'));
    if (options.signal?.aborted) {
      abort();
      return;
    }
    options.signal?.addEventListener('abort', abort, { once: true });
    try {
      const currency = Number(request.currencyOwned);
      if (!Number.isFinite(currency) || currency < 0) throw new Error('Simulation currency must be finite and non-negative.');
      const cost = request.kind === 'omikuji' ? request.pullCost : request.kind === 'dice' ? request.race.roll_cost : 200;
      if (!Number.isFinite(cost) || cost <= 0) throw new Error('Simulation pull cost must be finite and positive.');
      const createWorker = options.createWorker ?? ((url: URL) => {
        if (typeof Worker === 'undefined') throw new Error('Web Workers are unavailable in this browser.');
        return new Worker(url);
      });
      const url = new URL(workerPaths[request.kind], options.baseUrl);
      const message = messageFor(request);
      for (let index = 0; index < simulationBudget.workers; index++) workers.push(createWorker(url));
      for (const worker of workers) {
        if (settled) break;
        worker.onerror = (event) => {
          event.preventDefault();
          fail(new Error(event.message || 'Simulation worker failed.'));
        };
        worker.onmessageerror = () => fail(new Error('Simulation worker message could not be decoded.'));
        worker.onmessage = (event) => {
          if (settled || finished.has(worker)) return;
          const rewards = event.data;
          if (!isRewardArrays(rewards)) {
            fail(new Error('Simulation worker returned invalid rewards.'));
            return;
          }
          const names = Object.keys(rewards);
          if (rewardNames && (names.length !== rewardNames.length || rewardNames.some((name) => !Object.hasOwn(rewards, name)))) {
            fail(new Error('Simulation workers returned inconsistent reward keys.'));
            return;
          }
          rewardNames ??= names;
          const count = rewards[names[0]].length;
          if (names.some((name) => rewards[name].length !== count)) {
            fail(new Error('Simulation worker returned inconsistent sample counts.'));
            return;
          }
          // Concatenate in arrival order, matching the original statistics input.
          for (const [reward, samples] of Object.entries(rewards)) {
            results[reward] = Object.hasOwn(results, reward) ? results[reward].concat(samples) : samples;
          }
          finished.add(worker);
          if (finished.size === simulationBudget.workers) {
            settled = true;
            cleanup();
            resolve(results);
          }
        };
        worker.postMessage(message);
      }
    } catch (error) {
      fail(error);
    }
  });
}
