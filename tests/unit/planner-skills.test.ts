import { describe, expect, it, vi } from 'vitest';
import { createContext, runInContext } from 'node:vm';
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { decodeSkillDefinitions, formatSkill, type FormattedSkill, type SkillKey, type SkillTone } from '../../src/lib/domain/planner/skills';
import { isRecord } from '../../src/lib/domain/planner/save';
import { createSkillDataLoader, studentSkills } from '../../src/lib/services/planner-skills';
import type { Language } from '../../src/lib/domain/localisation';
import { readJson, readSource } from './legacy-harness';

const english = readJson('planner', 'json', 'skillinfo', 'en.json');
if (!isRecord(english)) throw new Error('Invalid English fixture.');
const effects = readJson('planner', 'json', 'skillinfo', 'localisation_en.json');
if (!isRecord(effects) || !isRecord(effects.BuffName)) throw new Error('Invalid effect fixture.');
const buffs: Record<string, string> = {};
for (const [key, value] of Object.entries(effects.BuffName)) if (typeof value === 'string') buffs[key] = value;
const aru = english['10000'];
if (!isRecord(aru)) throw new Error('Invalid student fixture.');
const base = decodeSkillDefinitions(aru.Skills);

interface Piece { text: string; colour: string; bold: boolean; tone: SkillTone }

function merge(pieces: Piece[]): Piece[] {
  const result: Piece[] = [];
  for (const piece of pieces) {
    const previous = result.at(-1);
    if (previous && previous.colour === piece.colour && previous.bold === piece.bold && previous.tone === piece.tone) previous.text += piece.text;
    else if (piece.text) result.push({ ...piece });
  }
  return result;
}

