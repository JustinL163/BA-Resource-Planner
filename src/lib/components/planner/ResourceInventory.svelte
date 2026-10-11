<script lang="ts">
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import type { PlannerCharacter, PlannerMetadata, ResourceTotals } from '$lib/domain/planner/types';
  import { formatAmount, type ResourceItem } from '$lib/domain/planner/catalog';
  import { inventoryLayout } from '$lib/domain/planner/inventory-layout';
  import { weaponXpSummary } from '$lib/domain/planner/aggregates';
  import ResourceCell, { type ResourceMode } from './ResourceCell.svelte';
  import PlannerDialog from './PlannerDialog.svelte';
  import GearFarming from './GearFarming.svelte';
  import type { PlannerDataset } from '$lib/domain/planner/types';
  import type { FarmServer } from '$lib/domain/planner/gear-farm';
  import ResourceUsersDialog, { type ResourceUserRow } from './ResourceUsersDialog.svelte';

  let { totals, metadata, dataset, savedServer, setServer, setOwned, gear, close, error, levelCap, setCap,
    characters, disabledCharacters, names, scribble,
    campaignMultiplier = $bindable(1), mode = $bindable<ResourceMode>('needed'), t }: {
    totals: ResourceTotals; metadata: PlannerMetadata; setOwned: (key: string, amount: number) => boolean;
    gear: boolean; close: () => void; error: string; levelCap: number; setCap: (value: number) => void;
    mode?: ResourceMode; t: (id: string) => string;
    dataset: PlannerDataset; savedServer: unknown; setServer: (server: FarmServer) => boolean;
    characters: PlannerCharacter[]; disabledCharacters: string[]; names: Record<string, string>; scribble: boolean;
    campaignMultiplier?: number;
  } = $props();
  let capError = $state('');
  let selectedResource = $state<ResourceItem | null>(null);
  let layout = $derived(inventoryLayout(metadata, totals, gear));
  const modes = [
    { key: 'needed', label: 'label-remainingneeded' }, { key: 'owned', label: 'label-owned' },
    { key: 'required', label: 'label-totalneeded' }, { key: 'leftover', label: 'label-leftover' }
  ] as const;
  const inlineAmountKeys = new Set(['9999', 'Xp', 'GearXp', 'Credit', 'Eligma']);
  const pairedExtraGroupNames = new Set(['XP items', 'Limit break books']);
  const inlineAmount = (key: string) => inlineAmountKeys.has(key) || key.endsWith('Cost');
  let panels = $derived(layout.panels);
  let summaryTiles = $derived(layout.extra.filter((item) => inlineAmount(item.key)));
  let allExtras = $derived(layout.extra.filter((item) => !inlineAmount(item.key)));
  let extras = $derived(allExtras.filter((item) => {
    if (mode === 'owned') return true;
    if (item.group === 'XP items' || item.group === 'Weapon items') return false;
    return Number(totals[mode][item.key] ?? 0) !== 0;
  }));
  let weaponRows = $derived(['T1', 'T2', 'T3', 'T4'].map((tier) => ({
    items: allExtras.filter((item) => item.group === 'Weapon items' && item.key.startsWith(`${tier}_`))
  })).filter((row) => row.items.some((item) => extras.some((extra) => extra.key === item.key))));
  let groups = $derived([...new Set(extras.map((item) => item.group))]);
  let pairedGroups = $derived(['XP items', 'Limit break books'].filter((group) =>
    groups.includes(group) && !(group === 'XP items' && mode === 'leftover')));
  let hasWeaponItems = $derived(groups.includes('Weapon items'));
  let otherGroups = $derived(groups.filter((group) => !pairedExtraGroupNames.has(group) && group !== 'Weapon items'));
  let weapons = $derived(weaponXpSummary(totals));
  let usersByResource = $derived.by(() => {
    const users: Record<string, ResourceUserRow[]> = {};
    const excluded = new Set(disabledCharacters);
    for (const character of characters) {
      if (excluded.has(character.id)) continue;
      const portrait = (scribble && metadata.scribblePortraits[character.id]) || metadata.portraits[character.id] || '';
      for (const [key, rawAmount] of Object.entries(totals.perCharacter[character.id] ?? {})) {
        const amount = Number(rawAmount);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        (users[key] ??= []).push({
          id: character.id, name: names[character.id] ?? character.name, amount, portrait
        });
      }
    }
    for (const rows of Object.values(users)) rows.sort((first, second) => second.amount - first.amount);
    return users;
  });
  let selectedUsers = $derived(selectedResource ? usersByResource[selectedResource.key] ?? [] : []);

  function openUsers(item: ResourceItem) {
    if (mode !== 'owned' && usersByResource[item.key]?.length) selectedResource = item;
  }

  function fitRowName(node: HTMLElement, _initialValue: string) {
    let frame = 0;
    let observer: ResizeObserver | undefined;
    const range = document.createRange();
    const baseFontSize = Number.parseFloat(getComputedStyle(node).fontSize) || 11;

    function fit() {
      node.style.removeProperty('font-size');
      range.selectNodeContents(node);
      if (range.getBoundingClientRect().width <= node.clientWidth) return;

      let low = 5.5;
      let high = baseFontSize;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const size = (low + high) / 2;
        node.style.fontSize = `${size}px`;
        range.selectNodeContents(node);
        if (range.getBoundingClientRect().width <= node.clientWidth) low = size;
        else high = size;
      }
      node.style.fontSize = `${low}px`;
    }

    function scheduleFit() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    }

    if (typeof ResizeObserver !== 'undefined' && node.parentElement) {
      observer = new ResizeObserver(scheduleFit);
      observer.observe(node.parentElement);
    }
    scheduleFit();

    return {
      update() {
        scheduleFit();
      },
      destroy() {
        observer?.disconnect();
        cancelAnimationFrame(frame);
        node.style.removeProperty('font-size');
      }
    };
  }
