import type { InvestmentValue } from '../resources/types';

export type SkillKey = 'ex' | 'basic' | 'passive' | 'sub';
export type SkillVariant = 'Ex' | 'Public' | 'GearPublic' | 'Passive' | 'WeaponPassive' | 'ExtraPassive';

export interface SkillDefinition {
  Name: string;
  Icon: string;
  Desc: string;
  Parameters: (string | number)[][];
  Cost?: number[];
}

export type SkillDefinitions = Partial<Record<SkillVariant, SkillDefinition>>;
export type SkillTone = 'default' | 'mystic' | 'explosion' | 'pierce';

export type SkillToken =
  | { kind: 'text'; text: string; bold: boolean; tone: SkillTone }
  | { kind: 'value'; current: string; target: string | null; bold: boolean; tone: SkillTone }
  | { kind: 'break' };

export interface FormattedSkill {
  name: string;
  icon: string;
  variant: SkillVariant;
  level: number;
  targetLevel: number;
  cost: { current: string; target: string | null } | null;
  tokens: SkillToken[];
}

const SKILL_VARIANTS: readonly SkillVariant[] = [
  'Ex',
  'Public',
  'GearPublic',
  'Passive',
  'WeaponPassive',
  'ExtraPassive'
];

const SAFE_ASSET_BASENAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: '\u00a0',
  quot: '"',
  times: '\u00d7'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isSkillVariant(value: string): value is SkillVariant {
  return SKILL_VARIANTS.some((variant) => variant === value);
}

function isSafeAssetBasename(value: string): boolean {
  return SAFE_ASSET_BASENAME.test(value) && !value.includes('..');
}

function validateSkillDefinition(value: unknown, variant: SkillVariant): SkillDefinition {
  if (!isRecord(value)) {
    throw new TypeError(`${variant} skill definition must be an object.`);
  }

  if (!hasOwn(value, 'Name') || typeof value.Name !== 'string' || value.Name.trim().length === 0) {
    throw new TypeError(`${variant} skill definition must have a nonempty Name.`);
  }
  if (!hasOwn(value, 'Icon') || typeof value.Icon !== 'string' || !isSafeAssetBasename(value.Icon)) {
    throw new TypeError(`${variant} skill definition must have a safe asset basename for Icon.`);
  }
  if (!hasOwn(value, 'Desc') || typeof value.Desc !== 'string' || value.Desc.trim().length === 0) {
    throw new TypeError(`${variant} skill definition must have a nonempty Desc.`);
  }

  const rawParameters = value.Parameters;
  if (!hasOwn(value, 'Parameters') || !isUnknownArray(rawParameters)) {
    throw new TypeError(`${variant} skill definition must have a Parameters matrix.`);
  }

  const parameters: (string | number)[][] = [];
  for (let rowIndex = 0; rowIndex < rawParameters.length; rowIndex += 1) {
    const rawRow = rawParameters[rowIndex];
    if (!isUnknownArray(rawRow)) {
      throw new TypeError(`${variant} Parameters row ${rowIndex + 1} must be an array.`);
    }

    const row: (string | number)[] = [];
    for (let columnIndex = 0; columnIndex < rawRow.length; columnIndex += 1) {
      const entry = rawRow[columnIndex];
      if (typeof entry === 'string') {
        row.push(entry);
      } else if (typeof entry === 'number' && Number.isFinite(entry)) {
        row.push(entry);
      } else {
        throw new TypeError(
          `${variant} Parameters entry ${rowIndex + 1}:${columnIndex + 1} must be a string or finite number.`
        );
      }
    }
    parameters.push(row);
  }

  let cost: number[] | undefined;
  if (hasOwn(value, 'Cost') && value.Cost !== null && value.Cost !== undefined) {
    if (!isUnknownArray(value.Cost)) {
      throw new TypeError(`${variant} Cost must be an array of finite numbers.`);
    }

    cost = [];
    for (let index = 0; index < value.Cost.length; index += 1) {
      const entry = value.Cost[index];
      if (typeof entry !== 'number' || !Number.isFinite(entry)) {
        throw new TypeError(`${variant} Cost entry ${index + 1} must be a finite number.`);
      }
      cost.push(entry);
    }
  }

  const definition: SkillDefinition = {
    Name: value.Name,
    Icon: value.Icon,
    Desc: value.Desc,
    Parameters: parameters
  };
  if (cost !== undefined) {
    definition.Cost = cost;
  }
  return definition;
}

export function decodeSkillDefinitions(value: unknown): SkillDefinitions {
  if (!isRecord(value)) {
    throw new TypeError('Skill definitions must be an object.');
  }

  const definitions: SkillDefinitions = {};
  for (const [variant, rawDefinition] of Object.entries(value)) {
    if (!isSkillVariant(variant)) {
      continue;
    }
    definitions[variant] = validateSkillDefinition(rawDefinition, variant);
  }
  return definitions;
}

