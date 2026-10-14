import { investmentKeys, type CharacterInfo, type ElephState, type FullInvestment, type PlannerCharacter, type PlannerMetadata } from './types';

const investmentNumberKeys = new Set<string>(investmentKeys);
const elephNumberKeys = new Set(['owned', 'cost', 'purchasable', 'farm_nodes']);

function normalizeFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeFingerprintValue);
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, normalizeFingerprintValue(record[key])]));
  }
  return value;
}

function normalizeFingerprintRecord(record: Record<string, unknown>, numericKeys: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(record).sort().map((key) => {
    const value = record[key];
    if (numericKeys.has(key) && (typeof value === 'number' || typeof value === 'string') &&
      String(value).trim() !== '' && Number.isFinite(Number(value))) {
      return [key, Number(value)];
    }
    return [key, normalizeFingerprintValue(value)];
  }));
}

export function defaultInvestment(info: CharacterInfo): FullInvestment {
  return {
    level: 1, bond: 1, star: info.StarGrade, ue: 0, ue_level: 0,
    ex: 1, basic: 1, passive: info.StarGrade >= 2 ? 1 : 0, sub: info.StarGrade >= 3 ? 1 : 0,
    gear1: 0, gear2: 0, gear3: 0, bond_gear: 0, book_hp: 0, book_atk: 0, book_heal: 0
  };
}

export function defaultEleph(): ElephState {
  return {
    owned: 0, unlocked: true, cost: 1, purchasable: 20, farm_nodes: 0,
    node_refresh: false, use_eligma: false, use_shop: false
  };
}

export function createCharacter(info: CharacterInfo, metadata: PlannerMetadata): PlannerCharacter {
  const current = defaultInvestment(info);
  const target = defaultInvestment(info);
  for (const field of metadata.fields) {
    if (field.key !== 'star' && field.key !== 'ue') target[field.key] = field.targetDefault;
  }
  if (info.StarGrade >= 2) target.passive = 1;
  if (info.StarGrade >= 3) target.sub = 1;
  return {
    id: String(info.Id), name: info.Name, current, target, eleph: defaultEleph(), enabled: true,
    hasBondGear: Boolean(info.Gear && Object.keys(info.Gear).length)
  };
}

export function characterFingerprint(character: PlannerCharacter): string {
  return JSON.stringify({
    current: normalizeFingerprintRecord(character.current, investmentNumberKeys),
    target: normalizeFingerprintRecord(character.target, investmentNumberKeys),
    eleph: normalizeFingerprintRecord(character.eleph, elephNumberKeys)
  });
}
