import { isRecord } from '../domain/planner/save';
import { workerRequest, type WorkerRequestOptions } from './worker-request';

function codec<T>(action: 1 | 2, data: string | Uint8Array, decode: (value: unknown) => T, options: WorkerRequestOptions) {
  return workerRequest<T>(new URL('/planner/js/lzma_worker.js', window.location.href), { action, data, mode: 9, cbn: 1 }, (value) => {
    if (!isRecord(value) || value.cbn !== 1) throw new Error('Invalid compression worker response.');
    if (value.error) {
      throw new Error(typeof value.error === 'string' ? value.error :
        isRecord(value.error) && typeof value.error.message === 'string' ? value.error.message : 'Compression worker failed.');
    }
    if (value.action === 3) return { type: 'progress' };
    if (value.action !== action) throw new Error('Unexpected compression worker action.');
    return { type: 'result', value: decode(value.result) };
  }, options);
}

export function compressSave(source: string, options: WorkerRequestOptions = {}): Promise<Uint8Array> {
  return codec(1, source, (value) => {
    if (!Array.isArray(value) || !value.length || !value.every((byte: unknown) =>
      typeof byte === 'number' && Number.isInteger(byte) && byte >= -128 && byte <= 255
    )) throw new Error('Compression worker returned invalid bytes.');
    return new Uint8Array(value);
  }, options);
}

export function decompressSave(bytes: Uint8Array, options: WorkerRequestOptions = {}): Promise<string> {
  return codec(2, bytes, (value) => {
    if (typeof value !== 'string') throw new Error('Compression worker returned invalid save data.');
    return value;
  }, options);
}
