import { describe, expect, it } from 'vitest';
import { readPreferences, writePreferences } from '../../src/lib/services/preferences';
import { normaliseLanguage } from '../../src/lib/domain/localisation';
import { createLegacyContext, evaluate, readSource } from './legacy-harness';
import { runInContext } from 'node:vm';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('shared planner preferences', () => {
  it('uses the planner defaults without writing on read', () => {
    const storage = new MemoryStorage();
    expect(readPreferences(storage)).toEqual({ theme: 'dark', language: 'En' });
    expect(storage.getItem('save-data')).toBeNull();
  });

  it('preserves save version, investments, event data and unknown fields', () => {
    const storage = new MemoryStorage();
    const save = {
      exportVersion: 1,
      characters: [{ id: '10000', level: 80 }],
      events_data: { sample: { shop_purchases: { Credit: 10 } } },
      futureField: { retained: true }
    };
    storage.setItem('save-data', JSON.stringify(save));
    expect(writePreferences(storage, { theme: 'light', language: 'Kr' }))
      .toEqual({ theme: 'light', language: 'Kr' });
    expect(JSON.parse(storage.getItem('save-data')!))
      .toEqual({ ...save, page_theme: 'light', language: 'Kr' });
  });

  it('rereads the latest save before changing preferences', () => {
    const storage = new MemoryStorage();
    writePreferences(storage, { theme: 'light' });
    storage.setItem('save-data', JSON.stringify({ exportVersion: 2, page_theme: 'light', updatedElsewhere: 42 }));
    writePreferences(storage, { language: 'Jp' });
    expect(JSON.parse(storage.getItem('save-data')!).updatedElsewhere).toBe(42);
    expect(readPreferences(storage).theme).toBe('light');
  });

  it.each(['{broken', 'null', '[]', '"not a save"'])('does not overwrite unreadable save %s', (save) => {
    const storage = new MemoryStorage();
    storage.setItem('save-data', save);
    expect(() => writePreferences(storage, { theme: 'light' })).toThrow();
    expect(storage.getItem('save-data')).toBe(save);
  });

  it('surfaces storage quota errors', () => {
    const storage = {
      getItem: () => null,
      setItem: () => { throw new Error('Quota exceeded'); }
    };
    expect(() => writePreferences(storage, { theme: 'light' })).toThrow('Quota exceeded');
  });

  it('creates the same complete default save as the existing planner', () => {
    const legacyStorage = new MemoryStorage();
    const context = createLegacyContext(['config.js', 'common.js'], {
      localStorage: legacyStorage,
      fetch: () => new Promise(() => {})
    });
    runInContext(readSource('planner', 'js', 'plannerFast.js'), context);
    const modernStorage = new MemoryStorage();
    writePreferences(modernStorage, {});
    expect(JSON.parse(modernStorage.getItem('save-data')!))
      .toEqual(evaluate(context, 'data'));
  });

  it.each([
    ['EN', 'En'], ['Kr', 'Kr'], ['JP', 'Jp'], ['CN', 'Tw'],
    ['Cn', 'Cn'], ['Tw', 'Tw'], ['TH', 'Th'], ['Id', 'Id'], [null, 'En']
  ])('normalises legacy language %s to %s', (source, expected) => {
    expect(normaliseLanguage(source)).toBe(expected);
  });
});
