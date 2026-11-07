<script lang="ts">
  import { farmServer, farmServers, leftoverBlueprintXp, type FarmServer, type GearFarmPlan } from '$lib/domain/planner/gear-farm';
  import { formatAmount, resourceItem } from '$lib/domain/planner/catalog';
  import type { PlannerDataset, PlannerMetadata, ResourceTotals } from '$lib/domain/planner/types';

  let { dataset, totals, metadata, savedServer, setServer, multiplier = $bindable(1), excludeOwnedChoiceBlueprints = $bindable(false),
    excludeOwnedGeneralBlueprints = $bindable(false), sortByStageNumber = $bindable(false), styleActive = false, onStyleTilePointerDown,
    result, busy, t }: {
    dataset: PlannerDataset; totals: ResourceTotals; metadata: PlannerMetadata; savedServer: unknown;
    setServer: (server: FarmServer) => boolean; multiplier?: number;
    excludeOwnedChoiceBlueprints?: boolean; excludeOwnedGeneralBlueprints?: boolean; sortByStageNumber?: boolean; styleActive?: boolean;
    onStyleTilePointerDown?: (event: PointerEvent) => void; t: (id: string) => string;
    result: GearFarmPlan | null; busy: boolean;
  } = $props();
  let settings = $derived.by(() => {
    try { return { server: farmServer(savedServer), error: '' }; }
    catch (problem) { return { server: null, error: problem instanceof Error ? problem.message : t('ui-farming-error') }; }
  });
  let blueprintXp = $derived(leftoverBlueprintXp(totals.leftover, dataset.context.data, metadata.equipment));
  let displayedRuns = $derived.by(() => {
    const runs = result?.runs ?? [];
    return sortByStageNumber
      ? [...runs].sort((first, second) => {
        const [firstMajor, firstMinor] = first.stage.split('-').map(Number);
        const [secondMajor, secondMinor] = second.stage.split('-').map(Number);
        return secondMajor - firstMajor || firstMinor - secondMinor;
      })
      : runs;
  });
</script>

