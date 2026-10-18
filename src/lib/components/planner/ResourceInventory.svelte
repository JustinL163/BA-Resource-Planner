<script lang="ts">
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import type { PlannerCharacter, PlannerMetadata, ResourceTotals } from '$lib/domain/planner/types';
  import { formatAmount, type ResourceItem } from '$lib/domain/planner/catalog';
  import { inventoryLayout } from '$lib/domain/planner/inventory-layout';
  import { localizedSchoolName } from '$lib/domain/planner/localized-labels';
  import { weaponXpSummary } from '$lib/domain/planner/aggregates';
  import ResourceCell, { type ResourceMode } from './ResourceCell.svelte';
  import PlannerDialog from './PlannerDialog.svelte';
  import KeyboardShortcutLabel from './KeyboardShortcutLabel.svelte';
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
    { key: 'needed', label: 'label-remainingneeded', shortcut: 'r' }, { key: 'owned', label: 'label-owned', shortcut: 'o' },
    { key: 'required', label: 'label-totalneeded', shortcut: 't' }, { key: 'leftover', label: 'label-leftover', shortcut: 'l' }
  ] as const;
  const inlineAmountKeys = new Set(['9999', 'Xp', 'GearXp', 'Credit', 'Eligma']);
  const pairedExtraGroupNames = new Set(['XP items', 'Limit break books', 'Gifts']);
  const academyIconFiles: Record<string, string> = {
    Abydos: 'Abydos', Arius: 'Arius', ETC: 'ETC', Gehenna: 'Gehenna', Highlander: 'Highlander',
    Hyakkiyako: 'Hyakkiyako', Millennium: 'Millennium', Odyssey: 'Odyssey', RedWinter: 'RedWinter',
    Shanhaijing: 'Shanhaijing', SRT: 'SRT', Tokiwadai: 'ETC', Trinity: 'Trinity', Valkyrie: 'Valkyrie',
    WildHunt: 'Wildhunt', Wildhunt: 'Wildhunt'
  };
  const inlineAmount = (key: string) => inlineAmountKeys.has(key) || key.endsWith('Cost');
  const schoolName = (name: string) => localizedSchoolName(name, t).replaceAll('_', ' ');
  let panels = $derived(layout.panels);
  let summaryTiles = $derived(layout.extra.filter((item) => inlineAmount(item.key)));
  const leadingSummaryKeys = ['Credit', 'Xp', '9999'];
  let leadingSummaryTiles = $derived(leadingSummaryKeys.flatMap((key) => summaryTiles.filter((item) => item.key === key)));
  let remainingSummaryTiles = $derived(summaryTiles.filter((item) =>
    !leadingSummaryKeys.includes(item.key) && (
      item.key === 'GearXp' ||
      (mode === 'owned' && !['Xp', 'GearXp', 'Eleph', 'ShopResets'].includes(item.key) && !item.key.endsWith('Cost')) ||
      Number(totals[mode][item.key] ?? 0) !== 0
    )));
  let gearXpSummaryItem: ResourceItem = $derived(
    remainingSummaryTiles.find((item) => item.key === 'GearXp') ?? layout.extra.find((item) => item.key === 'GearXp')!
  );
  let remainingCurrencyTiles = $derived(remainingSummaryTiles.filter((item) => item.key !== 'GearXp'));
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
  let pairedGroups = $derived(['XP items', 'Limit break books', 'Gifts'].filter((group) =>
    groups.includes(group) && !(group === 'XP items' && mode === 'leftover')));
  let hasWeaponItems = $derived(groups.includes('Weapon items'));
  let otherGroups = $derived(groups.filter((group) => !pairedExtraGroupNames.has(group) && group !== 'Weapon items'));
  let weapons = $derived(weaponXpSummary(totals));
  const weaponXpBalanceKey = 'WeaponXpBalance';
  let weaponXpBalanceItem: ResourceItem = $derived({
    key: weaponXpBalanceKey, name: t('ui-weapon-xp'), group: 'Currency', image: '/planner/icons/LevelPart/All_All.png'
  });
  let weaponXpBalanceTotals: ResourceTotals = $derived({
    ...totals,
    needed: { ...totals.needed, [weaponXpBalanceKey]: weapons.remaining },
    required: { ...totals.required, [weaponXpBalanceKey]: weapons.remainingNeeded },
    leftover: { ...totals.leftover, [weaponXpBalanceKey]: Math.max(weapons.remainingOwned - weapons.remainingNeeded, 0) }
  });
  let showWeaponXpBalance = $derived(mode !== 'owned');
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

  function handleMatrixKeydown(event: KeyboardEvent) {
    if (
      event.key !== 'Enter' || !(event.target instanceof HTMLInputElement) || !event.target.matches('.resource-input')
    ) return;

    const matrixRoot = event.currentTarget as HTMLElement;
    const inputs = [...matrixRoot.querySelectorAll('table')].flatMap((table, tableIndex) => {
      const rows = [...table.tBodies].flatMap((body) => [...body.rows]);
      return rows.flatMap((row, rowIndex) => {
        const rowHeaderOffset = row.querySelector(':scope > th[scope="row"]') ? 1 : 0;
        return [...row.cells].flatMap((cell) => {
          if (!(cell instanceof HTMLTableCellElement) || cell.tagName !== 'TD') return [];
          const input = cell.querySelector<HTMLInputElement>('input.resource-input');
          return input ? [{ input, tableIndex, column: cell.cellIndex - rowHeaderOffset, rowIndex }] : [];
        });
      });
    }).sort((first, second) =>
      first.tableIndex - second.tableIndex || first.column - second.column || first.rowIndex - second.rowIndex
    );

    const currentIndex = inputs.findIndex(({ input }) => input === event.target);
    if (currentIndex < 0) return;

    event.preventDefault();
    inputs[currentIndex + (event.shiftKey ? -1 : 1)]?.input.focus();
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
  {#snippet headerAccessory()}
    <span class={`selected-mode-chip ${mode}`}>
      {t(modes.find((item) => item.key === mode)!.label)}
    </span>
  {/snippet}
  <div class="controls">
    <div class="display-modes" role="group" aria-label={t('ui-display')}>
      {#each modes as option}
        <button class={option.key} data-key-shortcut={option.shortcut} data-key-shortcut-allow-number-input
          aria-keyshortcuts={option.shortcut.toUpperCase()} aria-pressed={mode === option.key} onclick={() => mode = option.key}>
          <KeyboardShortcutLabel label={t(option.label)} shortcut={option.shortcut} wrap={true} />
        </button>
      {/each}
    </div>
    {#if !gear}
      <label hidden>{t('ui-level-cap')}<input use:sanitizeIntegerInput type="number" min="78" max={metadata.maxLevel} step="1" value={levelCap}
        onchange={(event) => {
          const value = event.currentTarget.valueAsNumber;
          if (Number.isInteger(value) && value >= 78 && value <= metadata.maxLevel) { setCap(value); capError = ''; }
          else { capError = t('ui-invalid-input'); event.currentTarget.value = String(levelCap); }
        }} /></label>
    {/if}
    {#if leadingSummaryTiles.length || gear}
      <div class="summary-tiles controls-summary" class:gear-controls-summary={gear} role="group" aria-label={t('ui-resource')}>
        {#each leadingSummaryTiles as item (item.key)}
          <ResourceCell {item} {totals} {mode} {setOwned} {t}
            userCount={usersByResource[item.key]?.length ?? 0}
            inlineAmount={inlineAmount(item.key)}
            showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
        {/each}
        {#if gear}
          <ResourceCell item={gearXpSummaryItem} {totals} {mode} {setOwned} {t} inlineAmount />
          {#if showWeaponXpBalance}
            <ResourceCell item={weaponXpBalanceItem} totals={weaponXpBalanceTotals} {mode} {setOwned} {t} inlineAmount />
          {/if}
        {/if}
      </div>
    {/if}
  </div>
  {#if error || capError}<p class="error" role="alert">{error || capError}</p>{/if}
  <div class="inventory-sections" class:gear-layout={gear}
    style={gear ? `--gear-table-max-width: ${40 + (layout.panels[0]?.columns.length ?? 0) * 75}px` : undefined}>
  <div class="matrices" class:gear role="group" aria-label={t(gear ? 'footer-gear' : 'footer-resources')} onkeydown={handleMatrixKeydown}>
    {#if gear}
      {#each panels as panel, index}
        <section>
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
            <div class="school-pair" style={`--matrix-max-width: ${(panel.columns.length + 1) * 75}px`}>
              <div class="table-scroll">
                <table class="school-blu-ray-table" aria-label={`${t('ui-blu-rays')} - ${t(modes.find((item) => item.key === mode)!.label)}`}>
                  <thead>
                    <tr><th></th>{#each panel.columns.slice(0, 4) as column}<th scope="col">{column}</th>{/each}</tr>
                  </thead>
                  <tbody>{#each panel.rows as row}
                    <tr style:background-color={row.colour}>
                      <th class="school-row-header" scope="row" title={schoolName(row.name)} aria-label={schoolName(row.name)}>
                        <img class="school-row-icon" src={`/planner/icons/Academies/${academyIconFiles[row.name] ?? 'ETC'}.png`}
                          alt="" draggable="false" />
                      </th>
                      {#each row.cells.slice(0, 4) as item}
                        <td>{#if item}<ResourceCell {item} {totals} {mode} {setOwned} {t}
                          userCount={usersByResource[item.key]?.length ?? 0}
                          showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />{/if}</td>
                      {/each}
                    </tr>
                  {/each}</tbody>
                </table>
              </div>
              <div class="table-scroll">
                <table class="school-tech-note-table" aria-label={`${t('ui-tech-notes')} - ${t(modes.find((item) => item.key === mode)!.label)}`}>
                  <thead><tr>{#each panel.columns.slice(4) as column}<th scope="col">{column}</th>{/each}</tr></thead>
                  <tbody>{#each panel.rows as row}
                    <tr aria-label={row.name.replaceAll('_', ' ')} style:background-color={row.colour}>
                      {#each row.cells.slice(4, 8) as item}
                        <td>{#if item}<ResourceCell {item} {totals} {mode} {setOwned} {t}
                          userCount={usersByResource[item.key]?.length ?? 0}
                          showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />{/if}</td>
                      {/each}
                    </tr>
                  {/each}</tbody>
                </table>
              </div>
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
    {#if gear && remainingCurrencyTiles.length}
      <div class="summary-tiles" role="group" aria-label={t('ui-group-currencies')}>
        {#each remainingCurrencyTiles as item (item.key)}
          <ResourceCell {item} {totals} {mode} {setOwned} {t}
            userCount={usersByResource[item.key]?.length ?? 0}
            inlineAmount={inlineAmount(item.key)}
            showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
        {/each}
      </div>
    {/if}
    {#if gear}
      <details>
        <summary>{t('ui-weapon-xp')}</summary>
        <div class="table-scroll"><table class="weapon-table">
          <thead><tr><th scope="col" aria-label={t('ui-weapon-xp')}></th><th scope="col">{t('label-owned')}</th><th scope="col">{t('label-totalneeded')}</th><th scope="col">{t('label-remainingneeded')}</th></tr></thead>
          <tbody>{#each weapons.rows as row}
            <tr><th scope="row"><img class="weapon-xp-icon" src={`/planner/icons/LevelPart/${row.type}_All.png`} alt={row.type} draggable="false" /></th>
              <td>{formatAmount(row.owned)}</td><td>{formatAmount(row.required)}</td><td>{formatAmount(row.remaining)}</td></tr>
          {/each}
          </tbody>
        </table></div>
        <p class="note">{t('ui-weapon-xp-help')}</p>
      </details>
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
      {#if gear && mode === 'needed'}<GearFarming {dataset} {totals} {metadata} {savedServer} {setServer} bind:multiplier={campaignMultiplier} {t} />{/if}
    </div>
  </div>
  {#if !gear && remainingSummaryTiles.length}
    <h3>{t('ui-group-currencies')}</h3>
    <div class="summary-tiles" role="group" aria-label={t('ui-group-currencies')}>
      {#each remainingSummaryTiles as item (item.key)}
        <ResourceCell {item} {totals} {mode} {setOwned} {t}
          userCount={usersByResource[item.key]?.length ?? 0}
          inlineAmount={inlineAmount(item.key)}
          showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
      {/each}
    </div>
  {/if}
  {#if panels.length === 0 && summaryTiles.length === 0 && extras.length === 0}<p>{t('ui-no-resource-rows')}</p>{/if}
</PlannerDialog>

{#if selectedResource}
  <ResourceUsersDialog item={selectedResource} users={selectedUsers} close={() => selectedResource = null} {t} />
{/if}

<style>
  .controls { display: flex; flex-wrap: wrap; align-items: end; gap: 0.4rem 0.75rem; margin-bottom: 0.2rem; align-items: center; }
  .controls-summary { flex-wrap: nowrap !important; }
  .controls-summary.gear-controls-summary { flex: 1 1 36rem; flex-wrap: wrap !important; }
  .controls label[hidden] { display: none; }
  .display-modes { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .display-modes button { color: #252530; padding: 0.45rem 0.6rem; border: 2px solid transparent; }
  .display-modes button[aria-pressed="true"] { border-color: #7c5b7d; box-shadow: 0 0 0 1px var(--text); font-weight: bold; }
  .selected-mode-chip {
    flex: 0 0 auto; color: #252530; padding: 0.35rem 0.5rem;
    border-radius: 0.35rem; font-size: 0.8rem;
    font-weight: bold; line-height: 1.1; white-space: nowrap;
  }
  .needed { background: #f5c8dd; } .owned { background: #c8e6f5; } .required { background: #c8f5e0; } .leftover { background: #f5efc8; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; }
  input { padding: 0.35rem; min-width: 0; } input[type="number"] { width: 80px; }
  .matrices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 285px), 1fr)); align-items: start; gap: 0.75rem; }
  .matrices.gear { display: block; }
  .matrices:not(.gear) { display: flex; flex-direction: column; gap: 0.75rem; }
  .inventory-sections { min-width: 0; }
  .inventory-sections:not(.gear-layout) { min-width: 800px; }
  .inventory-side { min-width: 0; }
  h3 { font-size: 0.9rem; margin: 0.2rem 0 0.2rem; }
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
  .artifact-pair tbody th:first-child { width: max-content; white-space: nowrap; }
  .school-matrices tbody th, .artifact-pair tbody th { overflow: hidden; font-size: 0.7rem; white-space: nowrap; }
  .school-pair { display: grid; width: 100%; max-width: var(--matrix-max-width); margin-inline: auto; grid-template-columns: minmax(0, 5fr) minmax(0, 4fr); gap: 0; }
  .school-pair > .table-scroll { min-width: 0; overflow: hidden; }
  .matrices:not(.gear) .school-pair table { width: 100%; max-width: 100%; table-layout: fixed; margin: 0; }
  .school-row-header { box-sizing: border-box; width: auto; min-width: 0; max-width: none; padding: 0 !important; }
  .school-row-icon { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; padding: 0.45rem; box-sizing: border-box; }
  .row-name { display: block; width: 100%; min-width: 0; overflow: hidden; white-space: nowrap; text-align: center; }
  .matrices:not(.gear) td { width: 75px; min-width: 0; padding: 0; }
  .matrices:not(.gear) td :global(.resource-cell) { min-width: 0; min-height: 0; aspect-ratio: 1; }
  .artifact-pair { display: grid; width: 100%; max-width: 800px; margin-inline: auto; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0; }
  .matrices:not(.gear) .artifact-pair table { width: 100%; max-width: 100%; table-layout: fixed; margin: 0; }
  .artifact-pair > .table-scroll { min-width: 0; }
  .extra-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); align-items: start; gap: 0.5rem 1rem; }
  .xp-book-groups { display: flex; flex-wrap: wrap; width: 100%; align-items: start; gap: 0 1rem; margin-bottom: 0.5rem; margin-top: 0.5rem}
  .xp-book-groups > section { width: fit-content; max-width: 100%; min-width: 0; }
  .tiles { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .tiles :global(.resource-cell) { flex: 0 0 68px; width: 68px; min-width: 68px; min-height: 68px; border: 1px solid #7c5b7d44; border-radius: 0.4rem; background-color: var(--background); }
  .weapon-material-grid { display: grid; width: 100%; max-width: 284px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .weapon-material-grid :global(.resource-cell) { flex: initial; width: 100%; min-width: 0; min-height: 0; aspect-ratio: 1; }
  .summary-tiles { display: flex; flex-wrap: wrap; gap: 0.5rem; overflow: visible; }
  .summary-tiles :global(.resource-cell) { flex: 0 0 180px; width: 180px; min-width: 120px; min-height: 44px; height: 44px; border: 1px solid #7c5b7d66; border-radius: 0.4rem; background: var(--background); padding-right: 0.3rem; }
  .summary-tiles :global(.resource-cell.zero .resource-image) { opacity: 1; }
  .summary-tiles :global(.resource-cell.zero .amount) { visibility: visible; }
  .weapon-table { width: fit-content; max-width: 100%; table-layout: auto; }
  .weapon-table th, .weapon-table td { padding: 0.4rem; text-align: right; }
  .weapon-table th:first-child { width: 2.75rem; text-align: center; }
  .weapon-xp-icon { display: block; width: 2.4rem; height: 2.4rem; margin: auto; object-fit: contain; }
  details { margin-top: 1rem; } summary { cursor: pointer; }
  .note { font-size: 0.8rem; line-height: 1.4; opacity: 0.85; }
  .error { color: var(--error); }
  @media (max-width: 800px) {
    .gear td :global(.amount) { font-size: 0.9rem; }
    .matrices:not(.gear) td :global(.amount) { font-size: 0.9rem; }
    .gear-header-name { display: none; }
    .gear-header-image { display: block; }
    .inventory-sections:not(.gear-layout) { min-width: 0; width: 100%; }
    .matrices:not(.gear) { width: 100%; }
    .matrices:not(.gear) table { width: 100%; max-width: 100%; table-layout: fixed; }
    .matrices:not(.gear) td { width: auto; }
    .artifact-pair th:first-child { width: clamp(90px, 45%, 120px); }
    .school-matrices tbody th, .artifact-pair tbody th { font-size: 0.55rem; line-height: 1.05; }
    .summary-tiles { gap: 0.1rem;}
    .tiles :global(.resource-cell) { flex: 0 0 58px; width: 58px; min-width: 58px; min-height: 58px;}
  }
  @media (max-width: 600px) {
    .inventory-sections:not(.gear-layout) { width: 100%; }
    .display-modes { width: 100%; flex-wrap: nowrap; gap: 0.15rem; }
    .controls-summary { flex: 0 0 100%; width: 100%; }
    .selected-mode-chip { padding: 0.25rem 0.35rem; font-size: 0.7rem; }
    .display-modes button {
      flex: 1 1 0; min-width: 0; padding: 0.3rem 0.15rem; font-size: clamp(0.58rem, 2.4vw, 0.75rem);
      line-height: 1.1; white-space: normal; overflow-wrap: anywhere;
    }
    .matrices:not(.gear), .inventory-sections.gear-layout > .matrices {
      --section-inline-bleed: clamp(0.6rem, calc(-1rem + 5.333vw), 1rem);
      width: calc(100% + var(--section-inline-bleed) + var(--section-inline-bleed));
      margin-inline: calc(0rem - var(--section-inline-bleed));
    }
    .summary-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); overflow: visible; }
    .summary-tiles :global(.resource-cell) { flex: initial; width: 100%; min-width: 0; min-height: 34px; height: 34px; }
    .controls-summary :global(.resource-cell.inline-amount) {
      gap: 0.1rem; padding: 0 0.1rem;
    }
    .controls-summary :global(.inline-amount .resource-image) {
      position: static; flex: 0 0 1.25rem; width: 1.25rem; height: 1.25rem; transform: none;
    }
    .controls-summary :global(.inline-amount .amount) { width: auto; font-size: 0.85rem; }
    .tiles :global(.resource-cell) { flex: 0 0 48px; width: 48px; min-width: 48px; min-height: 48px;}
  }
  @media (min-width: 1201px) {
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
    .gear-layout .xp-book-groups { flex-direction: column; margin-bottom: 0; }
    .gear-layout .extra-groups { grid-template-columns: minmax(0, 1fr); }
  }
</style>
