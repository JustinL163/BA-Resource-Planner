import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runInContext } from 'node:vm';
import { get } from 'svelte/store';
import { metadata } from '../../.generated-content/planner';
import students from '../../planner/json/skillinfo/en.json';
import misc from '../../planner/json/misc_data.json';
import { decodePlannerDataset } from '../../src/lib/services/planner-data';
import { createCharacter, characterFingerprint } from '../../src/lib/domain/planner/defaults';
import { applyBulkPatch, validateBulkPatch, type BulkPatch } from '../../src/lib/domain/planner/bulk';
import { emptyTeam, groupFingerprint, groupText, memberIds, readTeams, reorderGroup, swapSlots, validateTeams, type Team } from '../../src/lib/domain/planner/groups';
import { createResourcePlanner } from '../../src/lib/stores/resource-planner';
import { createLegacyContext, evaluate, readSource } from './legacy-harness';

const dataset = decodePlannerDataset(students, misc, metadata);
const defaultStars = { star: 0, star_target: 0, ue: 0, ue_target: 0 };
const patches: BulkPatch[] = [
  { current: {}, target: {}, stars: defaultStars },
  { current: { level: '80', ex: '3', basic: '7', gear1: '7' }, target: {}, stars: defaultStars },
  { current: {}, target: { level: '90', ex: '5', basic: '10', passive: '10', sub: '10', gear1: '10', gear2: '10', gear3: '10' }, stars: defaultStars },
  { current: { passive: '0', sub: '0', gear1: '0' }, target: { passive: '0', sub: '0', gear1: '0' }, stars: defaultStars },
  { current: { bond: '80', bond_gear: '1', ue_level: '60', book_hp: '25' }, target: { bond: '100', bond_gear: '2', book_atk: '25' }, stars: defaultStars },
  { current: { bond: '80', ue_level: '60', book_heal: '25' }, target: {}, stars: { star: 5, ue: 2, star_target: 5, ue_target: 4 } },
  { current: { level: '80', gear1: '7' }, target: { level: '1', gear1: '1' }, stars: { star: 1, ue: 0, star_target: 2, ue_target: 0 } },
  { current: { ue_level: '60' }, target: { ue_level: '60', book_hp: '25', book_atk: '25', book_heal: '25' }, stars: { star: 5, ue: 3, star_target: 5, ue_target: 4 } }
];

describe('bulk update parity with the frozen implementation', () => {
  const reference = createLegacyContext(['config.js'], {
    charlist: dataset.students, saveToLocalStorage() {}, location: { reload() {} }
  });
  runInContext(readSource('tests', 'fixtures', 'bulk-update.legacy.js'), reference);
  it.each(Object.entries(dataset.students))('matches the legacy patch rules for %s', (id, info) => {
    for (const patch of patches) {
      const character = createCharacter(info, metadata);
      const initial = JSON.stringify(character);
      reference.data = { characters: [JSON.parse(initial)] };
      reference.bulkChars = [id];
      reference.modalStars = patch.stars;
      reference.patch = patch;
      runInContext('ApplyBulkUpdate(patch);', reference);
      const modern = applyBulkPatch(character, info, patch);
      expect(modern).toEqual(evaluate(reference, 'data.characters[0]'));
      expect(JSON.stringify(character)).toBe(initial);
    }
  });

  it('distinguishes an explicit zero from a blank field', () => {
    const character = createCharacter(dataset.students['10000'], metadata);
    character.current.gear1 = 7;
    const unchanged = applyBulkPatch(character, dataset.students['10000'], patches[0]);
    const zero = applyBulkPatch(character, dataset.students['10000'], { current: { gear1: '0' }, target: {}, stars: defaultStars });
    expect(unchanged.current.gear1).toBe(7);
    expect(zero.current.gear1).toBe('0');
  });

  it('rejects an empty patch and out-of-range input explicitly', () => {
    expect(() => validateBulkPatch(patches[0], metadata)).toThrow('at least one change');
    expect(() => validateBulkPatch({ current: { level: '999' }, target: {}, stars: defaultStars }, metadata)).toThrow('Invalid bulk');
    expect(() => validateBulkPatch({ current: {}, target: {}, stars: { ...defaultStars, star: 3, ue: 2 } }, metadata)).toThrow('five stars');
  });
});

