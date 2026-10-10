import { get, writable } from 'svelte/store';
import { createDefaultSave } from '../services/preferences';
import { announceSaveChange } from '../services/save-events';
import { fetchJson, loadCharacterNames, loadPlannerDataset, savedLanguage } from '../services/planner-data';
import { isRecord } from '../domain/planner/save';
import type { PlannerDataset, PlannerMetadata } from '../domain/planner/types';
import { decodeEventCatalog, decodeEventPlan, eventInteger, validateEventEnergy, type EventEntry } from '../domain/events/standard-save';
import type { EventActions, EventPlan } from '../domain/events/standard-types';
import { materialDropOptions } from '../domain/events/models';
import { boxPullCurrencyNeeded } from '../domain/events/boxes';
import { decodeCardStatistics, simulationInputFingerprint, validateStandardDeviation } from '../domain/events/card-statistics';
import type { CardStatistics } from '../domain/events/standard-types';
import type { SimulationKind } from '../services/simulations/types';

interface EventState {
  loading: boolean; error: string; saved: boolean; catalog: EventEntry[]; dataset: PlannerDataset | null;
  names: Record<string, string>; cafeEnergy: Record<string, number>; selected: string; plan: EventPlan | null;
}

function rootSave(source: string | null): Record<string, unknown> {
  const root: unknown = source === null ? createDefaultSave() : JSON.parse(source);
  if (!isRecord(root) || (root.exportVersion !== undefined && root.exportVersion !== 1 && root.exportVersion !== 2) ||
    (root.events_data !== undefined && !isRecord(root.events_data))) throw new Error('The saved planner or event data has an invalid format.');
  return root;
}

function eventSource(root: Record<string, unknown>, id: string): unknown {
  return isRecord(root.events_data) ? root.events_data[id] : undefined;
}

