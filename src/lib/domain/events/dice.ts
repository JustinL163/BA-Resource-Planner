import { isRecord } from '../planner/save';
import type { DiceRace, DiceReward, EventSummary } from './standard-types';
import type { EventAmounts } from './types';
import type { SimulationRequest } from '../../services/simulations/types';

const rewardTypes = new Set(['FixedDice', 'MoveBonus', 'GearBox', 'Material', 'XpReport', 'XpOrb', 'Eligma', 'Credit', 'SecretTech', 'Eleph', 'Misc']);
const identifiedTypes = new Set(['Material', 'XpReport', 'XpOrb', 'Eleph', 'Misc']);
const hasOwn = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);

function plainRecord(value: unknown, label: string, keys?: readonly string[]): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = typeof key === 'string' ? Object.getOwnPropertyDescriptor(value, key) : undefined;
    if (typeof key !== 'string' || (keys && !keys.includes(key)) ||
      !descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error(`${label} contains an unsupported property.`);
  }
  return value;
}

function denseArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || Reflect.ownKeys(value).length !== value.length + 1) throw new Error(`${label} must be a dense array.`);
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error(`${label} must be a dense array.`);
  }
  return value;
}

function decodeReward(value: unknown, label: string, lapReward: boolean): DiceReward {
  const source = plainRecord(value, label, ['type', 'id', 'amount']);
  if (typeof source.type !== 'string' || !rewardTypes.has(source.type)) throw new Error(`${label} has an unsupported type.`);
  const type = source.type;
  if (lapReward && type === 'MoveBonus') throw new Error(`${label} cannot be a MoveBonus.`);
  const hasId = hasOwn(source, 'id');
  if (identifiedTypes.has(type) && !hasId) throw new Error(`${label} requires an id.`);
  let id: string | undefined;
  if (hasId) {
    if (typeof source.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(source.id)) throw new Error(`${label} id must be a nonempty asset token.`);
    id = source.id;
  }
  const hasAmount = hasOwn(source, 'amount');
  let amount: number | undefined;
  if (hasAmount) {
    const rawAmount = source.amount;
    if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount)) throw new Error(`${label} amount must be finite.`);
    if (type === 'FixedDice' && rawAmount < 0) throw new Error(`${label} amount must be nonnegative.`);
    if (type !== 'FixedDice' && (rawAmount < 0 || !Number.isSafeInteger(rawAmount))) throw new Error(`${label} amount must be a nonnegative safe integer.`);
    if (type === 'MoveBonus' && (rawAmount < 1 || rawAmount > 3)) throw new Error(`${label} MoveBonus amount must be between 1 and 3.`);
    amount = rawAmount;
  } else if (type !== 'FixedDice') {
    throw new Error(`${label} requires an amount.`);
  }
  const reward: DiceReward = { type };
  if (id !== undefined) reward.id = id;
  if (amount !== undefined) reward.amount = amount;
  return reward;
}

function addCumulativeAmount(totals: Map<string, number>, reward: DiceReward, label: string): void {
  if (reward.type === 'FixedDice' || reward.type === 'MoveBonus' || reward.amount === undefined) return;
  const key = reward.id || reward.type;
  const total = (totals.get(key) ?? 0) + reward.amount;
  if (!Number.isSafeInteger(total)) throw new Error(`${label} cumulative reward amount exceeds the safe integer range.`);
  totals.set(key, total);
}

export function decodeDiceRace(value: unknown): DiceRace {
  const source = plainRecord(value, 'Dice race', [
    'roll_currency', 'roll_cost', 'tiles', 'lap_reward_tiers', 'lap_rewards'
  ]);
  if (typeof source.roll_currency !== 'string' || source.roll_currency.trim() === '') throw new Error('Dice race roll_currency must be a nonempty string.');
  if (typeof source.roll_cost !== 'number' || !Number.isFinite(source.roll_cost) || source.roll_cost <= 0) throw new Error('Dice race roll_cost must be finite and positive.');
  const rawTiles = denseArray(source.tiles, 'Dice race tiles');
  if (rawTiles.length !== 18) throw new Error('Dice race tiles must contain exactly 18 entries.');
  const rawTiers = denseArray(source.lap_reward_tiers, 'Dice race lap_reward_tiers');
  const tiers: number[] = [];
  let previousTier = 0;
  for (const tier of rawTiers) {
    if (typeof tier !== 'number' || !Number.isSafeInteger(tier) || tier <= previousTier) throw new Error('Dice race lap_reward_tiers must be positive, strictly increasing safe integers.');
    tiers.push(tier);
    previousTier = tier;
  }
  const rawLapRewards = denseArray(source.lap_rewards, 'Dice race lap_rewards');
  if (rawLapRewards.length !== tiers.length) throw new Error('Dice race lap_rewards must match lap_reward_tiers.');
  const totals = new Map<string, number>();
  const tiles = rawTiles.map((item, index) => {
    const reward = decodeReward(item, `Dice race tile ${index}`, false);
    addCumulativeAmount(totals, reward, `Dice race tile ${index}`);
    return reward;
  });
  if (tiles.filter((reward) => reward.type === 'FixedDice').length > 1) throw new Error('Dice race may contain at most one FixedDice tile.');
  const lapRewards = rawLapRewards.map((items, lapIndex) => {
    const rewards = denseArray(items, `Dice race lap reward ${lapIndex}`).map((item, rewardIndex) => {
      const reward = decodeReward(item, `Dice race lap reward ${lapIndex}, item ${rewardIndex}`, true);
      addCumulativeAmount(totals, reward, `Dice race lap reward ${lapIndex}, item ${rewardIndex}`);
      return reward;
    });
    return rewards;
  });

  return {
    roll_currency: source.roll_currency,
    roll_cost: source.roll_cost,
    tiles,
    lap_reward_tiers: tiers,
    lap_rewards: lapRewards
  };
}

