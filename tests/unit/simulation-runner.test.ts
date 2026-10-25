import { describe, expect, it } from 'vitest';
import { runSimulation, simulationBudget } from '../../src/lib/services/simulations/runner';
import type { SimulationRequest, SimulationWorker } from '../../src/lib/services/simulations/types';

class FakeWorker implements SimulationWorker {
  onmessage: SimulationWorker['onmessage'] = null;
  onerror: SimulationWorker['onerror'] = null;
  onmessageerror: SimulationWorker['onmessageerror'] = null;
  messages: unknown[] = [];
  terminated = false;
  postMessage(message: readonly unknown[]) { this.messages.push(structuredClone(message)); }
  terminate() { this.terminated = true; }
  respond(data: unknown) { this.onmessage?.(new MessageEvent('message', { data })); }
}

const card: SimulationRequest = {
  kind: 'card', currencyOwned: 1000,
  rewards: [{ drops: { Credit: 1 } }],
  chances: [[1], [1], [1], [1]]
};
const omikuji: SimulationRequest = {
  kind: 'omikuji', currencyOwned: '1000',
  rewards: [[1, [10001], [1]]], chances: [[0]],
  pullCost: 10, targetGrade: 1
};
const dice: SimulationRequest = {
  kind: 'dice', currencyOwned: 1000,
  race: { roll_cost: 10, tiles: [{ type: 'Credit', amount: 1 }], lap_rewards: [], lap_reward_tiers: [] },
  targets: [[]], tickets: [1, 1, 1, 1, 1, 1]
};

function start(request: SimulationRequest = card, signal?: AbortSignal) {
  const workers: FakeWorker[] = [];
  const urls: URL[] = [];
  const result = runSimulation(request, {
    baseUrl: new URL('https://example.invalid/planner/'),
    signal,
    createWorker(url) {
      const worker = new FakeWorker();
      workers.push(worker);
      urls.push(url);
      return worker;
    }
  });
  return { workers, urls, result };
}

describe('shared simulation runner', () => {
  it.each([card, omikuji, dice])('preserves four-worker payloads and budgets for $kind', async (request) => {
    const { workers, urls, result } = start(request);
    expect(workers).toHaveLength(4);
    const payload = workers[0].messages[0];
    const expected = request.kind === 'card'
      ? [request.rewards, request.chances, 3000, 100000, request.currencyOwned]
      : request.kind === 'omikuji'
        ? [request.rewards, request.chances, 3000, 100000, request.currencyOwned, request.pullCost, request.targetGrade]
        : [request.race, request.targets, 3000, 100000, request.currencyOwned, request.tickets];
    expect(payload).toEqual(expected);
    expect(workers.every((worker) => JSON.stringify(worker.messages[0]) === JSON.stringify(payload))).toBe(true);
    expect(urls.every((url) => url.pathname.endsWith(
      request.kind === 'card' ? 'cardGachaWorker.js' : request.kind === 'omikuji' ? 'omikujiGachaWorker.js' : 'diceGachaWorker.js'
    ))).toBe(true);
    workers.forEach((worker) => worker.respond({ Credit: [0] }));
    await expect(result).resolves.toEqual({ Credit: [0, 0, 0, 0] });
    expect(workers.every((worker) => worker.terminated && worker.onmessage === null)).toBe(true);
    expect(simulationBudget).toEqual({ workers: 4, timeoutMs: 3000, maxTrials: 100000 });
  });

  it('merges in arrival order and ignores duplicate messages', async () => {
    const { workers, result } = start();
    const duplicate = workers[2].onmessage;
    workers[2].respond({ Credit: [2] });
    duplicate?.(new MessageEvent('message', { data: { Credit: [999] } }));
    workers[0].respond({ Credit: [0] });
    workers[3].respond({ Credit: [3] });
    workers[1].respond({ Credit: [1] });
    await expect(result).resolves.toEqual({ Credit: [2, 0, 3, 1] });
  });

  it('cancels all workers and rejects rather than returning partial results', async () => {
    const controller = new AbortController();
    const { workers, result } = start(card, controller.signal);
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    workers[0].respond({ Credit: [1] });
    controller.abort();
    await rejected;
    expect(workers.every((worker) => worker.terminated)).toBe(true);
  });

  it('does not create workers for a previously aborted request', async () => {
    const controller = new AbortController();
    controller.abort();
    const { workers, result } = start(card, controller.signal);
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers).toHaveLength(0);
  });

  it('surfaces worker errors and terminates the complete pool', async () => {
    const { workers, result } = start();
    const error = Object.assign(new Event('error', { cancelable: true }), {
      message: 'Worker failed', filename: '', lineno: 0, colno: 0, error: null
    });
    workers[0].onerror?.(error);
    await expect(result).rejects.toThrow('Worker failed');
    expect(error.defaultPrevented).toBe(true);
    expect(workers.every((worker) => worker.terminated)).toBe(true);
  });

  it('surfaces message decoding errors', async () => {
    const { workers, result } = start();
    workers[0].onmessageerror?.(new MessageEvent('messageerror'));
    await expect(result).rejects.toThrow('could not be decoded');
    expect(workers.every((worker) => worker.terminated)).toBe(true);
  });

  it.each([null, [], {}, { Credit: [] }, { Credit: ['wrong'] }, { Credit: [NaN] }])(
    'rejects malformed reward data %j',
    async (data) => {
      const { workers, result } = start();
      workers[0].respond(data);
      await expect(result).rejects.toThrow('invalid rewards');
      expect(workers.every((worker) => worker.terminated)).toBe(true);
    }
  );

  it('rejects inconsistent reward keys', async () => {
    const { workers, result } = start();
    workers[0].respond({ Credit: [1] });
    workers[1].respond({ Eleph: [1] });
    await expect(result).rejects.toThrow('inconsistent reward keys');
  });

  it('rejects inconsistent per-reward trial counts', async () => {
    const { workers, result } = start();
    workers[0].respond({ Credit: [1], Eleph: [1, 2] });
    await expect(result).rejects.toThrow('inconsistent sample counts');
  });

  it('cleans up workers if pool construction fails partway through', async () => {
    const worker = new FakeWorker();
    let constructed = 0;
    const result = runSimulation(card, {
      baseUrl: new URL('https://example.invalid/planner/'),
      createWorker() {
        if (constructed++ > 0) throw new Error('Construction failed');
        return worker;
      }
    });
    await expect(result).rejects.toThrow('Construction failed');
    expect(worker.terminated).toBe(true);
  });

  it.each([-1, Infinity, NaN])('rejects invalid currency %s before spawning work', async (currencyOwned) => {
    const { result, workers } = start({ ...card, currencyOwned });
    await expect(result).rejects.toThrow('currency must be finite and non-negative');
    expect(workers).toHaveLength(0);
  });

  it('rejects zero-cost pulls that would never finish', async () => {
    const { result, workers } = start({
      kind: 'omikuji', currencyOwned: 1000, rewards: [[1, [10001], [1]]],
      chances: [[0]], pullCost: 0, targetGrade: 1
    });
    await expect(result).rejects.toThrow('pull cost must be finite and positive');
    expect(workers).toHaveLength(0);
  });
});