function legacyPieces(html: string): Piece[] {
  const pieces: Piece[] = [];
  function visit(node: DefaultTreeAdapterMap['node'], bold = false, colour = '', tone: SkillTone = 'default') {
    if ('value' in node) { pieces.push({ text: node.value, bold, colour, tone }); return; }
    if ('tagName' in node) {
      if (node.tagName === 'br') { pieces.push({ text: '\n', bold: false, colour: '', tone: 'default' }); return; }
      bold ||= node.tagName === 'b';
      const style = node.attrs.find((attr) => attr.name === 'style')?.value;
      colour = style?.match(/color: (#[\da-f]+)/)?.[1] ?? colour;
      const className = node.attrs.find((attr) => attr.name === 'class')?.value;
      if (className === 'ba-col-mystic') tone = 'mystic';
      if (className === 'ba-col-explosion') tone = 'explosion';
      if (className === 'ba-col-pierce') tone = 'pierce';
    }
    if ('childNodes' in node) for (const child of node.childNodes) visit(child, bold, colour, tone);
  }
  visit(parseFragment(html));
  return merge(pieces);
}

function modernPieces(view: FormattedSkill): Piece[] {
  const pieces: Piece[] = [];
  if (view.cost) {
    pieces.push({ text: 'Cost: ', bold: false, colour: '', tone: 'default' },
      { text: view.cost.current, bold: false, colour: '#008c9b', tone: 'default' });
    if (view.cost.target !== null) pieces.push({ text: '/', bold: false, colour: '', tone: 'default' },
      { text: view.cost.target, bold: false, colour: '#588f00', tone: 'default' });
    pieces.push({ text: '\n', bold: false, colour: '', tone: 'default' });
  }
  for (const token of view.tokens) {
    if (token.kind === 'break') pieces.push({ text: '\n', bold: false, colour: '', tone: 'default' });
    else if (token.kind === 'text') pieces.push({ text: token.text, bold: token.bold, colour: '', tone: token.tone });
    else {
      pieces.push({ text: token.current, bold: token.bold, colour: '#008c9b', tone: token.tone });
      if (token.target !== null) pieces.push({ text: '/', bold: token.bold, colour: '', tone: token.tone },
        { text: token.target, bold: token.bold, colour: '#588f00', tone: token.tone });
    }
  }
  return merge(pieces);
}

describe('frozen legacy skill description compatibility', () => {
  it.each(['en', 'jp', 'kr', 'tw', 'cn', 'th'])('matches every available student skill in %s', (language) => {
    const students = readJson('planner', 'json', 'skillinfo', `${language}.json`);
    const localizedEffects = readJson('planner', 'json', 'skillinfo', `localisation_${language}.json`);
    if (!isRecord(students) || !isRecord(localizedEffects) || !isRecord(localizedEffects.BuffName)) throw new Error('Invalid localized fixture.');
    const names = { ...buffs };
    for (const [key, value] of Object.entries(localizedEffects.BuffName)) if (typeof value === 'string' && value) names[key] = value;
    const context = createContext({ language, charlist: english, chartranslate: students,
      skillbuffnames: { en: effects, [language]: localizedEffects } });
    runInContext(readSource('tests', 'fixtures', 'skills.legacy.js'), context);
    for (const [id, student] of Object.entries(students)) {
      if (!isRecord(student) || !isRecord(student.Skills)) throw new Error('Invalid student.');
      // Missing translations are separately covered as explicit English fallbacks.
      const available = Object.fromEntries(Object.entries(student.Skills).filter(([key, skill]) => key !== 'Normal' && isRecord(skill) && skill.Desc));
      const definitions = decodeSkillDefinitions(available);
      const cases: [SkillKey, string, number, number][] = [
        ['ex', 'Ex', 0, 0], ['basic', 'Skill1', 0, 0],
        ['passive', 'Skill2', 0, 0], ['sub', 'Skill3', 0, 0],
        ['passive', 'Skill2', 2, 0]
      ];
      if (definitions.GearPublic) cases.push(['basic', 'Skill1', 0, 2]);
      for (const [key, oldKey, ue, gear] of cases) {
        if (key === 'ex' && !definitions.Ex) continue;
        const max = key === 'ex' ? 5 : 10;
        for (const [current, target] of [[0, 0], [1, max], [max, max], ['2', '3']] as const) {
          Object.assign(context, { id, oldKey, current, target, ue, gear });
          const old: unknown = runInContext('getSkillFormatted(id, oldKey, current, target, ue, gear)', context);
          if (typeof old !== 'string') throw new Error(`Missing reference description: ${id} ${oldKey}.`);
          const view = formatSkill(definitions, names, key, current, target, ue, gear);
          expect(modernPieces(view), `${language} ${id} ${key} ${current}/${target} UE${ue} BG${gear}`).toEqual(legacyPieces(old));
        }
      }
    }
  }, 30_000);

  it('uses the target upgrade for both parameter columns, as before', () => {
    const view = formatSkill(base, buffs, 'passive', 1, 10, '2', 0);
    expect(view.variant).toBe('WeaponPassive');
    expect(view.tokens.filter((token) => token.kind === 'value')).toEqual([
      { kind: 'value', current: '2000', target: '3800', bold: false, tone: 'default' },
      { kind: 'value', current: '14%', target: '26.6%', bold: false, tone: 'default' }
    ]);
  });

  it('retains repeated/equal parameters, aliases, markup, and zero-level coercion', () => {
    const definitions = decodeSkillDefinitions({ Ex: {
      Name: 'Test', Icon: 'SAFE', Desc: "<?1> <?1> <b:ATK='Attack'> <d:DEF> <c:Stun> <s:Shield>\n<b class='ba-col-mystic'>Mystic</b><br><kb:1>",
      Parameters: [[7, 7, 7, 7, 7]], Cost: [4, 4, 4, 4, 4]
    } });
    const names = { Debuff_DEF: 'DEF', CC_Stun: 'Stun', Special_Shield: 'Shield' };
    const view = formatSkill(definitions, names, 'ex', '0', '2', 0, 0);
    expect(view.level).toBe(1);
    expect(view.cost).toEqual({ current: '4', target: null });
    expect(view.tokens.filter((token) => token.kind === 'value')).toHaveLength(2);
    expect(view.tokens.filter((token) => token.kind === 'value').every((token) => token.current === '7' && token.target === '7')).toBe(true);
    expect(view.tokens).toContainEqual({ kind: 'text', text: 'Mystic', bold: true, tone: 'mystic' });
    expect(view.tokens.some((token) => token.kind === 'text' && token.text.includes('kb:'))).toBe(false);
  });

  it.each([null, undefined, '', ' ', 'bad', -1, 6, 1.5, Infinity])('rejects invalid EX input %s', (value) => {
    expect(() => formatSkill(base, buffs, 'ex', value, 5, 0, 0)).toThrow();
  });

  it('does not turn untrusted descriptions, names or parameters into HTML', () => {
    const definitions = decodeSkillDefinitions({ Public: {
      Name: '<img src=x onerror=alert(1)>', Icon: 'SAFE', Desc: '<script>alert(1)</script><?1>',
      Parameters: [Array(10).fill('<svg onload=alert(2)>')]
    } });
    const view = formatSkill(definitions, buffs, 'basic', 1, 1, 0, 0);
    expect(view.tokens).toContainEqual({ kind: 'text', text: '<script>alert(1)</script>', bold: false, tone: 'default' });
    expect(view.tokens).toContainEqual({ kind: 'value', current: '<svg onload=alert(2)>', target: null, bold: false, tone: 'default' });
    expect(() => decodeSkillDefinitions({ Public: { ...definitions.Public, Icon: '../unsafe' } })).toThrow();
  });

  it('reports missing variants, parameters, effects and costs explicitly', () => {
    expect(() => formatSkill({}, buffs, 'ex', 1, 1, 0, 0)).toThrow();
    for (const desc of ['<?1>', '<b:Unknown>']) {
      const definitions = decodeSkillDefinitions({ Public: { Name: 'Test', Icon: 'SAFE', Desc: desc, Parameters: [] } });
      expect(() => formatSkill(definitions, {}, 'basic', 1, 1, 0, 0)).toThrow();
    }
    expect(() => formatSkill({ Ex: { Name: 'Test', Icon: 'SAFE', Desc: 'Text', Parameters: [] } }, buffs, 'ex', 1, 1, 0, 0)).toThrow();
  });
});

describe('client skill data loading', () => {
  it('loads/caches English effects for English and Indonesian without another student download', async () => {
    const request = vi.fn(async () => effects);
    const load = createSkillDataLoader(request);
    expect((await load('En')).buffNames.Buff_ATK).toBe('ATK');
    expect((await load('Id')).students).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('merges translated buffs with English fallback and makes missing descriptions explicit', async () => {
    const request = vi.fn(async (url: string) => {
      if (url.endsWith('localisation_en.json')) return effects;
      if (url.endsWith('localisation_jp.json')) return { BuffName: { Buff_ATK: 'Translated ATK', Buff_DEF: '' } };
      return { '10000': { Skills: { Ex: { ...base.Ex, Desc: '' }, Public: base.Public } } };
    });
    const data = await createSkillDataLoader(request)('Jp');
    expect(data.buffNames.Buff_ATK).toBe('Translated ATK');
    expect(data.buffNames.Buff_DEF).toBe(buffs.Buff_DEF);
    const selected = studentSkills(aru.Skills, data, '10000');
    expect(selected.definitions.Ex).toEqual(base.Ex);
    expect(selected.fallback.has('Ex')).toBe(true);
    expect(selected.fallback.has('Public')).toBe(false);
  });

  it('does not cache failed/cancelled loads and permits a real retry', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('HTTP 500')).mockResolvedValue(effects);
    const load = createSkillDataLoader(request);
    await expect(load('En')).rejects.toThrow('HTTP 500');
    await expect(load('En')).resolves.toHaveProperty('buffNames');
    const controller = new AbortController();
    controller.abort();
    await expect(load('En', controller.signal)).rejects.toHaveProperty('name', 'AbortError');
  });

  it('discards an in-flight result after cancellation, even if the transport ignores abort', async () => {
    let finish: (value: unknown) => void = () => { throw new Error('No pending request.'); };
    const request = vi.fn().mockImplementationOnce(() => new Promise<unknown>((resolve) => { finish = resolve; })).mockResolvedValue(effects);
    const load = createSkillDataLoader(request);
    const controller = new AbortController();
    const pending = load('En', controller.signal);
    controller.abort();
    finish(effects);
    await expect(pending).rejects.toHaveProperty('name', 'AbortError');
    await expect(load('En')).resolves.toHaveProperty('buffNames');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('retains parameter-index gaps instead of substituting later indices', () => {
    const definitions = decodeSkillDefinitions({ Public: { Name: 'Test', Icon: 'SAFE', Desc: '<?2> <b:ATK>', Parameters: [] } });
    expect(formatSkill(definitions, buffs, 'basic', 1, 1, 0, 0).tokens)
      .toEqual([{ kind: 'text', text: '<?2> ATK', bold: false, tone: 'default' }]);
  });

  it.each(['En', 'Jp'] satisfies Language[])('rejects invalid effect formats for %s', async (language) => {
    await expect(createSkillDataLoader(async () => ({ BuffName: { Broken: 42 } }))(language)).rejects.toThrow('invalid format');
  });

  it('reports malformed localized skills instead of hiding them with a fallback', () => {
    expect(() => studentSkills(aru.Skills, { students: { '10000': { Skills: [] } }, buffNames: buffs }, '10000')).toThrow('Invalid localized');
    expect(() => studentSkills(aru.Skills, { students: { '10000': { Skills: { Ex: { Desc: 'bad' } } } }, buffNames: buffs }, '10000')).toThrow();
  });
});
