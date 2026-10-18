<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { metadata } from '$content/planner';
  import reviewedArchive from '$content/reviewed-event-archive.json';
  import strings from '$content/strings.json';
  import { getLanguageString } from '$lib/domain/localisation';
  import { preferences } from '$lib/stores/preferences';
  import { createEventPlanner } from '$lib/stores/event-planner';
  import { eventRequirements, summarizeEventRuns } from '$lib/domain/events/standard';
  import { applyCardRewards } from '$lib/domain/events/cards';
  import { applyDiceRewards } from '$lib/domain/events/dice';
  import { applyOmikujiRewards } from '$lib/domain/events/omikuji';
  import { applyLessonRewards } from '$lib/domain/events/lessons';
  import { applyInvasionRewards, calculateInvasionRewards } from '$lib/domain/events/invasion';
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

  const planner = createEventPlanner(metadata, undefined, reviewedArchive);
  const t = (id: string) => getLanguageString(strings, id, $preferences.language);
  function solverReportsInfeasible(value: unknown): boolean {
    return isRecord(value) && (value.feasible === false || (isRecord(value.midpoint) && value.midpoint.feasible === false));
  }
  let tab = $state<EventTab>('Targets');
  let now = $state(0);
  let solution = $state<unknown>(null);
  let solutionKey = $state('');
  let solving = $state(false);
  let solveError = $state('');
  let minimumRequiredAp = $state<number | null>(null);
  let retry = $state(0);
  let includeShop = $state(true);
  let includePoints = $state(true);
  let includeBoxes = $state(true);
  let includeCards = $state(true);
  let includeDice = $state(true);
  let includeOmikuji = $state(true);
  let includeLessons = $state(true);
  let includeInvasion = $state(true);
  let showArchives = $state(false);
  let eventListOpen = $state(false);
  let entry = $derived($planner.catalog.find((entry) => entry.id === $planner.selected));
  let event = $derived(entry?.event ?? null);
  let tabs = $derived((['Targets', 'Energy', 'Bonus', 'Shop', 'Stages', ...(event?.point_rewards ? ['Points'] : []), ...(event?.boxes ? ['Boxes'] : []), ...(event?.card_drops ? ['Cards'] : []), ...(event?.dice_race ? ['Dice'] : []), ...(event?.omikuji ? ['Omikuji'] : []), ...(event?.lessons ? ['Lessons'] : []), ...(event?.active ? ['Owned'] : [])]).filter((key): key is EventTab =>
    ['Targets', 'Energy', 'Bonus', 'Shop', 'Stages', 'Points', 'Boxes', 'Cards', 'Dice', 'Omikuji', 'Lessons', 'Owned'].includes(key)));
  let tabNav = $state<HTMLElement | undefined>(undefined);
  let tabRows = $state<EventTab[][]>([]);
  let tabRowsReady = $derived(tabRows.flat().length === tabs.length && tabs.every((item) => tabRows.some((row) => row.includes(item))));
  let renderedTabRows = $derived(tabRowsReady ? tabRows : [tabs]);
  let tabLayoutFrame: number | undefined;
  let calculation = $derived.by(() => {
    if (!event || !$planner.plan || !$planner.dataset || !now) return null;
    try {
      const plan = $planner.plan;
      const initialRequirements = eventRequirements(event, plan);
      const bonuses = calculateEventBonuses(entry?.id ?? '', event, plan.enabled_bonus_units, $planner.dataset.students);
      const budget = calculateEventEnergy(entry?.id ?? '', event, plan, $planner.cafeEnergy,
        initialRequirements.midEvent, initialRequirements.initial.cost, now);
      const invasionRewards = event.invasion
        ? calculateInvasionRewards(event.invasion, budget.resetsTotal, budget.resetsLeft, initialRequirements.midEvent)
        : null;
      const requirements = invasionRewards ? eventRequirements(event, plan, invasionRewards.currencies) : initialRequirements;
      const inputs = {
        eventId: entry?.id ?? '', bonuses, needed: requirements.needed, energyAvailable: budget.available,
        pointTarget: requirements.pointTarget, enabledGroups: plan.enabled_stage_groups, upgradeBases: false
      };
      let model: EventModel | null = null;
      if (plan.optimisation_type === 'Shop') model = buildStageModel(event, inputs, 'Energy_Cost', 'min', false);
      else if (plan.optimisation_type === 'Currency' && typeof plan.optimisation_options === 'string') model = buildStageModel(event, inputs, plan.optimisation_options, 'max', true);
      else if (plan.optimisation_type === 'Materials' && isRecord(plan.optimisation_options)) {
        const selected: Record<string, boolean> = {};
        const availableMaterials = new Set(materialDropOptions(event));
        for (const [key, value] of Object.entries(plan.optimisation_options)) {
          if (typeof value !== 'boolean') throw new Error('Invalid material target.');
          if (availableMaterials.has(key)) selected[key] = value;
        }
        if (Object.values(selected).some(Boolean)) model = buildMaterialTargetModel(event, inputs, selected);
      }
      return {
        requirements, bonuses, budget, model, invasionRewards,
        variables: buildStageVariables(event, bonuses, plan.enabled_stage_groups),
        materials: materialDropOptions(event), error: ''
      };
    } catch (problem) {
      return {
        requirements: null, bonuses: {}, budget: null, model: null, invasionRewards: null,
        variables: {}, materials: [], error: problem instanceof Error ? problem.message : t('ui-event-calculation-failed')
      };
    }
  });
  let solveKey = $derived(JSON.stringify({ id: entry?.id, blocked: Boolean($planner.error), model: calculation?.model, manual: $planner.plan?.optimisation_type === 'Manual' ? $planner.plan.optimisation_options ?? {} : null, retry }));
  $effect(() => {
    const key = solveKey;
    const model = untrack(() => calculation?.model);
    const plan = untrack(() => $planner.plan);
    const active = untrack(() => ({ event, eventId: entry?.id ?? '', calculation }));
    const controller = new AbortController();
    solution = null; solutionKey = ''; solveError = ''; minimumRequiredAp = null; solving = false;
    if (untrack(() => Boolean($planner.error))) return () => controller.abort();
    if (plan?.optimisation_type === 'Manual') {
      solution = plan.optimisation_options ?? {}; solutionKey = key;
    } else if (model) {
      solving = true;
      void (async () => {
        try {
          const result = await solveEventPlan(model, { signal: controller.signal });
          if (controller.signal.aborted) return;
          let infeasible = solverReportsInfeasible(result);
          // Currency maximization can satisfy its model while still falling short
          // of the selected purchases. Check the complete rounded plan as well.
          if (plan && (plan.optimisation_type === 'Materials' || plan.optimisation_type === 'Currency') && active.event &&
            active.calculation?.requirements && active.calculation.budget) {
            try {
              infeasible = !summarizeEventRuns(active.event, plan, active.calculation.requirements,
                active.calculation.bonuses, active.calculation.budget.available, result, false, false, metadata).feasible;
            } catch {
              // Invalid solver data still takes the minimum-AP error path.
            }
          }
          if (infeasible && plan && active.event && active.calculation?.requirements && active.calculation.budget &&
            (plan.optimisation_type === 'Materials' || plan.optimisation_type === 'Currency')) {
            try {
              const requirements = active.calculation.requirements;
              const bonuses = active.calculation.bonuses;
              const minimumModel = buildStageModel(active.event, {
                eventId: active.eventId,
                bonuses,
                needed: requirements.needed,
                energyAvailable: active.calculation.budget.available,
                pointTarget: requirements.pointTarget,
                enabledGroups: plan.enabled_stage_groups,
                upgradeBases: false
              }, 'Energy_Cost', 'min', false);
              const minimumSolution = await solveEventPlan(minimumModel, { signal: controller.signal });
              if (controller.signal.aborted) return;
              const minimumSummary = summarizeEventRuns(active.event, plan, requirements, bonuses,
                Number.MAX_SAFE_INTEGER, minimumSolution, false, false, metadata);
              if (minimumSummary.feasible) minimumRequiredAp = minimumSummary.energy;
            } catch (problem) {
              if (!controller.signal.aborted) console.error('Could not calculate minimum event energy.', problem);
            }
          }
          if (!controller.signal.aborted) { solution = result; solutionKey = key; }
        } catch (problem: unknown) {
          if (controller.signal.aborted) return;
          console.error('Event optimization failed.', problem);
          solveError = problem instanceof Error ? problem.message : t('ui-event-calculation-failed');
        } finally {
          if (!controller.signal.aborted) solving = false;
        }
      })();
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
      if (calculation?.invasionRewards) value = applyInvasionRewards(value, calculation.invasionRewards, includeInvasion);
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
    currencies: result.value.currencies,
    other: { ...result.value.eleph, Credit: result.value.credit, Eligma: result.value.eligma, SecretTech: result.value.secretTech,
      ...(result.value.gearBoxes ? { Random_Equipment_Box_0: result.value.gearBoxes } : {}) },
    schoolMats: result.value.schoolMats, xps: result.value.xps, gear: result.value.gear,
    artifacts: result.value.artifacts
  }) : []);

  function rewardRarityClass(group: string, id: string): string {
    const tier = group === 'schoolMats'
      ? id.match(/^(?:BD|TN)_([1-4])(?:_|$)/)?.[1]
      : group === 'artifacts' ? id.match(/_([1-4])$/)?.[1] : undefined;
    return tier ? `rarity-${tier}` : '';
  }

  function sortedRewardEntries(group: string, rewards: Record<string, number>): [string, number][] {
    const entries = Object.entries(rewards).filter(([, count]) => count !== 0);
    if (!['artifacts', 'schoolMats', 'xps'].includes(group)) return entries;
    return entries.sort(([firstId], [secondId]) => {
      const parts = (id: string): { type: string; tier: number } => {
        if (group === 'artifacts') {
          const match = id.match(/^(.*)_([1-4])$/);
          return { type: match?.[1] ?? id, tier: Number(match?.[2] ?? 0) };
        }
        if (group === 'schoolMats') {
          const match = id.match(/^(BD|TN)_([1-4])_(.+)$/);
          return { type: match ? `${match[1]}_${match[3]}` : id, tier: Number(match?.[2] ?? 0) };
        }
        if (group === 'xps') {
          const match = id.match(/^(XP|GXP)_([1-4])$/);
          return { type: match?.[1] === 'XP' ? '0-XP' : match?.[1] === 'GXP' ? '1-GXP' : id, tier: Number(match?.[2] ?? 0) };
        }
        return { type: id, tier: 0 };
      };
      const first = parts(firstId);
      const second = parts(secondId);
      return first.type.localeCompare(second.type) || second.tier - first.tier || firstId.localeCompare(secondId);
    });
  }

  function groupedRewardEntries(group: string, rewards: Record<string, number>) {
    const entriesByType = new Map<string, [string, number][]>();
    for (const entry of sortedRewardEntries(group, rewards)) {
      const id = entry[0];
      const schoolMat = group === 'schoolMats' ? id.match(/^(BD|TN)_([1-4])_(.+)$/) : null;
      const xp = group === 'xps' ? id.match(/^(XP|GXP)_[1-4]$/) : null;
      const type = schoolMat ? `${schoolMat[1]}_${schoolMat[3]}` : xp?.[1] ?? id;
      const entries = entriesByType.get(type) ?? [];
      entries.push(entry);
      entriesByType.set(type, entries);
    }
    return [...entriesByType].map(([type, entries]) => ({ type, entries }));
  }

  function formatRewardAmount(amount: number): string {
    return formatAmount(Number(amount.toFixed(1)));
  }

  function fitRewardAmount(node: HTMLElement, _amount: string) {
    const container = node.parentElement;
    const range = document.createRange();
    let frame = 0;
    let observer: ResizeObserver | undefined;

    function fit() {
      if (!container) return;
      node.style.removeProperty('font-size');
      const style = getComputedStyle(container);
      const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      const configuredRatio = Number.parseFloat(style.getPropertyValue('--overlay-number-fit-ratio'));
      const fitRatio = Number.isFinite(configuredRatio) ? Math.min(1, Math.max(0, configuredRatio)) : 1;
      const availableWidth = Math.max(0, (container.clientWidth - padding - 2) * fitRatio);
      range.selectNodeContents(node);
      const fits = () => range.getBoundingClientRect().width <= availableWidth;
      if (fits()) return;

      let low = 0;
      let high = Number.parseFloat(getComputedStyle(node).fontSize) || 18;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const size = (low + high) / 2;
        node.style.fontSize = `${size}px`;
        if (fits()) low = size;
        else high = size;
      }
      node.style.fontSize = `${low}px`;
    }

    function scheduleFit() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    }

    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(scheduleFit);
      observer.observe(container);
    }
    scheduleFit();
    return {
      update: scheduleFit,
      destroy() {
        observer?.disconnect();
        cancelAnimationFrame(frame);
        node.style.removeProperty('font-size');
      }
    };
  }

  const actions: EventActions = { ...planner, setMode(mode: Exclude<EventMode, ''>) {
    const saved = planner.setMode(mode);
    if (saved && mode === 'Manual') tab = 'Stages';
    return saved;
  } };

  function arrangeTabRows() {
    if (!tabNav) return;
    const buttons = new Map([...tabNav.querySelectorAll<HTMLButtonElement>('[data-event-tab]')]
      .map((button) => [button.dataset.eventTab as EventTab, button]));
    const availableWidth = tabNav.clientWidth;
    if (!availableWidth || buttons.size !== tabs.length) return;

    const savedButtonStyles = [...buttons.values()].map((button) => ({
      button,
      flex: button.style.flex,
      width: button.style.width,
      minWidth: button.style.minWidth
    }));
    for (const { button } of savedButtonStyles) {
      button.style.flex = '0 0 auto';
      button.style.width = 'max-content';
      button.style.minWidth = 'max-content';
    }
    const naturalWidths = new Map(savedButtonStyles.map(({ button }) =>
      [button.dataset.eventTab as EventTab, button.getBoundingClientRect().width]));
    for (const { button, flex, width, minWidth } of savedButtonStyles) {
      button.style.flex = flex;
      button.style.width = width;
      button.style.minWidth = minWidth;
    }

    const row = tabNav.querySelector<HTMLElement>('.tab-row');
    const gap = row ? Number.parseFloat(getComputedStyle(row).columnGap) || 0 : 0;
    const rows: EventTab[][] = [];
    let currentRow: EventTab[] = [];
    let currentWidth = 0;
    for (const item of tabs) {
      const width = naturalWidths.get(item);
      if (width === undefined) return;
      if (currentRow.length && currentWidth + gap + width > availableWidth) {
        rows.push(currentRow);
        currentRow = [];
        currentWidth = 0;
      }
      if (currentRow.length) currentWidth += gap;
      currentRow.push(item);
      currentWidth += width;
    }
    if (currentRow.length) rows.push(currentRow);

    const selectedRow = rows.findIndex((items) => items.includes(tab));
    if (selectedRow >= 0 && selectedRow < rows.length - 1) {
      const [selectedItems] = rows.splice(selectedRow, 1);
      if (selectedItems) rows.push(selectedItems);
    }
    const unchanged = rows.length === tabRows.length && rows.every((items, index) =>
      items.length === tabRows[index]?.length && items.every((item, itemIndex) => item === tabRows[index][itemIndex]));
    if (!unchanged) tabRows = rows;
  }

  function scheduleTabRows() {
    if (tabLayoutFrame !== undefined) cancelAnimationFrame(tabLayoutFrame);
    tabLayoutFrame = requestAnimationFrame(() => {
      tabLayoutFrame = undefined;
      arrangeTabRows();
    });
  }

  $effect(() => {
    const nav = tabNav;
    const currentTabs = tabs;
    const selectedTab = tab;
    if (nav && currentTabs.length && selectedTab) scheduleTabRows();
  });

  $effect(() => {
    const nav = tabNav;
    const currentTabs = tabs;
    if (!nav || !currentTabs.length) return;
    const observer = new ResizeObserver(scheduleTabRows);
    observer.observe(nav);
    for (const button of nav.querySelectorAll('[data-event-tab]')) observer.observe(button);
    return () => observer.disconnect();
  });

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

