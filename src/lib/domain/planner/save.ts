import { createDefaultSave } from '../../services/preferences';
import { createCharacter, defaultEleph } from './defaults';
import { investmentKeys, type CharacterInfo, type ElephState, type FullInvestment, type PlannerCharacter, type PlannerMetadata, type PlannerSave } from './types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scalar(value: unknown): value is number | string {
  return (typeof value === 'number' || typeof value === 'string') &&
    String(value).trim() !== '' && Number.isFinite(Number(value));
}

export interface PlannerSaveRepair {
  characterId: string;
  characterName: string;
  field: typeof investmentKeys[number] | 'owned';
  side: 'current' | 'target' | 'eleph';
  kind: 'blank-current-minimum' | 'target-from-current' | 'clamped' | 'invalid-owned-eleph';
}

function investment(
  value: unknown, defaults: FullInvestment, characterId: string, characterName: string,
  side: 'current' | 'target', metadata: PlannerMetadata, fallback?: FullInvestment, repairs?: PlannerSaveRepair[]
): FullInvestment {
  const context = `${characterName} (ID ${characterId}) ${side}`;
  if (value !== undefined && !isRecord(value)) throw new Error(`${context} investments are not an object.`);
  const result = { ...defaults, ...value };
  for (const key of investmentKeys) {
    const rule = metadata.fields.find((field) => field.key === key);
    if (!rule) throw new Error(context + ' ' + key + ' has no investment metadata.');
    let item = value?.[key] === undefined ? defaults[key] : value[key];
    const isBlank = item === null || (typeof item === 'string' && item.trim() === '');
    const wasProvided = value?.[key] !== undefined;
    if (wasProvided && isBlank) {
      if (side === 'target' && fallback) {
        item = fallback[key];
        repairs?.push({ characterId, characterName, field: key, side, kind: 'target-from-current' });
      } else if (side === 'current') {
        item = key === 'star' ? Math.max(rule.min, Number(defaults.star)) : rule.min;
        repairs?.push({ characterId, characterName, field: key, side, kind: 'blank-current-minimum' });
      }
    }
    if (!scalar(item)) throw new Error(context + ' ' + key + ' is not a finite number.');
    const minimum = Math.max(
      rule.min,
      key === 'star' ? Number(defaults.star) : rule.min,
      side === 'target' && fallback ? Number(fallback[key]) : rule.min
    );
    const clamped = Math.min(rule.max, Math.max(minimum, Number(item)));
    if (clamped !== Number(item)) {
      item = clamped;
      repairs?.push({ characterId, characterName, field: key, side, kind: 'clamped' });
    }
    if (!Number.isInteger(Number(item))) {
      throw new Error(context + ' ' + key + ' must be an integer within the investment limits.');
    }
    result[key] = item;
  }
  return result;
}

function eleph(value: unknown, characterId: string, characterName: string, repairs?: PlannerSaveRepair[]): ElephState {
  const context = characterName + ' (ID ' + characterId + ') eleph';
  if (value !== undefined && !isRecord(value)) throw new Error(`${context} settings are not an object.`);
  const result = { ...defaultEleph(), ...value };
  for (const key of ['owned', 'cost', 'purchasable', 'farm_nodes'] as const) {
    let item = value?.[key] === undefined ? result[key] : value[key];
    if (!scalar(item) || Number(item) < 0 || (key === 'owned' && !Number.isInteger(Number(item)))) {
      if (key === 'owned') {
        item = 0;
        repairs?.push({ characterId, characterName, field: 'owned', side: 'eleph', kind: 'invalid-owned-eleph' });
      } else {
        throw new Error(context + ' ' + key + ' must be finite and non-negative.');
      }
    }
    result[key] = item;
  }
  for (const key of ['unlocked', 'node_refresh', 'use_eligma', 'use_shop'] as const) {
    const item = value?.[key] === undefined ? result[key] : value[key];
    if (typeof item !== 'boolean') throw new Error(`${context} ${key} is not a boolean.`);
    result[key] = item;
  }
  if (value?.shop_currency !== undefined && typeof value.shop_currency !== 'string') {
    throw new Error(`${context} shop currency is not a string.`);
  }
  return result;
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item: unknown) => typeof item === 'string' || typeof item === 'number')) {
    throw new Error(`${label} is not a list of character IDs.`);
  }
  return value.map(String);
}

