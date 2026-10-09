import { describe, expect, it, vi } from 'vitest';
import { runInContext } from 'node:vm';
import { createLegacyContext } from './legacy-harness';
import strings from '../../planner/json/strings.json';
import type { RewardArrays } from '../../src/lib/services/simulations/types';

function setup() {
  const pending: {
    resolve: (result: RewardArrays) => void;
    reject: (error: Error) => void;
    signal: AbortSignal;
  }[] = [];
  const receive = vi.fn();
  const notify = vi.fn();
  const logError = vi.fn();
  const context = createLegacyContext(['config.js', 'common.js', 'eventPlanner.js'], {
    AbortController,
    fixtureStrings: strings,
    console: { error: logError },
    request: {
      kind: 'card', currencyOwned: 1000,
      rewards: [{ drops: { Credit: 1 } }], chances: [[1], [1], [1], [1]]
    },
    BAEventSimulations: {
      run(_request: unknown, { signal }: { signal: AbortSignal }) {
        return new Promise<RewardArrays>((resolve, reject) => pending.push({ resolve, reject, signal }));
      }
    },
    Swal: { fire: notify },
    receive
  });
  runInContext("language_strings = fixtureStrings; current_event = 'event-a'; cardPullCurrencyOwned = 1000;", context);
  const start = () => runInContext('RunEventSimulation("card", request, receive)', context);
  return { context, pending, receive, notify, logError, start };
}

describe('legacy event screen using shared simulation jobs', () => {
  it('commits a completed result only to the event and inputs that launched it', async () => {
    const { context, start, pending, receive } = setup();
    const done = start();
    expect(runInContext('cardGachaProcessing', context)).toBe(true);
    pending[0].resolve({ Credit: [1] });
    await done;
    expect(receive).toHaveBeenCalledWith({ Credit: [1] }, 'event-a');
    expect(runInContext('cardGachaProcessing', context)).toBe(false);
    expect(runInContext('simulationJobs.size', context)).toBe(0);
  });

  it('does not commit stale currency results and tells the user to rerun', async () => {
    const { context, start, pending, receive, notify } = setup();
    const done = start();
    runInContext('cardPullCurrencyOwned = 2000;', context);
    pending[0].resolve({ Credit: [1] });
    await done;
    expect(receive).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ icon: 'info' }));
    expect(runInContext('cardGachaProcessing', context)).toBe(false);
  });

  it('cancels old-event workers and ignores results even if they arrive late', async () => {
    const { context, start, pending, receive } = setup();
    const done = start();
    runInContext("CancelEventSimulations(); current_event = 'event-b';", context);
    expect(pending[0].signal.aborted).toBe(true);
    pending[0].resolve({ Credit: [1] });
    await done;
    expect(receive).not.toHaveBeenCalled();
    expect(runInContext('cardGachaProcessing', context)).toBe(false);
  });

  it('an old completion cannot clear a replacement job', async () => {
    const { context, start, pending, receive } = setup();
    const old = start();
    const replacement = start();
    expect(pending[0].signal.aborted).toBe(true);
    pending[0].resolve({ Credit: [1] });
    await old;
    expect(runInContext('cardGachaProcessing', context)).toBe(true);
    pending[1].resolve({ Credit: [2] });
    await replacement;
    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenCalledWith({ Credit: [2] }, 'event-a');
  });

  it('reports failures and permits retry without a success-shaped fallback', async () => {
    const { context, start, pending, receive, notify, logError } = setup();
    const done = start();
    pending[0].reject(new Error('Worker failed'));
    await done;
    expect(logError).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ icon: 'error' }));
    expect(receive).not.toHaveBeenCalled();
    expect(runInContext('cardGachaProcessing', context)).toBe(false);
    const retry = start();
    pending[1].resolve({ Credit: [3] });
    await retry;
    expect(receive).toHaveBeenCalledWith({ Credit: [3] }, 'event-a');
  });
});
