<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { metadata } from '$content/planner';
  import lessonArchive from '$content/lesson-events.json';
  import strings from '$content/strings.json';
  import { getLanguageString } from '$lib/domain/localisation';
  import { preferences } from '$lib/stores/preferences';
  import { createEventPlanner } from '$lib/stores/event-planner';
  import { eventRequirements, summarizeEventRuns } from '$lib/domain/events/standard';
  import { applyCardRewards } from '$lib/domain/events/cards';
  import { applyDiceRewards } from '$lib/domain/events/dice';
  import { applyOmikujiRewards } from '$lib/domain/events/omikuji';
  import { applyLessonRewards } from '$lib/domain/events/lessons';
  import { calculateEventBonuses, calculateEventEnergy } from '$lib/domain/events/budget';
  import { buildStageModel, buildMaterialTargetModel, buildStageVariables, materialDropOptions } from '$lib/domain/events/models';
  import { isRecord } from '$lib/domain/planner/save';
  import { formatAmount } from '$lib/domain/planner/catalog';
  import type { EventActions, EventMode, EventTab } from '$lib/domain/events/standard-types';
  import type { EventModel } from '$lib/domain/events/types';
  import { solveEventPlan } from '$lib/services/event-plan';
  import { createEventSimulation } from '$lib/services/event-simulation.svelte';
  import { eventItem } from '$lib/services/event-items';
  import { saveChangedEvent } from '$lib/services/save-events';
  import EventSettings from '$lib/components/events/EventSettings.svelte';
  import EventMarket from '$lib/components/events/EventMarket.svelte';
  import EventBoxes from '$lib/components/events/EventBoxes.svelte';
  import EventCards from '$lib/components/events/EventCards.svelte';
  import EventOmikuji from '$lib/components/events/EventOmikuji.svelte';
  import EventLessons from '$lib/components/events/EventLessons.svelte';
  import EventDice from '$lib/components/events/EventDice.svelte';

  const planner = createEventPlanner(metadata, undefined, lessonArchive);
  const t = (id: string) => getLanguageString(strings, id, $preferences.language);
  let tab = $state<EventTab>('Targets');
  let now = $state(0);
  let solution = $state<unknown>(null);
  let solutionKey = $state('');
  let solving = $state(false);
  let solveError = $state('');
  let retry = $state(0);
  let includeShop = $state(false);
  let includePoints = $state(false);
  let includeBoxes = $state(false);
  let includeCards = $state(false);
  let includeDice = $state(false);
  let includeOmikuji = $state(false);
  let includeLessons = $state(false);
  let showArchives = $state(false);
  let eventListOpen = $state(false);
  let entry = $derived($planner.catalog.find((entry) => entry.id === $planner.selected));
  let event = $derived(entry?.event ?? null);
  let tabs = $derived((['Targets', 'Energy', 'Bonus', 'Shop', 'Stages', ...(event?.point_rewards ? ['Points'] : []), ...(event?.boxes ? ['Boxes'] : []), ...(event?.card_drops ? ['Cards'] : []), ...(event?.dice_race ? ['Dice'] : []), ...(event?.omikuji ? ['Omikuji'] : []), ...(event?.lessons ? ['Lessons'] : []), ...(event?.active ? ['Owned'] : [])]).filter((key): key is EventTab =>
    ['Targets', 'Energy', 'Bonus', 'Shop', 'Stages', 'Points', 'Boxes', 'Cards', 'Dice', 'Omikuji', 'Lessons', 'Owned'].includes(key)));
  let calculation = $derived.by(() => {
    if (!event || !$planner.plan || !$planner.dataset || !now) return null;
    try {
      const plan = $planner.plan;
      const requirements = eventRequirements(event, plan);
      const bonuses = calculateEventBonuses(entry?.id ?? '', event, plan.enabled_bonus_units, $planner.dataset.students);
      const budget = calculateEventEnergy(entry?.id ?? '', event, plan, $planner.cafeEnergy, requirements.midEvent, requirements.initial.cost, now);
      const inputs = {
        eventId: entry?.id ?? '', bonuses, needed: requirements.needed, energyAvailable: budget.available,
        pointTarget: requirements.pointTarget, enabledGroups: plan.enabled_stage_groups, upgradeBases: false
      };
      let model: EventModel | null = null;
      if (plan.optimisation_type === 'Shop') model = buildStageModel(event, inputs, 'Energy_Cost', 'min', false);
      else if (plan.optimisation_type === 'Currency' && typeof plan.optimisation_options === 'string') model = buildStageModel(event, inputs, plan.optimisation_options, 'max', true);
      else if (plan.optimisation_type === 'Materials' && isRecord(plan.optimisation_options)) {
        const selected: Record<string, boolean> = {};
        for (const [key, value] of Object.entries(plan.optimisation_options)) {
          if (typeof value !== 'boolean') throw new Error('Invalid material target.');
          selected[key] = value;
        }
        if (Object.values(selected).some(Boolean)) model = buildMaterialTargetModel(event, inputs, selected);
      }
      return { requirements, bonuses, budget, model, variables: buildStageVariables(event, bonuses, plan.enabled_stage_groups), materials: materialDropOptions(event), error: '' };
    } catch (problem) {
      return { requirements: null, bonuses: {}, budget: null, model: null, variables: {}, materials: [], error: problem instanceof Error ? problem.message : t('ui-event-calculation-failed') };
    }
  });
  let solveKey = $derived(JSON.stringify({ id: entry?.id, blocked: Boolean($planner.error), model: calculation?.model, manual: $planner.plan?.optimisation_type === 'Manual' ? $planner.plan.optimisation_options ?? {} : null, retry }));
  $effect(() => {
    const key = solveKey;
    const model = untrack(() => calculation?.model);
    const plan = untrack(() => $planner.plan);
    const controller = new AbortController();
    solution = null; solutionKey = ''; solveError = ''; solving = false;
    if (untrack(() => Boolean($planner.error))) return () => controller.abort();
    if (plan?.optimisation_type === 'Manual') {
      solution = plan.optimisation_options ?? {}; solutionKey = key;
    } else if (model) {
      solving = true;
      void solveEventPlan(model, { signal: controller.signal }).then((result) => {
        if (!controller.signal.aborted) { solution = result; solutionKey = key; }
      }).catch((problem: unknown) => {
        if (controller.signal.aborted) return;
        console.error('Event optimization failed.', problem);
        solveError = problem instanceof Error ? problem.message : t('ui-event-calculation-failed');
      }).finally(() => { if (!controller.signal.aborted) solving = false; });
    }
    return () => controller.abort();
  });
  let baseResult = $derived.by(() => {
    if ($planner.error || !event || !$planner.plan || !calculation?.requirements || !calculation.budget || solutionKey !== solveKey || solution === null) return null;
    try {
      return { value: summarizeEventRuns(event, $planner.plan, calculation.requirements, calculation.bonuses, calculation.budget.available, solution, includeShop, includePoints, metadata, includeBoxes), error: '' };
    } catch (problem) {
      return { value: null, error: problem instanceof Error ? problem.message : t('ui-event-calculation-failed') };
    }
  });
  let cardCurrency = $derived(Object.entries(event?.currencies ?? {}).find(([, currency]) => currency.source === 'CardPull')?.[1].pull_currency);
  let simulationCurrency = $derived(cardCurrency ?? event?.dice_race?.roll_currency ?? event?.omikuji?.pull_currency);
  let simulationFunds = $derived(simulationCurrency && baseResult?.value?.feasible ? baseResult.value.currencies[simulationCurrency] ?? 0 : null);
  const simulation = createEventSimulation(() => ({
    id: entry?.id ?? '', event, plan: $planner.plan, currency: simulationFunds, blocked: Boolean($planner.error)
  }), planner.saveSimulation, t);
  let includeSimulation = $derived(Boolean(event?.card_drops && includeCards || event?.dice_race && includeDice || event?.omikuji && includeOmikuji));
  let result = $derived.by(() => {
    if (!event || !baseResult?.value || !$planner.plan) return baseResult;
    try {
      let value = event.lessons && includeLessons
        ? applyLessonRewards(baseResult.value, event.lessons, $planner.plan.lesson_pre_runs ?? [], $planner.plan.lesson_post_runs ?? {}, metadata)
        : baseResult.value;
      const rounded = simulation.rounded;
      if (includeSimulation && rounded) {
        value = event.card_drops ? applyCardRewards(event, value, rounded, metadata)
          : event.dice_race ? applyDiceRewards(value, rounded) : applyOmikujiRewards(value, rounded, metadata);
      }
      return { value, error: '' };
    } catch (problem) {
      return { value: null, error: problem instanceof Error ? problem.message : t('ui-event-calculation-failed') };
    }
  });

  let rewardGroups = $derived(result?.value ? Object.entries({
    currencies: result.value.currencies, artifacts: result.value.artifacts, schoolMats: result.value.schoolMats,
    eleph: result.value.eleph, xps: result.value.xps, gear: result.value.gear,
    other: { Credit: result.value.credit, Eligma: result.value.eligma, SecretTech: result.value.secretTech,
      ...(result.value.gearBoxes ? { Random_Equipment_Box_0: result.value.gearBoxes } : {}) }
  }) : []);
  const actions: EventActions = { ...planner, setMode(mode: Exclude<EventMode, ''>) {
    const saved = planner.setMode(mode);
    if (saved && mode === 'Manual') tab = 'Stages';
    return saved;
  } };

  onMount(() => {
    now = Date.now();
    const controller = new AbortController();
    void planner.initialise(controller.signal);
    const refresh = () => { void planner.reload(); };
    const storage = (event: StorageEvent) => { if (event.key === 'save-data' || event.key === null) refresh(); };
    window.addEventListener(saveChangedEvent, refresh);
    window.addEventListener('storage', storage);
    const timer = setInterval(() => { now = Date.now(); }, 60000);
    return () => {
      controller.abort(); clearInterval(timer);
      window.removeEventListener(saveChangedEvent, refresh); window.removeEventListener('storage', storage);
    };
  });
