<script lang="ts">
  import type { PlannerMetadata, ResourceTotals } from '$lib/domain/planner/types';
  import { formatAmount } from '$lib/domain/planner/catalog';
  import { inventoryLayout } from '$lib/domain/planner/inventory-layout';
  import { weaponXpSummary } from '$lib/domain/planner/aggregates';
  import ResourceCell, { type ResourceMode } from './ResourceCell.svelte';
  import PlannerDialog from './PlannerDialog.svelte';
  import GearFarming from './GearFarming.svelte';
  import type { PlannerDataset } from '$lib/domain/planner/types';
  import type { FarmServer } from '$lib/domain/planner/gear-farm';

  let { totals, metadata, dataset, savedServer, setServer, setOwned, gear, close, error, levelCap, setCap,
    campaignMultiplier = $bindable(1), mode = $bindable<ResourceMode>('needed'), t }: {
    totals: ResourceTotals; metadata: PlannerMetadata; setOwned: (key: string, amount: number) => boolean;
    gear: boolean; close: () => void; error: string; levelCap: number; setCap: (value: number) => void;
    mode?: ResourceMode; t: (id: string) => string;
    dataset: PlannerDataset; savedServer: unknown; setServer: (server: FarmServer) => boolean;
    campaignMultiplier?: number;
  } = $props();
  let search = $state('');
  let capError = $state('');
  let layout = $derived(inventoryLayout(metadata, totals, gear));
  const modes = [
    { key: 'needed', label: 'label-remainingneeded' }, { key: 'owned', label: 'label-owned' },
    { key: 'required', label: 'label-totalneeded' }, { key: 'leftover', label: 'label-leftover' }
  ] as const;
  const show = (key: string, name: string) =>
    (name.toLowerCase().includes(search.toLowerCase()) || key.toLowerCase().includes(search.toLowerCase())) &&
    (mode === 'owned' || Number(totals[mode][key] ?? 0) !== 0);
  let panels = $derived(layout.panels.map((panel) => ({
    ...panel, rows: panel.rows.filter((row) => row.cells.some((cell) => cell && show(cell.key, `${row.name} ${cell.name}`)))
  })).filter((panel) => panel.rows.length));
  let extras = $derived(layout.extra.filter((item) => show(item.key, item.name)));
  let groups = $derived([...new Set(extras.map((item) => item.group))]);
  let weapons = $derived(weaponXpSummary(totals));
</script>