describe('team/group domain compatibility', () => {
  const groups = {
    First: [['10000', null, null, null, '20000', null]],
    Second: [['10001', { id: '10002', server: 'Global' }, null, null, null, null]],
    Empty: null
  };
  it('matches the old regular-member filter and excludes borrowed characters', () => {
    const reference = createLegacyContext([], { data: { groups } });
    runInContext(readSource('tests', 'fixtures', 'group-rules.legacy.js'), reference);
    reference.name = 'Second';
    expect([...memberIds(groups, 'Second')]).toEqual(evaluate(reference, 'charsFromGroup(name)'));
    expect([...memberIds(groups, 'Second', true)]).toEqual(['10000', '20000', '10001']);
  });

  it.each([1, 2, 3])('matches old group-order semantics at position %i', (position) => {
    const reference = createLegacyContext([], { data: { groups }, currentGroup: 'Second', position, rebuildGroups() {} });
    runInContext(readSource('tests', 'fixtures', 'group-rules.legacy.js'), reference);
    runInContext('SetGroupOrder(position);', reference);
    expect(reorderGroup(groups, 'Second', position)).toEqual(evaluate(reference, 'data.groups'));
    expect(Object.keys(reorderGroup(groups, 'Second', position))).toEqual(evaluate(reference, 'Object.keys(data.groups)'));
  });

  it('accepts legacy null/empty/short teams and preserves borrowed metadata', () => {
    expect(readTeams(null)).toEqual([]);
    expect(readTeams([])).toEqual([]);
    expect(readTeams([[10000, { id: 10001, future: true }]])[0]).toEqual(['10000', { id: '10001', future: true }, null, null, null, null]);
  });

  it('enforces roles, duplicate regular students, one borrow and the fifty-team limit', () => {
    const team: Team = ['10000', null, null, null, '20000', null];
    expect(() => validateTeams([team], dataset.students)).not.toThrow();
    expect(() => validateTeams([[...team], ['10000', null, null, null, null, null]], dataset.students)).toThrow('once');
    expect(() => validateTeams([['10000', { id: '10000' }, null, null, '20000', null]], dataset.students)).not.toThrow();
    expect(() => validateTeams([[{ id: '10000' }, { id: '10001' }, null, null, null, null]], dataset.students)).toThrow('one borrowed');
    expect(() => validateTeams([['20000', null, null, null, null, null]], dataset.students)).toThrow('respective slots');
    expect(() => validateTeams(Array.from({ length: 51 }, emptyTeam), dataset.students)).toThrow('50 teams');
  });

  it('swaps within a role across teams and rejects role-crossing moves', () => {
    const teams: Team[] = [['10000', null, null, null, '20000', null], emptyTeam()];
    swapSlots(teams, { team: 0, slot: 0 }, { team: 1, slot: 1 });
    expect(teams[0][0]).toBeNull();
    expect(teams[1][1]).toBe('10000');
    expect(() => swapSlots(teams, { team: 1, slot: 1 }, { team: 0, slot: 4 })).toThrow('same role');
  });

  it('reports group names whose JavaScript key order cannot represent the requested position', () => {
    expect(() => reorderGroup({ '1': null, Named: null }, '1', 2)).toThrow('Numeric group names');
  });

  it('exports each member with its own investments, and marks borrows', () => {
    const aru = createCharacter(dataset.students['10000'], metadata);
    Object.assign(aru.current, { ex: 5, basic: 10, passive: 10, sub: 10, gear1: 10, gear2: 10, gear3: 10 });
    const text = groupText([['10000', { id: '10001' }, null, null, null, null]], [aru], { '10000': 'Aru', '10001': 'Eimi' }, true);
    expect(text).toMatch(/Aru +3\u2605 +1 +MMMM +XXX/);
    expect(text).toMatch(/Eimi +\(Borrowed\)/);
  });
});

describe('transactional team and bulk operations', () => {
  let stored: string;
  let planner: ReturnType<typeof createResourcePlanner>;
  beforeEach(async () => {
    stored = JSON.stringify({
      exportVersion: 2, characters: ['10000', '10001'].map((id) => createCharacter(dataset.students[id], metadata)),
      groups: { Empty: null, Future: { untouched: true } }, events_data: { preserved: true }, language: 'EN'
    });
    vi.stubGlobal('fetch', async (url: string) => new Response(JSON.stringify(url.includes('misc_data') ? misc : students)));
    const storage: Storage = {
      length: 1, key: () => 'save-data', clear() {}, removeItem() {},
      getItem: () => stored, setItem: (_key, value) => { stored = value; }
    };
    planner = createResourcePlanner(metadata, () => storage);
    await planner.initialise();
    vi.unstubAllGlobals();
  });

  it('renames empty groups and preserves unrecognized groups and event data', () => {
    expect(planner.group({ type: 'rename', name: 'Empty', newName: 'Renamed', expected: 'null' })).toBe(true);
    expect(Object.keys(get(planner).data!.groups)).toEqual(['Renamed', 'Future']);
    expect(get(planner).data!.groups.Future).toEqual({ untouched: true });
    expect(get(planner).data!.events_data).toEqual({ preserved: true });
  });

  it('writes six-slot groups readable by the legacy planner without adding roster entries', () => {
    expect(planner.teamSlot('Empty', 'null', { team: 0, slot: 0 }, '10002')).toBe(true);
    expect(JSON.parse(stored).groups.Empty).toEqual([['10002', null, null, null, null, null]]);
    expect(JSON.parse(stored).characters).toHaveLength(2);
  });

  it('rejects stale group selections and invalid duplicate picks without overwriting storage', () => {
    planner.teamSlot('Empty', 'null', { team: 0, slot: 0 }, '10000');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const before = stored;
    expect(planner.teamSlot('Empty', 'null', { team: 0, slot: 1 }, '10001')).toBe(false);
    expect(stored).toBe(before);
    expect(planner.teamSlot('Empty', groupFingerprint(get(planner).data!.groups.Empty), { team: 0, slot: 1 }, '10000')).toBe(false);
    expect(stored).toBe(before);
    log.mockRestore();
  });

  it('applies bulk changes atomically and rejects one stale selection before saving any', () => {
    const initial = get(planner).data!.characters;
    const expected = Object.fromEntries(initial.map((character) => [character.id, characterFingerprint(character)]));
    const newest = JSON.parse(stored);
    newest.characters[1].target.level = 80;
    stored = JSON.stringify(newest);
    const before = stored;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(planner.bulkEdit(['10000', '10001'], expected, patches[2])).toBe(false);
    expect(stored).toBe(before);
    log.mockRestore();
    expect(planner.bulkEdit(['10000'], expected, patches[2])).toBe(true);
    expect(JSON.parse(stored).characters[0].target.level).toBe(90);
    expect(JSON.parse(stored).characters[1].target.level).toBe(80);
    expect(JSON.parse(stored).groups.Future).toEqual({ untouched: true });
  });
});
