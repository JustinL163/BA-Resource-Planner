import type { CharacterInfo, PlannerCharacter } from './types';

/** Preset order used by the legacy sort dialog. */
export const legacySortPresetKeys = [
  'custom', 'level', 'star', 'bond', 'academy', 'name', 'ex', 'street', 'outdoor', 'indoor',
  'bullet', 'armour', 'role', 'weapon'
] as const;

export type LegacySortPresetKey = (typeof legacySortPresetKeys)[number];

/** English fallback labels; callers can localize these labels in their UI. */
export const legacySortPresetLabels: Record<LegacySortPresetKey, string> = {
  custom: 'Custom',
  name: 'Name',
  level: 'Level',
  star: 'Stars',
  bond: 'Bond',
  academy: 'School',
  ex: 'EX',
  street: 'Urban',
  outdoor: 'Outdoors',
  indoor: 'Indoors',
  bullet: 'Attack Type',
  armour: 'Defense Type',
  role: 'Role',
  weapon: 'Weapon Type'
};

export const legacySortPresets = legacySortPresetKeys.map((key) => ({
  key,
  label: legacySortPresetLabels[key]
}));

type LegacySortInfo = CharacterInfo & {
  School?: string;
  TacticRole?: string;
  StreetBattleAdaptation?: number;
  OutdoorBattleAdaptation?: number;
  IndoorBattleAdaptation?: number;
  Weapon?: {
    AdaptationType?: string;
    AdaptationValue?: number;
  };
};

export type LegacyNameLookup = ReadonlyMap<string, string> | Readonly<Record<string, string>>;

const sortOperations: Record<Exclude<LegacySortPresetKey, 'custom'>, readonly LegacySortPresetKey[]> = {
  level: ['level', 'star', 'bond', 'academy', 'name'],
  star: ['star', 'level', 'bond', 'academy', 'name'],
  bond: ['bond', 'star', 'level', 'academy', 'name'],
  academy: ['academy', 'star', 'level', 'bond', 'name'],
  name: ['name'],
  ex: ['ex', 'star', 'level', 'bond', 'academy', 'name'],
  street: ['street', 'star', 'level', 'bond', 'academy', 'name'],
  outdoor: ['outdoor', 'star', 'level', 'bond', 'academy', 'name'],
  indoor: ['indoor', 'star', 'level', 'bond', 'academy', 'name'],
  bullet: ['bullet', 'star', 'level', 'bond', 'academy', 'name'],
  armour: ['armour', 'star', 'level', 'bond', 'academy', 'name'],
  role: ['role', 'star', 'level', 'bond', 'academy', 'name'],
  weapon: ['weapon', 'star', 'level', 'bond', 'academy', 'name']
};

const academyOrder: Record<string, number> = {
  Hyakkiyako: 11, RedWinter: 10, Trinity: 9, Gehenna: 8, Abydos: 7, Millennium: 6,
  Arius: 5, Shanhaijing: 4, Valkyrie: 3, SRT: 2, ETC: 1, Tokiwadai: 0
};

const bulletOrder: Record<string, number> = { Sonic: 4, Mystic: 3, Explosion: 2, Pierce: 1 };
const armourOrder: Record<string, number> = { ElasticArmor: 4, Unarmed: 3, HeavyArmor: 2, LightArmor: 1 };
const roleOrder: Record<string, number> = { Tanker: 5, DamageDealer: 4, Healer: 3, Supporter: 2, Vehicle: 1 };
const weaponOrder: Record<string, number> = { SG: 11, SMG: 10, AR: 9, GL: 8, HG: 7, RL: 6, SR: 5, RG: 4, MG: 3, MT: 2, FT: 1 };

function getName(names: LegacyNameLookup, id: string): string | undefined {
  const map = names as ReadonlyMap<string, string>;
  return typeof map.get === 'function' ? map.get(id) : (names as Readonly<Record<string, string>>)[id];
}

function compareText(left: unknown, right: unknown, japanese: boolean): number {
  const a = String(left);
  const b = String(right);
  if (japanese) return a.localeCompare(b, 'ja');
  return a < b ? -1 : a > b ? 1 : 0;
}

function numeric(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function compareDescending(left: number | undefined, right: number | undefined): number {
  if (left === undefined) return right === undefined ? 0 : 1;
  if (right === undefined) return -1;
  return right - left;
}

function compareLegacyKey(
  left: PlannerCharacter,
  right: PlannerCharacter,
  key: LegacySortPresetKey,
  students: Record<string, CharacterInfo>,
  names: LegacyNameLookup,
  japanese: boolean
): number {
  const leftInfo = students[left.id] as LegacySortInfo | undefined;
  const rightInfo = students[right.id] as LegacySortInfo | undefined;

  if (key === 'name') {
    return compareText(getName(names, left.id), getName(names, right.id), japanese);
  }

  if (key === 'level' || key === 'star' || key === 'bond' || key === 'ex') {
    return compareDescending(numeric(left.current[key]), numeric(right.current[key]));
  }

  const categoryValue = (info: LegacySortInfo | undefined, character: PlannerCharacter): number | undefined => {
    if (!info) return undefined;
    switch (key) {
      case 'academy': return info.School ? academyOrder[info.School] : undefined;
      case 'street': {
        const base = numeric(info.StreetBattleAdaptation);
        if (base === undefined) return undefined;
        return base + (Number(character.current.ue) >= 3 && info.Weapon?.AdaptationType === 'Street'
          ? numeric(info.Weapon.AdaptationValue) ?? 0 : 0);
      }
      case 'outdoor': {
        const base = numeric(info.OutdoorBattleAdaptation);
        if (base === undefined) return undefined;
        return base + (Number(character.current.ue) >= 3 && info.Weapon?.AdaptationType === 'Outdoor'
          ? numeric(info.Weapon.AdaptationValue) ?? 0 : 0);
      }
      case 'indoor': {
        const base = numeric(info.IndoorBattleAdaptation);
        if (base === undefined) return undefined;
        return base + (Number(character.current.ue) >= 3 && info.Weapon?.AdaptationType === 'Indoor'
          ? numeric(info.Weapon.AdaptationValue) ?? 0 : 0);
      }
      case 'bullet': return info.BulletType ? bulletOrder[info.BulletType] : undefined;
      case 'armour': return info.ArmorType ? armourOrder[info.ArmorType] : undefined;
      case 'role': return info.TacticRole ? roleOrder[info.TacticRole] : undefined;
      case 'weapon': return info.WeaponType ? weaponOrder[info.WeaponType] : undefined;
      default: return undefined;
    }
  };

  return compareDescending(categoryValue(leftInfo, left), categoryValue(rightInfo, right));
}

/**
 * Sort characters with the legacy planner presets. Numeric and category values
 * sort high to low, names sort ascending, and equal keys retain input order.
 */
export function sortPlannerCharacters(
  characters: PlannerCharacter[],
  preset: LegacySortPresetKey,
  students: Record<string, CharacterInfo>,
  names: LegacyNameLookup,
  language: string
): PlannerCharacter[] {
  if (preset === 'custom') return [...characters];
  const operations = sortOperations[preset];
  const japanese = language === 'Jp';

  return characters.map((character, index) => ({ character, index })).sort((left, right) => {
    for (const key of operations) {
      const comparison = compareLegacyKey(left.character, right.character, key, students, names, japanese);
      if (comparison !== 0) return comparison;
    }
    return left.index - right.index;
  }).map(({ character }) => character);
}
