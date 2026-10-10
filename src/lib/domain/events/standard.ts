import { isRecord } from '../planner/save';
import type { PlannerMetadata } from '../planner/types';
import { calculateInitialClear } from './budget';
import { boxPullCurrencyNeeded, boxRewards } from './boxes';
import { cardPullRequirement } from './cards';
import { lessonProgress } from './lessons';
import type { EventAmounts } from './types';
import type { EventPlan, EventRequirements, EventSummary, ShopItem, StandardEvent } from './standard-types';

function setOwn<T>(record: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(record, key, { value, enumerable: true, configurable: true, writable: true });
}
function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}
function addAmount(record: EventAmounts, key: string, amount: number, label: string): void {
  const current = Object.prototype.hasOwnProperty.call(record, key) ? record[key] : 0;
  setOwn(record, key, finite(current + finite(amount, label), label));
}
function parseLegacyInt(value: unknown): number {
  return Number.parseInt(String(value));
}
function positiveOwned(owned: Record<string, unknown>, key: string): number {
  const parsed = parseLegacyInt(owned[key]);
  return parsed > 0 ? parsed : 0;
}
export function eventRequirements(event: StandardEvent, plan: EventPlan, invasionCurrencies: EventAmounts = {}): EventRequirements {
  const initial = calculateInitialClear(event);
  if (!isRecord(plan.currency_needed) || !isRecord(plan.currency_owned)) {
    throw new Error('Event currency requirements and owned amounts must be records.');
  }
  if (!isRecord(invasionCurrencies)) throw new Error('Invasion currency rewards must be a record.');
  const currencyNeeded: EventPlan['currency_needed'] = Object.assign(Object.create(null), plan.currency_needed);
  for (const rule of event.derivedCurrencyRules ?? []) {
    if (!Object.hasOwn(currencyNeeded, rule.from)) throw new Error(`Missing source currency requirement "${rule.from}".`);
    const sourceAmount = Number(currencyNeeded[rule.from]);
    const derivedAmount = sourceAmount * rule.multiplier;
    if (!Number.isFinite(sourceAmount) || sourceAmount < 0 || !Number.isFinite(derivedAmount)) {
      throw new Error(`Invalid derived currency requirement for "${rule.to}".`);
    }
    currencyNeeded[rule.to] = derivedAmount;
  }
  const invasionAmount = (currency: string): number => {
    if (!Object.prototype.hasOwnProperty.call(invasionCurrencies, currency)) return 0;
    const amount = finite(invasionCurrencies[currency], `Invasion reward for "${currency}"`);
    if (amount < 0) throw new Error(`Invasion reward for "${currency}" cannot be negative.`);
    return amount;
  };
  const midEvent = Object.values(plan.currency_owned).some((value) => parseLegacyInt(value) > 0);
  const needed: EventAmounts = {};
  for (const [currency, rawAmount] of Object.entries(currencyNeeded)) {
    if (!Object.hasOwn(event.currencies, currency)) throw new Error(`Unknown required event currency "${currency}".`);
    if ((typeof rawAmount !== 'number' && typeof rawAmount !== 'string') ||
      (typeof rawAmount === 'string' && rawAmount.trim() === '')) {
      throw new Error(`Invalid required amount for "${currency}".`);
    }
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Required amount for "${currency}" must be finite and non-negative.`);
    }
    const source = event.currencies[currency];
    if (event.derivedCurrencyRules?.some((rule) => rule.from === currency)) continue;
    if (source.source === 'BoxPull') {
      if (!event.boxes || event.box_clear_cost === undefined || !source.pull_currency) throw new Error('Missing box currency configuration.');
      const pullAmount = boxPullCurrencyNeeded({ boxes: event.boxes, box_clear_cost: event.box_clear_cost }, amount);
      // The legacy BoxPull branch subtracts owned reward currency, not draw currency.
      const subtract = initial.rewards[currency] && !midEvent
        ? initial.rewards[source.pull_currency] ?? 0 : positiveOwned(plan.currency_owned, currency);
      if (!(initial.rewards[currency] && !midEvent)) setOwn(needed, currency, Number.NaN);
      setOwn(needed, source.pull_currency, Math.max(pullAmount - subtract - invasionAmount(currency), 0));
    } else if (source.source === 'CardPull') {
      if (!source.pull_currency) throw new Error('Missing card draw currency.');
      setOwn(needed, currency, Number.NaN);
      setOwn(needed, source.pull_currency, Math.max(cardPullRequirement(amount,
        positiveOwned(plan.currency_owned, source.pull_currency), initial.rewards[source.pull_currency] ?? 0) -
        invasionAmount(currency), 0));
    } else {
      const subtract = midEvent ? positiveOwned(plan.currency_owned, currency) : initial.rewards[currency] ?? 0;
      setOwn(needed, currency, Math.max(amount - subtract - invasionAmount(currency), 0));
    }
  }
  const rawTarget = plan.point_target || event.event_point_target || 0;
  if (typeof rawTarget !== 'number' && typeof rawTarget !== 'string') {
    throw new Error('Event point target must be numeric.');
  }
  const target = Number(rawTarget);
  if (!Number.isFinite(target)) throw new Error('Event point target must be finite.');
  const pointSubtract = midEvent ? positiveOwned(plan.currency_owned, 'Event_Point') : initial.rewards.Event_Point;
  const pointTarget = Math.max(target - (pointSubtract ?? Number.NaN), 0);
  return { needed, pointTarget, midEvent, initial };
}
function checkSolverStatus(value: Record<string, unknown>): void {
  if (Object.hasOwn(value, 'result')) finite(value.result, 'Solver objective result');
  if (Object.prototype.hasOwnProperty.call(value, 'feasible')) {
    if (typeof value.feasible !== 'boolean') throw new Error('Invalid solver feasibility status.');
    if (!value.feasible) throw new Error('Event solver reported no feasible solution.');
  }
  if (Object.prototype.hasOwnProperty.call(value, 'bounded')) {
    if (typeof value.bounded !== 'boolean') throw new Error('Invalid solver bounded status.');
    if (!value.bounded) throw new Error('Event solver returned an unbounded solution.');
  }
  if (Object.prototype.hasOwnProperty.call(value, 'unbounded')) {
    if (typeof value.unbounded !== 'boolean') throw new Error('Invalid solver unbounded status.');
    if (value.unbounded) throw new Error('Event solver returned an unbounded solution.');
  }
}
function reverseMaterialId(name: string, materialNames: Record<string, string>): number | undefined {
  for (const [id, materialName] of Object.entries(materialNames)) {
    if (materialName !== name) continue;
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) throw new Error(`Invalid material ID "${id}".`);
    return numericId;
  }
  return undefined;
}
function selectedShopItem(items: unknown, key: string, shop: string): ShopItem | undefined {
  if (!Array.isArray(items)) throw new Error(`Missing shop data for "${shop}".`);
  for (const candidate of items) {
    if (!isRecord(candidate)) throw new Error(`Invalid shop item in "${shop}".`);
    const id = candidate.id;
    if ((typeof id !== 'string' && typeof id !== 'number') || (typeof id === 'number' && !Number.isFinite(id))) {
      throw new Error(`Invalid shop item ID in "${shop}".`);
    }
    if (String(id) !== key) continue;
    if (typeof candidate.type !== 'string') throw new Error(`Invalid shop item type for "${key}".`);
    return {
      id,
      type: candidate.type,
      count: finite(candidate.count, `Shop item count for "${key}"`),
      cost: finite(candidate.cost, `Shop item cost for "${key}"`),
      ...(candidate.amount === undefined ? {} : { amount: finite(candidate.amount, `Shop amount for "${key}"`) }),
    };
  }
  return undefined;
}
function addShopRewards(event: StandardEvent, plan: EventPlan, metadata: PlannerMetadata,
  summary: Pick<EventSummary, 'artifacts' | 'schoolMats' | 'eleph' | 'xps'>): { eligma: number; secretTech: number } {
  if (!isRecord(event.shops) || !isRecord(plan.shop_purchases)) throw new Error('Event shops and purchases must be records.');
  let eligma = 0;
  let secretTech = 0;
  for (const [shopName, rawPurchases] of Object.entries(plan.shop_purchases)) {
    if (!isRecord(rawPurchases)) throw new Error(`Purchases for "${shopName}" must be a record.`);
    const items = Object.prototype.hasOwnProperty.call(event.shops, shopName) ? event.shops[shopName] : undefined;
    for (const [itemKey, rawCount] of Object.entries(rawPurchases)) {
      if (typeof rawCount !== 'number' && typeof rawCount !== 'string') {
        throw new Error(`Invalid purchase count for "${itemKey}".`);
      }
      const count = parseLegacyInt(rawCount);
      if (!Number.isFinite(count)) throw new Error(`Invalid purchase count for "${itemKey}".`);
      if (items === undefined) {
        if (count === 0) continue;
        throw new Error(`Unknown selected shop "${shopName}".`);
      }
      const item = selectedShopItem(items, itemKey, shopName);
      if (item === undefined) {
        if (count === 0) continue;
        throw new Error(`Unknown selected shop item "${itemKey}" in "${shopName}".`);
      }
      const numericId = /^\d+$/.test(itemKey) ? Number(itemKey) : undefined;
      if (numericId !== undefined && !Number.isFinite(numericId)) {
        throw new Error(`Invalid shop item ID "${itemKey}".`);
      }

      if (numericId && numericId < 1000) {
        const name = metadata.materialNames[String(numericId)];
        if (typeof name !== 'string' || name === '') throw new Error(`Missing material data for "${itemKey}".`);
        addAmount(summary.artifacts, name, count, `Shop artifact "${itemKey}"`);
      } else if (numericId && numericId < 5000) {
        const name = metadata.materialNames[String(numericId)];
        if (typeof name !== 'string' || name === '') throw new Error(`Missing material data for "${itemKey}".`);
        addAmount(summary.schoolMats, name, count, `Shop school material "${itemKey}"`);
      } else if (numericId !== undefined && numericId >= 10000 && numericId < 30000) {
        addAmount(summary.eleph, itemKey, count * (item.amount ?? 1), `Shop eleph "${itemKey}"`);
      } else if (itemKey.includes('-') && itemKey.includes('Credit')) {
        const value = Number.parseInt(itemKey.substring(itemKey.indexOf('-') + 1));
        // The legacy array/number guard drops shop Credit from the summary.
        finite(count * finite(value, `Shop Credit ID "${itemKey}"`), `Shop Credit "${itemKey}"`);
      } else if (itemKey.includes('-') && itemKey.includes('Eligma')) {
        const value = Number.parseInt(itemKey.substring(itemKey.indexOf('-') + 1));
        eligma = finite(eligma + count * finite(value, `Shop Eligma ID "${itemKey}"`), 'Shop Eligma total');
      } else if (itemKey === 'SecretTech') {
        secretTech = finite(secretTech + count, 'Shop SecretTech total');
      } else if (itemKey.includes('XP_') && itemKey.length <= 5) {
        addAmount(summary.xps, itemKey, count * (item.amount ?? 1), `Shop XP "${itemKey}"`);
      } else if (itemKey.substring(0, 7) === 'Needle_') {
        addAmount(summary.xps, itemKey, count, `Shop Needle "${itemKey}"`);
      }
    }
  }
  return { eligma, secretTech };
}
export function summarizeEventRuns(
  event: StandardEvent, plan: EventPlan, requirements: EventRequirements, bonuses: EventAmounts,
  energyAvailable: number, solution: unknown, includeShop: boolean, includePoints: boolean, metadata: PlannerMetadata, includeBoxes = false,
): EventSummary {
  finite(energyAvailable, 'Available event energy');
  if (!isRecord(solution)) throw new Error('Event solver result must be a record.');
  checkSolverStatus(solution);
  const rawRuns = Object.prototype.hasOwnProperty.call(solution, 'midpoint') ? solution.midpoint : solution;
  if (!isRecord(rawRuns)) throw new Error('Event solver midpoint must be a record.');
  checkSolverStatus(rawRuns);
  if (!isRecord(event.currencies) || !Array.isArray(event.stages)) throw new Error('Invalid standard event definition.');
  if (!isRecord(metadata.materialNames)) throw new Error('Material names must be a record.');
  const questStages = new Map<string, StandardEvent['stages'][number]>();
  for (const stage of event.stages) {
    if (stage.type !== 'Quest') continue;
    if (typeof stage.number !== 'number' || !Number.isFinite(stage.number)) throw new Error('A quest stage needs a finite stage number.');
    const key = String(stage.number);
    if (questStages.has(key)) throw new Error(`Duplicate quest stage number "${key}".`);
    if (!isRecord(stage.drops)) throw new Error(`Quest stage "${key}" is missing drops.`);
    finite(stage.cost, `Energy cost for quest "${key}"`);
    if (stage.cost < 0) throw new Error(`Energy cost for quest "${key}" cannot be negative.`);
    questStages.set(key, stage);
  }

  const ignoredKeys = new Set(['feasible', 'result', 'bounded', 'unbounded', 'midpoint']);
  const manual = plan.optimisation_type === 'Manual';
  const runsToApply: { key: string; stage: StandardEvent['stages'][number]; value: number }[] = [];
  for (const [key, rawValue] of Object.entries(rawRuns)) {
    if (ignoredKeys.has(key)) continue;
    const stage = questStages.get(key);
    if (!stage) throw new Error(`Unknown quest stage "${key}" in event solver result.`);
    let value: number;
    if (typeof rawValue === 'number') {
      value = finite(rawValue, `Solver runs for quest "${key}"`);
    } else if (manual && typeof rawValue === 'string' && rawValue.trim() !== '') {
      value = Number(rawValue);
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        throw new Error(`Manual runs for quest "${key}" must be a finite integer.`);
      }
    } else {
      throw new Error(`Solver runs for quest "${key}" must be a finite number.`);
    }
    runsToApply.push({ key, stage, value });
  }

  if (!isRecord(requirements.initial) || !isRecord(requirements.needed) || !isRecord(requirements.initial.rewards)) throw new Error('Invalid event requirements.');
  if (typeof requirements.midEvent !== 'boolean') throw new Error('Invalid event timing mode.');
  const initialCost = finite(requirements.initial.cost, 'Initial clear energy cost');
  if (initialCost < 0) throw new Error('Initial clear energy cost cannot be negative.');
  if (typeof requirements.pointTarget !== 'number' ||
    (!Number.isFinite(requirements.pointTarget) && !Number.isNaN(requirements.pointTarget))) throw new Error('Invalid event point requirement.');
  for (const [name, amount] of Object.entries(requirements.needed)) {
    if (['BoxPull', 'CardPull'].includes(event.currencies[name]?.source ?? '') && Number.isNaN(amount)) continue;
    if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid required amount for "${name}".`);
  }

  const runs: EventAmounts = {}, currencies: EventAmounts = {}, artifacts: EventAmounts = {};
  const schoolMats: EventAmounts = {}, eleph: EventAmounts = {}, xps: EventAmounts = {}, gear: EventAmounts = {};
  let credit = 0;
  let eligma = 0;
  let secretTech = 0;
  let farmEnergy = 0;
  let feasible = true;

  for (const { key, stage, value } of runsToApply) {
    if (value <= -1) {
      feasible = false;
      break;
    }
    if (value <= 0.01) continue;
    const stageRuns = Math.ceil(value);
    setOwn(runs, key, finite(stageRuns, `Rounded runs for quest "${key}"`));
    for (const [drop, rawAmount] of Object.entries(stage.drops ?? {})) {
      const amount = finite(rawAmount, `Drop "${drop}" in quest "${key}"`);
      if (Object.prototype.hasOwnProperty.call(event.currencies, drop)) {
        const bonus = bonuses[drop] ?? 0;
        addAmount(currencies, drop, stageRuns * Math.ceil(amount + amount * finite(bonus, `Bonus for "${drop}"`)),
          `Currency "${drop}" in quest "${key}"`);
      } else if (drop === 'Credit') {
        credit = finite(credit + stageRuns * amount, 'Event Credit total');
      } else {
        const numericDrop = /^\d+$/.test(drop) ? Number(drop) : undefined;
        if (numericDrop !== undefined && numericDrop >= 10000 && numericDrop < 30000) continue;
        const materialId = reverseMaterialId(drop, metadata.materialNames);
        if (materialId !== undefined) {
          addAmount(materialId < 1000 ? artifacts : schoolMats, drop, stageRuns * amount, `Material "${drop}" in quest "${key}"`);
        } else if (/^T[1-9]_/.test(drop)) {
          addAmount(gear, drop, stageRuns * amount, `Gear "${drop}" in quest "${key}"`);
        }
      }
    }
    farmEnergy = finite(farmEnergy + stage.cost * stageRuns, 'Farm energy total');
  }
  if (!manual) {
    for (const [name, required] of Object.entries(requirements.needed)) {
      if (currencies[name] < required) feasible = false;
    }
    if (currencies.Event_Point < requirements.pointTarget) feasible = false;
  }
  if (farmEnergy > energyAvailable + 100) feasible = false;

  for (const [name] of Object.entries(requirements.needed)) {
    if (requirements.initial.rewards[name] && !Object.prototype.hasOwnProperty.call(currencies, name)) setOwn(currencies, name, 0);
  }
  if (requirements.midEvent) {
    if (!isRecord(plan.currency_owned)) throw new Error('Owned event currencies must be a record.');
    for (const [name, rawAmount] of Object.entries(plan.currency_owned)) {
      const amount = rawAmount ? parseLegacyInt(rawAmount) : 0;
      addAmount(currencies, name, finite(amount, `Owned event currency "${name}"`), `Owned event currency "${name}"`);
    }
  } else {
    for (const [name, amount] of Object.entries(requirements.initial.rewards)) {
      addAmount(currencies, name, finite(amount, `Initial reward "${name}"`), `Initial reward "${name}"`);
    }
  }

  const overflowPurchases: NonNullable<EventSummary['overflowPurchases']> = Object.create(null);
  let hasOverflowPurchases = false;
  for (const [shopCurrency, items] of Object.entries(event.shops)) {
    if (!Object.prototype.hasOwnProperty.call(currencies, shopCurrency)) continue;
    for (const item of items) {
      if (!item.overflow) continue;
      const id = String(item.id);
      let count: number;
      if (event.omikuji && item.type === 'EventCurrency' && item.cost > 0 && item.overflow_cap) {
        if (plan.optimisation_type === 'Currency') {
          const spend = Number(plan.currency_needed[shopCurrency] ?? 0);
          if (!Number.isFinite(spend)) throw new Error(`Invalid currency spend for "${shopCurrency}".`);
          count = Math.max(Math.min(Math.floor((currencies[shopCurrency] - spend) / item.cost), item.overflow_cap), 0);
          addAmount(currencies, id, count * (item.amount ?? 1), `Overflow currency "${id}"`);
        } else {
          const stored = plan.shop_purchases[shopCurrency]?.[id] ?? 0;
          count = parseLegacyInt(stored);
          if (!Number.isSafeInteger(count) || count < 0 || count > item.overflow_cap) {
            throw new Error(`Invalid overflow purchase count for "${id}".`);
          }
          setOwn(currencies, id, count * (item.amount ?? 1));
        }
      } else if (event.invasion && item.type === 'Eleph' && item.count === -1 && item.cost > 0 && item.overflow_cap) {
        const stored = plan.optimisation_type === 'Currency' ? 0 : plan.shop_purchases[shopCurrency]?.[id] ?? 0;
        count = parseLegacyInt(stored);
        if (!Number.isSafeInteger(count) || count < 0 || count > item.overflow_cap) {
          throw new Error(`Invalid Invasion overflow purchase count for "${id}".`);
        }
      } else if (event.eventId === 'serenade-promenade-rerun' && item.type === 'Eleph' &&
        item.count === 0 && item.cost > 0 && item.overflow_cap) {
        if (plan.optimisation_type === 'Currency') {
          const spend = Number(plan.currency_needed[shopCurrency] ?? 0);
          if (!Number.isFinite(spend)) throw new Error(`Invalid currency spend for "${shopCurrency}".`);
          count = Math.max(Math.min(Math.floor((currencies[shopCurrency] - spend) / item.cost), item.overflow_cap), 0);
          if (includeShop) addAmount(eleph, id, count * (item.amount ?? 1), `Overflow Eleph "${id}"`);
        } else {
          const stored = plan.shop_purchases[shopCurrency]?.[id] ?? 0;
          count = parseLegacyInt(stored);
          if (!Number.isSafeInteger(count) || count < 0 || count > item.overflow_cap) {
            throw new Error(`Invalid Serenade overflow purchase count for "${id}".`);
          }
        }
      } else {
        throw new Error('Invalid event currency overflow purchase.');
      }
      overflowPurchases[shopCurrency] ??= Object.create(null);
      setOwn(overflowPurchases[shopCurrency], id, count);
      hasOverflowPurchases = true;
    }
  }

  let boxInfo: EventSummary['boxes'];
  if (includeBoxes && event.boxes) {
    if (event.box_clear_cost === undefined) throw new Error('Missing box clear cost.');
    const currency = Object.values(event.currencies).find((currency) => currency.source === 'BoxPull');
    if (!currency?.pull_currency) throw new Error('Missing box draw currency.');
    const rewards = boxRewards({ boxes: event.boxes, box_clear_cost: event.box_clear_cost }, currencies[currency.pull_currency] ?? 0, metadata.materialNames);
    for (const [target, extra] of [[artifacts, rewards.artifacts], [schoolMats, rewards.schoolMats], [eleph, rewards.eleph], [xps, rewards.xps]]) {
      for (const [key, count] of Object.entries(extra)) addAmount(target, key, count, `Box reward "${key}"`);
    }
    credit = finite(credit + rewards.credit, 'Event Credit total');
    eligma = finite(eligma + rewards.eligma, 'Event Eligma total');
    secretTech = finite(secretTech + rewards.secretTech, 'Event SecretTech total');
    if (rewards.currency) setOwn(currencies, rewards.currencyName, rewards.currency);
    boxInfo = { clears: rewards.clears, leftoverPercent: rewards.leftoverPercent };
  }

  if (includePoints && event.point_rewards) for (const tier of event.point_rewards) {
    const points = finite(tier.points, 'Point reward tier');
    const count = finite(tier.count, `Point reward "${String(tier.id)}"`);
    if (points > currencies.Event_Point) break;
    const id = String(tier.id);
    if (tier.type === 'XpReport' || tier.type === 'XpOrb') addAmount(xps, id, count, `Point reward "${id}"`);
    else if (tier.type === 'Eligma') eligma = finite(eligma + count, 'Event Eligma total');
    else if (tier.type === 'Credit') credit = finite(credit + count, 'Event Credit total');
    else if (tier.type === 'SecretTech') secretTech = finite(secretTech + count, 'Event SecretTech total');
    else if (tier.type === 'Eleph') addAmount(eleph, id, count, `Point reward "${id}"`);
    else if (tier.type === 'SchoolMat') addAmount(schoolMats, id, count, `Point reward "${id}"`);
  }

  if (includeShop) {
    const shopRewards = addShopRewards(event, plan, metadata, { artifacts, schoolMats, eleph, xps });
    eligma = finite(eligma + shopRewards.eligma, 'Event Eligma total');
    secretTech = finite(secretTech + shopRewards.secretTech, 'Event SecretTech total');
  }
  if (event.eventId === 'serenade-promenade-rerun' && eleph['10058']) {
    addAmount(eleph, '16016', eleph['10058'], 'Serenade Promenade Eleph conversion');
    setOwn(eleph, '10058', 0);
  }
  if (event.lessons) {
    const progress = lessonProgress(event.lessons, plan.lesson_pre_runs ?? [], plan.lesson_post_runs ?? {}, currencies.Event_Point ?? 0);
    if (progress.pointsRemaining < 0) feasible = false;
  }
  if (event.eventId === 'box-shadow-looming') {
    const points = finite(currencies.Event_Point ?? 0, 'BOX Shadow Looming event points');
    // Match the legacy base reward and add 2 Eleph for each 300 Event Points.
    setOwn(eleph, '26014', Math.floor(points / 300) * 2 + 119 + 8);
  }
  return {
    runs, currencies, artifacts, schoolMats, eleph, xps, gear, credit, eligma, secretTech,
    energy: finite(farmEnergy + (requirements.midEvent ? 0 : initialCost), 'Displayed event energy'), feasible,
    ...(boxInfo ? { boxes: boxInfo } : {}),
    ...(hasOverflowPurchases ? { overflowPurchases } : {})
  };
}