<section class="farming-recommendations" aria-label={t('ui-farming-recommendations')} aria-busy={busy}>
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
    {#if result}
      <p class="farm-energy" data-farm-energy>
        <img src="/planner/icons/Misc/Energy.png" alt={t('ui-farming-ap')} draggable="false" />
        <span>{formatAmount(result.energy)} AP</span>
      </p>
    {/if}
  </div>
  <div class="blueprint-exclusion-toggles" role="group" aria-label={t('ui-farming-recommendations')}>
    <label class="blueprint-toggle" class:active={excludeOwnedChoiceBlueprints}>
      <input type="checkbox" bind:checked={excludeOwnedChoiceBlueprints} />
      <span class="blueprint-toggle-visuals">
        <span class="blueprint-toggle-switch" aria-hidden="true"></span>
        <span class="blueprint-toggle-icon" aria-hidden="true">
        <img src="/planner/icons/Gear/Choice_T10.webp" alt="" draggable="false" />
        </span>
      </span>
      <span class="blueprint-toggle-text">{t('ui-exclude-owned-choice-blueprints')}</span>
    </label>
    <label class="blueprint-toggle" class:active={excludeOwnedGeneralBlueprints}>
      <input type="checkbox" bind:checked={excludeOwnedGeneralBlueprints} />
      <span class="blueprint-toggle-visuals">
        <span class="blueprint-toggle-switch" aria-hidden="true"></span>
        <span class="blueprint-toggle-icon" aria-hidden="true">
        <img src="/planner/icons/Gear/G_Watch.png" alt="" draggable="false" />
        </span>
      </span>
      <span class="blueprint-toggle-text">{t('ui-exclude-owned-general-blueprints')}</span>
    </label>
  </div>
  {#if result}
    {#if result.unavailable.length}
      <p class="warning" role="status">{t('ui-gear-unavailable')}: {result.unavailable.map((key) => resourceItem(key, metadata).name).join(', ')}</p>
    {/if}
    {#if result.runs.length}
      <div class="stage-runs" class:style-editable={styleActive} role="list" aria-label={t('ui-farming-stage-runs')}
        onpointerdown={(event) => onStyleTilePointerDown?.(event)}>
        {#each displayedRuns as row}
          <div role="listitem" data-farm-stage={row.stage} aria-label={`${row.stage}: ${formatAmount(row.runs)} ${t('ui-runs')}`}>
            <strong>{row.stage}</strong><span data-farm-runs>{formatAmount(row.runs)} {t('ui-runs')}</span>
          </div>
        {/each}
      </div>
    {:else}<p>{t(result.unavailable.length ? 'ui-no-farmable-gear' : 'ui-no-gear-needed')}</p>{/if}
  {/if}
  <p>{t('ui-leftover-blueprint-xp')}: {formatAmount(blueprintXp)}</p>
  <p class="note">{t('ui-farming-selector-allocation-help')}</p>
</section>

<style>
  .farming-recommendations { margin-top: 0.2rem; }
  h3 { margin: 0; font-size: 0.9rem; }
  .controls { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.75rem; }
  label { display: flex; flex-direction: column; gap: 0.3rem; }
  .farm-energy { display: flex; align-items: center; align-self: flex-end; gap: 0.35rem; margin: 0; padding-bottom: 0.2rem; }
  .farm-energy img { width: 2rem; height: 2rem; object-fit: contain; }
  .blueprint-exclusion-toggles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.45rem; width: min(100%, 24rem); margin-top: 0.55rem; }
  .blueprint-toggle { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.2rem; min-height: 4rem; box-sizing: border-box; padding: 0.4rem; border: 1px solid #7c5b7d66; border-radius: 0.4rem; background: var(--background); text-align: center; cursor: pointer; }
  .blueprint-toggle-visuals { display: flex; align-items: center; justify-content: center; gap: 0.4rem; pointer-events: none; }
  .blueprint-toggle:focus-within { outline: 2px solid #82dafb; outline-offset: 1px; }
  .blueprint-toggle input { position: absolute; z-index: 2; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  .blueprint-toggle-switch { position: relative; display: block; width: 1.45rem; height: 0.8rem; box-sizing: border-box; border: 1px solid #7c5b7d88; border-radius: 999px; background: color-mix(in srgb, var(--text) 28%, transparent); transition: background-color 160ms ease; pointer-events: none; }
  .blueprint-toggle-switch::before { position: absolute; top: 0.08rem; left: 0.08rem; width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--background); content: ''; transition: transform 160ms ease; }
  .blueprint-toggle.active .blueprint-toggle-switch { border-color: #82dafb; background: #82dafb; }
  .blueprint-toggle.active .blueprint-toggle-switch::before { transform: translateX(0.65rem); }
  .blueprint-toggle-icon { display: grid; width: 2.3rem; height: 2.3rem; place-items: center; pointer-events: none; }
  .blueprint-toggle-icon img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .blueprint-toggle-text { position: relative; z-index: 1; max-width: 100%; font-size: 0.66rem; line-height: 1.15; pointer-events: none; }
  @media (max-width: 600px) {
    .blueprint-toggle-text { font-size: 0.56rem; }
  }
  .stage-runs { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.4rem; margin-top: 0.6rem; }
  .stage-runs > div { display: flex; flex-direction: column; align-items: center; padding: 0.35rem; border: 1px solid #7c5b7d66; border-radius: 0.4rem; background: #7c5b7d22; }
  .stage-runs.style-editable > div { position: relative; isolation: isolate; }
  .stage-runs.style-editable > div::before, .stage-runs.style-editable > div::after { position: absolute; inset: 0; border-radius: inherit; content: ''; }
  .stage-runs.style-editable > div::before { z-index: 1; background: #82dafb4d; cursor: crosshair; pointer-events: auto; }
  .stage-runs.style-editable > div::after { z-index: 2; background: linear-gradient(135deg, transparent 43%, #bfeaff9c 50%, transparent 57%); background-size: 300% 300%; background-repeat: no-repeat; animation: gear-stage-style-shine 2.8s ease-in-out infinite; pointer-events: none; }
  @keyframes gear-stage-style-shine { 0% { background-position: 140% 140%; } 24% { background-position: -140% -140%; } 24.01%, 100% { background-position: 140% 140%; } }
  @media (prefers-reduced-motion: reduce) { .stage-runs.style-editable > div::after { animation: none; } }
  .stage-runs span { font-size: 0.85rem; }
  .note, .warning { font-size: 0.85rem; line-height: 1.5; }
</style>
