import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { runInContext } from 'node:vm';
import { metadata } from '../../.generated-content/planner';
import students from '../../planner/json/skillinfo/en.json';
import misc from '../../planner/json/misc_data.json';
import { createCharacter } from '../../src/lib/domain/planner/defaults';
import { parsePlannerSave } from '../../src/lib/domain/planner/save';
import { aggregateResources, weaponXpSummary } from '../../src/lib/domain/planner/aggregates';
import { decodePlannerDataset } from '../../src/lib/services/planner-data';
import { createResourcePlanner } from '../../src/lib/stores/resource-planner';
import { createLegacyContext, evaluate, readSource } from './legacy-harness';

const dataset = decodePlannerDataset(students, misc, metadata);

class MemoryStorage implements Storage {
  private entries = new Map<string, string>();
  get length() { return this.entries.size; }
  clear() { this.entries.clear(); }
  key(index: number) { return [...this.entries.keys()][index] ?? null; }
  removeItem(key: string) { this.entries.delete(key); }
  getItem(key: string) { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string) { this.entries.set(key, value); }
}

function sourceSave() {
  return {
    exportVersion: 2, characters: [createCharacter(dataset.students['10000'], metadata)],
    character_order: ['10000'], disabled_characters: [], owned_materials: {},
    groups: { Team: [['10000', null]] }, events_data: { event: { target: 42 } },
    language: 'EN', futureField: { keep: true }
  };
}

describe('planner models and legacy defaults', () => {
  it.each(['10000', '10009', '13000'])('matches legacy defaults for %s', (id) => {
    const context = createLegacyContext(['config.js'], { info: dataset.students[id] });
    const modern = createCharacter(dataset.students[id], metadata);
    const legacy = evaluate(context, '(() => { const character = new Student(info); character.id = String(character.id); return character; })()');
    expect(modern).toEqual(legacy);
  });

  it('preserves current, target, inventory, teams, events and future fields', () => {
    const value = sourceSave();
    value.characters[0].current.futureInvestment = { kept: true };
    const parsed = parsePlannerSave(JSON.stringify(value), dataset.students, metadata);
    expect(parsed).toEqual(value);
  });

  it('upgrades flat version-1 investments and old disabled-name lists', () => {
    const value = {
      exportVersion: 1,
      characters: [{ id: 10000, name: 'Aru', level: 80, level_target: 90, star: 3, star_target: 5, ex: 1, ex_target: 5 }],
      disabled_characters: ['Aru'], groups: {}, language: 'EN', owned_materials: {},
      events_data: { retained: true }
    };
    const result = parsePlannerSave(JSON.stringify(value), dataset.students, metadata);
    expect(result.exportVersion).toBe(2);
    expect(result.characters[0].current.level).toBe(80);
    expect(result.characters[0].target.level).toBe(90);
    expect(result.characters[0].current.book_hp).toBe(0);
    expect(result.disabled_characters).toEqual(['10000']);
    expect(result.events_data).toEqual(value.events_data);
  });

  it.each(['{bad', 'null', '[]', '{"characters":null}', '{"characters":[],"exportVersion":3}'])(
    'rejects invalid saves without inventing an empty plan: %s', (source) => {
      expect(() => parsePlannerSave(source, dataset.students, metadata)).toThrow();
    }
  );

  it('does not silently replace null or out-of-range investments', () => {
    const value = sourceSave();
    value.characters[0].current.level = null;
    expect(() => parsePlannerSave(JSON.stringify(value), dataset.students, metadata)).toThrow('finite number');
    value.characters[0].current.level = 999;
    expect(() => parsePlannerSave(JSON.stringify(value), dataset.students, metadata)).toThrow('investment limits');
  });

  it('rejects missing or duplicate students explicitly', () => {
    const value = sourceSave();
    value.characters.push(value.characters[0]);
    expect(() => parsePlannerSave(JSON.stringify(value), dataset.students, metadata)).toThrow('Duplicate');
    value.characters = [{ ...value.characters[0], id: 'missing' }];
    expect(() => parsePlannerSave(JSON.stringify(value), dataset.students, metadata)).toThrow('missing');
  });
});

describe('aggregate and weapon-XP parity', () => {
  it.each([78, 80, 90])('matches the independent legacy reference at cap %i', (cap) => {
    const data = parsePlannerSave(JSON.stringify(sourceSave()), dataset.students, metadata);
    data.characters = ['10002', '10000', '10001'].map((id) => {
      const character = createCharacter(dataset.students[id], metadata);
      Object.assign(character.target, { level: 90, star: 5, ue: 4, ue_level: 60, ex: 5, basic: 10, gear1: 10, book_hp: 25 });
      character.eleph.farm_nodes = 1;
      return character;
    });
    data.disabled_characters = ['10001'];
    data.owned_materials = {
      '3000': '100', Credit: 500000, XP_1: 4, XP_2: '2', XP_3: 10, XP_4: 1,
      GXP_4: 2, T4_Spring: 1, T3_Hammer: 2, T2_Barrel: 3, T4_Needle: 1
    };
    const context = createLegacyContext(['config.js', 'common.js', 'pageLogic.js'], {
      charlist: dataset.students, data, disabledChars: data.disabled_characters,
      fixture: { misc, cap, owned: data.owned_materials }
    });
    runInContext(readSource('tests', 'fixtures', 'resource-calculations.legacy.js'), context);
    runInContext(readSource('tests', 'fixtures', 'resource-aggregates.legacy.js'), context);
    runInContext(`misc_data = fixture.misc; lvlCalcsCap = fixture.cap; ownedMatDict = {...fixture.owned};
      for (const character of data.characters) calculateCharResources(character, false);
      updateAggregateCount(); updateUeXP();`, context);
    const modern = aggregateResources(dataset, data.characters, data.disabled_characters, data.owned_materials, cap);
    expect({ required: modern.required, needed: modern.needed, leftover: modern.leftover, owned: modern.owned })
      .toEqual(evaluate(context, '({required:requiredMatDict,needed:neededMatDict,leftover:leftoverMatDict,owned:ownedMatDict})'));
    const weapons = weaponXpSummary(modern);
    for (const row of weapons.rows) {
      context.rowType = row.type.toLowerCase();
      expect(row.owned).toBe(Number(String(runInContext("document.getElementById('owned-' + rowType).innerText", context)).replaceAll(',', '')));
      expect(row.remaining).toBe(Number(String(runInContext("document.getElementById('remaining-needed-' + rowType).innerText", context)).replaceAll(',', '')));
    }
    expect(weapons.remaining).toBe(Number(String(runInContext("document.getElementById('remaining-needed-all').innerText", context)).replaceAll(',', '')));
  });
});

