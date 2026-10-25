import type { EventAmounts } from './types';
import type { EventSummary, InvasionDefinition, InvasionRewards, InvasionStage } from './standard-types';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, label: string): UnknownRecord {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = typeof key === 'string' ? Object.getOwnPropertyDescriptor(value, key) : undefined;
    if (typeof key !== 'string' || !descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      throw new Error(`${label} contains an unsafe property.`);
    }
  }
  return value;
}

function requiredField(source: unknown, key: string, label: string): unknown {
  const values = record(source, label);
  const descriptor = Object.getOwnPropertyDescriptor(values, key);
  if (!descriptor || !('value' in descriptor)) throw new Error(`${label} is missing a safe "${key}" value.`);
  return descriptor.value;
}

function recordEntries(value: unknown, label: string): [string, unknown][] {
  const source = record(value, label);
  return Object.keys(source).map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor || !('value' in descriptor)) throw new Error(`${label} contains an unsafe "${key}" value.`);
    return [key, descriptor.value];
  });
}

function arrayValues(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || Reflect.ownKeys(value).length !== value.length + 1) {
    throw new Error(`${label} must be a dense array.`);
  }
  const values: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      throw new Error(`${label} must be a dense array.`);
    }
    values.push(descriptor.value);
  }
  return values;
}

function safeString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '' || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`${label} must be a safe nonempty string.`);
  }
  return value;
}

function nonnegativeSafeInteger(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be a safe integer greater than or equal to ${minimum}.`);
  }
  return value;
}

function finiteNonnegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be finite and nonnegative.`);
  }
  return value;
}

function setOwn<T>(target: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
}

function addAmount(target: EventAmounts, key: string, amount: number, label: string): void {
  const current = Object.hasOwn(target, key) ? target[key] : 0;
  if (!Number.isFinite(current)) throw new Error(`${label} existing amount must be finite.`);
  const total = current + finiteNonnegative(amount, label);
  if (!Number.isFinite(total)) throw new Error(`${label} total must be finite.`);
  setOwn(target, key, total);
}

function decodeAmountsAndTypes(
  amountsValue: unknown,
  typesValue: unknown,
  label: string
): { amounts: EventAmounts; types: string[] } {
  const entries = recordEntries(amountsValue, `${label} amounts`);
  const rawTypes = arrayValues(typesValue, `${label} types`);
  if (entries.length !== rawTypes.length) throw new Error(`${label} types must match the amount keys in count and order.`);

  const amounts: EventAmounts = {};
  const types: string[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const [key, rawAmount] = entries[index];
    if (key.trim() === '') throw new Error(`${label} contains an empty amount key.`);
    const amount = finiteNonnegative(rawAmount, `${label} amount "${key}"`);
    const type = safeString(rawTypes[index], `${label} type ${index}`);
    setOwn(amounts, key, amount);
    types.push(type);
  }
  return { amounts, types };
}

function decodeStage(value: unknown, index: number): InvasionStage {
  const label = `Invasion stage ${index + 1}`;
  record(value, label);
  const number = nonnegativeSafeInteger(requiredField(value, 'number', label), `${label} number`, 1);
  const level = nonnegativeSafeInteger(requiredField(value, 'level', label), `${label} level`, 1);
  const initial = decodeAmountsAndTypes(
    requiredField(value, 'initial', label),
    requiredField(value, 'initial_key', label),
    `${label} initial rewards`
  );
  const drops = decodeAmountsAndTypes(
    requiredField(value, 'drops', label),
    requiredField(value, 'drop_key', label),
    `${label} drops`
  );
  return {
    number,
    level,
    initial: initial.amounts,
    initial_key: initial.types,
    drops: drops.amounts,
    drop_key: drops.types
  };
}

