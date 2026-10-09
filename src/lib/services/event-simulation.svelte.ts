import { onDestroy, untrack } from 'svelte';
import { simulationInputFingerprint } from '../domain/events/card-statistics';
import type { CardStatistics, EventPlan, StandardEvent } from '../domain/events/standard-types';
import type { EventAmounts } from '../domain/events/types';
import { roundCardStatistics, simulateCards } from './card-simulation';
import { simulateDice } from './dice-simulation';
import { simulateOmikuji } from './omikuji-simulation';

export type EventSimulationKind = 'card' | 'dice' | 'omikuji';
interface Context {
  id: string;
  event: StandardEvent | null;
  plan: EventPlan | null;
  currency: number | null;
  blocked: boolean;
}

export function createEventSimulation(
  context: () => Context,
  save: (kind: EventSimulationKind, statistics: CardStatistics, currency: number, expected: { id: string; inputs: string }) => boolean,
  t: (id: string) => string
) {
  let contextId = $derived(context().id);
  let kind = $derived<EventSimulationKind | null>(context().event?.card_drops ? 'card' : context().event?.dice_race ? 'dice' : context().event?.omikuji ? 'omikuji' : null);
  let inputKey = $derived.by(() => {
    const current = context();
    return JSON.stringify({ id: current.id, kind, currency: current.currency, blocked: current.blocked,
      inputs: current.plan ? simulationInputFingerprint(current.plan) : null });
  });
  let matchingStatistics = $derived.by(() => {
    const current = context();
    if (!kind || current.blocked || current.currency === null || !current.plan) return null;
    const statistics = kind === 'card' ? current.plan.card_pull_rewards : kind === 'dice' ? current.plan.dice_roll_rewards : current.plan.omikuji_pull_rewards;
    const storedCurrency = kind === 'card' ? current.plan.card_pull_currency_owned : kind === 'dice' ? current.plan.dice_roll_currency_owned : current.plan.omikuji_pull_currency_owned;
    return statistics && Object.keys(statistics).length && Number(storedCurrency ?? 0) === current.currency ? statistics : null;
  });
  let job = $state<AbortController | null>(null);
  let jobKey = $state('');
  let processing = $state(false);
  let error = $state('');
  let notice = $state('');
  let samples = $state<{ key: string; count: number } | null>(null);
  let rounded = $state<EventAmounts | null>(null);
  let roundedKey = $state('');
  let rounding = $state(false);
  let roundingError = $state('');
  let roundingRetry = $state(0);
  let roundKey = $derived(JSON.stringify({
    id: context().id, kind, currency: context().currency, statistics: matchingStatistics,
    deviation: context().plan?.standard_deviation ?? 0, retry: roundingRetry
  }));
  $effect(() => {
    const key = roundKey;
    const statistics = untrack(() => matchingStatistics);
    const deviation = untrack(() => context().plan?.standard_deviation ?? 0);
    const controller = new AbortController();
    rounded = null; roundedKey = ''; roundingError = ''; rounding = false;
    if (statistics) {
      rounding = true;
      void roundCardStatistics(statistics, deviation, { signal: controller.signal }).then((amounts) => {
        if (!controller.signal.aborted) { rounded = amounts; roundedKey = key; }
      }).catch((problem: unknown) => {
        if (controller.signal.aborted) return;
        console.error('Event reward adjustment failed.', problem);
        roundingError = problem instanceof Error ? problem.message : t('ui-event-calculation-failed');
      }).finally(() => { if (!controller.signal.aborted) rounding = false; });
    }
    return () => controller.abort();
  });
  $effect(() => {
    const key = inputKey;
    if (job && jobKey !== key) cancel(t(`ui-event-${kind ?? 'card'}-inputs-changed`));
  });
  $effect(() => {
    void contextId;
    error = ''; notice = ''; samples = null;
  });
  onDestroy(() => job?.abort());

  function cancel(message = t(`ui-event-${kind ?? 'card'}-cancelled`)) {
    const pending = job;
    job = null; pending?.abort(); processing = false; notice = message;
  }
  async function run() {
    const current = context();
    if (!kind || current.blocked || !current.event || !current.plan || current.currency === null || processing || matchingStatistics) return;
    const currentKind = kind;
    const controller = new AbortController();
    const expected = { id: current.id, inputs: simulationInputFingerprint(current.plan) };
    const key = inputKey;
    const currency = current.currency;
    job = controller; jobKey = key; processing = true; error = ''; notice = '';
    try {
      const event = current.event;
      let result;
      if (currentKind === 'card' && event.card_drops) result = await simulateCards(event.card_drops, currency, { signal: controller.signal });
      else if (currentKind === 'dice' && event.dice_race) result = await simulateDice(event.dice_race, currency, { signal: controller.signal });
      else if (currentKind === 'omikuji' && event.omikuji) result = await simulateOmikuji(event.omikuji, currency, { signal: controller.signal });
      else throw new Error('The event simulation is not configured.');
      if (controller.signal.aborted) return;
      if (inputKey !== key) { cancel(t(`ui-event-${currentKind}-inputs-changed`)); return; }
      if (save(currentKind, result.statistics, currency, expected)) samples = { key, count: result.sampleCount };
    } catch (problem) {
      if (controller.signal.aborted) return;
      console.error('Event simulation failed.', problem);
      error = problem instanceof Error ? problem.message : t(`ui-event-${currentKind}-failed`);
    } finally {
      if (job === controller) { job = null; processing = false; }
    }
  }
  return {
    run, cancel, retryAdjustment: () => roundingRetry++,
    get kind() { return kind; },
    get ready() { return Boolean(matchingStatistics); },
    get processing() { return processing; },
    get error() { return error; },
    get notice() { return notice; },
    get sampleCount() { return samples?.key === inputKey ? samples.count : null; },
    get rounding() { return rounding; },
    get roundingError() { return roundingError; },
    get rounded() { return roundedKey === roundKey ? rounded : null; }
  };
}