export function diceRewardNames(race: DiceRace): string[] {
  const names = new Set<string>();
  for (const rewards of race.lap_rewards) {
    for (const reward of rewards) {
      const name = reward.id || (reward.type !== 'FixedDice' ? reward.type : '');
      if (name) names.add(name);
    }
  }
  for (const reward of race.tiles) {
    if (reward.type === 'MoveBonus' || reward.type === 'FixedDice') continue;
    const name = reward.id || reward.type;
    if (name) names.add(name);
  }
  return [...names];
}

export function diceSimulationRequest(
  race: DiceRace,
  currency: number
): Extract<SimulationRequest, { kind: 'dice' }> {
  if (typeof currency !== 'number' || !Number.isFinite(currency) || currency < 0 || currency > 200000) throw new Error('Dice simulation currency must be finite and between 0 and 200000.');
  const decodedRace = decodeDiceRace(race);
  return {
    kind: 'dice',
    race: decodedRace,
    targets: Array.from({ length: 18 }, () => []),
    currencyOwned: currency,
    tickets: [1, 1, 1, 1, 1, 1]
  };
}

function cloneAmounts(value: EventAmounts, label: string): EventAmounts {
  const source = plainRecord(value, label);
  const copy: EventAmounts = {};
  for (const [key, amount] of Object.entries(source)) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new Error(`${label} entry "${key}" must be finite.`);
    }
    Object.defineProperty(copy, key, { value: amount, enumerable: true, configurable: true, writable: true });
  }
  return copy;
}

function addTotal(current: number, amount: number, name: string): number {
  const total = current + amount;
  if (!Number.isFinite(current) || !Number.isFinite(total)) {
    throw new Error(`Dice reward total for "${name}" is not finite.`);
  }
  return total;
}

function addToDictionary(target: EventAmounts, key: string, amount: number): void {
  const current = hasOwn(target, key) ? target[key] : 0;
  if (typeof current !== 'number' || !Number.isFinite(current)) {
    throw new Error(`Dice reward total for "${key}" is not finite.`);
  }
  const total = current + amount;
  if (!Number.isFinite(total)) throw new Error(`Dice reward total for "${key}" is not finite.`);
  Object.defineProperty(target, key, { value: total, enumerable: true, configurable: true, writable: true });
}

export function applyDiceRewards(summary: EventSummary, rounded: EventAmounts): EventSummary {
  const rewardAmounts = plainRecord(rounded, 'Rounded dice rewards');
  const result: EventSummary = {
    ...summary,
    runs: cloneAmounts(summary.runs, 'Dice summary runs'),
    currencies: cloneAmounts(summary.currencies, 'Dice summary currencies'),
    artifacts: cloneAmounts(summary.artifacts, 'Dice summary artifacts'),
    schoolMats: cloneAmounts(summary.schoolMats, 'Dice summary schoolMats'),
    eleph: cloneAmounts(summary.eleph, 'Dice summary eleph'),
    xps: cloneAmounts(summary.xps, 'Dice summary xps'),
    gear: cloneAmounts(summary.gear, 'Dice summary gear'),
    gearBoxes: summary.gearBoxes === undefined ? 0 : summary.gearBoxes,
    ...(summary.boxes === undefined ? {} : { boxes: { ...summary.boxes } })
  };

  for (const [name, amount] of Object.entries(rewardAmounts)) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error(`Rounded dice reward "${name}" must be finite.`);
    if (amount === 0) continue;
    if (name === 'Credit') {
      result.credit = addTotal(result.credit, amount, name);
    } else if (name.includes('XP_')) {
      addToDictionary(result.xps, name, amount);
    } else if (name === 'Eligma') {
      result.eligma = addTotal(result.eligma, amount, name);
    } else if (name === 'SecretTech') {
      result.secretTech = addTotal(result.secretTech, amount, name);
    } else if (name === 'GearBox') {
      result.gearBoxes = addTotal(result.gearBoxes === undefined ? 0 : result.gearBoxes, amount, name);
    } else {
      const numericId = parseInt(name);
      if (numericId && numericId >= 10000 && numericId < 30000) {
        addToDictionary(result.eleph, name, amount);
      }
    }
  }
  return result;
}
