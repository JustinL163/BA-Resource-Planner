import { expect, it } from 'vitest';
import { createContext, runInContext } from 'node:vm';
import { readSource } from './legacy-harness';

it('pins the cloud-save LZMA bytes and round-trips the binary response', async () => {
  const source = JSON.stringify({
    exportVersion: 2,
    characters: [],
    events_data: { sample: { target: 42 } }
  });
  const context = createContext({ source, setTimeout, setImmediate });
  runInContext(readSource('planner', 'js', 'lzma_worker.js'), context);
  const compressed = await new Promise<unknown>((resolve, reject) => {
    context.complete = (result: unknown, error: unknown) => error ? reject(error) : resolve(result);
    runInContext('LZMA.compress(source, 9, complete);', context);
  });
  expect(compressed).toMatchSnapshot();
  context.compressed = compressed;
  const decompressed = await new Promise<unknown>((resolve, reject) => {
    context.complete = (result: unknown, error: unknown) => error ? reject(error) : resolve(result);
    runInContext('LZMA.decompress(new Uint8Array(compressed), complete);', context);
  });
  expect(decompressed).toBe(source);
});
