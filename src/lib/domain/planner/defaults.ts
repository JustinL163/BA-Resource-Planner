import type { CharacterInfo, ElephState, FullInvestment, PlannerCharacter, PlannerMetadata } from './types';

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
  return JSON.stringify({ current: character.current, target: character.target, eleph: character.eleph });
}