function readInteger(value: InvestmentValue, label: string, minimum: number, maximum: number): number {
  let parsed: number;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string' && value.trim().length > 0) {
    parsed = Number(value);
  } else {
    throw new TypeError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function readSkillLevel(value: InvestmentValue, label: string, maximum: number): number {
  const level = readInteger(value, label, 0, maximum);
  return level === 0 ? 1 : level;
}

function selectVariant(key: SkillKey, targetUe: number, targetBondGear: number): SkillVariant {
  switch (key) {
    case 'ex':
      return 'Ex';
    case 'basic':
      return targetBondGear >= 2 ? 'GearPublic' : 'Public';
    case 'passive':
      return targetUe >= 2 ? 'WeaponPassive' : 'Passive';
    case 'sub':
      return 'ExtraPassive';
    default:
      throw new TypeError(`Unsupported skill key: ${String(key)}.`);
  }
}

function toneFromClass(value: string): SkillTone | null {
  switch (value) {
    case 'mystic':
    case 'explosion':
    case 'pierce':
      return value;
    default:
      return null;
  }
}

function resolveBuffTag(content: string, buffNames: Record<string, string>): string | null {
  const tagPrefix = content.slice(0, 2);
  let buffPrefix: string;
  switch (tagPrefix) {
    case 'b:':
      buffPrefix = 'Buff_';
      break;
    case 'd:':
      buffPrefix = 'Debuff_';
      break;
    case 'c:':
      buffPrefix = 'CC_';
      break;
    case 's:':
      buffPrefix = 'Special_';
      break;
    default:
      return null;
  }

  const body = content.slice(2);
  if (body.length === 0) {
    return null;
  }

  const aliasMatch = /^([^=<>]+)='([^']*)'$/.exec(body);
  if (aliasMatch) {
    return aliasMatch[2];
  }

  const buffKey = `${buffPrefix}${body}`;
  if (!hasOwn(buffNames, buffKey) || typeof buffNames[buffKey] !== 'string' || buffNames[buffKey].trim().length === 0) {
    throw new Error(`Unknown skill buff: ${buffKey}.`);
  }
  return buffNames[buffKey];
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(?:#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (entity) => {
    const body = entity.slice(1, -1);
    if (body[0] === '#') {
      const isHexadecimal = body[1]?.toLowerCase() === 'x';
      const digits = body.slice(isHexadecimal ? 2 : 1);
      const codePoint = Number.parseInt(digits, isHexadecimal ? 16 : 10);
      if (!Number.isSafeInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
        return '\ufffd';
      }
      if (codePoint === 0 || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        return '\ufffd';
      }
      return String.fromCodePoint(codePoint);
    }
    return HTML_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

function resolveParameterText(text: string, buffNames: Record<string, string>): string {
  let output = '';
  let cursor = 0;

  while (cursor < text.length) {
    if (text[cursor] !== '<') {
      const nextTag = text.indexOf('<', cursor);
      const end = nextTag < 0 ? text.length : nextTag;
      output += decodeHtmlEntities(text.slice(cursor, end));
      cursor = end;
      continue;
    }

    const tagEnd = text.indexOf('>', cursor + 1);
    if (tagEnd < 0) {
      output += decodeHtmlEntities(text.slice(cursor));
      break;
    }

    const tag = text.slice(cursor, tagEnd + 1);
    const buffName = resolveBuffTag(tag.slice(1, -1), buffNames);
    output += decodeHtmlEntities(buffName ?? tag);
    cursor = tagEnd + 1;
  }

  return output;
}

function getContiguousParameterCount(description: string): number {
  const indices = new Set<number>();
  const pattern = /<\?(\d+)>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(description)) !== null) {
    const index = Number(match[1]);
    if (Number.isSafeInteger(index) && match[0] === `<?${index}>`) {
      indices.add(index);
    }
  }

  let count = 0;
  while (indices.has(count + 1)) {
    count += 1;
  }
  return count;
}

function getParameterValue(
  parameters: (string | number)[][],
  parameterIndex: number,
  level: number,
  variant: SkillVariant,
  buffNames: Record<string, string>
): string {
  const row = parameters[parameterIndex - 1];
  if (!row) {
    throw new Error(`${variant} skill is missing Parameters row ${parameterIndex}.`);
  }

  const value = row[level - 1];
  if (value === undefined || (typeof value === 'number' && !Number.isFinite(value))) {
    throw new Error(`${variant} skill is missing parameter ${parameterIndex} at level ${level}.`);
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${variant} skill has an invalid parameter ${parameterIndex} at level ${level}.`);
  }
  return resolveParameterText(String(value), buffNames);
}

function getCostValue(cost: number[] | undefined, level: number, variant: SkillVariant): number {
  const value = cost?.[level - 1];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${variant} skill is missing a cost entry at level ${level}.`);
  }
  return value;
}

