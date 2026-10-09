<script lang="ts">
  import { untrack } from 'svelte';
  import { farmServer, farmServers, leftoverBlueprintXp, type FarmServer, type GearFarmResult } from '$lib/domain/planner/gear-farm';
  import { recommendGear } from '$lib/services/gear-farm';
  import { formatAmount, resourceItem } from '$lib/domain/planner/catalog';
  import type { PlannerDataset, PlannerMetadata, ResourceTotals } from '$lib/domain/planner/types';

  let { dataset, totals, metadata, savedServer, setServer, multiplier = $bindable(1), t }: {
    dataset: PlannerDataset; totals: ResourceTotals; metadata: PlannerMetadata; savedServer: unknown;
    setServer: (server: FarmServer) => boolean; multiplier?: number; t: (id: string) => string;
  } = $props();
  let open = $state(false);
  let retry = $state(0);
  let result = $state<GearFarmResult | null>(null);
  let resultKey = $state('');
  let busy = $state(false);
  let error = $state('');
  let settings = $derived.by(() => {
    try { return { server: farmServer(savedServer), error: '' }; }
    catch (problem) { return { server: null, error: problem instanceof Error ? problem.message : t('ui-farming-error') }; }
  });
  let blueprintXp = $derived(leftoverBlueprintXp(totals.leftover, dataset.context.data, metadata.equipment));
  let inputKey = $derived(JSON.stringify([settings.server, multiplier, totals.needed]));
  $effect(() => {
    const key = inputKey;
    retry;
    if (!open) { if (resultKey !== key) result = null; return; }
    const { server, campaign, needed, settingError } = untrack(() => ({
      server: settings.server, campaign: multiplier, needed: totals.needed, settingError: settings.error
    }));
    result = null; error = settingError; busy = false;
    if (!server) return;
    const controller = new AbortController();
    busy = true;
    void recommendGear(dataset.context.data, needed, server, campaign, metadata.worldCaps, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) { result = value; resultKey = key; } })
      .catch((problem) => {
        if (controller.signal.aborted) return;
        console.error('Gear farming failed.', problem);
        error = problem instanceof Error ? problem.message : t('ui-farming-error');
      })
      .finally(() => { if (!controller.signal.aborted) busy = false; });
    return () => controller.abort();
  });
</script>

<details ontoggle={(event) => open = event.currentTarget.open}>
  <summary>{t('ui-farming-recommendations')}{#if result} &middot; {formatAmount(result.energy)} AP{/if}</summary>
  <div class="controls">
    <label>{t('ui-server')}<select value={settings.server ?? ''} onchange={(event) => {
      const selected = farmServers.find((value) => value === event.currentTarget.value);
      if (selected && !setServer(selected)) event.currentTarget.value = settings.server ?? '';
    }}>
      {#if !settings.server}<option value="" disabled>{t('ui-select-server')}</option>{/if}
      {#each farmServers as server}<option>{server}</option>{/each}
    </select></label>
    <label>{t('ui-campaign-multiplier')}<select bind:value={multiplier}>
      {#each [1, 2, 3] as value}<option value={value}>{value}x</option>{/each}
    </select></label>
  </div>
  {#if busy}<p role="status">{t('ui-calculating-farming')}</p>{/if}
  {#if error}<p class="error" role="alert">{error}<button onclick={() => retry++}>{t('ui-retry')}</button></p>{/if}
  {#if result}
    <p data-farm-energy>{t('ui-farming-ap')}: {formatAmount(result.energy)} AP</p>
    {#if result.unavailable.length}
      <p class="warning" role="status">{t('ui-gear-unavailable')}: {result.unavailable.map((key) => resourceItem(key, metadata).name).join(', ')}</p>
    {/if}
    {#if result.runs.length}
      <div class="stage-runs" role="list" aria-label={t('ui-farming-stage-runs')}>
        {#each result.runs as row}
          <div role="listitem" data-farm-stage={row.stage} aria-label={`${row.stage}: ${formatAmount(row.runs)} ${t('ui-runs')}`}>
            <strong>{row.stage}</strong><span data-farm-runs>{formatAmount(row.runs)} {t('ui-runs')}</span>
          </div>
        {/each}
      </div>
    {:else}<p>{t(result.unavailable.length ? 'ui-no-farmable-gear' : 'ui-no-gear-needed')}</p>{/if}
  {/if}
  <p>{t('ui-leftover-blueprint-xp')}: {formatAmount(blueprintXp)}</p>
  <p class="note">{t('ui-farming-rounding-help')}</p>
</details>

<style>
  details { margin-top: 1rem; }
  summary { cursor: pointer; }
  .controls { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.75rem; }
  label { display: flex; flex-direction: column; gap: 0.3rem; }
  .stage-runs { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.4rem; }
  .stage-runs > div { display: flex; flex-direction: column; align-items: center; padding: 0.35rem; border: 1px solid #7c5b7d66; border-radius: 0.4rem; background: #7c5b7d22; }
  .stage-runs span { font-size: 0.85rem; }
  .error { color: var(--error); }
  .note, .warning { font-size: 0.85rem; line-height: 1.5; }
</style>