export function decodeInvasion(config: unknown, stages: unknown): InvasionDefinition {
  const maxStage = nonnegativeSafeInteger(requiredField(config, 'max_stage', 'Invasion config'), 'Invasion max_stage', 1);
  const dailyAttempts = nonnegativeSafeInteger(
    requiredField(config, 'daily_attempts', 'Invasion config'),
    'Invasion daily_attempts'
  );
  const firstDayAttempts = nonnegativeSafeInteger(
    requiredField(config, 'first_day_attempts', 'Invasion config'),
    'Invasion first_day_attempts'
  );
  if (firstDayAttempts < maxStage - 1) {
    throw new Error('Invasion first_day_attempts must cover the configured stages.');
  }

  const decodedStages = arrayValues(stages, 'Invasion stages').map(decodeStage);
  if (decodedStages.length < maxStage) throw new Error('Invasion stages must include max_stage.');

  return {
    max_stage: maxStage,
    daily_attempts: dailyAttempts,
    first_day_attempts: firstDayAttempts,
    stages: decodedStages
  };
}

function addTypedReward(
  type: string,
  key: string,
  amount: number,
  multiplier: number,
  totals: InvasionRewards,
  label: string
): void {
  if (type !== 'Currency' && type !== 'Eleph' && type !== 'XP' && type !== 'Credit') return;
  const scaledAmount = amount * multiplier;
  if (!Number.isFinite(scaledAmount) || scaledAmount < 0) {
    throw new Error(`${label} calculated amount must be finite and nonnegative.`);
  }

  if (type === 'Currency') addAmount(totals.currencies, key, scaledAmount, label);
  else if (type === 'Eleph') addAmount(totals.eleph, key, scaledAmount, label);
  else if (type === 'XP') addAmount(totals.xps, key, scaledAmount, label);
  else {
    const credit = totals.credit + scaledAmount;
    if (!Number.isFinite(credit)) throw new Error(`${label} credit total must be finite.`);
    totals.credit = credit;
  }
}

function addStageRewards(
  amounts: EventAmounts,
  types: string[],
  multiplier: number,
  totals: InvasionRewards,
  label: string
): void {
  const entries = recordEntries(amounts, label);
  if (entries.length !== types.length) throw new Error(`${label} types must match the amount keys in count and order.`);
  for (let index = 0; index < entries.length; index += 1) {
    const [key, rawAmount] = entries[index];
    const amount = finiteNonnegative(rawAmount, `${label} amount "${key}"`);
    addTypedReward(types[index], key, amount, multiplier, totals, `${label} amount "${key}"`);
  }
}

export function calculateInvasionRewards(
  definition: InvasionDefinition,
  resetsTotal: number,
  resetsLeft: number,
  midEvent: boolean
): InvasionRewards {
  const validated = decodeInvasion(
    definition,
    requiredField(definition, 'stages', 'Invasion definition')
  );
  const totalResets = nonnegativeSafeInteger(resetsTotal, 'Invasion resetsTotal', 1);
  const remainingResets = midEvent
    ? nonnegativeSafeInteger(resetsLeft, 'Invasion resetsLeft')
    : totalResets - 1;
  const repeatedMultiplier = validated.daily_attempts * remainingResets;
  if (!Number.isFinite(repeatedMultiplier)) throw new Error('Invasion repeated attempt count must be finite.');

  const totals: InvasionRewards = { currencies: {}, eleph: {}, xps: {}, credit: 0 };
  if (!midEvent) {
    for (let index = 0; index < Math.min(validated.stages.length, validated.max_stage); index += 1) {
      const stage = validated.stages[index];
      const dropMultiplier = index + 1 === validated.max_stage
        ? validated.first_day_attempts - validated.max_stage + 1
        : 1;
      addStageRewards(stage.drops, stage.drop_key, dropMultiplier, totals, `Invasion stage ${index + 1} drops`);
      addStageRewards(stage.initial, stage.initial_key, 1, totals, `Invasion stage ${index + 1} initial rewards`);
    }
  }

  const finalStage = validated.stages[validated.max_stage - 1];
  addStageRewards(
    finalStage.drops,
    finalStage.drop_key,
    repeatedMultiplier,
    totals,
    `Invasion stage ${validated.max_stage} repeated drops`
  );
  return totals;
}

