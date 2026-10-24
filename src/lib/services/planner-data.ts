import { normaliseLanguage, type Language } from '../domain/localisation';
import { isRecord } from '../domain/planner/save';
import type { CharacterInfo, PlannerDataset, PlannerMetadata } from '../domain/planner/types';
import type { ResourceData } from '../domain/resources/types';

const numbers = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item: unknown) => typeof item === 'number' && Number.isFinite(item));
const matrix = (value: unknown): value is number[][] => Array.isArray(value) && value.every(numbers);
const stringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string');
const numberRecord = (value: unknown): value is Record<string, number> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item));
const optionalNumber = (value: unknown) => value === undefined || (typeof value === 'number' && Number.isFinite(value));
const price = (value: unknown) =>
  isRecord(value) && ['amount', 'cost', 'times'].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]));

function character(value: unknown): value is CharacterInfo {
  if (!isRecord(value)) return false;
  return typeof value.Id === 'number' && typeof value.StarGrade === 'number' &&
    ['Name', 'School', 'SquadType', 'BulletType', 'ArmorType', 'WeaponType'].every((key) => typeof value[key] === 'string') &&
    (value.Equipment === undefined || (Array.isArray(value.Equipment) && value.Equipment.every((item: unknown) => typeof item === 'string'))) &&
    ['SkillExMaterial', 'SkillExMaterialAmount', 'SkillMaterial', 'SkillMaterialAmount'].every((key) => value[key] === undefined || matrix(value[key])) &&
    optionalNumber(value.PotentialMaterial) &&
    (value.Gear === undefined || (isRecord(value.Gear) &&
      (value.Gear.TierUpMaterial === undefined || matrix(value.Gear.TierUpMaterial)) &&
      (value.Gear.TierUpMaterialAmount === undefined || matrix(value.Gear.TierUpMaterialAmount))));
}

function resourceData(value: unknown): value is ResourceData {
  if (!isRecord(value) || !isRecord(value.skill_credit_cost)) return false;
  return numbers(value.skill_credit_cost.ex) && numbers(value.skill_credit_cost.other) &&
    numbers(value.level_xp) && numbers(value.ue_xp) && numbers(value.bond_gear_credit_cost) &&
    isRecord(value.cumulative_gear_cost) && Object.values(value.cumulative_gear_cost).every(numberRecord) &&
    isRecord(value.cumulative_mystic_cost) && Object.values(value.cumulative_mystic_cost).every((row) =>
      isRecord(row) && optionalNumber(row.credit) && optionalNumber(row.eleph)) &&
    Array.isArray(value.cumulative_limit_break_cost) && value.cumulative_limit_break_cost.every((row: unknown) =>
      isRecord(row) && typeof row.books === 'number' && typeof row.credit === 'number' &&
      typeof row.artifact_1 === 'number' && optionalNumber(row.artifact_2)) &&
    stringRecord(value.gun_ue_category) && numberRecord(value.unlock_cost) && isRecord(value.hard_modes) &&
    isRecord(value.shop_eleph) && Object.values(value.shop_eleph).every(price) &&
    isRecord(value.shop_characters) && Object.values(value.shop_characters).every((row) =>
      typeof row === 'string' || (price(row) && isRecord(row) && typeof row.currency === 'string')) &&
    isRecord(value.gear_drops) && Object.values(value.gear_drops).every((row) =>
      Array.isArray(row) && row.length >= 3 && row.every((item: unknown) => typeof item === 'string')) &&
    isRecord(value.gear_rates) && Object.values(value.gear_rates).every((rows) =>
      Array.isArray(rows) && rows.every((row: unknown) => isRecord(row) &&
        (typeof row.Tier === 'number' || typeof row.Tier === 'string') &&
        numbers(row.Rates) && (row.OldRates === undefined || numbers(row.OldRates)))) &&
    numberRecord(value.gear_bp_value) &&
    (value.universal_bp_cost === undefined || numberRecord(value.universal_bp_cost));
}

export async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not load ${url}: HTTP ${response.status}.`);
  return response.json();
}

export function decodePlannerDataset(students: unknown, data: unknown, metadata: PlannerMetadata): PlannerDataset {
  if (!isRecord(students) || !Object.values(students).every(character)) throw new Error('Character data has an invalid format.');
  const definitions: Record<string, CharacterInfo> = {};
  for (const [id, info] of Object.entries(students)) {
    if (!character(info) || String(info.Id) !== id) throw new Error(`Invalid character definition: ${id}.`);
    definitions[id] = info;
  }
  if (!resourceData(data)) throw new Error('Resource data has an invalid format.');
  const ids = new Map(Object.entries(metadata.materialNames).map(([id, name]) => [name, id]));
  return { students: definitions, context: { data, materialId: (name) => ids.get(name) } };
}

export async function loadPlannerDataset(metadata: PlannerMetadata, signal?: AbortSignal): Promise<PlannerDataset> {
  const [students, data] = await Promise.all([
    fetchJson('/planner/json/skillinfo/en.json', signal),
    fetchJson('/planner/json/misc_data.json', signal)
  ]);
  return decodePlannerDataset(students, data, metadata);
}

export async function loadCharacterNames(language: Language, dataset: PlannerDataset, signal?: AbortSignal): Promise<Record<string, string>> {
  if (language === 'En' || language === 'Id') {
    return Object.fromEntries(Object.entries(dataset.students).map(([id, info]) => [id, info.Name]));
  }
  const value = await fetchJson(`/planner/json/skillinfo/${language.toLowerCase()}.json`, signal);
  if (!isRecord(value)) throw new Error('Localized character data is not an object.');
  const names: Record<string, string> = {};
  for (const [id, info] of Object.entries(value)) {
    if (!isRecord(info) || typeof info.Name !== 'string') throw new Error(`Invalid localized name for ${id}.`);
    names[id] = info.Name;
  }
  return names;
}

export function savedLanguage(source: string | null): Language {
  if (source === null) return 'En';
  const value: unknown = JSON.parse(source);
  if (!isRecord(value)) throw new Error('Saved planner data is not an object.');
  return normaliseLanguage(value.language);
}