export function parsePlannerSave(
  source: string | null, students: Record<string, CharacterInfo>, metadata: PlannerMetadata,
  names: Record<string, string> = {}, repairs: PlannerSaveRepair[] = []
): PlannerSave {
  const raw: unknown = source === null ? createDefaultSave() : JSON.parse(source);
  if (!isRecord(raw)) throw new Error('Saved planner data is not an object.');
  const version = raw.exportVersion ?? 1;
  if (version !== 1 && version !== 2) throw new Error(`Unsupported save version: ${String(version)}.`);
  if (!Array.isArray(raw.characters)) throw new Error('Saved characters are not a list.');
  const seen = new Set<string>();
  const characters = raw.characters.map((value: unknown): PlannerCharacter => {
    if (!isRecord(value) || (typeof value.id !== 'string' && typeof value.id !== 'number')) {
      throw new Error('A saved character has no valid ID.');
    }
    const id = String(value.id);
    if (!students[id]) throw new Error(`Student data is missing for ${id}. Use the legacy planner or correct the import.`);
    if (seen.has(id)) throw new Error(`Duplicate saved character: ${id}.`);
    seen.add(id);
    const defaults = createCharacter(students[id], metadata);
    if (value.name !== undefined && typeof value.name !== 'string') throw new Error(`Invalid saved name for ${id}.`);
    if (value.enabled !== undefined && typeof value.enabled !== 'boolean') throw new Error(`Invalid enabled flag for ${id}.`);
    const characterName = typeof value.name === 'string' ? value.name : defaults.name;
    const current = version === 1 ? Object.fromEntries(investmentKeys.map((key) => [key, value[key]])) : value.current;
    const target = version === 1 ? Object.fromEntries(investmentKeys.map((key) => [key, value[`${key}_target`]])) : value.target;
    const currentInvestment = investment(current, defaults.current, id, characterName, 'current', metadata);
    const targetInvestment = investment(target, defaults.target, id, characterName, 'target', metadata, currentInvestment, repairs);
    return {
      ...value, id, name: characterName,
      current: currentInvestment,
      target: targetInvestment,
      eleph: eleph(value.eleph, id, characterName, repairs),
      enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
      hasBondGear: defaults.hasBondGear
    };
  });
  const inventory = raw.owned_materials === undefined ? {} : raw.owned_materials;
  if (!isRecord(inventory)) throw new Error('Owned materials are not an object.');
  const owned: PlannerSave['owned_materials'] = Object.create(null);
  for (const [key, amount] of Object.entries(inventory)) {
    if (!scalar(amount) || Number(amount) < 0) throw new Error(`Owned ${key} must be finite and non-negative.`);
    owned[key] = amount;
  }
  const groups = raw.groups === undefined ? createDefaultSave().groups : raw.groups;
  if (!isRecord(groups)) throw new Error('Saved groups are not an object.');
  const disabled = strings(raw.disabled_characters === undefined ? [] : raw.disabled_characters, 'Disabled characters').map((name) => {
    if (students[name]) return name;
    const match = Object.entries(students).find(([id, info]) => info.Name === name || names[id] === name);
    if (!match) throw new Error(`Unknown disabled character: ${name}.`);
    return match[0];
  });
  const order = strings(raw.character_order === undefined ? characters.map((character) => character.id) : raw.character_order, 'Character order');
  if (raw.language !== undefined && typeof raw.language !== 'string') throw new Error('Saved language is not a string.');
  return {
    ...raw, exportVersion: 2, characters, character_order: order, disabled_characters: disabled,
    owned_materials: owned, groups, language: typeof raw.language === 'string' ? raw.language : 'EN'
  };
}

export function validateCharacterEdit(character: PlannerCharacter, info: CharacterInfo, metadata: PlannerMetadata): void {
  for (const field of metadata.fields) {
    for (const side of ['current', 'target'] as const) {
      const value = character[side][field.key];
      const number = Number(value);
      let max = field.max;
      if (field.key === 'ue_level') max = [0, 30, 40, 50, 60][Number(character[side].ue)] ?? 0;
      if (field.key === 'bond_gear' && !character.hasBondGear) max = 0;
      if (field.key.startsWith('book_') && !Number(character[side].ue)) max = 0;
      if (!scalar(value) || !Number.isInteger(number) || number < field.min || number > max) {
        throw new Error(`${field.label} ${side} must be an integer between ${field.min} and ${max}.`);
      }
    }
    if (Number(character.target[field.key]) < Number(character.current[field.key])) {
      throw new Error(`${field.label} target cannot be below current.`);
    }
  }
  if (Number(character.current.star) < info.StarGrade) throw new Error('Current stars cannot be below base rarity.');
  for (const side of ['current', 'target'] as const) {
    if (Number(character[side].ue) > 0 && Number(character[side].star) < 5) throw new Error('UE requires five stars.');
  }
  eleph(character.eleph);
  for (const key of ['owned', 'cost', 'purchasable', 'farm_nodes'] as const) {
    const value = character.eleph[key];
    if (!scalar(value) || !Number.isInteger(Number(value)) || Number(value) < 0) {
      throw new Error(`Eleph ${key} must be a non-negative integer.`);
    }
  }
  if (Number(character.eleph.cost) < 1 || Number(character.eleph.cost) > 5) throw new Error('Eligma cost must be between 1 and 5.');
}