</script>

<PlannerDialog title={t(gear ? 'footer-gear' : 'footer-resources')} {close} {t}>
  <div class="controls">
    <div class="display-modes" role="group" aria-label={t('ui-display')}>
      {#each modes as option}
        <button class={option.key} aria-pressed={mode === option.key} onclick={() => mode = option.key}>{t(option.label)}</button>
      {/each}
    </div>
    {#if !gear}
      <label>{t('ui-level-cap')}<input use:sanitizeIntegerInput type="number" min="78" max={metadata.maxLevel} step="1" value={levelCap}
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
  {#if summaryTiles.length}
    <div class="summary-tiles" role="group" aria-label={t('ui-resource')}>
      {#each summaryTiles as item (item.key)}
        <ResourceCell {item} {totals} {mode} {setOwned} {t}
          userCount={usersByResource[item.key]?.length ?? 0}
          inlineAmount={inlineAmount(item.key)}
          showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
      {/each}
    </div>
  {/if}
  <div class="inventory-sections" class:gear-layout={gear}
    style={gear ? `--gear-table-max-width: ${40 + (layout.panels[0]?.columns.length ?? 0) * 75}px` : undefined}>
  <div class="matrices" class:gear>
    {#if gear}
      {#each panels as panel, index}
        <section>
          <h3>{t(panel.title)}</h3>
          <div class="table-scroll">
            <table aria-label={`${t(panel.title)} ${index + 1} - ${t(modes.find((item) => item.key === mode)!.label)}`}>
              <thead><tr><th></th>{#each panel.columns as column}<th scope="col">
                <span class="gear-header-name">{column}</span>
                <img class="gear-header-image" src={`/planner/icons/Gear/T1_${column}.webp`} alt={column} />
              </th>{/each}</tr></thead>
              <tbody>{#each panel.rows as row}
                <tr style:background-color={row.colour}>
                  <th scope="row">{row.name.replaceAll('_', ' ')}</th>
                  {#each row.cells as item}
                    <td>{#if item}<ResourceCell {item} {totals} {mode} {setOwned} {t}
                      userCount={usersByResource[item.key]?.length ?? 0}
                      showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />{/if}</td>
                  {/each}
                </tr>
              {/each}</tbody>
            </table>
          </div>
        </section>
      {/each}
    {:else}
      {#each panels as panel, index}
        {#if panel.columnGroups}
          <section class="school-matrices">
            <div class="table-scroll">
              <table style={`--matrix-max-width: ${100 + panel.columns.length * 75}px`}
                aria-label={`${t(panel.title)}, ${t(panel.columnGroups[1].title)} - ${t(modes.find((item) => item.key === mode)!.label)}`}>
                <thead>
                  <tr><th></th>{#each panel.columns as column}<th scope="col">{column}</th>{/each}</tr>
                </thead>
                <tbody>{#each panel.rows as row}
                  <tr style:background-color={row.colour}>
                    <th scope="row" title={row.name.replaceAll('_', ' ')}>
                      <span class="row-name" use:fitRowName={row.name.replaceAll('_', ' ')}>{row.name.replaceAll('_', ' ')}</span>
                    </th>
                    {#each row.cells as item}
                      <td>{#if item}<ResourceCell {item} {totals} {mode} {setOwned} {t}
                        userCount={usersByResource[item.key]?.length ?? 0}
                        showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />{/if}</td>
                    {/each}
                  </tr>
                {/each}</tbody>
              </table>
            </div>
          </section>
        {:else if panel.title === 'ui-artifacts'}
          {#if index === panels.findIndex((item) => item.title === 'ui-artifacts')}
            <section class="artifact-matrices">
              <div class="artifact-pair">
                {#each panels.filter((item) => item.title === 'ui-artifacts') as artifactPanel, artifactIndex}
                  <div class="table-scroll">
                    <table style={`--matrix-max-width: ${100 + artifactPanel.columns.length * 75}px`}
                      aria-label={`${t(artifactPanel.title)} ${artifactIndex + 1} - ${t(modes.find((item) => item.key === mode)!.label)}`}>
                      <thead><tr><th></th>{#each artifactPanel.columns as column}<th scope="col">{column}</th>{/each}</tr></thead>
                      <tbody>{#each artifactPanel.rows as row}
                        <tr style:background-color={row.colour}>
                          <th scope="row" title={row.name.replaceAll('_', ' ')}>
                            <span class="row-name" use:fitRowName={row.name.replaceAll('_', ' ')}>{row.name.replaceAll('_', ' ')}</span>
                          </th>
                          {#each row.cells as item}
                            <td>{#if item}<ResourceCell {item} {totals} {mode} {setOwned} {t}
                              userCount={usersByResource[item.key]?.length ?? 0}
                              showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />{/if}</td>
                          {/each}
                        </tr>
                      {/each}</tbody>
                    </table>
                  </div>
                {/each}
              </div>
            </section>
          {/if}
        {/if}
      {/each}
    {/if}
  </div>
    <div class="inventory-side">
      {#if pairedGroups.length}
        <div class="xp-book-groups">
          {#each pairedGroups as group}
            <section>
              <h3>{t(`ui-group-${group.toLowerCase().replaceAll(' ', '-')}`)}</h3>
              <div class="tiles">
                {#each extras.filter((item) => item.group === group) as item (item.key)}
                  <ResourceCell {item} {totals} {mode} {setOwned} {t}
                    userCount={usersByResource[item.key]?.length ?? 0}
                    inlineAmount={inlineAmount(item.key)}
                    showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
                {/each}
              </div>
            </section>
          {/each}
        </div>
      {/if}
      {#if hasWeaponItems}
        <section class="weapon-materials">
          <h3>{t('ui-group-weapon-items')}</h3>
          <div class="weapon-material-grid">
            {#each weaponRows as row}
              {#each row.items as item (item.key)}
                <ResourceCell {item} {totals} {mode} {setOwned} {t}
                  userCount={usersByResource[item.key]?.length ?? 0}
                  inlineAmount={inlineAmount(item.key)}
                  showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
              {/each}
            {/each}
          </div>
        </section>
      {/if}
      <div class="extra-groups">
        {#each otherGroups as group}
          <section>
            <h3>{t(`ui-group-${group.toLowerCase().replaceAll(' ', '-')}`)}</h3>
            <div class="tiles">
              {#each extras.filter((item) => item.group === group) as item (item.key)}
                <ResourceCell {item} {totals} {mode} {setOwned} {t}
                  userCount={usersByResource[item.key]?.length ?? 0}
                  inlineAmount={inlineAmount(item.key)}
                  showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
              {/each}
            </div>
          </section>
        {/each}
      </div>
    </div>
  </div>
  {#if panels.length === 0 && summaryTiles.length === 0 && extras.length === 0}<p>{t('ui-no-resource-rows')}</p>{/if}
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

{#if selectedResource}
  <ResourceUsersDialog item={selectedResource} users={selectedUsers} close={() => selectedResource = null} {t} />
{/if}

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
  .matrices:not(.gear) { display: flex; flex-direction: column; gap: 0.75rem; }
  .inventory-sections { min-width: 0; }
  .inventory-sections:not(.gear-layout) { min-width: 800px; }
  .inventory-side { min-width: 0; }
  h3 { font-size: 0.9rem; margin: 0.6rem 0 0.35rem; }
  .table-scroll { overflow-x: auto; }
  table { border-spacing: 0; width: 100%; font-size: 0.75rem; }
  th, td { padding: 0.1rem; border: none; }
  thead th { padding: 0.25rem; }
  tbody th { text-align: left; font-size: 0.75rem; font-weight: normal; width: 22%; overflow-wrap: anywhere; }
  .gear .table-scroll { overflow-x: hidden; }
  .gear table { table-layout: fixed; max-width: var(--gear-table-max-width); margin-inline: auto; }
  .gear tbody tr:nth-child(even) { background-color: #84848436; }
  .gear thead th:first-child, .gear tbody th { width: 40px; }
  .gear thead th:not(:first-child) { overflow-wrap: anywhere; line-height: 1.1; }
  .gear-header-image { display: none; width: 100%; height: 2.25rem; object-fit: contain; }
  .gear tbody th { text-align: center; }
  .gear td { min-width: 0; padding: 0; }
  .gear td :global(.resource-cell) { min-width: 0; min-height: 0; aspect-ratio: 1; }
  .matrices:not(.gear) .table-scroll { overflow: hidden; }
  .matrices:not(.gear) table { width: max-content; table-layout: auto; }
  .school-matrices table, .artifact-pair table { max-width: var(--matrix-max-width); margin-inline: auto; }
  .school-matrices tbody th:first-child, .artifact-pair tbody th:first-child { width: max-content; white-space: nowrap; }
  .school-matrices tbody th, .artifact-pair tbody th { overflow: hidden; font-size: 0.7rem; white-space: nowrap; }
  .row-name { display: block; width: 100%; min-width: 0; overflow: hidden; white-space: nowrap; }
  .matrices:not(.gear) td { width: 75px; min-width: 0; padding: 0; }
  .matrices:not(.gear) td :global(.resource-cell) { min-width: 0; min-height: 0; aspect-ratio: 1; }
  .artifact-pair { display: grid; width: 100%; max-width: 800px; margin-inline: auto; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0; }
  .matrices:not(.gear) .artifact-pair table { width: 100%; max-width: 100%; table-layout: fixed; margin: 0; }
  .artifact-pair > .table-scroll { min-width: 0; }
  .extra-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); align-items: start; gap: 0.5rem 1rem; }
  .xp-book-groups { display: grid; width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 0.5rem 1rem; margin-bottom: 0.5rem; }
  .tiles { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .tiles :global(.resource-cell) { flex: 0 0 68px; width: 68px; min-width: 68px; min-height: 68px; border: 1px solid #7c5b7d44; border-radius: 0.4rem; }
  .weapon-material-grid { display: grid; width: 100%; max-width: 284px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .weapon-material-grid :global(.resource-cell) { flex: initial; width: 100%; min-width: 0; min-height: 0; aspect-ratio: 1; }
  .summary-tiles { display: flex; flex-wrap: nowrap; gap: 0.5rem; margin: 0.5rem 0 0.75rem; padding: 0.2rem 0.1rem 0.5rem; overflow-x: auto; }
  .summary-tiles :global(.resource-cell) { flex: 0 0 180px; width: 180px; min-width: 120px; min-height: 54px; height: 54px; border: 1px solid #7c5b7d44; border-radius: 0.4rem; }
  .weapon-table th, .weapon-table td { padding: 0.4rem; text-align: right; }
  .weapon-table th:first-child { text-align: left; }
  details { margin-top: 1rem; } summary { cursor: pointer; }
  .note { font-size: 0.8rem; line-height: 1.4; opacity: 0.85; }
  .error { color: var(--error); }
  @media (max-width: 800px) {
    .gear td :global(.amount) { font-size: 0.9rem; }
    .matrices:not(.gear) td :global(.amount) { font-size: 0.9rem; }
  }
  @media (max-width: 840px) {
    .gear-header-name { display: none; }
    .gear-header-image { display: block; }
  }
  @media (max-width: 840px) {
    .inventory-sections:not(.gear-layout) { min-width: 0; width: 100%; }
    .matrices:not(.gear) { width: 100%; }
    .matrices:not(.gear) table { width: 100%; max-width: 100%; table-layout: fixed; }
    .matrices:not(.gear) td { width: auto; }
    .school-matrices th:first-child { width: clamp(105px, 32%, 130px); }
    .artifact-pair th:first-child { width: clamp(90px, 45%, 120px); }
    .school-matrices tbody th, .artifact-pair tbody th { font-size: 0.55rem; line-height: 1.05; }
  }
  @media (max-width: 600px) {
    .inventory-sections:not(.gear-layout) { width: calc(100% + 2rem); margin-inline: -1rem; }
  }
  @media (max-width: 480px) {
    .inventory-sections:not(.gear-layout) { width: calc(100% + 1.2rem); margin-inline: -0.6rem; }
  }
  @media (min-width: 1200px) {
    .matrices:not(.gear) {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
      gap: 0.75rem;
    }
    .matrices:not(.gear) > section { min-width: 0; }
    .matrices:not(.gear) .school-matrices table {
      width: 100%; max-width: 100%; table-layout: fixed; margin: 0;
    }
    .matrices:not(.gear) .artifact-matrices .artifact-pair { max-width: none; }
    .school-matrices th:first-child { width: clamp(100px, 20%, 140px); }
    .artifact-pair th:first-child { width: clamp(90px, 35%, 120px); }
    .inventory-sections.gear-layout {
      display: grid;
      grid-template-columns: minmax(0, var(--gear-table-max-width)) minmax(0, 1fr);
      grid-template-areas: "gear side";
      align-items: start;
      gap: 0 1rem;
    }
    .gear-layout > .matrices { grid-area: gear; }
    .gear-layout > .inventory-side { grid-area: side; display: flex; flex-direction: column; gap: 0.5rem; }
    .gear-layout .xp-book-groups { grid-template-columns: minmax(0, 1fr); margin-bottom: 0; }
    .gear-layout .extra-groups { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 600px) {
    .summary-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: visible; }
    .summary-tiles :global(.resource-cell) { flex: initial; width: 100%; min-width: 0; }
  }
  @media (max-width: 700px) {
    .xp-book-groups { grid-template-columns: minmax(0, 1fr); }
  }
</style>