describe('transactional planner persistence', () => {
  async function setup(value: string = JSON.stringify(sourceSave())) {
    const storage = new MemoryStorage();
    storage.setItem('save-data', value);
    vi.stubGlobal('fetch', async (url: string) => new Response(JSON.stringify(url.includes('misc_data') ? misc : students)));
    const planner = createResourcePlanner(metadata, () => storage);
    await planner.initialise();
    vi.unstubAllGlobals();
    expect(get(planner).dataset).not.toBeNull();
    return { storage, planner };
  }

  it('updates one field without overwriting unrelated or newly changed fields', async () => {
    const { storage, planner } = await setup();
    const latest = JSON.parse(storage.getItem('save-data')!);
    latest.updatedElsewhere = 123;
    latest.page_theme = 'light';
    storage.setItem('save-data', JSON.stringify(latest));
    expect(planner.owned('Credit', 200)).toBe(true);
    const saved = JSON.parse(storage.getItem('save-data')!);
    expect(saved.owned_materials.Credit).toBe(200);
    expect(saved.updatedElsewhere).toBe(123);
    expect(saved.page_theme).toBe('light');
    expect(saved.groups).toEqual(latest.groups);
    expect(saved.events_data).toEqual(latest.events_data);
  });

  it('persists an older save only after validation and keeps its exact backup', async () => {
    const source = JSON.stringify({ ...sourceSave(), exportVersion: 1, characters: [{ id: 10000, level: 1, level_target: 90 }] });
    const { storage, planner } = await setup(source);
    expect(JSON.parse(storage.getItem('save-data')!).exportVersion).toBe(2);
    expect(storage.getItem('data-backup-modern')).toBe(source);
    expect(get(planner).migrated).toBe(true);
  });

  it('detects another tab editing the same character instead of losing its changes', async () => {
    const { storage, planner } = await setup();
    const character = get(planner).data!.characters[0];
    const expected = JSON.stringify({ current: character.current, target: character.target, eleph: character.eleph });
    const latest = JSON.parse(storage.getItem('save-data')!);
    latest.characters[0].target.level = 80;
    storage.setItem('save-data', JSON.stringify(latest));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(planner.edit(character, expected)).toBe(false);
    expect(get(planner).error).toContain('another window');
    expect(JSON.parse(storage.getItem('save-data')!).characters[0].target.level).toBe(80);
    log.mockRestore();
  });

  it('does not overwrite unreadable saves or report a failed write as saved', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { storage, planner } = await setup('{broken');
    expect(get(planner).data).toBeNull();
    expect(storage.getItem('save-data')).toBe('{broken');
    await planner.importData(JSON.stringify(sourceSave()));
    const before = storage.getItem('save-data');
    const original = storage.setItem.bind(storage);
    storage.setItem = () => { throw new Error('Quota exceeded'); };
    expect(planner.owned('Credit', 123)).toBe(false);
    expect(storage.getItem('save-data')).toBe(before);
    expect(get(planner).saved).toBe(false);
    expect(get(planner).error).toBe('Quota exceeded');
    storage.setItem = original;
    log.mockRestore();
  });

  it('adds, excludes, reorders and removes characters while retaining teams', async () => {
    const { planner } = await setup();
    expect(planner.add(['10001', '10002'])).toBe(true);
    expect(planner.include('10001', false)).toBe(true);
    expect(planner.move('10002', -1)).toBe(true);
    expect(get(planner).data!.character_order).toEqual(['10000', '10002', '10001']);
    expect(get(planner).data!.disabled_characters).toEqual(['10001']);
    expect(get(planner).data!.characters.find((character) => character.id === '10001')!.enabled).toBe(false);
    expect(planner.remove('10000')).toBe(true);
    expect(get(planner).data!.groups.Team).toEqual([['10000', null]]);
  });

  it('persists arbitrary drag ordering while preserving unknown order entries and unrelated state', async () => {
    const { storage, planner } = await setup();
    planner.add(['10001', '10002']);
    const latest = JSON.parse(storage.getItem('save-data')!);
    latest.character_order.push('future-character');
    latest.newField = true;
    storage.setItem('save-data', JSON.stringify(latest));
    expect(planner.reorder('10000', '10002', true, ['10000', '10001', '10002'])).toBe(true);
    expect(get(planner).data!.character_order).toEqual(['10001', '10002', '10000', 'future-character']);
    expect(get(planner).data!.events_data).toEqual(latest.events_data);
    expect(get(planner).data!.newField).toBe(true);
  });
});