function cloneAmounts(value: unknown, label: string): EventAmounts {
  const clone: EventAmounts = {};
  for (const [key, rawAmount] of recordEntries(value, label)) {
    if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount)) {
      throw new Error(`${label} amount "${key}" must be finite.`);
    }
    setOwn(clone, key, rawAmount);
  }
  return clone;
}

function addAmounts(target: EventAmounts, source: EventAmounts, label: string): void {
  for (const [key, rawAmount] of recordEntries(source, label)) {
    addAmount(target, key, finiteNonnegative(rawAmount, `${label} amount "${key}"`), `${label} amount "${key}"`);
  }
}

function cloneBoxes(value: NonNullable<EventSummary['boxes']>): NonNullable<EventSummary['boxes']> {
  const source = record(value, 'Event summary boxes');
  const clears = requiredField(source, 'clears', 'Event summary boxes');
  const leftoverPercent = requiredField(source, 'leftoverPercent', 'Event summary boxes');
  if (typeof clears !== 'number' || !Number.isFinite(clears)) {
    throw new Error('Event summary boxes clears must be finite.');
  }
  if (typeof leftoverPercent !== 'string') throw new Error('Event summary boxes leftoverPercent must be a string.');
  return { clears, leftoverPercent };
}

function cloneOverflowPurchases(
  value: NonNullable<EventSummary['overflowPurchases']>
): NonNullable<EventSummary['overflowPurchases']> {
  const clone: NonNullable<EventSummary['overflowPurchases']> = {};
  for (const [key, amounts] of recordEntries(value, 'Event summary overflow purchases')) {
    setOwn(clone, key, cloneAmounts(amounts, `Event summary overflow purchases "${key}"`));
  }
  return clone;
}

export function applyInvasionRewards(
  summary: EventSummary,
  rewards: InvasionRewards,
  includeOptionalRewards: boolean
): EventSummary {
  const currencies = cloneAmounts(summary.currencies, 'Event summary currencies');
  const eleph = cloneAmounts(summary.eleph, 'Event summary eleph');
  const xps = cloneAmounts(summary.xps, 'Event summary xps');
  const credit = includeOptionalRewards
    ? summary.credit + finiteNonnegative(rewards.credit, 'Invasion credit')
    : summary.credit;
  if (includeOptionalRewards && (!Number.isFinite(summary.credit) || !Number.isFinite(credit))) {
    throw new Error('Event summary credit total must be finite.');
  }

  addAmounts(currencies, rewards.currencies, 'Invasion currencies');
  if (includeOptionalRewards) {
    addAmounts(eleph, rewards.eleph, 'Invasion eleph');
    addAmounts(xps, rewards.xps, 'Invasion XP');
  }

  return {
    runs: cloneAmounts(summary.runs, 'Event summary runs'),
    currencies,
    artifacts: cloneAmounts(summary.artifacts, 'Event summary artifacts'),
    schoolMats: cloneAmounts(summary.schoolMats, 'Event summary school mats'),
    eleph,
    xps,
    gear: cloneAmounts(summary.gear, 'Event summary gear'),
    credit,
    eligma: summary.eligma,
    secretTech: summary.secretTech,
    energy: summary.energy,
    feasible: summary.feasible,
    ...(summary.boxes === undefined ? {} : { boxes: cloneBoxes(summary.boxes) }),
    ...(summary.gearBoxes === undefined ? {} : { gearBoxes: summary.gearBoxes }),
    ...(summary.overflowPurchases === undefined
      ? {}
      : { overflowPurchases: cloneOverflowPurchases(summary.overflowPurchases) })
  };
}
