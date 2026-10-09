import { describe, expect, it } from 'vitest';
import { runInContext } from 'node:vm';
import { createStudentSearchIndex, decodeSearchAliases, matchesSearchText, searchStudents, stringSimilarity } from '../../src/lib/domain/planner/student-search';
import { emptyTeam, nextEmptySlot } from '../../src/lib/domain/planner/groups';
import aliases from '../../planner/json/student_info.json';
import students from '../../planner/json/skillinfo/en.json';
import { createLegacyContext, evaluate, readSource } from './legacy-harness';

const studentSearch = { createStudentSearchIndex, searchStudents, stringSimilarity };

describe('raid fuzzy search compatibility', () => {
  const reference = createLegacyContext([], { student_info: aliases, usedStudents: [], borrowMode: false });
  runInContext(readSource('tests', 'fixtures', 'student-search.legacy.js'), reference);
  runInContext('LoadStudentInfo();', reference);
  const oldStudents = Object.fromEntries(Object.entries(aliases).map(([id, value]) => [id, { Name: value.EN[0] }]));
  const index = createStudentSearchIndex(oldStudents, {}, aliases);

  it.each(['aru', 'a', 'az', 'sazusa', 'nyaru', 'broko', 'shiroko', 'hibiki', 'shuny', 'misaki', 'xyz', ''])(
    'matches the original five displayed results for %s', (query) => {
      reference.query = query;
      expect(searchStudents(index, query)).toEqual(evaluate(reference, 'SearchStudent(query, 5).slice(0, 5)'));
    }
  );

  it.each([
    ['aru', 'aru'], ['shunny', 'shuny'], ['shiroko', 'shiroko (cycling)'],
    ['ABC', 'abc'], ['', 'aru'], ['あずさ', 'あすさ'], ['a', 'longer']
  ])('keeps the same bigram scores for %s / %s', (first, second) => {
    reference.first = first; reference.second = second;
    expect(stringSimilarity(first, second)).toBe(runInContext('stringSimilarity(first, second, 2)', reference));
  });

  it('excludes used IDs before matching, retaining fuzzy fallback for the rest', () => {
    reference.usedStudents = ['10000', '10031'];
    reference.query = 'aru';
    const allowed = new Set(index.map((entry) => entry.id).filter((id) => !reference.usedStudents.includes(id)));
    expect(searchStudents(index, 'aru', allowed)).toEqual(evaluate(reference, 'SearchStudent(query, 5).slice(0, 5)'));
    reference.usedStudents = [];
  });
});

describe('automatic character names and manually maintained aliases', () => {
  const index = createStudentSearchIndex(students, {}, aliases);
  it('indexes all canonical character names without requiring a manual entry', () => {
    expect(index).toHaveLength(Object.keys(students).length);
    for (const [id, info] of Object.entries(students)) expect(index.find((entry) => entry.id === id)?.terms).toContain(info.Name.toLowerCase());
    expect(Object.hasOwn(aliases, '10093')).toBe(false);
    expect(searchStudents(index, 'Kirara')[0]).toBe('10093');
  });

  it('preserves editable nicknames and generates current canonical names too', () => {
    expect(searchStudents(index, 'broko')[0]).toBe('10024');
    expect(searchStudents(index, 'sazusa')[0]).toBe('10021');
    const edited = createStudentSearchIndex(students, {}, { '10000': { EN: ['manual-sensei-name'] } });
    expect(searchStudents(edited, 'manual-sensei-name')[0]).toBe('10000');
    expect(searchStudents(edited, 'Aru')[0]).toBe('10000');
  });

  it('includes localized names and selected-language aliases alongside English', () => {
    const index = createStudentSearchIndex({ '1': { Name: 'Aru' } }, { '1': 'アル' }, { '1': { JP: ['社長'] } }, 'Jp');
    expect(searchStudents(index, 'アル')).toEqual(['1']);
    expect(matchesSearchText(index, '1', '社長')).toBe(true);
    expect(matchesSearchText(index, '1', ' ARU ')).toBe(true);
  });

  it('deduplicates terms/results and supports colliding aliases for separate variants', () => {
    const index = createStudentSearchIndex({ '1': { Name: 'Aru' }, '2': { Name: 'Aru (Dress)' } }, {}, {
      '1': { EN: ['Aru', 'alias'] }, '2': { EN: ['alias'] }
    });
    expect(index[0].terms).toEqual(['aru', 'alias']);
    expect(searchStudents(index, 'alias')).toEqual(['1', '2']);
    expect(searchStudents(index, '  ARU  ')[0]).toBe('1');
  });

  it('returns only valid eligible IDs when fewer than five choices remain', () => {
    expect(searchStudents(index, 'anything', new Set())).toEqual([]);
    expect(searchStudents(index, 'aru', new Set(['10000']))).toEqual(['10000']);
    expect(() => searchStudents(index, 'aru', undefined, 0)).toThrow('positive integer');
  });

  it.each([[], null, { '1': { EN: 'wrong' } }, { '1': { EN: [''] } }])('reports malformed alias input %j', (value) => {
    expect(() => decodeSearchAliases(value)).toThrow();
  });
});

describe('sequential team picking', () => {
  it('advances to the next empty role, wraps to earlier empties and closes when full', () => {
    const team = emptyTeam();
    team[0] = '10000';
    expect(nextEmptySlot([team], { team: 0, slot: 0 })).toEqual({ team: 0, slot: 1 });
    team[1] = '10001'; team[2] = '10002'; team[3] = '10003';
    expect(nextEmptySlot([team], { team: 0, slot: 3 })).toEqual({ team: 0, slot: 4 });
    team[4] = '20000'; team[5] = '20001'; team[1] = null;
    expect(nextEmptySlot([team], { team: 0, slot: 5 })).toEqual({ team: 0, slot: 1 });
    team[1] = '10001';
    expect(nextEmptySlot([team], { team: 0, slot: 5 })).toBeNull();
  });
});

describe('legacy search initialization', () => {
  it.each(['raids.js', 'tournament.js'])('%s handles either data arrival order and includes missing canonical names', (file) => {
    const context = createLegacyContext([file], {
      BAStudentSearch: studentSearch,
      fixture: { students, aliases },
      $: Object.assign(() => ({ ready() {} }), { getJSON: () => ({ done() {} }) })
    });
    runInContext('student_info = fixture.aliases; LoadStudentInfo(); charlist = fixture.students; LoadStudentInfo();', context);
    expect(evaluate(context, 'SearchStudent("Kirara", 5)[0]')).toBe('10093');
    runInContext('studentSearchIndex = undefined; student_info = undefined; LoadStudentInfo(); student_info = fixture.aliases; LoadStudentInfo();', context);
    expect(evaluate(context, 'SearchStudent("broko", 5)[0]')).toBe('10024');
  });
});
