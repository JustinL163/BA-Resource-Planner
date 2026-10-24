<script lang="ts">
  import { farmServer, farmServers, leftoverBlueprintXp, type FarmServer, type GearFarmPlan } from '$lib/domain/planner/gear-farm';
  import { formatAmount, resourceItem } from '$lib/domain/planner/catalog';
  import type { PlannerDataset, PlannerMetadata, ResourceTotals } from '$lib/domain/planner/types';

  let { dataset, totals, metadata, savedServer, setServer, multiplier = $bindable(1), result, busy, t }: {
    dataset: PlannerDataset; totals: ResourceTotals; metadata: PlannerMetadata; savedServer: unknown;
    setServer: (server: FarmServer) => boolean; multiplier?: number; t: (id: string) => string;
    result: GearFarmPlan | null; busy: boolean;
  } = $props();
  let settings = $derived.by(() => {
    try { return { server: farmServer(savedServer), error: '' }; }
    catch (problem) { return { server: null, error: problem instanceof Error ? problem.message : t('ui-farming-error') }; }
  });
  let blueprintXp = $derived(leftoverBlueprintXp(totals.leftover, dataset.context.data, metadata.equipment));
</script>

<section class="farming-recommendations" aria-label={t('ui-farming-recommendations')}>
  <h3>{t('ui-farming-recommendations')}{#if result}{' - '}{formatAmount(result.energy)} AP{/if}</h3>
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
  {#if result}
    <p class="farm-energy" data-farm-energy>
      <img src="/planner/icons/Misc/Energy.png" alt={t('ui-farming-ap')} draggable="false" />
      <span>{formatAmount(result.energy)} AP</span>
    </p>
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
  <p class="note">{t('ui-farming-selector-allocation-help')}</p>
</section>

<style>
  .farming-recommendations { margin-top: 1rem; }
  h3 { margin: 0; font-size: 0.9rem; }
  .controls { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.75rem; }
  label { display: flex; flex-direction: column; gap: 0.3rem; }
  .farm-energy { display: flex; align-items: center; gap: 0.35rem; }
  .farm-energy img { width: 2rem; height: 2rem; object-fit: contain; }
  .stage-runs { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.4rem; }
  .stage-runs > div { display: flex; flex-direction: column; align-items: center; padding: 0.35rem; border: 1px solid #7c5b7d66; border-radius: 0.4rem; background: #7c5b7d22; }
  .stage-runs span { font-size: 0.85rem; }
  .note, .warning { font-size: 0.85rem; line-height: 1.5; }
</style>
