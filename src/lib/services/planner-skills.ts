import type { Language } from '../domain/localisation';
import { isRecord } from '../domain/planner/save';
import { decodeSkillDefinitions, type SkillDefinitions, type SkillVariant } from '../domain/planner/skills';
import { fetchJson } from './planner-data';

export interface SkillData {
  students: Record<string, unknown> | null;
  buffNames: Record<string, string>;
}

const variants: SkillVariant[] = ['Ex', 'Public', 'GearPublic', 'Passive', 'WeaponPassive', 'ExtraPassive'];

function buffNames(value: unknown): Record<string, string> {
  if (!isRecord(value) || !isRecord(value.BuffName) ||
    !Object.values(value.BuffName).every((name) => typeof name === 'string')) {
    throw new Error('Skill effect names have an invalid format.');
  }
  const names: Record<string, string> = {};
  for (const [key, name] of Object.entries(value.BuffName)) {
    if (typeof name === 'string' && name) names[key] = name;
  }
  return names;
}

export function createSkillDataLoader(request: typeof fetchJson = fetchJson) {
  const cache = new Map<Language, SkillData>();
  return async (language: Language, signal?: AbortSignal): Promise<SkillData> => {
    signal?.throwIfAborted();
    const supported = language === 'Id' ? 'En' : language;
    const cached = cache.get(supported);
    if (cached) return cached;
    const english = await request('/planner/json/skillinfo/localisation_en.json', signal);
    const names = buffNames(english);
    let students: Record<string, unknown> | null = null;
    if (supported !== 'En') {
      const code = supported.toLowerCase();
      const [localized, effects] = await Promise.all([
        request(`/planner/json/skillinfo/${code}.json`, signal),
        request(`/planner/json/skillinfo/localisation_${code}.json`, signal)
      ]);
      if (!isRecord(localized)) throw new Error('Localized skill data is not an object.');
      students = localized;
      Object.assign(names, buffNames(effects));
    }
    signal?.throwIfAborted();
    const result = { students, buffNames: names };
    cache.set(supported, result);
    return result;
  };
}

export const loadSkillData = createSkillDataLoader();

export function studentSkills(english: unknown, data: SkillData, id: string): {
  definitions: SkillDefinitions; fallback: Set<SkillVariant>;
} {
  const base = decodeSkillDefinitions(english);
  if (data.students === null) return { definitions: base, fallback: new Set() };
  const localized = data.students[id];
  if (localized !== undefined && !isRecord(localized)) throw new Error(`Invalid localized skills for ${id}.`);
  const skills = localized?.Skills;
  if (skills !== undefined && !isRecord(skills)) throw new Error(`Invalid localized skills for ${id}.`);
  const selected: Record<string, unknown> = {};
  const fallback = new Set<SkillVariant>();
  for (const variant of variants) {
    const candidate = skills?.[variant];
    if (candidate === undefined || (isRecord(candidate) && (candidate.Desc === undefined || candidate.Desc === ''))) {
      if (base[variant]) {
        selected[variant] = base[variant];
        fallback.add(variant);
      }
    } else {
      selected[variant] = candidate;
    }
  }
  return { definitions: decodeSkillDefinitions(selected), fallback };
}