<svelte:head><title>{t('page-event-planner')}</title></svelte:head>
<noscript><p>{t('ui-javascript-required')}</p></noscript>
{#if $planner.loading}<p role="status">{t('ui-loading-planner')}</p>{/if}
{#if $planner.error}<p class="error" role="alert">{$planner.error}
  <button onclick={() => { if ($planner.dataset) void planner.reload(true); else void planner.initialise(); }}>{t('ui-event-reload')}</button>
</p>{/if}
<div class="event-layout" class:event-selection={!entry || eventListOpen}>
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
    {#if entry}
      <div class="event-heading">
        <button class="event-list-toggle" data-event-list-control aria-expanded={eventListOpen} aria-controls="event-list"
          onclick={() => eventListOpen = !eventListOpen}>{t('label-eventlist')}</button>
        <h2>{event?.display_name || (t(`event-${entry.id}`) === 'Undefined' ? entry.name : t(`event-${entry.id}`))}</h2>
      </div>
    {/if}
    {#if !entry}<p>{t('label-selectevent')}</p>
    {:else if !event}<p>{t('ui-event-special-unavailable')}</p>
    {:else if $planner.plan && $planner.dataset}
      <nav class="tabs" bind:this={tabNav} aria-label={t('page-event-planner')}>
        {#each renderedTabRows as row (row[0])}
          <div class="tab-row">
            {#each row as item, index (item)}<button aria-pressed={tab === item} data-event-tab={item} class:selected={tab === item} class:before-selected={row[index + 1] === tab} class:after-selected={row[index - 1] === tab} onclick={() => tab = item}>{t(item === 'Points' ? 'label-tabpointrewards' : `label-tab${item.toLowerCase()}`)}</button>{/each}
          </div>
        {/each}
      </nav>
      <div class="tab-panel">
        {#if calculation?.error}<p class="error" role="alert">{calculation.error}</p>{/if}
        {#if simulation.kind && simulation.error}<p class="error" role="alert">{simulation.error}</p>{/if}
        {#if simulation.kind && simulation.notice}<p role="status">{simulation.notice}</p>{/if}
        <div class="tab-panel-body">
        <div class="tab-content">
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
            materials={calculation?.materials ?? []} students={$planner.dataset.students} plannerUnlockedIds={$planner.plannerUnlockedIds}
            names={$planner.names} {metadata} {actions} {t} />
        {:else}
          <EventMarket {tab} {event} plan={$planner.plan} runs={result?.value?.feasible ? result.value.runs : {}} variables={calculation?.variables ?? {}}
            initial={calculation?.requirements?.initial ?? { rewards: {}, cost: 0 }} midEvent={calculation?.requirements?.midEvent ?? false}
            pointsObtained={result?.value?.feasible ? result.value.currencies.Event_Point ?? 0 : 0}
            overflowPurchases={result?.value?.overflowPurchases ?? {}} {actions}
            item={(reward) => eventItem(reward, event, metadata, $planner.names)} {t} />
        {/if}
        {/key}
        </div>
        <section class="results" aria-label={t('ui-event-summary')}>
        {#if !solving && !solveError && !result?.error && result?.value?.feasible}
          <div class="run-tiles">{#each Object.entries(result.value.runs) as [stage, count]}<span data-event-run={stage}>Q{stage}: <strong>{formatAmount(count)}</strong></span>{/each}</div>
        {/if}
        <div class="display-options">
          <label><input type="checkbox" bind:checked={includeShop} />{t('label-includeshop')}</label>
          {#if event.point_rewards}<label><input type="checkbox" bind:checked={includePoints} />{t('label-includepointrewards')}</label>{/if}
          {#if event.boxes}<label><input type="checkbox" bind:checked={includeBoxes} />{t('label-includeboxes')}</label>{/if}
                  {#if event.card_drops}<label><input type="checkbox" bind:checked={includeCards} />{t('label-includecards')}</label>{/if}
          {#if event.dice_race}<label><input type="checkbox" bind:checked={includeDice} />{t('label-includedice')}</label>{/if}
          {#if event.omikuji}<label><input type="checkbox" bind:checked={includeOmikuji} />{t('label-includeomikuji')}</label>{/if}
          {#if event.lessons}<label><input type="checkbox" bind:checked={includeLessons} />{t('label-includelessons')}</label>{/if}
          {#if event.invasion}<label><input type="checkbox" bind:checked={includeInvasion} />{t('label-includeinvasion')}</label>{/if}
        </div>
        {#if includeSimulation}
          {#if simulation.rounding}<p role="status">{t(`ui-event-${simulation.kind}-adjusting`)}</p>
          {:else if simulation.roundingError}<p class="error" role="alert">{simulation.roundingError} <button onclick={simulation.retryAdjustment}>{t('ui-retry')}</button></p>
          {:else if !simulation.ready}<p role="status">{t(`ui-event-${simulation.kind}-simulate-first`)}</p>{/if}
        {/if}
        {#if solving}<p role="status">{t('ui-event-solving')}</p>
        {:else if result?.value && !result.value.feasible}
          <p class="error" role="alert">{t('ui-event-infeasible')}
            {#if minimumRequiredAp !== null} ({t('ui-event-total-ap')}: {formatAmount(minimumRequiredAp)})
            {:else if $planner.plan?.optimisation_type === 'Shop' || $planner.plan?.optimisation_type === 'Manual'} ({t('ui-event-total-ap')}: {formatAmount(result.value.energy)}){/if}
          </p>
        {:else if !result?.value && solutionKey === solveKey && solverReportsInfeasible(solution) &&
          ($planner.plan?.optimisation_type === 'Materials' || $planner.plan?.optimisation_type === 'Currency')}
          <p class="error" role="alert">{t('ui-event-infeasible')}{#if minimumRequiredAp !== null} ({t('ui-event-total-ap')}: {formatAmount(minimumRequiredAp)}){/if}</p>
        {:else if solveError || result?.error}<p class="error" role="alert">{solveError || result?.error} <button onclick={() => retry++}>{t('ui-retry')}</button></p>
        {:else if result?.value}
          {#if result.value.boxes}
            <p class="box-progress" data-event-box-progress>
              {t('ui-event-box-cleared')}: <strong>{formatAmount(result.value.boxes.clears)}</strong>.
              {t('ui-event-box-leftover')}: <strong>{result.value.boxes.leftoverPercent}%</strong> {t('ui-event-box-not-included')}
            </p>
          {/if}
          {#each rewardGroups as [group, rewards]}
            {#if group === 'currencies' || !(includeSimulation && simulation.ready && !simulation.rounded)}
              <div class="reward-group" data-event-rewards={group}>
                {#if group === 'currencies'}
                  {@const amount = formatAmount(result.value.energy)}
                  <span class="reward-item" role="img" title={`${t('ui-event-total-ap')}: ${amount}`} aria-label={`${t('ui-event-total-ap')}: ${amount}`} data-event-ap>
                    <img src="/planner/icons/EventIcon/EnergyIcon/Energy.png" alt="" draggable="false" />
                    <strong use:fitRewardAmount={amount}>{amount}</strong>
                  </span>
                {/if}
                {#if !(includeSimulation && simulation.ready && !simulation.rounded)}
                  {#each groupedRewardEntries(group, rewards) as typeGroup}
                    <div class="reward-type-group" data-event-reward-group={group} data-event-reward-type={typeGroup.type}>
                      {#each typeGroup.entries as [id, count]}
                        {@const item = eventItem({ id, count, type: 'StageDrop' }, event, metadata, $planner.names)}
                        {@const amount = formatRewardAmount(count)}
                        <span class={`reward-item ${rewardRarityClass(group, id)}`} class:without-image={!item.image} title={item.name}
                          aria-label={`${item.name}: ${amount}`} data-event-reward={id}>
                          {#if item.image}<img src={item.image} alt="" />{:else}<span class="reward-fallback">{item.name}</span>{/if}
                          <strong use:fitRewardAmount={amount}>{amount}</strong>
                        </span>
                      {/each}
                    </div>
                  {/each}
                {/if}
              </div>
            {/if}
          {/each}
        {:else}<p>{t('ui-event-choose-target')}</p>{/if}
        </section>
        </div>
      </div>
    {/if}
  </section>
</div>

<style>
  .event-layout { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 1rem; margin-top: 1rem; }
  aside { box-sizing: border-box; align-self: start; display: flex; flex-direction: column; gap: .5rem; max-height: 70vh; max-height: 70dvh; padding-right: .25rem; overflow-y: auto; overscroll-behavior: contain; }
  aside button { display: flex; align-items: center; gap: .5rem; text-align: left; padding: .5rem; }
  aside img { width: 58px; height: 58px; object-fit: contain; }
  .archives { display: flex; align-items: center; gap: .4rem; font-size: .85rem; }
  .event-list-toggle { display: none; }
  .selected { background: #7c5b7d55; border-color: #c89fca; }
  .event-content { min-width: 0; }
  h2 { font-size: 1.2rem; }
  .tabs { display: flex; flex-direction: column; max-width: 100%; margin: .25rem 0 0; }
  .tab-row { display: flex; flex-wrap: nowrap; align-items: flex-end; gap: 0; width: 100%; max-width: 800px }
  .tabs button { flex: 1 1 auto; min-width: max-content; padding: .55rem .8rem; border: 1px solid #888; border-bottom-color: transparent; border-radius: 0; background: transparent; color: var(--text); white-space: nowrap; }
  .tabs button:hover { background: var(--surface); }
  .tabs button.selected { position: relative; z-index: 1; border-color: #7c5b7d; border-bottom-color: var(--background); background: var(--background); color: var(--text); font-weight: 600; }
  .tabs button.before-selected { border-right-color: transparent; }
  .tabs button.after-selected { border-left-color: transparent; }
  .tab-panel { position: relative; min-width: 0; max-width: 800px; margin-top: -1px; padding: .75rem; border: 1px solid #7c5b7d; border-radius: 0 0 .45rem .45rem; }
  .tab-panel-body { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 1rem; min-width: 0; }
  .tab-content { flex: 1 1 36rem; min-width: min(100%, 22rem); max-width: 770px; }
  .display-options, .run-tiles { display: flex; flex-wrap: wrap; gap: .4rem; }
  .run-tiles { margin-bottom: 1rem; }
  .error { color: var(--error); overflow-wrap: anywhere; }
  .results { flex: 1 1 22rem; min-width: min(100%, 18rem); margin: 0; border-top: 1px solid #7c5b7d; max-width: 700px; padding-top: 0.5rem }
  @media (min-width: 1300px) {
    .tab-panel { max-width: 1500px; }
    .results { padding-left: 1rem; border-top: 0; border-left: 1px solid #7c5b7d; }
  }
  @media (max-width: 1299px) {
    .tab-panel-body { flex-direction: column; }
    .tab-content, .results { box-sizing: border-box; flex: 0 1 auto; width: 100%; max-width: none; }
  }
  .display-options { gap: 1rem; }
  .display-options label { display: flex; align-items: center; gap: .35rem; }
  .run-tiles span { padding: .3rem .6rem; background: #7c5b7d33; border-radius: .4rem; }
  .reward-group { display: flex; flex-wrap: wrap; }
  .reward-type-group { display: contents; }
  .reward-type-group[data-event-reward-group="schoolMats"], .reward-type-group[data-event-reward-group="xps"] {
    display: flex; flex: 0 0 auto; flex-wrap: nowrap; gap: .2rem .35rem;
  }
  .reward-item { --overlay-number-fit-ratio: 0.9; position: relative; display: inline-grid; flex: 0 0 4.5rem; place-items: center; width: 4.5rem; height: 4.5rem; background-position: center; background-size: contain; background-repeat: no-repeat; }
  .reward-item.rarity-1 { background-image: url('/planner/icons/Misc/background_n.png'); }
  .reward-item.rarity-2 { background-image: url('/planner/icons/Misc/background_r.png'); }
  .reward-item.rarity-3 { background-image: url('/planner/icons/Misc/background_sr.png'); }
  .reward-item.rarity-4 { background-image: url('/planner/icons/Misc/background_ssr.png'); }
  .reward-item img { display: block; width: 74%; max-width: 70px; aspect-ratio: 1 / 1; object-fit: contain; }
  .reward-fallback { max-width: 100%; padding: 0.15rem; font-size: 0.65rem; line-height: 1; text-align: center; overflow-wrap: anywhere; }
  .reward-item.without-image strong { top: auto; bottom: 0.15rem; font-size: 0.9rem; }
  .reward-item strong { position: absolute; top: 50%; left: 50%; max-width: 100%; transform: translate(-50%, -50%); color: #111; font-size: 1.5rem; line-height: 1; text-align: center; white-space: nowrap; text-shadow: -1px -1px 0 #fff, 0 -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 0 1px 0 #fff, 1px 1px 0 #fff; pointer-events: none; }
  @media (max-width: 800px) {
    .event-layout { grid-template-columns: minmax(0, 1fr); }
    .event-layout.event-selection .event-content { display: none; }
    .event-list-toggle { display: block; flex: 0 0 auto; margin: 0; }
    .event-heading { display: flex; align-items: center; gap: .6rem; }
    .event-heading h2 { min-width: 0; margin: 0; }
    aside:not(.open) { display: none; }
    aside { flex-direction: row; flex-wrap: wrap; }
    aside button { flex: 1 1 200px; }
  }
  @media (max-width: 600px) {
    .event-layout { margin-inline: -.55rem; }
    .reward-item { position: relative; display: inline-grid; flex: 0 0 3.5rem; place-items: center; width: 3.5rem; height: 3.5rem; background-position: center; background-size: contain; background-repeat: no-repeat; }
  }
</style>
