import { isRecord } from '../planner/save';
import { decodeCoreEvent } from './data';
import { boxCurrencyObtained } from './boxes';
import { decodeCardDraws } from './cards';
import { decodeDiceRace, diceRewardNames } from './dice';
import { decodeOmikuji, omikujiRewardNames } from './omikuji';
import { decodeLessonDefinition } from './lessons';
import { decodeInvasion } from './invasion';
import { decodeCardStatistics, validateStandardDeviation } from './card-statistics';
import type { EventEnergySettings } from './types';
import type { BoxCycle, EventMode, EventPlan, PointReward, SavedAmounts, ShopItem, StandardEvent } from './standard-types';

export interface EventEntry { id: string; name: string; icon: string; comingSoon: boolean; event: StandardEvent | null; archived?: boolean }
export const standardEventIds = ['lore-pursuit-s2', 'box-shadow-looming-rerun'];
export const boxEventIds = ['moonlight-dream', 'pandemic-hazard', '0068-opera-with-love-rerun', 'say-bing-rerun', 'kivotos-unsolved-mysteries'];
export const cardEventIds = ['get-hyped-and-march-on-rerun', 'art-for-whom'];
export const diceEventIds = ['occult-research-society'];
export const omikujiEventIds = ['magical-girl-trinity', 'new-year-march-rerun', 'pray-ball', 'an-unconcealed-path', 'pray-ball-rerun'];
export const lessonEventIds = ['on-your-mark', 'hot-spring-rerun', 'restoration-project', 'on-your-mark-rerun'];
export const invasionEventIds = ['valentine-rerun'];
const modes: EventMode[] = ['', 'Shop', 'Materials', 'Currency', 'Manual'];

function number(value: unknown, label: string, max = Infinity): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' ||
    !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > max) throw new Error(`Invalid event ${label}.`);
  return Number(value);
}

export function eventInteger(value: unknown, label: string, max = Infinity): number {
  const result = number(value, label, max);
  if (!Number.isInteger(result)) throw new Error(`Event ${label} must be an integer.`);
  return result;
}

function asset(value: unknown): string {
  if (typeof value !== 'string' || !value || /[\\/:]/.test(value) || value.includes('..')) throw new Error('Invalid event image filename.');
  return value;
}

function reward(value: unknown): ShopItem {
  if (!isRecord(value) || (typeof value.id !== 'string' && typeof value.id !== 'number') || typeof value.type !== 'string') throw new Error('Invalid event reward.');
  if (value.overflow !== undefined && typeof value.overflow !== 'boolean') throw new Error('Invalid event overflow flag.');
  const overflow = value.overflow === true;
  const count = overflow && value.count === -1 ? -1 : eventInteger(value.count, 'reward count');
  const item: ShopItem = { id: value.id, type: value.type, count, cost: number(value.cost ?? 0, 'reward cost') };
  if (value.amount !== undefined) item.amount = number(value.amount, 'reward amount');
  if (value.default !== undefined) item.default = eventInteger(value.default, 'default purchase', item.count);
  if (value.locked !== undefined) {
    if (typeof value.locked !== 'boolean') throw new Error('Invalid event locked purchase.');
    item.locked = value.locked;
  }
  if (value.overflow !== undefined) item.overflow = overflow;
  if (value.overflow_cap !== undefined) item.overflow_cap = eventInteger(value.overflow_cap, 'overflow cap');
  return item;
}