export function createEventPlanner(
  metadata: PlannerMetadata,
  storageProvider: () => Storage = () => window.localStorage,
  reviewedArchive?: unknown
) {
  const state = writable<EventState>({ loading: false, error: '', saved: false, catalog: [], dataset: null, names: {}, cafeEnergy: {}, selected: '', plan: null });
  const namesCache = new Map<string, Record<string, string>>();
  let fingerprint = '';
  let generation = 0;
  let writing = false;
  let signal: AbortSignal | undefined;

  function report(problem: unknown): false {
    console.error('Event planner operation failed.', problem);
    state.update((current) => ({ ...current, loading: false, saved: false, error: problem instanceof Error ? problem.message : 'Event planner operation failed.' }));
    return false;
  }

  async function reload(force = false) {
    if (writing) return;
    const current = get(state);
    if (!current.dataset) return;
    const token = ++generation;
    try {
      const source = storageProvider().getItem('save-data');
      const root = rootSave(source);
      const language = savedLanguage(source);
      const names = namesCache.get(language) ?? await loadCharacterNames(language, current.dataset, signal);
      if (token !== generation || signal?.aborted) return;
      namesCache.set(language, names);
      if (source !== storageProvider().getItem('save-data')) { await reload(force); return; }
      const raw = eventSource(root, current.selected);
      const nextFingerprint = JSON.stringify(raw ?? null);
      if (!force && current.plan && nextFingerprint !== fingerprint) {
        state.update((value) => ({ ...value, names, loading: false, saved: false, error: 'This event changed in another window. Reload event settings before editing.' }));
        return;
      }
      const event = current.catalog.find((entry) => entry.id === current.selected)?.event;
      const plan = event ? decodeEventPlan(raw, event) : null;
      fingerprint = nextFingerprint;
      state.update((value) => ({ ...value, names, plan, loading: false, error: '' }));
    } catch (problem) {
      if (signal?.aborted) return;
      report(problem);
    }
  }

  function select(id: string): boolean {
    const current = get(state);
    try {
      const entry = current.catalog.find((entry) => entry.id === id && !entry.comingSoon);
      if (!entry) throw new Error('Choose an available event.');
      const raw = eventSource(rootSave(storageProvider().getItem('save-data')), id);
      const plan = entry.event ? decodeEventPlan(raw, entry.event) : null;
      fingerprint = JSON.stringify(raw ?? null);
      generation++;
      state.update((value) => ({ ...value, selected: id, plan, error: '', saved: false }));
      return true;
    } catch (problem) { return report(problem); }
  }

  function commit(change: (plan: EventPlan, entry: EventEntry) => void): boolean {
    const current = get(state);
    try {
      const entry = current.catalog.find((entry) => entry.id === current.selected);
      if (!entry?.event || !current.plan) throw new Error('This event is not ready for editing in the Svelte planner.');
      const storage = storageProvider();
      const root = rootSave(storage.getItem('save-data'));
      const raw = eventSource(root, current.selected);
      if (JSON.stringify(raw ?? null) !== fingerprint) throw new Error('This event changed in another window. Reload event settings before editing.');
      const plan = decodeEventPlan(raw, entry.event);
      change(plan, entry);
      const checked = decodeEventPlan(plan, entry.event);
      const events = isRecord(root.events_data) ? { ...root.events_data } : {};
      events[current.selected] = checked;
      root.events_data = events;
      writing = true;
      storage.setItem('save-data', JSON.stringify(root));
      fingerprint = JSON.stringify(checked);
      state.update((value) => ({ ...value, plan: checked, saved: true, error: '' }));
      announceSaveChange();
      return true;
    } catch (problem) { return report(problem); }
    finally { writing = false; }
  }

  const actions: EventActions = {
    setMode(mode) { return commit((plan, entry) => {
      if (!entry.event?.available_targets.includes(mode)) throw new Error('This optimization mode is unavailable.');
      plan.optimisation_type = mode; plan.optimisation_options = null;
      if (mode === 'Currency' && entry.event.currency_targets.length === 1) plan.optimisation_options = entry.event.currency_targets[0];
      if (mode === 'Currency' && (entry.event.omikuji || entry.event.invasion || entry.event.eventId === 'serenade-promenade-rerun')) {
        for (const [currency, items] of Object.entries(entry.event.shops)) {
          for (const item of items) if (item.overflow) {
            plan.shop_purchases[currency] ??= {};
            plan.shop_purchases[currency][String(item.id)] = 0;
          }
          plan.currency_needed[currency] = items.reduce((sum, item) =>
            sum + Number(plan.shop_purchases[currency]?.[String(item.id)] ?? 0) * item.cost, 0);
        }
      }
    }); },
    setMaterials(materials) { return commit((plan, entry) => {
      if (plan.optimisation_type !== 'Materials' || !entry.event) throw new Error('Select Materials optimization first.');
      const known = materialDropOptions(entry.event);
      for (const [key, selected] of Object.entries(materials)) if (!known.includes(key) || typeof selected !== 'boolean') throw new Error(`Invalid material target ${key}.`);
      plan.optimisation_options = { ...materials };
    }); },
    setCurrency(currency) { return commit((plan, entry) => {
      if (plan.optimisation_type !== 'Currency' || !entry.event?.currency_targets.includes(currency)) throw new Error('Select an available currency target.');
      plan.optimisation_options = currency;
    }); },
    setEnergy(key, value) { return commit((plan) => {
      const checked = validateEventEnergy(key, value);
      if (key === 'energy_pack' && typeof checked === 'boolean') plan.energy_pack = checked;
      else if (key !== 'energy_pack' && typeof checked === 'number') plan[key] = checked;
      else throw new Error('Invalid event energy setting.');
    }); },
    setBonusIds(ids) { return commit((plan, entry) => {
      const known = new Set(Object.values(entry.event?.currencies ?? {}).flatMap((currency) => currency.bonus_units.map((unit) => unit.id)));
      if (ids.some((id) => !known.has(id))) throw new Error('Unknown event bonus character.');
      plan.enabled_bonus_units = [...new Set(ids)];
    }); },
    setOwnedCurrency(currency, value) { return commit((plan, entry) => {
      if (!entry.event?.active || !entry.event.currencies[currency] ||
        (entry.event.currencies[currency].source !== 'StageDrop' && currency !== 'Event_Point')) throw new Error('Owned currency is unavailable for this event.');
      plan.currency_owned[currency] = eventInteger(value, 'owned currency', 200000);
    }); },
    setPointTarget(value) { return commit((plan) => { plan.point_target = eventInteger(value, 'point target'); }); },
    setStandardDeviation(value) { return commit((plan, entry) => {
      if (!entry.event?.card_drops && !entry.event?.dice_race && !entry.event?.omikuji) throw new Error('RNG adjustment is unavailable for this event.');
      plan.standard_deviation = validateStandardDeviation(value);
    }); },
    setLessonPreRuns(runs) { return commit((plan, entry) => {
      const lessons = entry.event?.lessons;
      if (!lessons || !Array.isArray(runs)) throw new Error('Lesson runs are unavailable for this event.');
      const maxRuns = lessons.rank_upgrades[lessons.rank_upgrades.length - 1] / lessons.lesson_cost;
      if (runs.length > maxRuns) throw new Error('Lesson rank-up runs exceed the maximum rank.');
      plan.lesson_pre_runs = runs.map((location) => eventInteger(location, 'lesson location', lessons.locations.length - 1));
    }); },
    setLessonPostRuns(runs) { return commit((plan, entry) => {
      const lessons = entry.event?.lessons;
      if (!lessons || !isRecord(runs)) throw new Error('Post-rank lesson runs are unavailable for this event.');
      const checked: NonNullable<EventPlan['lesson_post_runs']> = Object.create(null);
      for (const [location, amount] of Object.entries(runs)) {
        if (!/^(0|[1-9]\d*)$/.test(location) || Number(location) >= lessons.locations.length) {
          throw new Error(`Unknown lesson location "${location}".`);
        }
        eventInteger(amount, 'lesson runs', 200000);
        checked[location] = amount;
      }
      plan.lesson_post_runs = checked;
    }); },
    resetLessons() { return commit((plan, entry) => {
      if (!entry.event?.lessons) throw new Error('Lessons are unavailable for this event.');
      plan.lesson_pre_runs = [];
      plan.lesson_post_runs = {};
    }); },
    setGroups(groups) { return commit((plan) => {
      if (groups.length !== 3 || groups.some((flag) => typeof flag !== 'boolean')) throw new Error('Invalid stage groups.');
      plan.enabled_stage_groups = groups.some(Boolean) ? [groups[0], groups[1], groups[2]] : [false, false, true];
    }); },
    setPurchase(currency, item, count) { return commit((plan, entry) => {
      const reward = entry.event?.shops[currency]?.find((reward) => String(reward.id) === item);
      if (!reward) throw new Error('Unknown event shop item.');
      if (reward.overflow && plan.optimisation_type === 'Currency') throw new Error('This overflow purchase is calculated automatically in Currency mode.');
      if (reward.locked && !Object.values(plan.currency_owned).some((amount) => Number.parseInt(String(amount)) > 0)) throw new Error('This shop item is locked until Owned mode.');
      plan.shop_purchases[currency] ??= {};
      const unlimitedIveAlivePurchase = entry.event?.eventId === 'ive-alive-rerun' && currency === 'Event_Point' &&
        item === '16016' && reward.overflow && reward.count === -1 && reward.overflow_cap === undefined;
      plan.shop_purchases[currency][item] = eventInteger(count, 'purchase count', reward.overflow
        ? reward.overflow_cap ?? (unlimitedIveAlivePurchase ? 200000 : reward.count)
        : reward.count);
      plan.currency_needed[currency] = (entry.event?.shops[currency] ?? []).reduce((total, reward) => total + Number(plan.shop_purchases[currency][String(reward.id)] ?? 0) * reward.cost, 0);
      const source = entry.event?.currencies[currency];
      if (source?.source === 'BoxPull') {
        const event = entry.event;
        if (!event?.boxes || event.box_clear_cost === undefined || !source.pull_currency) throw new Error('Missing box currency configuration.');
        plan.currency_needed[source.pull_currency] = boxPullCurrencyNeeded({ boxes: event.boxes, box_clear_cost: event.box_clear_cost }, Number(plan.currency_needed[currency]));
      }
    }); },
    setManualRuns(stage, count) { return commit((plan, entry) => {
      if (plan.optimisation_type !== 'Manual' || !entry.event?.stages.some((quest) => quest.type === 'Quest' && quest.number === stage)) throw new Error('Select Manual mode and an available quest.');
      const runs = eventInteger(count, 'stage runs', 2000);
      const options: Record<string, number | string> = {};
      if (isRecord(plan.optimisation_options)) {
        for (const [key, value] of Object.entries(plan.optimisation_options)) {
          if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Invalid saved manual stage runs.');
          options[key] = value;
        }
      }
      plan.optimisation_options = { ...options, [String(stage)]: runs };
    }); }
  };

  function saveSimulation(kind: SimulationKind, statistics: CardStatistics, currency: number, expected: { id: string; inputs: string }) {
    return commit((plan, entry) => {
        const configured = kind === 'card' ? entry.event?.card_drops : kind === 'dice' ? entry.event?.dice_race : entry.event?.omikuji;
        if (!configured || entry.id !== expected.id || simulationInputFingerprint(plan) !== expected.inputs) {
          throw new Error('The event inputs changed during the simulation. Run the simulation again; nothing was replaced.');
        }
        if (!Number.isFinite(currency) || currency < 0 || currency > 200000) throw new Error('Invalid simulation currency.');
        const checked = decodeCardStatistics(statistics);
        if (!Object.keys(checked).length) throw new Error('The simulation returned no statistics.');
        if (kind === 'card') { plan.card_pull_rewards = checked; plan.card_pull_currency_owned = currency; }
        else if (kind === 'dice') { plan.dice_roll_rewards = checked; plan.dice_roll_currency_owned = currency; }
        else { plan.omikuji_pull_rewards = checked; plan.omikuji_pull_currency_owned = currency; }
      });
  }
  return {
    subscribe: state.subscribe, ...actions, select, reload, saveSimulation,
    saveCardSimulation(statistics: CardStatistics, currency: number, expected: { id: string; inputs: string }) {
      return saveSimulation('card', statistics, currency, expected);
    },
    async initialise(abortSignal: AbortSignal | undefined = signal) {
      signal = abortSignal;
      state.update((value) => ({ ...value, loading: true, error: '' }));
      try {
        const current = get(state);
        if (!current.dataset) {
          const [dataset, config, misc] = await Promise.all([
            loadPlannerDataset(metadata, signal), fetchJson('/planner/json/events.json', signal), fetchJson('/planner/json/event_misc.json', signal)
          ]);
          if (signal?.aborted) return;
          if (!isRecord(misc) || !isRecord(misc.cafe_energy)) throw new Error('Invalid event cafe data.');
          const cafeEnergy: Record<string, number> = {};
          for (const [rank, amount] of Object.entries(misc.cafe_energy)) {
            if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error('Invalid cafe energy rate.');
            cafeEnergy[rank] = amount;
          }
          state.update((value) => ({ ...value, dataset, catalog: decodeEventCatalog(config, true, reviewedArchive), cafeEnergy }));
        }
        await reload(true);
      } catch (problem) {
        if (signal?.aborted) return;
        report(problem);
      }
    }
  };
}