<PlannerDialog title={t(gear ? 'footer-gear' : 'footer-resources')} {close} {t}>
  <div class="controls">
    <div class="display-modes" role="group" aria-label={t('ui-display')}>
      {#each modes as option}
        <button class={option.key} aria-pressed={mode === option.key} onclick={() => mode = option.key}>{t(option.label)}</button>
      {/each}
    </div>
    <label>{t('ui-search-resources')}<input type="search" bind:value={search} /></label>
    {#if !gear}
      <label>{t('ui-level-cap')}<input type="number" min="78" max={metadata.maxLevel} step="1" value={levelCap}
        onchange={(event) => {
          const value = event.currentTarget.valueAsNumber;
          if (Number.isInteger(value) && value >= 78 && value <= metadata.maxLevel) { setCap(value); capError = ''; }
          else { capError = t('ui-invalid-input'); event.currentTarget.value = String(levelCap); }
        }} /></label>
    {/if}
  </div>
  {#if error || capError}<p class="error" role="alert">{error || capError}</p>{/if}
  {#if mode === 'owned'}<p class="note">{t('ui-owned-help')}</p>{/if}
  {#if gear && mode === 'needed'}<GearFarming {dataset} {totals} {metadata} {savedServer} {setServer} bind:multiplier={campaignMultiplier} {t} />{/if}
  <div class="matrices" class:gear>
    {#each panels as panel, index}
      <section>
        <h3>{t(panel.title)}</h3>
        <div class="table-scroll">
          <table aria-label={`${t(panel.title)} ${index + 1} - ${t(modes.find((item) => item.key === mode)!.label)}`}>
            <thead><tr><th></th>{#each panel.columns as column}<th scope="col">{column}</th>{/each}</tr></thead>
            <tbody>{#each panel.rows as row}
              <tr style:background-color={row.colour}>
                <th scope="row">{row.name.replaceAll('_', ' ')}</th>
                {#each row.cells as item}
                  <td>{#if item}<ResourceCell {item} {totals} {mode} {setOwned} {t} />{/if}</td>
                {/each}
              </tr>
            {/each}</tbody>
          </table>
        </div>
      </section>
    {/each}
  </div>
  <div class="extra-groups">
    {#each groups as group}
      <section>
        <h3>{t(`ui-group-${group.toLowerCase().replaceAll(' ', '-')}`)}</h3>
        <div class="tiles">
          {#each extras.filter((item) => item.group === group) as item (item.key)}
            <ResourceCell {item} {totals} {mode} {setOwned} {t} />
          {/each}
        </div>
      </section>
    {/each}
  </div>
  {#if panels.length === 0 && extras.length === 0}<p>{t('ui-no-resource-rows')}</p>{/if}
  {#if gear}
    <details>
      <summary>{t('ui-weapon-xp')}</summary>
      <div class="table-scroll"><table class="weapon-table">
        <thead><tr><th>{t('ui-resource')}</th><th>{t('label-owned')}</th><th>{t('label-totalneeded')}</th><th>{t('label-remainingneeded')}</th></tr></thead>
        <tbody>{#each weapons.rows as row}
          <tr><th>{row.type}</th><td>{formatAmount(row.owned)}</td><td>{formatAmount(row.required)}</td><td>{formatAmount(row.remaining)}</td></tr>
        {/each}</tbody>
      </table></div>
      <p>{t('label-remainingneeded')}: {formatAmount(weapons.remaining)} XP</p>
      <p class="note">{t('ui-weapon-xp-help')}</p>
    </details>
  {:else}
    <p class="note">{t('ui-raid-token-help')}</p>
  {/if}
</PlannerDialog>

<style>
  .controls { display: flex; flex-wrap: wrap; align-items: end; gap: 0.75rem; margin-bottom: 0.6rem; }
  .display-modes { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .display-modes button { color: #252530; padding: 0.45rem 0.6rem; border: 2px solid transparent; }
  .display-modes button[aria-pressed="true"] { border-color: #7c5b7d; box-shadow: 0 0 0 1px var(--text); font-weight: bold; }
  .needed { background: #f5c8dd; } .owned { background: #c8e6f5; } .required { background: #c8f5e0; } .leftover { background: #f5efc8; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; }
  input { padding: 0.35rem; min-width: 0; } input[type="number"] { width: 80px; }
  .matrices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 285px), 1fr)); align-items: start; gap: 0.75rem; }
  .matrices.gear { display: block; }
  h3 { font-size: 0.9rem; margin: 0.6rem 0 0.35rem; }
  .table-scroll { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 0.75rem; }
  th, td { padding: 0.1rem; border: 1px solid #7c5b7d44; }
  thead th { padding: 0.25rem; }
  tbody th { text-align: left; font-size: 0.75rem; font-weight: normal; width: 22%; overflow-wrap: anywhere; }
  .gear tbody th { width: 40px; }
  .gear td { min-width: 52px; }
  .extra-groups { display: flex; flex-wrap: wrap; align-items: start; gap: 0.5rem 1rem; }
  .tiles { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .tiles :global(.resource-cell) { min-width: 68px; border: 1px solid #7c5b7d44; border-radius: 0.4rem; }
  .weapon-table th, .weapon-table td { padding: 0.4rem; text-align: right; }
  .weapon-table th:first-child { text-align: left; }
  details { margin-top: 1rem; } summary { cursor: pointer; }
  .note { font-size: 0.8rem; line-height: 1.4; opacity: 0.85; }
  .error { color: var(--error); }
</style>