</script>

<svelte:head><title>{t('page-event-planner')} - Svelte</title></svelte:head>
<h1>{t('page-event-planner')}</h1>
<details class="migration"><summary>{t('ui-migration-status')} &middot; <a href="/planner/events.html" data-sveltekit-reload>{t('ui-legacy-tools')}</a></summary><p>{t('ui-event-boundary')}</p></details>
<noscript><p>{t('ui-javascript-required')}</p></noscript>
{#if $planner.loading}<p role="status">{t('ui-loading-planner')}</p>{/if}
{#if $planner.error}<p class="error" role="alert">{$planner.error}
  <button onclick={() => { if ($planner.dataset) void planner.reload(true); else void planner.initialise(); }}>{t('ui-event-reload')}</button>
</p>{/if}
{#if entry}
  <button class="event-list-toggle" data-event-list-control aria-expanded={eventListOpen} aria-controls="event-list"
    onclick={() => eventListOpen = !eventListOpen}>{t('label-eventlist')}</button>
{/if}
<div class="event-layout">
  <aside id="event-list" aria-label={t('label-eventlist')} class:open={!entry || eventListOpen}>
    {#if $planner.catalog.some((item) => item.archived)}
      <label class="archives"><input type="checkbox" bind:checked={showArchives} />{t('ui-event-supported-archives')}</label>
    {/if}
    {#each $planner.catalog.filter((item) => !item.archived || showArchives || item.id === $planner.selected) as item (item.id)}
      <button class:selected={item.id === $planner.selected} aria-pressed={item.id === $planner.selected} disabled={item.comingSoon || $planner.loading} data-event-id={item.id}
        onclick={() => { if (planner.select(item.id)) { tab = 'Targets'; now = Date.now(); eventListOpen = false; } }}>
        <img src={`/planner/icons/EventIcon/${item.icon}`} alt="" />
        <span>{t(`event-${item.id}`) === 'Undefined' ? item.name : t(`event-${item.id}`)}{#if item.comingSoon} &middot; {t('text-comingsoon')}{/if}</span>
      </button>
    {/each}
  </aside>
  <section class="event-content">
    {#if !entry}<p>{t('label-selectevent')}</p>
    {:else if !event}<h2>{entry.name}</h2><p>{t('ui-event-special-legacy')}</p><a href="/planner/events.html" data-sveltekit-reload>{t('ui-legacy-tools')}</a>
    {:else if $planner.plan && $planner.dataset}
      <h2>{event.display_name}</h2>
      <nav class="tabs" aria-label={t('page-event-planner')}>
        {#each tabs as item}<button aria-pressed={tab === item} data-event-tab={item} class:selected={tab === item} onclick={() => tab = item}>{t(item === 'Points' ? 'label-tabpointrewards' : `label-tab${item.toLowerCase()}`)}</button>{/each}
      </nav>
      <p class="saved" role="status">{$planner.saved ? t('ui-saved-locally') : ''}</p>
      {#if calculation?.error}<p class="error" role="alert">{calculation.error}</p>{/if}
      {#if simulation.kind && simulation.error}<p class="error" role="alert">{simulation.error}</p>{/if}
      {#if simulation.kind && simulation.notice}<p role="status">{simulation.notice}</p>{/if}
      {#key entry.id}
        {#if tab === 'Cards' && event.card_drops}
          <EventCards draws={event.card_drops} currency={simulationFunds ?? 0} currencyName={cardCurrency ? event.currencies[cardCurrency].shortname : ''}
            standardDeviation={$planner.plan.standard_deviation ?? 0} processing={simulation.processing} ready={simulation.ready}
            sampleCount={simulation.sampleCount} canSimulate={simulationFunds !== null}
            simulate={() => { void simulation.run(); }} cancel={() => simulation.cancel()} setDeviation={planner.setStandardDeviation}
            item={(reward) => eventItem(reward, event, metadata, $planner.names)} {t} />
        {:else if tab === 'Dice' && event.dice_race}
          <EventDice race={event.dice_race} currency={simulationFunds ?? 0} currencyName={event.currencies[event.dice_race.roll_currency].shortname}
            standardDeviation={$planner.plan.standard_deviation ?? 0} processing={simulation.processing} ready={simulation.ready}
            sampleCount={simulation.sampleCount} canSimulate={simulationFunds !== null}
            simulate={() => { void simulation.run(); }} cancel={() => simulation.cancel()} setDeviation={planner.setStandardDeviation}
            item={(reward) => eventItem(reward, event, metadata, $planner.names)} {t} />
        {:else if tab === 'Omikuji' && event.omikuji}
          <EventOmikuji omikuji={event.omikuji} currency={simulationFunds ?? 0} currencyName={event.currencies[event.omikuji.pull_currency].shortname}
            standardDeviation={$planner.plan.standard_deviation ?? 0} processing={simulation.processing} ready={simulation.ready}
            sampleCount={simulation.sampleCount} canSimulate={simulationFunds !== null}
            simulate={() => { void simulation.run(); }} cancel={() => simulation.cancel()} setDeviation={planner.setStandardDeviation}
            item={(reward) => eventItem(reward, event, metadata, $planner.names)} {t} />
        {:else if tab === 'Lessons' && event.lessons}
          <EventLessons lessons={event.lessons} plan={$planner.plan} pointsAvailable={baseResult?.value?.currencies.Event_Point ?? 0}
            actions={actions} item={(reward) => eventItem(reward, event, metadata, $planner.names)} {t} />
        {:else if tab === 'Boxes' && event.boxes}
          <EventBoxes boxes={event.boxes} item={(reward) => eventItem(reward, event, metadata, $planner.names)} {t} />
        {:else if ['Targets', 'Energy', 'Bonus', 'Owned'].includes(tab)}
          <EventSettings {tab} {event} plan={$planner.plan} budget={calculation?.budget ?? null} bonuses={calculation?.bonuses ?? {}}
            materials={calculation?.materials ?? []} students={$planner.dataset.students} names={$planner.names} {metadata} {actions} {t} />
        {:else}
          <EventMarket {tab} {event} plan={$planner.plan} runs={result?.value?.feasible ? result.value.runs : {}} variables={calculation?.variables ?? {}}
            initial={calculation?.requirements?.initial ?? { rewards: {}, cost: 0 }} midEvent={calculation?.requirements?.midEvent ?? false}
            pointsObtained={result?.value?.feasible ? result.value.currencies.Event_Point ?? 0 : 0} {actions}
            item={(reward) => eventItem(reward, event, metadata, $planner.names)} {t} />
        {/if}
      {/key}
      <section class="results" aria-labelledby="results-title">
        <h3 id="results-title">{t('ui-event-summary')}</h3>
        <div class="display-options">
          <label><input type="checkbox" bind:checked={includeShop} />{t('label-includeshop')}</label>
          {#if event.point_rewards}<label><input type="checkbox" bind:checked={includePoints} />{t('label-includepointrewards')}</label>{/if}
          {#if event.boxes}<label><input type="checkbox" bind:checked={includeBoxes} />{t('label-includeboxes')}</label>{/if}
                  {#if event.card_drops}<label><input type="checkbox" bind:checked={includeCards} />{t('label-includecards')}</label>{/if}
          {#if event.dice_race}<label><input type="checkbox" bind:checked={includeDice} />{t('label-includedice')}</label>{/if}
          {#if event.omikuji}<label><input type="checkbox" bind:checked={includeOmikuji} />{t('label-includeomikuji')}</label>{/if}
          {#if event.lessons}<label><input type="checkbox" bind:checked={includeLessons} />{t('label-includelessons')}</label>{/if}
        </div>
        {#if includeSimulation}
          {#if simulation.rounding}<p role="status">{t(`ui-event-${simulation.kind}-adjusting`)}</p>
          {:else if simulation.roundingError}<p class="error" role="alert">{simulation.roundingError} <button onclick={simulation.retryAdjustment}>{t('ui-retry')}</button></p>
          {:else if !simulation.ready}<p role="status">{t(`ui-event-${simulation.kind}-simulate-first`)}</p>{/if}
        {/if}
        {#if solving}<p role="status">{t('ui-event-solving')}</p>
        {:else if solveError || result?.error}<p class="error" role="alert">{solveError || result?.error} <button onclick={() => retry++}>{t('ui-retry')}</button></p>
        {:else if result?.value && !result.value.feasible}<p class="error" role="alert">{t('ui-event-infeasible')} ({t('ui-event-total-ap')}: {formatAmount(result.value.energy)})</p>
        {:else if result?.value}
          <p data-event-ap>{t('ui-event-total-ap')}: <strong>{formatAmount(result.value.energy)}</strong></p>
          {#if result.value.boxes}
            <p class="box-progress" data-event-box-progress>
              {t('ui-event-box-cleared')}: <strong>{formatAmount(result.value.boxes.clears)}</strong>.
              {t('ui-event-box-leftover')}: <strong>{result.value.boxes.leftoverPercent}%</strong> {t('ui-event-box-not-included')}
            </p>
          {/if}
          <div class="run-tiles">{#each Object.entries(result.value.runs) as [stage, count]}<span data-event-run={stage}>Q{stage}: <strong>{formatAmount(count)}</strong></span>{/each}</div>
          {#each (includeSimulation && simulation.ready && !simulation.rounded ? [] : rewardGroups) as [group, rewards]}
            <div class="reward-group" data-event-rewards={group}>
              {#each Object.entries(rewards).filter(([, count]) => count !== 0) as [id, count]}
                {@const item = eventItem({ id, count, type: 'StageDrop' }, event, metadata, $planner.names)}
                <span title={item.name} data-event-reward={id}>{#if item.image}<img src={item.image} alt={item.name} />{:else}<span>{item.name}</span>{/if}<strong>{formatAmount(count)}</strong></span>
              {/each}
            </div>
          {/each}
        {:else}<p>{t('ui-event-choose-target')}</p>{/if}
      </section>
    {/if}
  </section>
</div>

<style>
  .migration { padding: .5rem; background: var(--surface); border-left: 3px solid #7c5b7d; font-size: .85rem; }
  .event-layout { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 1rem; margin-top: 1rem; }
  aside { display: flex; flex-direction: column; gap: .5rem; }
  aside button { display: flex; align-items: center; gap: .5rem; text-align: left; padding: .5rem; }
  aside img { width: 58px; height: 58px; object-fit: contain; }
  .archives { display: flex; align-items: center; gap: .4rem; font-size: .85rem; }
  .event-list-toggle { display: none; }
  .selected { background: #7c5b7d55; border-color: #c89fca; }
  .event-content { min-width: 0; }
  h2 { font-size: 1.2rem; }
  .tabs, .display-options, .run-tiles { display: flex; flex-wrap: wrap; gap: .4rem; }
  .tabs button { padding: .45rem .65rem; }
  .saved { min-height: 1em; margin: .3rem 0; font-size: .8rem; }
  .error { color: var(--error); overflow-wrap: anywhere; }
  .results { margin-top: 1rem; border-top: 1px solid #7c5b7d; }
  .display-options { gap: 1rem; }
  .display-options label { display: flex; align-items: center; gap: .35rem; }
  .run-tiles span { padding: .3rem .6rem; background: #7c5b7d33; border-radius: .4rem; }
  .reward-group { display: flex; flex-wrap: wrap; gap: .4rem; margin: .7rem 0; }
  .reward-group > span { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 58px; max-width: 95px; font-size: .8rem; text-align: center; }
  .reward-group img { width: 48px; height: 48px; object-fit: contain; }
  @media (max-width: 700px) {
    .event-layout { grid-template-columns: minmax(0, 1fr); }
    .event-list-toggle { display: block; margin-top: .75rem; }
    aside:not(.open) { display: none; }
    aside { flex-direction: row; flex-wrap: wrap; }
    aside button { flex: 1 1 200px; }
  }
</style>