export function decodeStandardEvent(value: unknown): StandardEvent {
  const core = decodeCoreEvent(value);
  if (!isRecord(value) || typeof value.display_name !== 'string' || !isRecord(value.shops) ||
    !Array.isArray(value.available_targets) || !Array.isArray(value.currency_targets)) throw new Error('Invalid standard event.');
  const cards = value.card_drops === undefined ? undefined : decodeCardDraws(value.card_drops);
  const dice = value.dice_race === undefined ? undefined : decodeDiceRace(value.dice_race);
  const omikuji = value.omikuji === undefined ? undefined : decodeOmikuji(value.omikuji);
  const lessons = value.lessons === undefined ? undefined : decodeLessonDefinition(value.lessons, value.lessons_template);
  const invasion = value.invasion_config === undefined && value.invasion_stages === undefined
    ? undefined : decodeInvasion(value.invasion_config, value.invasion_stages);
  if ((lessons && (omikuji || cards || dice || invasion || value.boxes !== undefined)) ||
    (invasion && (omikuji || cards || dice || value.boxes !== undefined)) ||
    Number(Boolean(omikuji)) + Number(Boolean(cards)) + Number(Boolean(dice)) + Number(value.boxes !== undefined) > 1) {
    throw new Error('Mixed special-event mechanics require the legacy planner.');
  }
  const stageGroups = value.stage_groups ?? (lessons && core.stages.every((stage) => stage.group == null) ? ['', '', ''] : undefined);
  if (!Array.isArray(stageGroups)) throw new Error('Invalid standard event stage groups.');
  let boxes: BoxCycle[] | undefined;
  let boxCost: number | undefined;
  if (value.boxes !== undefined) {
    if (!Array.isArray(value.boxes) || !value.boxes.length) throw new Error('Invalid event box cycles.');
    boxCost = eventInteger(value.box_clear_cost, 'box clear cost');
    if (boxCost === 0) throw new Error('Box clear cost must be positive.');
    boxes = value.boxes.map((set: unknown) => {
      if (!isRecord(set) || !Array.isArray(set.cycle) || !set.cycle.length || !Array.isArray(set.rewards)) throw new Error('Invalid event box cycle.');
      const cycles: string[] = [];
      for (const key of set.cycle) {
        if (typeof key !== 'string' || !/^[1-9]\d*$/.test(key) || !Number.isSafeInteger(Number(key))) throw new Error('Invalid box cycle number.');
        cycles.push(key);
      }
      return {
        cycle: cycles,
        rewards: set.rewards.map((entry: unknown) => {
          const item = reward(entry);
          if (!isRecord(entry)) throw new Error('Invalid box reward.');
          return { id: item.id, type: item.type, count: item.count, amount: eventInteger(entry.amount, 'box reward amount') };
        })
      };
    });
    const mapping = Object.fromEntries(boxes.flatMap((box, index) => box.cycle.map((key) => [key, index])));
    if (!Object.hasOwn(mapping, String(Object.keys(mapping).length))) throw new Error('Missing repeating box cycle.');
    boxCurrencyObtained({ boxes, box_clear_cost: boxCost }, 0);
  }
  const currencies: StandardEvent['currencies'] = {};
  if (!isRecord(value.currencies)) throw new Error('Invalid event currencies.');
  for (const [key, currency] of Object.entries(value.currencies)) {
    if (!isRecord(currency) || (currency.source !== 'StageDrop' &&
      // The legacy Lessons/Invasion definitions omit the source on Event_Point.
      !((lessons || invasion) && key === 'Event_Point' && currency.source === undefined) &&
      !(boxes && currency.source === 'BoxPull') && !(cards && currency.source === 'CardPull') &&
      !(omikuji && (currency.source === 'ShopPurchase' || currency.source === 'ShopBuy'))) ||
      typeof currency.shortname !== 'string') throw new Error('This currency requires the legacy planner.');
    const currencyIcon = currency.icon ?? ((lessons || invasion) && key === 'Event_Point' ? 'Event_Point.png' : undefined);
    currencies[key] = { ...core.currencies[key], icon: asset(currencyIcon), shortname: currency.shortname };
    if (currency.clear !== undefined) currencies[key].clear = number(currency.clear, 'currency target');
    if (currency.source === 'BoxPull' || currency.source === 'CardPull') {
      if (typeof currency.pull_currency !== 'string') throw new Error('Draw reward currency has no draw currency.');
      currencies[key].pull_currency = currency.pull_currency;
    }
  }
  const boxCurrencies = Object.entries(currencies).filter(([, currency]) => currency.source === 'BoxPull');
  if (boxes) {
    if (boxCurrencies.length !== 1) throw new Error('A box event must define exactly one box reward currency.');
    const [rewardCurrency, currency] = boxCurrencies[0];
    if (!currency.pull_currency || currencies[currency.pull_currency]?.source !== 'StageDrop') throw new Error('Invalid box draw currency.');
    for (const box of boxes) {
      if (!box.rewards.some((item) => item.type === 'EventCurrency' && String(item.id) === rewardCurrency && item.amount * item.count > 0) ||
        box.rewards.some((item) => item.type === 'EventCurrency' && String(item.id) !== rewardCurrency)) throw new Error('Invalid box reward currency.');
    }
  }
  if (cards) {
    const cardCurrencies = Object.entries(currencies).filter(([, currency]) => currency.source === 'CardPull');
    if (cardCurrencies.length !== 1 || !cardCurrencies[0][1].pull_currency ||
      currencies[cardCurrencies[0][1].pull_currency]?.source !== 'StageDrop') throw new Error('Invalid card draw currency.');
    const rewardCurrency = cardCurrencies[0][0];
    if (!cards.every((card) => card.drops[rewardCurrency] !== undefined)) throw new Error('A card is missing its event reward currency.');
  }
  if (dice && currencies[dice.roll_currency]?.source !== 'StageDrop') throw new Error('Invalid dice roll currency.');
  if (omikuji) {
    const currency = currencies[omikuji.pull_currency];
    if (!currency || (currency.source !== 'ShopPurchase' && currency.source !== 'ShopBuy')) {
      throw new Error('Omikuji draw currency must use a supported Event Point overflow shop.');
    }
  }
  const shops: StandardEvent['shops'] = {};
  for (const [currency, items] of Object.entries(value.shops)) {
    if (!currencies[currency] || !Array.isArray(items)) throw new Error(`Invalid event shop ${currency}.`);
    shops[currency] = items.map((source: unknown) => {
      const item = reward(source);
      if (!item.overflow) return item;
      const supportedOmikujiOverflow = Boolean(omikuji && currency === 'Event_Point' &&
        item.type === 'EventCurrency' && item.count === 0 && item.overflow_cap &&
        currencies[currency].source === 'StageDrop');
      const supportedInvasionOverflow = Boolean(invasion && item.type === 'Eleph' &&
        item.count === -1 && item.overflow_cap && currencies[currency].source === 'StageDrop');
      if (!supportedOmikujiOverflow && !supportedInvasionOverflow) {
        throw new Error('This overflow shop requires the legacy planner.');
      }
      if (omikuji && String(item.id) === omikuji.pull_currency && item.amount === undefined) item.amount = 1;
      return item;
    });
  }
  if (omikuji) {
    const matching = Object.entries(shops).flatMap(([currency, items]) =>
      items.filter((item) => item.overflow && item.type === 'EventCurrency' && String(item.id) === omikuji.pull_currency)
        .map((item) => ({ currency, item })));
    if (matching.length !== 1 || matching[0].currency !== 'Event_Point') {
      throw new Error('Omikuji requires one capped Event Point overflow draw currency.');
    }
  }
  if (invasion) {
    for (const stage of invasion.stages) {
      const dropNames = Object.keys(stage.drops);
      for (let index = 0; index < dropNames.length; index += 1) {
        if (stage.drop_key[index] === 'Currency' && !Object.hasOwn(currencies, dropNames[index])) {
          throw new Error(`Unknown Invasion currency "${dropNames[index]}".`);
        }
      }
      const initialNames = Object.keys(stage.initial);
      for (let index = 0; index < initialNames.length; index += 1) {
        if (stage.initial_key[index] === 'Currency' && !Object.hasOwn(currencies, initialNames[index])) {
          throw new Error(`Unknown initial Invasion currency "${initialNames[index]}".`);
        }
      }
    }
  }
  if (invasion) {
    const overflowItems = Object.entries(shops).flatMap(([currency, items]) =>
      items.filter((item) => item.overflow).map((item) => ({ currency, item })));
    if (overflowItems.length !== 1 || overflowItems[0].item.type !== 'Eleph' ||
      overflowItems[0].item.count !== -1 || !overflowItems[0].item.overflow_cap) {
      throw new Error('The Invasion event requires one capped Eleph overflow shop item.');
    }
  }
  const available: Exclude<EventMode, ''>[] = [];
  for (const mode of value.available_targets) {
    if (mode !== 'Shop' && mode !== 'Materials' && mode !== 'Currency' && mode !== 'Manual') throw new Error('Invalid event optimization mode.');
    available.push(mode);
  }
  if (!value.currency_targets.every((key: unknown) => typeof key === 'string' && Boolean(currencies[key])) ||
    stageGroups.length !== 3 || !stageGroups.every((key: unknown) => typeof key === 'string')) throw new Error('Invalid event targets or stage groups.');
  const points: PointReward[] = [];
  if (value.point_rewards !== undefined) {
    if (!Array.isArray(value.point_rewards)) throw new Error('Invalid event point rewards.');
    for (const tier of value.point_rewards) {
      if (!isRecord(tier)) throw new Error('Invalid event point tier.');
      const identified = tier.id === undefined && typeof tier.type === 'string' &&
        ['Credit', 'Eligma', 'SecretTech', 'Pyroxene', 'Energy'].includes(tier.type) ? { ...tier, id: tier.type } : tier;
      points.push({ ...reward(identified), points: eventInteger(tier.points, 'point tier') });
    }
  }
  const result: StandardEvent = {
    ...core, display_name: value.display_name, icon: asset(value.icon), currencies, shops,
    available_targets: available, currency_targets: value.currency_targets, stage_groups: stageGroups
  };
  if (!Array.isArray(value.stages)) throw new Error('Invalid standard event stages.');
  const rawStages = value.stages;
  result.stages = core.stages.map((stage, index) => {
    const raw = rawStages[index];
    if (!isRecord(raw)) throw new Error('Invalid standard event stage.');
    const extra: { label?: string; visible?: boolean } = {};
    if (raw.label !== undefined) {
      if (typeof raw.label !== 'string') throw new Error('Invalid quest label.');
      extra.label = raw.label;
    }
    if (raw.visible !== undefined) {
      if (typeof raw.visible !== 'boolean') throw new Error('Invalid quest visibility.');
      extra.visible = raw.visible;
    }
    return { ...stage, ...extra };
  });
  if (value.event_point_target !== undefined) result.event_point_target = number(value.event_point_target, 'point target');
  if (value.active !== undefined) {
    if (typeof value.active !== 'boolean') throw new Error('Invalid event active flag.');
    result.active = value.active;
  }
  if (value.point_rewards !== undefined) result.point_rewards = points;
  if (boxes && boxCost !== undefined) { result.boxes = boxes; result.box_clear_cost = boxCost; }
  if (cards) result.card_drops = cards;
  if (dice) result.dice_race = dice;
  if (omikuji) result.omikuji = omikuji;
  if (lessons) result.lessons = lessons;
  if (invasion) result.invasion = invasion;
  return result;
}

