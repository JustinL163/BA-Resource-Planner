import type { PlannerMetadata } from '../planner/types';
import type { EventAmounts } from './types';
import type {
  EventPlan,
  EventSummary,
  LessonDefinition,
  LessonLocation,
  LessonReward,
  SavedAmounts
} from './standard-types';

interface PostRun {
  location: number;
  rewardRuns: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredField(record: unknown, key: string, label: string): unknown {
  if (!isRecord(record)) throw new Error(`${label} must be an object.`);
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor || !('value' in descriptor)) throw new Error(`${label} is missing a safe "${key}" value.`);
  return descriptor.value;
}

function optionalField(record: Record<string, unknown>, key: string, label: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor)) throw new Error(`${label} has an unsafe "${key}" value.`);
  return descriptor.value;
}

function recordEntries(value: unknown, label: string): [string, unknown][] {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return Object.keys(value).map((key) => [key, requiredField(value, key, label)]);
}

function arrayValues(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const values: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor)) throw new Error(`${label} has an unsafe index ${index}.`);
    values.push(descriptor.value);
  }
  return values;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function safeString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '' || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`${label} must be a safe nonempty string.`);
  }
  return value;
}

function safeIndex(value: unknown, limit: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value >= limit) {
    throw new Error(`${label} must be a valid lesson location index.`);
  }
  return value;
}

function orderedThresholds(value: unknown, label: string, integer: boolean): number[] {
  const values = arrayValues(value, label);
  if (values.length === 0) throw new Error(`${label} must not be empty.`);

  const thresholds: number[] = [];
  let previous = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < values.length; index += 1) {
    const threshold = finiteNumber(values[index], `${label} threshold ${index}`);
    if (threshold < 0 || (integer && (!Number.isSafeInteger(threshold) || threshold < 1))) {
      throw new Error(`${label} threshold ${index} is invalid.`);
    }
    if (threshold < previous) throw new Error(`${label} must be ordered.`);
    thresholds.push(threshold);
    previous = threshold;
  }
  return thresholds;
}

