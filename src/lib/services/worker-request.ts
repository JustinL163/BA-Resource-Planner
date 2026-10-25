export interface TaskWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage: (message: unknown) => void;
  terminate: () => void;
}
export interface WorkerRequestOptions {
  signal?: AbortSignal;
  createWorker?: (url: URL) => TaskWorker;
}
export type WorkerReply<T> = { type: 'progress' } | { type: 'result'; value: T };

export function workerRequest<T>(
  url: URL, message: unknown, decode: (value: unknown) => WorkerReply<T>, options: WorkerRequestOptions = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    let worker: TaskWorker | undefined;
    let settled = false;
    const timeout = setTimeout(() => fail(new Error('Worker request timed out.')), 30000);
    const clean = () => {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
      if (worker) {
        worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null;
        worker.terminate();
      }
    };
    const fail = (error: unknown) => { if (!settled) { settled = true; clean(); reject(error); } };
    const abort = () => fail(new DOMException('Worker request cancelled.', 'AbortError'));
    if (options.signal?.aborted) { abort(); return; }
    options.signal?.addEventListener('abort', abort, { once: true });
    try {
      worker = options.createWorker ? options.createWorker(url) : new Worker(url);
      worker.onerror = (event) => { event.preventDefault(); fail(new Error(event.message || 'Worker failed.')); };
      worker.onmessageerror = () => fail(new Error('Worker response could not be decoded.'));
      worker.onmessage = (event: MessageEvent<unknown>) => {
        if (settled) return;
        try {
          const reply = decode(event.data);
          if (reply.type === 'result') { settled = true; clean(); resolve(reply.value); }
        } catch (error) { fail(error); }
      };
      worker.postMessage(message);
    } catch (error) { fail(error); }
  });
}
