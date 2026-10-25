import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressSave, decompressSave } from '../../src/lib/services/compression';
import { workerRequest, type TaskWorker } from '../../src/lib/services/worker-request';

class FakeWorker implements TaskWorker {
  onmessage: TaskWorker['onmessage'] = null;
  onerror: TaskWorker['onerror'] = null;
  onmessageerror: TaskWorker['onmessageerror'] = null;
  message: unknown;
  terminated = false;
  postMessage(message: unknown) { this.message = message; }
  terminate() { this.terminated = true; }
  reply(data: unknown) { this.onmessage?.(new MessageEvent('message', { data })); }
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('single-use worker requests', () => {
  const url = new URL('https://example.invalid/worker.js');
  it('resolves decoded replies and always releases the worker', async () => {
    const worker = new FakeWorker();
    const result = workerRequest(url, 'request', (value) => ({ type: 'result', value }), { createWorker: () => worker });
    worker.reply('response');
    await expect(result).resolves.toBe('response');
    expect(worker.terminated).toBe(true);
    expect(worker.onmessage).toBeNull();
  });
  it('cancels pending work without returning a result', async () => {
    const worker = new FakeWorker(), controller = new AbortController();
    const result = workerRequest(url, 'request', (value) => ({ type: 'result', value }), {
      createWorker: () => worker, signal: controller.signal
    });
    const error = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await error;
    expect(worker.terminated).toBe(true);
  });
  it('rejects malformed messages and times out a silent worker', async () => {
    const worker = new FakeWorker();
    const result = workerRequest(url, 'request', () => { throw new Error('Invalid reply'); }, { createWorker: () => worker });
    worker.reply({});
    await expect(result).rejects.toThrow('Invalid reply');
    vi.useFakeTimers();
    const silent = new FakeWorker();
    const waiting = workerRequest(url, 'request', (value) => ({ type: 'result', value }), { createWorker: () => silent });
    const error = expect(waiting).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(30000);
    await error;
    expect(silent.terminated).toBe(true);
  });
});

describe('legacy LZMA worker protocol', () => {
  it('uses level nine, callback IDs and signed-byte normalization while ignoring progress', async () => {
    vi.stubGlobal('window', { location: { href: 'https://example.invalid/planner/' } });
    const worker = new FakeWorker();
    const result = compressSave('save', { createWorker: () => worker });
    expect(worker.message).toEqual({ action: 1, data: 'save', mode: 9, cbn: 1 });
    worker.reply({ action: 3, cbn: 1, result: 0.5 });
    expect(worker.terminated).toBe(false);
    worker.reply({ action: 1, cbn: 1, result: [1, -1, -128, 127], error: null });
    await expect(result).resolves.toEqual(new Uint8Array([1, 255, 128, 127]));
  });
  it('accepts decompressed text and surfaces codec errors', async () => {
    vi.stubGlobal('window', { location: { href: 'https://example.invalid/planner/' } });
    const worker = new FakeWorker();
    const result = decompressSave(new Uint8Array([1]), { createWorker: () => worker });
    worker.reply({ action: 2, cbn: 1, result: '{"exportVersion":2}', error: null });
    await expect(result).resolves.toBe('{"exportVersion":2}');
    const failed = new FakeWorker();
    const error = decompressSave(new Uint8Array([1]), { createWorker: () => failed });
    failed.reply({ action: 2, cbn: 1, error: 'Corrupt data' });
    await expect(error).rejects.toThrow('Corrupt data');
    expect(failed.terminated).toBe(true);
  });
});