function decodeLocation(value: unknown, index: number): LessonLocation {
  if (!isRecord(value)) throw new Error(`Lesson location ${index} must be an object.`);
  const label = `Lesson location ${index}`;
  const name1 = safeString(requiredField(value, 'name1', label), `${label} name1`);
  const name2 = safeString(requiredField(value, 'name2', label), `${label} name2`);
  const unlockRank = finiteNumber(requiredField(value, 'unlock_rank', label), `${label} unlock rank`);
  const unlock2 = finiteNumber(requiredField(value, 'unlock_2', label), `${label} secondary unlock`);
  if (!Number.isSafeInteger(unlockRank) || unlockRank < 0 ||
      !Number.isSafeInteger(unlock2) || unlock2 < 0) {
    throw new Error(`${label} unlock values must be nonnegative safe integers.`);
  }

  const rawSwap = requiredField(value, 'id_swap', label);
  const idSwap: Record<string, string> = {};
  for (const [key, rawId] of recordEntries(rawSwap, `${label} ID mappings`)) {
    safeString(key, `${label} mapping key`);
    if (typeof rawId !== 'string' || !/^(0|[1-9]\d*)$/.test(rawId) ||
        !Number.isSafeInteger(Number(rawId))) {
      throw new Error(`${label} mapping "${key}" must contain a safe numeric ID.`);
    }
    Object.defineProperty(idSwap, key, {
      value: rawId,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }

  return { name1, name2, unlock_rank: unlockRank, unlock_2: unlock2, id_swap: idSwap };
}

function decodeReward(value: unknown, label: string): LessonReward {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  const type = safeString(requiredField(value, 'type', label), `${label} type`);
  const rawId = optionalField(value, 'id', label);
  const count = optionalField(value, 'count', label);
  const chance = optionalField(value, 'chance', label);

  let id: string | undefined;
  if (rawId !== undefined) id = safeString(rawId, `${label} ID`);
  if ((type === 'Material' || type === 'Eleph') && id === undefined) {
    throw new Error(`${label} requires an ID.`);
  }

  let decodedCount: number | undefined;
  if (count !== undefined) {
    decodedCount = finiteNumber(count, `${label} count`);
    if (decodedCount < 0) throw new Error(`${label} count must be nonnegative.`);
  }

  let decodedChance: number | undefined;
  if (chance !== undefined) {
    decodedChance = finiteNumber(chance, `${label} chance`);
    if (decodedChance < 0) throw new Error(`${label} chance must be nonnegative.`);
  }

  return {
    type,
    ...(id === undefined ? {} : { id }),
    ...(decodedCount === undefined ? {} : { count: decodedCount }),
    ...(decodedChance === undefined ? {} : { chance: decodedChance })
  };
}

function decodeDefinition(locationsValue: unknown, templateValue: unknown): LessonDefinition {
  const locations = arrayValues(locationsValue, 'Lesson locations').map(decodeLocation);
  if (locations.length === 0) throw new Error('Lesson locations must not be empty.');
  if (!isRecord(templateValue)) throw new Error('Lesson template must be an object.');

  const rankUpgrades = orderedThresholds(
    requiredField(templateValue, 'rank_upgrades', 'Lesson template'),
    'Lesson rank upgrades',
    false
  );
  const levelUnlocks = orderedThresholds(
    requiredField(templateValue, 'level_unlocks', 'Lesson template'),
    'Lesson level unlocks',
    true
  );
  const lessonCost = finiteNumber(
    requiredField(templateValue, 'lesson_cost', 'Lesson template'),
    'Lesson cost'
  );
  if (lessonCost <= 0) throw new Error('Lesson cost must be greater than zero.');

  const rewardRows = arrayValues(
    requiredField(templateValue, 'rewards', 'Lesson template'),
    'Lesson rewards'
  );
  if (rewardRows.length < Math.max(levelUnlocks.length, 5)) {
    throw new Error('Lesson rewards must include every level and the post-run rewards.');
  }
  const rewards = rewardRows.map((row, rowIndex) =>
    arrayValues(row, `Lesson reward level ${rowIndex + 1}`)
      .map((reward, rewardIndex) => decodeReward(reward, `Lesson reward ${rowIndex + 1}, item ${rewardIndex + 1}`))
  );

  return {
    locations,
    rank_upgrades: rankUpgrades,
    level_unlocks: levelUnlocks,
    lesson_cost: lessonCost,
    rewards
  };
}

export function decodeLessonDefinition(locations: unknown, template: unknown): LessonDefinition {
  return decodeDefinition(locations, template);
}

function validateDefinition(definition: LessonDefinition): LessonDefinition {
  if (!isRecord(definition)) throw new Error('Lesson definition must be an object.');
  const template = {
    rank_upgrades: requiredField(definition, 'rank_upgrades', 'Lesson definition'),
    level_unlocks: requiredField(definition, 'level_unlocks', 'Lesson definition'),
    lesson_cost: requiredField(definition, 'lesson_cost', 'Lesson definition'),
    rewards: requiredField(definition, 'rewards', 'Lesson definition')
  };
  return decodeDefinition(requiredField(definition, 'locations', 'Lesson definition'), template);
}

function checkedRuns(
  plan: Pick<EventPlan, 'lesson_pre_runs' | 'lesson_post_runs'>,
  locationCount: number
): { preRuns: number[]; postRuns: PostRun[]; postPointRuns: number } {
  const preRunValues = arrayValues(plan.lesson_pre_runs, 'Lesson pre-runs');
  const preRuns = preRunValues.map((value, index) =>
    safeIndex(value, locationCount, `Lesson pre-run ${index}`)
  );
  const rawPostRuns = plan.lesson_post_runs === undefined ? {} : plan.lesson_post_runs;
  let postPointRuns = 0;
  const postRuns: PostRun[] = [];
  for (const [key, rawCount] of recordEntries(rawPostRuns, 'Lesson post-runs')) {
    if (!/^(0|[1-9]\d*)$/.test(key)) throw new Error(`Invalid lesson post-run location "${key}".`);
    const location = safeIndex(Number(key), locationCount, `Lesson post-run "${key}"`);
    if (typeof rawCount !== 'number' && typeof rawCount !== 'string') {
      throw new Error(`Lesson post-run count for location "${key}" must be numeric.`);
    }
    const rewardRuns = Number(rawCount);
    const pointsRuns = Number.parseInt(String(rawCount));
    if (!Number.isFinite(rewardRuns) || rewardRuns < 0 ||
        !Number.isSafeInteger(pointsRuns) || pointsRuns < 0) {
      throw new Error(`Lesson post-run count for location "${key}" must be a finite nonnegative amount.`);
    }
    postPointRuns += pointsRuns;
    if (!Number.isSafeInteger(postPointRuns)) throw new Error('Total lesson post-runs exceed the safe integer range.');
    postRuns.push({ location, rewardRuns });
  }
  return { preRuns, postRuns, postPointRuns };
}

function rankAtSpend(definition: LessonDefinition, spent: number): { rank: number; rankMaxed: boolean } {
  let rank = 1;
  for (const threshold of definition.rank_upgrades) {
    if (threshold > spent) break;
    rank += 1;
  }
  return {
    rank,
    rankMaxed: spent >= definition.rank_upgrades[definition.rank_upgrades.length - 1]
  };
}

function levelAtRank(definition: LessonDefinition, rank: number): number {
  let level = 1;
  for (let index = 0; index < definition.level_unlocks.length; index += 1) {
    if (definition.level_unlocks[index] > rank) break;
    level = index + 1;
  }
  return level;
}

export function lessonProgress(
  definition: LessonDefinition,
  preRuns: number[],
  postRuns: SavedAmounts,
  pointsAvailable: number
): {
  rank: number;
  level: number;
  rankMaxed: boolean;
  pointsUsed: number;
  pointsRemaining: number;
  remainingRuns: number;
} {
  const decoded = validateDefinition(definition);
  const runs = checkedRuns({ lesson_pre_runs: preRuns, lesson_post_runs: postRuns }, decoded.locations.length);
  const totalRuns = runs.preRuns.length + runs.postPointRuns;
  if (!Number.isSafeInteger(totalRuns)) throw new Error('Total lesson runs exceed the safe integer range.');

  const spent = finiteNumber(runs.preRuns.length * decoded.lesson_cost, 'Lesson pre-run points spent');
  const { rank, rankMaxed } = rankAtSpend(decoded, spent);
  const level = levelAtRank(decoded, rank);
  const pointsUsed = finiteNumber(totalRuns * decoded.lesson_cost, 'Lesson points used');
  const pointsRemaining = finiteNumber(
    finiteNumber(pointsAvailable, 'Available lesson points') - pointsUsed,
    'Remaining lesson points'
  );
  const remainingRuns = Math.max(Math.floor(pointsRemaining / decoded.lesson_cost), 0);
  if (!Number.isSafeInteger(remainingRuns)) throw new Error('Remaining lesson runs exceed the safe integer range.');

  return { rank, level, rankMaxed, pointsUsed, pointsRemaining, remainingRuns };
}

function copyAmounts(value: unknown, label: string): EventAmounts {
  const result: EventAmounts = {};
  for (const [key, rawAmount] of recordEntries(value, label)) {
    safeString(key, `${label} key`);
    const amount = finiteNumber(rawAmount, `${label} value for "${key}"`);
    Object.defineProperty(result, key, {
      value: amount,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  return result;
}

function copySummary(summary: EventSummary): EventSummary {
  if (!isRecord(summary)) throw new Error('Lesson reward summary must be an object.');
  const credit = finiteNumber(requiredField(summary, 'credit', 'Lesson reward summary'), 'Summary credit');
  const eligma = finiteNumber(requiredField(summary, 'eligma', 'Lesson reward summary'), 'Summary eligma');
  const result: EventSummary = {
    ...summary,
    runs: copyAmounts(requiredField(summary, 'runs', 'Lesson reward summary'), 'Summary runs'),
    currencies: copyAmounts(requiredField(summary, 'currencies', 'Lesson reward summary'), 'Summary currencies'),
    artifacts: copyAmounts(requiredField(summary, 'artifacts', 'Lesson reward summary'), 'Summary artifacts'),
    schoolMats: copyAmounts(requiredField(summary, 'schoolMats', 'Lesson reward summary'), 'Summary school materials'),
    eleph: copyAmounts(requiredField(summary, 'eleph', 'Lesson reward summary'), 'Summary eleph'),
    xps: copyAmounts(requiredField(summary, 'xps', 'Lesson reward summary'), 'Summary XP'),
    gear: copyAmounts(requiredField(summary, 'gear', 'Lesson reward summary'), 'Summary gear'),
    credit,
    eligma
  };
  if (summary.boxes !== undefined) result.boxes = { ...summary.boxes };
  if (summary.overflowPurchases !== undefined) {
    result.overflowPurchases = Object.fromEntries(
      Object.entries(summary.overflowPurchases).map(([currency, purchases]) => [currency, { ...purchases }])
    );
  }
  return result;
}

function addAmount(target: EventAmounts, key: string, amount: number, label: string): void {
  safeString(key, `${label} key`);
  const current = Object.hasOwn(target, key) ? target[key] : 0;
  const total = finiteNumber(current + finiteNumber(amount, label), label);
  Object.defineProperty(target, key, {
    value: total,
    enumerable: true,
    configurable: true,
    writable: true
  });
}

function addTotal(current: number, amount: number, label: string): number {
  return finiteNumber(current + finiteNumber(amount, label), label);
}

function selectedRewardAmount(reward: LessonReward): number {
  if (reward.chance) return reward.chance;
  if (reward.count) return reward.count;
  return 0;
}

function materialReward(
  reward: LessonReward,
  location: LessonLocation,
  locationIndex: number,
  metadata: PlannerMetadata
): { category: 'artifacts' | 'schoolMats' | undefined; name?: string } {
  if (reward.id === undefined || !Object.hasOwn(location.id_swap, reward.id)) {
    throw new Error(`Unknown lesson material mapping "${reward.id ?? ''}" at location ${locationIndex}.`);
  }
  const mappedId = location.id_swap[reward.id];
  if (typeof mappedId !== 'string' || !/^(0|[1-9]\d*)$/.test(mappedId) ||
      !Number.isSafeInteger(Number(mappedId))) {
    throw new Error(`Invalid lesson material mapping "${reward.id}" at location ${locationIndex}.`);
  }
  const numericId = Number(mappedId);
  if (numericId < 1000) {
    const names = requiredField(metadata, 'materialNames', 'Planner metadata');
    const name = requiredField(names, mappedId, 'Planner material names');
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error(`Unknown lesson material ID "${mappedId}" in planner metadata.`);
    }
    return { category: 'artifacts', name };
  }
  if (numericId < 5000) {
    const names = requiredField(metadata, 'materialNames', 'Planner metadata');
    const name = requiredField(names, mappedId, 'Planner material names');
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error(`Unknown lesson material ID "${mappedId}" in planner metadata.`);
    }
    return { category: 'schoolMats', name };
  }
  return { category: undefined };
}

function applyRewardSet(
  result: EventSummary,
  rewards: LessonReward[],
  location: LessonLocation,
  locationIndex: number,
  runs: number,
  preRun: boolean,
  metadata: PlannerMetadata
): void {
  for (const reward of rewards) {
    const amount = selectedRewardAmount(reward);
    if (reward.type === 'Eligma') {
      result.eligma = addTotal(result.eligma, amount * runs, 'Lesson eligma total');
    } else if (reward.type === 'Credit') {
      let creditAmount = amount * runs;
      if (preRun) {
        if (reward.count === undefined) throw new Error('Pre-run Credit rewards require a count.');
        creditAmount = reward.count;
      }
      result.credit = addTotal(result.credit, creditAmount, 'Lesson credit total');
    } else if (reward.type === 'Material') {
      const material = materialReward(reward, location, locationIndex, metadata);
      if (material.category !== undefined && material.name !== undefined) {
        addAmount(result[material.category], material.name, amount * runs, 'Lesson material total');
      }
    } else if (reward.type === 'Eleph') {
      if (reward.id === undefined) throw new Error('Lesson Eleph rewards require an ID.');
      addAmount(result.eleph, reward.id, amount * runs, 'Lesson eleph total');
    }
  }
}

export function applyLessonRewards(
  summary: EventSummary,
  definition: LessonDefinition,
  preRuns: number[],
  postRuns: SavedAmounts,
  metadata: PlannerMetadata
): EventSummary {
  const decoded = validateDefinition(definition);
  const runs = checkedRuns({ lesson_pre_runs: preRuns, lesson_post_runs: postRuns }, decoded.locations.length);
  if (!isRecord(metadata)) throw new Error('Planner metadata must be an object.');
  const result = copySummary(summary);

  for (let index = 0; index < runs.preRuns.length; index += 1) {
    const locationIndex = runs.preRuns[index];
    const spent = finiteNumber(index * decoded.lesson_cost, 'Lesson pre-run points spent');
    const { rank } = rankAtSpend(decoded, spent);
    const level = levelAtRank(decoded, rank);
    const rewards = decoded.rewards[level - 1];
    if (!rewards) throw new Error(`Missing lesson rewards for level ${level}.`);
    applyRewardSet(
      result,
      rewards,
      decoded.locations[locationIndex],
      locationIndex,
      1,
      true,
      metadata
    );
  }

  for (const postRun of runs.postRuns) {
    if (postRun.rewardRuns === 0) continue;
    applyRewardSet(
      result,
      decoded.rewards[4],
      decoded.locations[postRun.location],
      postRun.location,
      postRun.rewardRuns,
      false,
      metadata
    );
  }
  return result;
}