export function decodeEventCatalog(value: unknown, includeSupportedArchives = false, reviewedArchive?: unknown): EventEntry[] {
  if (!isRecord(value) || !isRecord(value.events) || !Array.isArray(value.event_order)) throw new Error('Invalid event catalog.');
  const events = value.events;
  let archivedEvents: Record<string, unknown> = {};
  if (reviewedArchive !== undefined) {
    if (!isRecord(reviewedArchive) || !isRecord(reviewedArchive.events)) throw new Error('Invalid reviewed archived event catalog.');
    archivedEvents = reviewedArchive.events;
  }
  const listedCount = value.event_order.length;
  const order: unknown[] = [...value.event_order];
  if (includeSupportedArchives) {
    const listed = new Set(order.filter((key): key is string => typeof key === 'string').map((key) => key.replace(/^\|/, '')));
    for (const id of [...standardEventIds, ...boxEventIds, ...cardEventIds, ...diceEventIds, ...omikujiEventIds, ...lessonEventIds, ...invasionEventIds]) {
      if (!listed.has(id) && (Object.hasOwn(events, id) || Object.hasOwn(archivedEvents, id))) order.push(id);
    }
  }
  return order.map((key: unknown, index: number) => {
    if (typeof key !== 'string') throw new Error('Invalid event list entry.');
    const id = key.replace(/^\|/, '');
    const event = Object.hasOwn(events, id) ? events[id] : archivedEvents[id];
    if (!isRecord(event) || typeof event.display_name !== 'string') throw new Error(`Missing event ${id}.`);
    return {
      id, name: event.display_name, icon: asset(event.icon), comingSoon: key.startsWith('|'),
      event: [...standardEventIds, ...boxEventIds, ...cardEventIds, ...diceEventIds, ...omikujiEventIds, ...lessonEventIds, ...invasionEventIds].includes(id) ? decodeStandardEvent(event) : null,
      ...(index >= listedCount ? { archived: true } : {})
    };
  });
}

