import type { CharacterInfo, FullInvestment, InvestmentKey, PlannerCharacter, PlannerMetadata } from './types';
import { integer } from '../resources/types';

export interface BulkPatch {
  current: Partial<Record<InvestmentKey, string>>;
  target: Partial<Record<InvestmentKey, string>>;
  stars: { star: number; star_target: number; ue: number; ue_target: number };
}

export type BulkValidationCode = 'invalid-value' | 'ue-requires-five-stars' | 'no-changes';

export class BulkValidationError extends Error {
  constructor(readonly code: BulkValidationCode, message: string) {
    super(message);
    this.name = 'BulkValidationError';
  }
}

export function validateBulkPatch(patch: BulkPatch, metadata: PlannerMetadata): void {
  let changed = patch.stars.star > 0 || patch.stars.star_target > 0;
  for (const side of ['current', 'target'] as const) {
    for (const [key, value] of Object.entries(patch[side])) {
      if (value === '') continue;
      const field = metadata.fields.find((item) => item.key === key);
      if (!value.trim() || !field || key === 'star' || key === 'ue' ||
          !Number.isInteger(Number(value)) || Number(value) < field.min || Number(value) > field.max) {
        throw new BulkValidationError('invalid-value', `Invalid bulk ${key} ${side}.`);
      }
      changed = true;
    }
  }
  for (const [key, value] of Object.entries(patch.stars)) {
    const max = key.startsWith('ue') ? 4 : 5;
    if (!Number.isInteger(value) || value < 0 || value > max) {
      throw new BulkValidationError('invalid-value', `Invalid bulk ${key}.`);
    }
  }
  if ((patch.stars.ue && patch.stars.star !== 5) || (patch.stars.ue_target && patch.stars.star_target !== 5)) {
    throw new BulkValidationError('ue-requires-five-stars', 'Bulk UE changes require five stars.');
  }
  if (!changed) {
    throw new BulkValidationError('no-changes', 'Enter at least one change. Blank fields keep their existing values.');
  }
}

export function applyBulkPatch(character: PlannerCharacter, info: CharacterInfo, patch: BulkPatch): PlannerCharacter {
  const result = { ...character, current: { ...character.current }, target: { ...character.target }, eleph: { ...character.eleph } };
  const current = result.current, target = result.target;
  const uc = patch.current, ut = patch.target, stars = patch.stars;
  const ordinary: InvestmentKey[] = ['level', 'ex', 'basic', 'passive', 'sub', 'gear1', 'gear2', 'gear3'];
  if (character.hasBondGear) ordinary.push('bond_gear');
  for (const key of ordinary) {
    if (uc[key]) current[key] = uc[key];
    if (ut[key]) target[key] = Math.max(Number(ut[key]), Number(current[key]));
    else if (integer(target[key]) < integer(current[key])) target[key] = current[key];
  }
  if (stars.star) { current.star = Math.max(stars.star, info.StarGrade); current.ue = stars.ue; }
  if (stars.star_target) { target.star = Math.max(stars.star_target, Number(current.star)); target.ue = Math.max(stars.ue_target, Number(current.ue)); }
  else {
    if (Number(target.star) < Number(current.star)) target.star = current.star;
    if (Number(target.ue) < Number(current.ue)) target.ue = current.ue;
  }
  function ueLevel(investment: FullInvestment, value: number | string) {
    const stars = Number(investment.ue);
    return stars >= 3 ? value : stars === 2 ? Math.min(Number(value), 40) : stars === 1 ? Math.min(Number(value), 30) : 0;
  }
  if (uc.ue_level) current.ue_level = ueLevel(current, uc.ue_level);
  if (ut.ue_level) target.ue_level = ueLevel(target, Math.max(Number(ut.ue_level), Number(current.ue_level)));
  else if (integer(target.ue_level) < integer(current.ue_level)) target.ue_level = current.ue_level;
  for (const key of ['book_hp', 'book_atk', 'book_heal'] as const) {
    if (uc[key]) current[key] = Number(current.ue) > 0 ? uc[key] : 0;
    if (ut[key]) target[key] = Number(target.ue) > 0 ? Math.max(Number(ut[key]), Number(current[key])) : 0;
    else if (integer(target[key]) < integer(current[key])) target[key] = current[key];
  }
  if (uc.bond) {
    current.bond = Number(current.star) >= 5 ? uc.bond : Math.min(Number(uc.bond), Number(current.star) >= 3 ? 20 : 10);
  }
  if (ut.bond) {
    // Keep the legacy current-star check for this target-bond branch.
    const value = Math.max(Number(ut.bond), Number(current.bond));
    target.bond = Number(target.star) >= 5 ? value : Math.min(value, Number(current.star) >= 3 ? 20 : 10);
  } else if (integer(target.bond) < integer(current.bond)) target.bond = current.bond;
  return result;
}
