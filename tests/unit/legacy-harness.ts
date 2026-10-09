import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext, type Context } from 'node:vm';

export function readSource(...segments: string[]): string {
  return readFileSync(resolve(...segments), 'utf8');
}

export function readJson(...segments: string[]): unknown {
  return JSON.parse(readSource(...segments));
}

export function createLegacyContext(files: string[], globals: Record<string, unknown> = {}): Context {
  const cells = new Map<string, {
    checked: boolean; value: string; innerText: string;
    classList: { remove: () => void }
  }>();
  const context = createContext({
    console,
    addEventListener() {},
    navigator: { platform: 'Win32' },
    document: {
      getElementById(id: string) {
        if (!cells.has(id)) cells.set(id, {
          checked: false, value: '', innerText: '', classList: { remove() {} }
        });
        return cells.get(id);
      }
    },
    $: () => ({ ready() {} }),
    ...globals
  });
  context.window = context;
  for (const file of files) {
    runInContext(readSource('planner', 'js', file), context, { filename: file });
  }
  return context;
}

export function evaluate(context: Context, expression: string): unknown {
  const result: unknown = runInContext(expression, context);
  return JSON.parse(JSON.stringify(result, (_key, value: unknown) => {
    if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
    return value;
  }));
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