function amounts(value: unknown, label: string): SavedAmounts {
  if (!isRecord(value)) throw new Error(`Invalid event ${label}.`);
  const result: SavedAmounts = Object.create(null);
  for (const [key, entry] of Object.entries(value)) {
    eventInteger(entry, label);
    if (typeof entry === 'number' || typeof entry === 'string') result[key] = entry;
  }
  return result;
}

export function validateEventEnergy(key: keyof EventEnergySettings, value: unknown): number | boolean {
  if (key === 'energy_pack') {
    if (typeof value !== 'boolean') throw new Error('Invalid event energy pack setting.');
    return value;
  }
  const limits = { cafe_rank: 10, pyro_refreshes: 20, pvp_refreshes: 4, energy_carryover: 3000 };
  const result = eventInteger(value, key, limits[key]);
  if (key === 'cafe_rank' && result < 1) throw new Error('Cafe rank must be between 1 and 10.');
  return result;
}

export function decodeEventPlan(value: unknown, event: StandardEvent): EventPlan {
  if (value !== undefined && !isRecord(value)) throw new Error('Saved event settings are not an object.');
  const raw = value ?? {};
  const enabled = raw.enabled_bonus_units ?? [];
  if (!Array.isArray(enabled) || !enabled.every((id: unknown) => typeof id === 'string')) throw new Error('Invalid event bonus characters.');
  const shopValue = raw.shop_purchases ?? {};
  if (!isRecord(shopValue)) throw new Error('Invalid saved event shops.');
  const purchases: EventPlan['shop_purchases'] = Object.create(null);
  for (const [key, entries] of Object.entries(shopValue)) purchases[key] = amounts(entries, 'purchases');
  let needed = amounts(raw.currency_needed ?? {}, 'currency requirements');
  if (!Object.keys(purchases).length) {
    for (const [currency, items] of Object.entries(event.shops)) {
      purchases[currency] = Object.fromEntries(items.map((item) => [
        String(item.id), item.default ?? (item.overflow ? 0 : item.count)
      ]));
    }
    needed = {};
  }
  if (!Object.keys(needed).length) needed = Object.fromEntries(Object.entries(event.currencies).filter(([, currency]) => currency.clear).map(([key, currency]) => [key, currency.clear ?? 0]));
  const groups = raw.enabled_stage_groups ?? [true, true, true];
  if (!Array.isArray(groups) || groups.length !== 3 || !groups.every((flag: unknown) => typeof flag === 'boolean') || !groups.some(Boolean)) throw new Error('Invalid saved stage groups.');
  const mode = raw.optimisation_type ?? '';
  const selectedMode = modes.find((entry) => entry === mode);
  if (selectedMode === undefined || (selectedMode && !event.available_targets.includes(selectedMode))) throw new Error('Invalid saved event optimization mode.');
  let options: EventPlan['optimisation_options'] = null;
  if (mode === 'Currency' && raw.optimisation_options !== null && raw.optimisation_options !== undefined) {
    if (typeof raw.optimisation_options !== 'string' || !event.currency_targets.includes(raw.optimisation_options)) throw new Error('Invalid saved currency target.');
    options = raw.optimisation_options;
  } else if (mode === 'Materials' && raw.optimisation_options != null) {
    if (!isRecord(raw.optimisation_options)) throw new Error('Invalid saved material targets.');
    const selected: Record<string, boolean> = {};
    for (const [key, flag] of Object.entries(raw.optimisation_options)) {
      if (typeof flag !== 'boolean') throw new Error('Invalid material selection.');
      selected[key] = flag;
    }
    options = selected;
  } else if (mode === 'Manual' && raw.optimisation_options != null) {
    options = amounts(raw.optimisation_options, 'stage runs');
    for (const [key, value] of Object.entries(options)) {
      if (!event.stages.some((stage) => stage.type === 'Quest' && String(stage.number) === key)) throw new Error(`Unknown saved quest ${key}.`);
      eventInteger(value, 'stage runs', 2000);
    }
  }
  if (selectedMode === 'Currency' && (event.omikuji || event.invasion)) {
    for (const [currency, items] of Object.entries(event.shops)) {
      if (!items.some((item) => item.overflow)) continue;
      purchases[currency] ??= Object.create(null);
      for (const item of items) if (item.overflow) purchases[currency][String(item.id)] = 0;
      const totalCost = items.reduce((total, item) => {
        const next = total + Number(purchases[currency][String(item.id)] ?? 0) * item.cost;
        if (!Number.isFinite(next)) throw new Error(`Invalid shop cost for "${currency}".`);
        return next;
      }, 0);
      needed[currency] = totalCost;
    }
  }
  const result: EventPlan = {
    ...raw, enabled_bonus_units: enabled, shop_purchases: purchases, currency_needed: needed,
    currency_owned: amounts(raw.currency_owned ?? {}, 'owned currency'),
    enabled_stage_groups: [groups[0], groups[1], groups[2]], optimisation_type: selectedMode, optimisation_options: options
  };
  for (const key of ['cafe_rank', 'pyro_refreshes', 'pvp_refreshes', 'energy_pack', 'energy_carryover'] as const) {
    if (raw[key] !== null && raw[key] !== undefined) validateEventEnergy(key, raw[key]);
  }
  if (raw.point_target !== null && raw.point_target !== undefined) eventInteger(raw.point_target, 'point target');
  for (const [currency, items] of Object.entries(event.shops)) {
    for (const item of items) if (purchases[currency]?.[String(item.id)] !== undefined) {
      eventInteger(purchases[currency][String(item.id)], 'purchase count', item.overflow ? item.overflow_cap ?? item.count : item.count);
    }
  }
  if (event.card_drops || event.dice_race || event.omikuji) {
    for (const [key, amount] of Object.entries(result.currency_owned)) {
      if (event.currencies[key]?.source === 'StageDrop') eventInteger(amount, 'owned simulation currency', 200000);
    }
    if (raw.standard_deviation != null) result.standard_deviation = validateStandardDeviation(raw.standard_deviation);
  }
  if (event.card_drops) {
    if (raw.card_pull_currency_owned != null) result.card_pull_currency_owned = number(raw.card_pull_currency_owned, 'card draw currency', 200000);
    if (raw.card_pull_rewards !== undefined) {
      result.card_pull_rewards = decodeCardStatistics(raw.card_pull_rewards);
      const keys = Object.keys(result.card_pull_rewards);
      const expected = new Set(event.card_drops.flatMap((card) => Object.keys(card.drops)));
      if (keys.length && (keys.length !== expected.size || keys.some((key) => !expected.has(key)))) {
        throw new Error('Saved card statistics do not match the event rewards. Use a backup or correct the saved statistics.');
      }
    }
  }
  if (event.dice_race) {
    if (raw.dice_roll_currency_owned != null) result.dice_roll_currency_owned = number(raw.dice_roll_currency_owned, 'dice roll currency', 200000);
    if (raw.dice_roll_rewards !== undefined) {
      result.dice_roll_rewards = decodeCardStatistics(raw.dice_roll_rewards);
      const keys = Object.keys(result.dice_roll_rewards);
      const expected = new Set(diceRewardNames(event.dice_race));
      if (keys.length && (keys.length !== expected.size || keys.some((key) => !expected.has(key)))) {
        throw new Error('Saved dice statistics do not match the event rewards. Use a backup or correct the saved statistics.');
      }
    }
  }
  if (event.omikuji) {
    if (raw.omikuji_pull_currency_owned != null) result.omikuji_pull_currency_owned = number(raw.omikuji_pull_currency_owned, 'Omikuji draw currency', 200000);
    if (raw.omikuji_pull_rewards !== undefined) {
      result.omikuji_pull_rewards = decodeCardStatistics(raw.omikuji_pull_rewards);
      const keys = Object.keys(result.omikuji_pull_rewards);
      const expected = new Set(omikujiRewardNames(event.omikuji));
      if (keys.length && (keys.length !== expected.size || keys.some((key) => !expected.has(key)))) {
        throw new Error('Saved Omikuji statistics do not match the event slips. Use a backup or correct the saved statistics.');
      }
    }
  }
  if (event.lessons) {
    const lessons = event.lessons;
    if (raw.lesson_pre_runs !== undefined) {
      if (!Array.isArray(raw.lesson_pre_runs) || raw.lesson_pre_runs.length >
        lessons.rank_upgrades[lessons.rank_upgrades.length - 1] / lessons.lesson_cost) {
        throw new Error('Saved lesson rank-up runs are invalid.');
      }
      result.lesson_pre_runs = raw.lesson_pre_runs.map((index: unknown) =>
        eventInteger(index, 'lesson location', lessons.locations.length - 1));
    }
    if (raw.lesson_post_runs !== undefined) {
      const postRuns = amounts(raw.lesson_post_runs, 'lesson runs');
      for (const [location, amount] of Object.entries(postRuns)) {
        if (!/^(0|[1-9]\d*)$/.test(location) || Number(location) >= lessons.locations.length) {
          throw new Error(`Unknown saved lesson location "${location}".`);
        }
        eventInteger(amount, 'lesson runs', 200000);
      }
      result.lesson_post_runs = postRuns;
    }
  }
  return result;
}
