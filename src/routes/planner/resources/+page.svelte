<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { metadata } from '$content/planner';
  import { getLanguageString } from '$lib/domain/localisation';
  import { preferences } from '$lib/stores/preferences';
  import { createResourcePlanner } from '$lib/stores/resource-planner';
  import { saveChangedEvent } from '$lib/services/save-events';
  import CharacterCard from '$lib/components/planner/CharacterCard.svelte';
  import CharacterPicker from '$lib/components/planner/CharacterPicker.svelte';
  import CharacterEditor from '$lib/components/planner/CharacterEditor.svelte';
  import ResourceInventory from '$lib/components/planner/ResourceInventory.svelte';
  import TransferDialog from '$lib/components/planner/TransferDialog.svelte';
  import type { ResourceMode } from '$lib/components/planner/ResourceCell.svelte';
  import { sortable, type DragState } from '$lib/components/planner/sortable';
  import type { CardMode } from '$lib/domain/planner/card-display';
  import TeamsEditor from '$lib/components/planner/TeamsEditor.svelte';
  import BulkEditor from '$lib/components/planner/BulkEditor.svelte';
  import { memberIds } from '$lib/domain/planner/groups';
  import strings from '$content/strings.json';

  const planner = createResourcePlanner(metadata);
  let adding = $state(false);
  let editing = $state('');
  let search = $state('');
  let school = $state('');
  let role = $state('');
  let attack = $state('');
  let armour = $state('');
  let weapon = $state('');
  let rarity = $state('');
  let included = $state('');
  let sort = $state('custom');
  let mainView = $state<'characters' | 'teams'>('characters');
  let selectedGroup = $state('');
  let groupFilter = $state('');
  let upToGroup = $state(false);
  let bulkIds = $state<string[]>([]);
  let bulkOpen = $state(false);
  let mode = $state<CardMode>('edit');
  const modes: CardMode[] = ['edit', 'disable', 'move', 'bulk'];
  let drag = $state<DragState | null>(null);
  let dialog = $state<'' | 'resources' | 'gear' | 'transfer'>('');
  let cardSize = $state(5);
  let uiError = $state('');
  let announcement = $state('');
  let grid = $state<HTMLDivElement>();
  let resourceMode = $state<ResourceMode>('needed');
  let gearMode = $state<ResourceMode>('needed');
  let campaignMultiplier = $state(1);
  const sizes = [80, 100, 120, 140, 160];
  let levelCap = $state(metadata.maxLevel);
  const t = (id: string) => getLanguageString(strings, id, $preferences.language);
  let totals = $derived($planner.data ? planner.totals(levelCap) : null);
  let selected = $derived($planner.data?.characters.find((character) => character.id === editing));
  let definitions = $derived(Object.values($planner.dataset?.students ?? {}));
  let schools = $derived([...new Set(definitions.map((info) => info.School))].sort());
  let attacks = $derived([...new Set(definitions.map((info) => info.BulletType))].sort());
  let armours = $derived([...new Set(definitions.map((info) => info.ArmorType))].sort());
  let weapons = $derived([...new Set(definitions.map((info) => info.WeaponType))].sort());
  let rarities = $derived([...new Set(definitions.map((info) => info.StarGrade))].sort());
  let bulkCharacters = $derived($planner.data?.characters.filter((character) => bulkIds.includes(character.id)) ?? []);
  let groupMembers = $derived.by(() => {
    try {
      return { ids: $planner.data && groupFilter ? memberIds($planner.data.groups, groupFilter, upToGroup) : null, error: '' };
    } catch (problem) {
      return { ids: new Set<string>(), error: problem instanceof Error ? problem.message : t('ui-team-invalid') };
    }
  });
  $effect(() => {
    if (groupFilter && $planner.data && !Object.hasOwn($planner.data.groups, groupFilter)) groupFilter = '';
  });
  let visible = $derived.by(() => {
    const data = $planner.data;
    const dataset = $planner.dataset;
    if (!data || !dataset) return [];
    const order = new Map(data.character_order.map((id, index) => [id, index]));
    const names = $planner.names;
    const disabled = new Set(data.disabled_characters);
    return data.characters.filter((character) => {
      const info = dataset.students[character.id];
      return `${names[character.id] ?? info.Name} ${info.Name} ${character.id}`.toLowerCase().includes(search.toLowerCase()) &&
        (!school || info.School === school) && (!role || info.SquadType === role) &&
        (!attack || info.BulletType === attack) && (!armour || info.ArmorType === armour) &&
        (!weapon || info.WeaponType === weapon) && (!rarity || info.StarGrade === Number(rarity)) &&
        (!groupMembers.ids || groupMembers.ids.has(character.id)) &&
        (!included || (included === 'yes' ? !disabled.has(character.id) : disabled.has(character.id)));
    }).sort((a, b) => sort === 'name'
      ? (names[a.id] ?? dataset.students[a.id].Name).localeCompare(names[b.id] ?? dataset.students[b.id].Name)
      : sort === 'level' ? Number(b.target.level) - Number(a.target.level)
      : (order.get(a.id) ?? data.characters.indexOf(a)) - (order.get(b.id) ?? data.characters.indexOf(b)));
  });

  onMount(() => {
    const controller = new AbortController();
    void planner.initialise(controller.signal);
    try {
      const savedSize = Number(localStorage.getItem('character_box_size') ?? 5);
      if (Number.isInteger(savedSize) && savedSize >= 1 && savedSize <= 5) cardSize = savedSize;
    } catch (error) {
      console.error('Could not read character size.', error);
      uiError = error instanceof Error ? error.message : t('ui-preference-failed');
    }
    const refresh = () => { void planner.reload(); };
    const storage = (event: StorageEvent) => {
      if (event.key === 'save-data' || event.key === 'image-style' || event.key === null) refresh();
    };
    window.addEventListener(saveChangedEvent, refresh);
    window.addEventListener('storage', storage);
    return () => {
      controller.abort();
      window.removeEventListener(saveChangedEvent, refresh);
      window.removeEventListener('storage', storage);
    };
  });

  function resize(value: number) {
    try {
      localStorage.setItem('character_box_size', String(value));
      cardSize = value;
      uiError = '';
    } catch (error) {
      console.error('Could not save character size.', error);
      uiError = error instanceof Error ? error.message : t('ui-preference-failed');
    }
  }

  function showDrag(value: DragState | null) { drag = value; }

  async function reorder(value: DragState) {
    const ids = visible.map((character) => character.id);
    if (planner.reorder(value.source, value.target, value.after, ids)) {
      sort = 'custom';
      announcement = `${t('ui-moved-character')} ${$planner.names[value.source] ?? value.source}`;
      await tick();
      grid?.querySelector<HTMLButtonElement>(`[data-sort-id="${value.source}"]`)?.focus({ preventScroll: true });
    }
  }

  function keyboardMove(event: KeyboardEvent, id: string) {
    if (mode === 'bulk') return;
    if (!(event.altKey || mode === 'move') || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const ids = visible.map((character) => character.id);
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const target = ids[ids.indexOf(id) + (forward ? 1 : -1)];
    if (target) void reorder({ source: id, target, after: forward });
  }

  function chooseMode(value: CardMode) {
    mode = value;
    if (value !== 'bulk') bulkIds = [];
  }
  function toggleBulk(id: string) { bulkIds = bulkIds.includes(id) ? bulkIds.filter((value) => value !== id) : [...bulkIds, id]; }
</script>

<svelte:head><title>{t('page-resource-planner')} - Svelte</title></svelte:head>

<h1>{t('page-resource-planner')}</h1>
<noscript><p>{t('ui-javascript-required')}</p></noscript>
<details class="migration-note"><summary>{t('ui-migration-status')} &middot; <a href="/planner/index.html" data-sveltekit-reload>{t('ui-legacy-tools')}</a></summary>
  <p>{t('ui-modern-boundary')}</p>
</details>
{#if $planner.loading}<p role="status">{t('ui-loading-planner')}</p>{/if}
{#if $planner.error}
  <div class="error-banner" role="alert">{$planner.error}
    <button onclick={() => { void planner.initialise(); }}>{t('ui-retry')}</button>
  </div>
{/if}
{#if $planner.migrated}<p role="status">{t('ui-save-migrated')}</p>{/if}
{#if uiError}<p class="error" role="alert">{uiError}</p>{/if}
{#if groupMembers.error}<p class="error" role="alert">{groupMembers.error}</p>{/if}
<p class="visually-hidden" role="status">{announcement}</p>
{#if $planner.data && $planner.dataset && totals}
 {#if mainView === 'teams'}
  <TeamsEditor data={$planner.data} dataset={$planner.dataset} {metadata} names={$planner.names} scribble={$planner.scribble}
    actions={planner} error={$planner.error} bind:selected={selectedGroup} {t} />
 {:else}
  <section aria-labelledby="characters-title">
    <div class="section-heading">
      <h2 id="characters-title">{t('footer-characters')} ({$planner.data.characters.length})</h2>
    </div>
    <div class="toolbar">
      <div class="modes" role="group" aria-label={t('ui-character-mode')}>
        {#each modes as item}
          <button class:active={mode === item} aria-pressed={mode === item} onclick={() => chooseMode(item)}
            onpointerup={(event) => {
              if (event.pointerType === 'mouse') return;
              const rect = event.currentTarget.getBoundingClientRect();
              if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) chooseMode(item);
            }}>{t(item === 'bulk' ? 'ui-bulk-mode' : `label-${item}mode`)}</button>
        {/each}
      </div>
      {#if mode === 'bulk'}
        <div class="toolbar">
          <span>{bulkCharacters.length} {t('ui-selected')}</span>
          <button onclick={() => bulkIds = [...new Set([...bulkIds, ...visible.map((character) => character.id)])]}>{t('ui-select-visible')}</button>
          <button onclick={() => bulkIds = []}>{t('ui-clear-selection')}</button>
          <button disabled={!bulkCharacters.length} onclick={() => bulkOpen = true}>{t('ui-bulk-edit')}</button>
        </div>
      {/if}
      <label>{t('ui-card-size')}<input type="range" min="1" max="5" step="1" value={cardSize}
        oninput={(event) => resize(event.currentTarget.valueAsNumber)} /></label>
      <span class="saved" role="status">{$planner.saved ? t('ui-saved-locally') : ''}</span>
    </div>
    <p class="shortcut-help">{t('ui-card-shortcuts-summary')}</p>
    <details class="legend"><summary>{t('ui-overlay-help')}</summary>
      <p id="card-shortcuts">{t('ui-card-shortcuts')}</p><p>{t('ui-overlay-legend')}</p>
    </details>
    <details class="filter-panel">
      <summary>{t('ui-filters-sort')}</summary>
      <div class="filters">
      <label>{t('ui-search-characters')}<input type="search" bind:value={search} /></label>
      <label>{t('label-group')}<select bind:value={groupFilter}><option value="">{t('label-all')}</option>
        {#each Object.keys($planner.data.groups) as name}<option>{name}</option>{/each}</select></label>
      <label class="group-range"><input type="checkbox" bind:checked={upToGroup} />{t('button-groupmodeupto')}</label>
      <label>{t('label-school')}<select bind:value={school}><option value="">{t('label-all')}</option>
        {#each schools as name}<option>{name}</option>{/each}</select></label>
      <label>{t('ui-role')}<select bind:value={role}><option value="">{t('label-all')}</option>
        <option value="Main">Striker</option><option value="Support">Special</option></select></label>
      <label>{t('label-attacktype')}<select bind:value={attack}><option value="">{t('label-all')}</option>
        {#each attacks as name}<option>{name}</option>{/each}</select></label>
      <label>{t('label-defensetype')}<select bind:value={armour}><option value="">{t('label-all')}</option>
        {#each armours as name}<option>{name}</option>{/each}</select></label>
      <label>{t('ui-weapon-type')}<select bind:value={weapon}><option value="">{t('label-all')}</option>
        {#each weapons as name}<option>{name}</option>{/each}</select></label>
      <label>{t('ui-base-rarity')}<select bind:value={rarity}><option value="">{t('label-all')}</option>
        {#each rarities as value}<option value={String(value)}>{value}</option>{/each}</select></label>
      <label>{t('ui-included')}<select bind:value={included}><option value="">{t('label-all')}</option>
        <option value="yes">{t('ui-included')}</option><option value="no">{t('ui-excluded')}</option></select></label>
      <label>{t('ui-sort')}<select bind:value={sort}>
        <option value="custom">{t('ui-custom-order')}</option><option value="name">{t('ui-name-order')}</option>
        <option value="level">{t('ui-level-order')}</option></select></label>
      </div>
      <div class="toolbar">
      <button onclick={() => planner.includeMany(visible.map((character) => character.id), true)}>{t('ui-include-all')}</button>
      <button onclick={() => planner.includeMany(visible.map((character) => character.id), false)}>{t('ui-exclude-all')}</button>
      <button onclick={() => { search = ''; school = ''; role = ''; attack = ''; armour = ''; weapon = ''; rarity = ''; included = ''; groupFilter = ''; upToGroup = false; }}>{t('ui-reset-filters')}</button>
      </div>
    </details>
    <div class="characters" bind:this={grid} style:--card-size={`${sizes[cardSize - 1]}px`}
      use:sortable={{ mode, change: showDrag, drop: reorder }} aria-label={t('footer-characters')}>
      {#each visible as character (character.id)}
        <CharacterCard {character} info={$planner.dataset.students[character.id]}
          name={$planner.names[character.id] ?? character.name} {metadata} scribble={$planner.scribble}
          included={!$planner.data.disabled_characters.includes(character.id)} {t}
          {mode} dragging={drag?.source === character.id}
          bulkSelected={mode === 'bulk' && bulkIds.includes(character.id)} selectBulk={() => toggleBulk(character.id)}
          dropPosition={drag?.target === character.id && drag.source !== character.id ? drag.after ? 'after' : 'before' : ''}
          edit={() => editing = character.id} include={(value) => planner.include(character.id, value)}
          keyboard={(event) => keyboardMove(event, character.id)} />
      {/each}
      <button class="add-card" disabled={mode === 'bulk'} onclick={() => adding = true} aria-label={t('ui-add-characters')}>
        <span aria-hidden="true">+</span><span>{t('ui-add-characters')}</span>
      </button>
    </div>
    {#if visible.length === 0}<p>{t('ui-no-characters')}</p>{/if}
  </section>
 {/if}
{/if}

<nav class="planner-actions" aria-label={t('ui-planner-tools')}>
  <button disabled={!totals} onclick={() => dialog = 'resources'}><img src="/planner/icons/Misc/Credit.png" alt="" />{t('footer-resources')}</button>
  <button disabled={!totals} onclick={() => dialog = 'gear'}><img src="/planner/icons/Gear/T10_Hat_small.webp" alt="" />{t('footer-gear')}</button>
  <button disabled={!$planner.data} onclick={() => { mainView = mainView === 'teams' ? 'characters' : 'teams'; chooseMode('edit'); }}>
    {t(mainView === 'teams' ? 'footer-characters' : 'footer-teamseditor')}
  </button>
  <button onclick={() => dialog = 'transfer'}>{t('footer-transfer')}</button>
</nav>

{#if dialog === 'resources' && totals && $planner.dataset}
  <ResourceInventory {totals} {metadata} setOwned={planner.owned} {t} gear={false} bind:mode={resourceMode}
    dataset={$planner.dataset} savedServer={$planner.data?.server} setServer={planner.setServer}
    close={() => dialog = ''} error={$planner.error} {levelCap} setCap={(value) => levelCap = value} />
{:else if dialog === 'gear' && totals && $planner.dataset}
  <ResourceInventory {totals} {metadata} setOwned={planner.owned} {t} gear={true} bind:mode={gearMode}
    bind:campaignMultiplier
    dataset={$planner.dataset} savedServer={$planner.data?.server} setServer={planner.setServer}
    close={() => dialog = ''} error={$planner.error} {levelCap} setCap={(value) => levelCap = value} />
{:else if dialog === 'transfer'}
  <TransferDialog ready={Boolean($planner.data)} canImport={Boolean($planner.dataset)}
    currentSource={planner.currentSource}
    importCloud={(source, expected, credentials) => planner.importData(source, { expectedSource: expected, credentials })}
    exportData={planner.exportData} importData={planner.importData} close={() => dialog = ''} error={$planner.error} {t} />
{/if}

{#if adding && $planner.data && $planner.dataset}
  <CharacterPicker students={$planner.dataset.students} names={$planner.names} added={$planner.data.characters.map((character) => character.id)}
    {metadata} save={planner.add} close={() => adding = false} error={$planner.error} {t} />
{/if}
{#if selected && $planner.dataset}
  {#key selected.id}
    <CharacterEditor character={selected} info={$planner.dataset.students[selected.id]} name={$planner.names[selected.id] ?? selected.name}
      dataset={$planner.dataset} {metadata} language={$preferences.language} save={planner.edit} remove={() => planner.remove(selected.id)}
      close={() => editing = ''} error={$planner.error} {t} />
  {/key}
{/if}
{#if bulkOpen && $planner.dataset}
  <BulkEditor characters={bulkCharacters} dataset={$planner.dataset} {metadata} names={$planner.names} save={planner.bulkEdit}
    close={() => bulkOpen = false} error={$planner.error} {t} />
{/if}

<style>
  section { margin: 1.25rem 0; }
  .migration-note { font-size: 0.85rem; padding: 0.5rem; border-left: 3px solid #7c5b7d; background: var(--surface); line-height: 1.5; }
  .section-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  .filters, .toolbar { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 1rem 0; align-items: flex-end; }
  label { display: flex; flex-direction: column; gap: 0.35rem; }
  .group-range { flex-direction: row; align-items: center; }
  input[type="search"] { padding: 0.6rem; min-width: 0; }
  .characters { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start; gap: 0.9rem 0.75rem; padding: 1rem 0.5rem 5rem; }
  .modes { display: flex; gap: 0.35rem; }
  .modes button { font-size: 0.9rem; }
  .modes .active { background: #7c5b7d; color: white; }
  .shortcut-help { font-size: 0.82rem; margin: 0.5rem 0 0.75rem; line-height: 1.5; }
  .legend { font-size: 0.82rem; margin-bottom: 0.6rem; }
  .legend p { line-height: 1.5; }
  .filter-panel { padding: 0.5rem; border: 1px solid #7c5b7d66; border-radius: 0.4rem; }
  summary { cursor: pointer; }
  .add-card { flex: 0 0 var(--card-size); width: var(--card-size); aspect-ratio: 8 / 9; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0.5rem; color: inherit; background: transparent; border: 2px dashed #7c5b7d; border-radius: 16%; font-size: max(11px, calc(var(--card-size) * 0.085)); }
  .add-card span:first-child { font-size: 2.5rem; line-height: 1; }
  .saved { color: var(--success); margin-left: auto; font-size: 0.85rem; }
  .planner-actions { position: fixed; bottom: max(0.75rem, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); display: flex; gap: 0.5rem; padding: 0.5rem; max-width: calc(100vw - 1rem); width: max-content; border: 1px solid #7c5b7d; border-radius: 0.75rem; background: var(--surface); box-shadow: 0 2px 10px #0005; z-index: 9; }
  .planner-actions button { display: flex; align-items: center; gap: 0.4rem; }
  .planner-actions img { width: 26px; height: 26px; object-fit: contain; }
  .error { color: var(--error); }
  @media (max-width: 480px) { .filters label { flex: 1 1 140px; } .section-heading { align-items: flex-start; } .planner-actions button { padding: 0.4rem; flex-direction: column; justify-content: center; font-size: 0.75rem; min-width: 0; } .modes { flex-wrap: wrap; } }
</style>