function tokenizeDescription(
  description: string,
  parameters: (string | number)[][],
  level: number,
  targetLevel: number,
  variant: SkillVariant,
  buffNames: Record<string, string>
): SkillToken[] {
  const tokens: SkillToken[] = [];
  const styleStack: { bold: boolean; tone: SkillTone }[] = [];
  const parameterCount = getContiguousParameterCount(description);
  let bold = false;
  let tone: SkillTone = 'default';

  function appendText(text: string): void {
    if (text.length === 0) {
      return;
    }

    const decodedText = decodeHtmlEntities(text);
    const previous = tokens[tokens.length - 1];
    if (previous?.kind === 'text' && previous.bold === bold && previous.tone === tone) {
      previous.text += decodedText;
    } else {
      tokens.push({ kind: 'text', text: decodedText, bold, tone });
    }
  }

  function appendBreak(): void {
    tokens.push({ kind: 'break' });
  }

  let cursor = 0;
  while (cursor < description.length) {
    const character = description[cursor];
    if (character === '\n' || character === '\r') {
      appendBreak();
      cursor += character === '\r' && description[cursor + 1] === '\n' ? 2 : 1;
      continue;
    }

    if (character !== '<') {
      let end = cursor + 1;
      while (end < description.length && description[end] !== '<' && description[end] !== '\n' && description[end] !== '\r') {
        end += 1;
      }
      appendText(description.slice(cursor, end));
      cursor = end;
      continue;
    }

    const tagEnd = description.indexOf('>', cursor + 1);
    if (tagEnd < 0) {
      appendText('<');
      cursor += 1;
      continue;
    }

    const tag = description.slice(cursor, tagEnd + 1);
    if (tag === '<kb:1>') {
      cursor = tagEnd + 1;
      continue;
    }
    if (tag === '<b>') {
      styleStack.push({ bold, tone });
      bold = true;
      cursor = tagEnd + 1;
      continue;
    }
    if (tag === '</b>') {
      const previous = styleStack.pop();
      bold = previous?.bold ?? false;
      tone = previous?.tone ?? 'default';
      cursor = tagEnd + 1;
      continue;
    }
    if (/^<br\s*\/?>$/i.test(tag)) {
      appendBreak();
      cursor = tagEnd + 1;
      continue;
    }

    const toneMatch = /^<b class=['"]ba-col-(mystic|explosion|pierce)['"]>$/.exec(tag);
    const tagTone = toneMatch ? toneFromClass(toneMatch[1]) : null;
    if (tagTone !== null) {
      styleStack.push({ bold, tone });
      bold = true;
      tone = tagTone;
      cursor = tagEnd + 1;
      continue;
    }

    const parameterMatch = /^<\?(\d+)>$/.exec(tag);
    if (parameterMatch) {
      const parameterIndex = Number(parameterMatch[1]);
      if (
        Number.isSafeInteger(parameterIndex) &&
        parameterIndex >= 1 &&
        parameterIndex <= parameterCount &&
        tag === `<?${parameterIndex}>`
      ) {
        const current = getParameterValue(parameters, parameterIndex, level, variant, buffNames);
        const target =
          level === targetLevel
            ? null
            : getParameterValue(parameters, parameterIndex, targetLevel, variant, buffNames);
        tokens.push({ kind: 'value', current, target, bold, tone });
        cursor = tagEnd + 1;
        continue;
      }
    }

    const buffName = resolveBuffTag(tag.slice(1, -1), buffNames);
    if (buffName !== null) {
      appendText(buffName);
      cursor = tagEnd + 1;
      continue;
    }

    appendText('<');
    cursor += 1;
  }

  return tokens;
}

export function formatSkill(
  skills: SkillDefinitions,
  buffNames: Record<string, string>,
  key: SkillKey,
  current: InvestmentValue,
  target: InvestmentValue,
  targetUe: InvestmentValue,
  targetBondGear: InvestmentValue
): FormattedSkill {
  const validatedTargetUe = readInteger(targetUe, 'Target UE', 0, 4);
  const validatedTargetBondGear = readInteger(targetBondGear, 'Target bond gear', 0, 2);
  const variant = selectVariant(key, validatedTargetUe, validatedTargetBondGear);
  const maximumLevel = key === 'ex' ? 5 : 10;
  const level = readSkillLevel(current, 'Current skill level', maximumLevel);
  const targetLevel = readSkillLevel(target, 'Target skill level', maximumLevel);

  if (!isRecord(skills) || !hasOwn(skills, variant)) {
    throw new Error(`Missing ${variant} skill definition for ${key}.`);
  }
  if (!isRecord(buffNames)) {
    throw new TypeError('Buff names must be an object.');
  }

  const skill = validateSkillDefinition(skills[variant], variant);
  let cost: FormattedSkill['cost'] = null;
  if (key === 'ex') {
    const currentCost = getCostValue(skill.Cost, level, variant);
    const targetCost = getCostValue(skill.Cost, targetLevel, variant);
    cost = {
      current: String(currentCost),
      target: currentCost === targetCost ? null : String(targetCost)
    };
  }

  return {
    name: skill.Name,
    icon: skill.Icon,
    variant,
    level,
    targetLevel,
    cost,
    tokens: tokenizeDescription(skill.Desc, skill.Parameters, level, targetLevel, variant, buffNames)
  };
}
