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
  import { sortableReorder, type DragState } from '$lib/components/planner/sortable';
  import type { CardMode } from '$lib/domain/planner/card-display';
  import { availableExMaterialFilterOptions, matchesExMaterialFilter } from '$lib/domain/planner/ex-material-filter';
  import { legacySortPresetKeys, sortPlannerCharacters, type LegacySortPresetKey } from '$lib/domain/planner/legacy-sort';
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
  let exMaterial = $state('');
  let included = $state('');
  let sort = $state<LegacySortPresetKey>('custom');
  let mainView = $state<'characters' | 'teams'>('characters');
  let selectedGroup = $state('');
  let groupFilter = $state('');
  let upToGroup = $state(false);
  let bulkIds = $state<string[]>([]);
  let selectionAnchor = $state('');
  let lastSelectionWasAdd = $state(true);
  let bulkOpen = $state(false);
  let mode = $derived<CardMode>(bulkIds.length ? 'bulk' : 'edit');
  let drag = $state<DragState | null>(null);
  type SelectionBox = { pointerId: number; startX: number; startY: number; x: number; y: number; moved: boolean; deselect: boolean };
  type SelectionSnapshot = { ids: string[]; anchor: string; adds: boolean };
  let selectionBox = $state<SelectionBox | null>(null);
  let boxPreviewIds = $state<string[]>([]);
  let selectionCaptureElement: HTMLElement | null = null;
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
  let exMaterials = $derived($planner.dataset
    ? availableExMaterialFilterOptions($planner.dataset.students, metadata) : []);
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
    const filtered = data.characters.filter((character) => {
      const info = dataset.students[character.id];
      return `${names[character.id] ?? info.Name} ${info.Name} ${character.id}`.toLowerCase().includes(search.toLowerCase()) &&
        (!school || info.School === school) && (!role || info.SquadType === role) &&
        (!attack || info.BulletType === attack) && (!armour || info.ArmorType === armour) &&
        (!weapon || info.WeaponType === weapon) && (!rarity || info.StarGrade === Number(rarity)) &&
        (!exMaterial || matchesExMaterialFilter(info, exMaterial, metadata)) &&
        (!groupMembers.ids || groupMembers.ids.has(character.id)) &&
        (!included || (included === 'yes' ? !disabled.has(character.id) : disabled.has(character.id)));
    });
    if (sort !== 'custom') return sortPlannerCharacters(filtered, sort, dataset.students, names, $preferences.language);
    return filtered.sort((a, b) =>
      (order.get(a.id) ?? data.characters.indexOf(a)) - (order.get(b.id) ?? data.characters.indexOf(b)));
  });
  let selectedVisibleIndex = $derived(visible.findIndex((character) => character.id === editing));
  let hasPreviousCharacter = $derived(selectedVisibleIndex > 0);
  let hasNextCharacter = $derived(selectedVisibleIndex >= 0 && selectedVisibleIndex < visible.length - 1);

  function navigateCharacter(direction: -1 | 1) {
    if (selectedVisibleIndex < 0) return;
    const adjacent = visible[selectedVisibleIndex + direction];
    if (adjacent) editing = adjacent.id;
  }

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
    window.addEventListener('pointerdown', beginSelectionBox, true);
    window.addEventListener('pointermove', moveSelectionBox, { passive: false });
    window.addEventListener('pointerup', finishSelectionBox);
    window.addEventListener('pointercancel', cancelSelectionBox);
    window.addEventListener('click', clearBulkOnBlankClick, true);
    window.addEventListener('keydown', plannerShortcuts);
    return () => {
      controller.abort();
      window.removeEventListener(saveChangedEvent, refresh);
      window.removeEventListener('storage', storage);
      window.removeEventListener('pointerdown', beginSelectionBox, true);
      window.removeEventListener('pointermove', moveSelectionBox);
      window.removeEventListener('pointerup', finishSelectionBox);
      window.removeEventListener('pointercancel', cancelSelectionBox);
      window.removeEventListener('click', clearBulkOnBlankClick, true);
      window.removeEventListener('keydown', plannerShortcuts);
    };
  });

  function selectionSnapshot(): SelectionSnapshot {
    return { ids: [...bulkIds], anchor: selectionAnchor, adds: lastSelectionWasAdd };
  }

  function restoreSelection(snapshot: SelectionSnapshot) {
    bulkIds = [...snapshot.ids];
    selectionAnchor = snapshot.anchor;
    lastSelectionWasAdd = snapshot.adds;
  }

  function setBulkSelection(ids: string[], anchor: string, adds: boolean) {
    const before = selectionSnapshot();
    bulkIds = [...new Set(ids)];
    selectionAnchor = anchor;
    lastSelectionWasAdd = adds;
    const after = selectionSnapshot();
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      planner.recordUiHistory(() => restoreSelection(before), () => restoreSelection(after));
    }
  }

  function clearSelection() {
    if (bulkIds.length) setBulkSelection([], '', true);
  }

  function clearBulkOnBlankClick(event: MouseEvent) {
    if (event.button !== 0 || !bulkIds.length) return;
    const target = event.target instanceof Element ? event.target : null;
    const main = document.getElementById('main-content');
    if (!target || !main?.contains(target) || target.closest(
      'header, footer, .planner-actions, dialog, [data-sort-id], button, a, label, input, select, textarea, summary, [contenteditable="true"], [role="button"], p, h1, h2, h3, h4, h5, h6, span, img'
    )) return;
    clearSelection();
  }

  function selectCard(event: MouseEvent, id: string) {
    const modified = event.ctrlKey || event.metaKey;
    if (!modified && mode !== 'bulk') return;
    event.preventDefault();
    if (modified && event.shiftKey && bulkIds.length) {
      const start = visible.findIndex((character) => character.id === selectionAnchor);
      const end = visible.findIndex((character) => character.id === id);
      if (start >= 0 && end >= 0) {
        const range = visible.slice(Math.min(start, end), Math.max(start, end) + 1).map((character) => character.id);
        const selected = new Set(bulkIds);
        if (lastSelectionWasAdd) range.forEach((value) => selected.add(value));
        else range.forEach((value) => selected.delete(value));
        setBulkSelection([...selected], id, lastSelectionWasAdd);
        return;
      }
    }
    const selecting = !bulkIds.includes(id);
    setBulkSelection(selecting ? [...bulkIds, id] : bulkIds.filter((value) => value !== id), id, selecting);
  }

  function selectVisible() {
    const ids = [...new Set([...bulkIds, ...visible.map((character) => character.id)])];
    setBulkSelection(ids, visible.at(-1)?.id ?? selectionAnchor, true);
  }

  function cardsInSelectionBox(box: SelectionBox): string[] {
    if (!grid) return [];
    const cards = new Map(Array.from(grid.querySelectorAll<HTMLElement>('[data-sort-id]'))
      .map((card) => [card.dataset.sortId ?? '', card] as const));
    const left = Math.min(box.startX, box.x);
    const right = Math.max(box.startX, box.x);
    const top = Math.min(box.startY, box.y);
    const bottom = Math.max(box.startY, box.y);
    return visible.filter((character) => {
      const rect = cards.get(character.id)?.getBoundingClientRect();
      return rect && rect.left <= right && rect.right >= left && rect.top <= bottom && rect.bottom >= top;
    }).map((character) => character.id);
  }

  function beginSelectionBox(event: PointerEvent) {
    const target = event.target instanceof Element ? event.target : null;
    const main = document.getElementById('main-content');
    if (event.button !== 0 || event.pointerType !== 'mouse' || !event.isPrimary || !target || !grid || !main?.contains(target) ||
      target.closest('header, footer, .planner-actions, dialog, [data-sort-id]') ||
      target.closest('button, a, label, input, select, textarea, summary, [contenteditable="true"], [role="button"]')) return;
    event.preventDefault();
    selectionBox = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, moved: false, deselect: event.altKey };
    boxPreviewIds = [];
    selectionCaptureElement = document.body;
    selectionCaptureElement.setPointerCapture(event.pointerId);
  }

  function moveSelectionBox(event: PointerEvent) {
    const box = selectionBox;
    if (!box || event.pointerId !== box.pointerId) return;
    const moved = box.moved || Math.hypot(event.clientX - box.startX, event.clientY - box.startY) >= 5;
    if (!moved) return;
    event.preventDefault();
    selectionBox = { ...box, x: event.clientX, y: event.clientY, moved, deselect: event.altKey };
    boxPreviewIds = cardsInSelectionBox(selectionBox);
  }

  function finishSelectionBox(event: PointerEvent) {
    const box = selectionBox;
    if (!box || event.pointerId !== box.pointerId) return;
    const completed = { ...box, x: event.clientX, y: event.clientY,
      moved: box.moved || Math.hypot(event.clientX - box.startX, event.clientY - box.startY) >= 5,
      deselect: event.altKey };
    const ids = completed.moved ? cardsInSelectionBox(completed) : [];
    selectionBox = null;
    boxPreviewIds = [];
    selectionCaptureElement = null;
    if (!completed.moved) { clearSelection(); return; }
    if (!ids.length || (completed.deselect && !bulkIds.length)) return;
    const next = new Set(bulkIds);
    if (completed.deselect) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    setBulkSelection([...next], ids.at(-1) ?? selectionAnchor, !completed.deselect);
  }

  function cancelSelectionBox(event?: PointerEvent) {
    if (event && selectionBox?.pointerId !== event.pointerId) return;
    const pointerId = selectionBox?.pointerId;
    selectionBox = null;
    boxPreviewIds = [];
    if (pointerId !== undefined && selectionCaptureElement?.hasPointerCapture(pointerId)) selectionCaptureElement.releasePointerCapture(pointerId);
    selectionCaptureElement = null;
  }

  function plannerShortcuts(event: KeyboardEvent) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
    if (event.key === 'Escape') {
      if (selectionBox) { cancelSelectionBox(); return; }
      if (bulkIds.length) { event.preventDefault(); clearSelection(); }
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) planner.redo();
      else planner.undo();
    } else if (key === 'y') {
      event.preventDefault();
      planner.redo();
    }
  }

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
    if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const ids = visible.map((character) => character.id);
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const target = ids[ids.indexOf(id) + (forward ? 1 : -1)];
    if (target) void reorder({ source: id, target, after: forward });
  }

</script>

<svelte:head><title>{t('page-resource-planner')} - Svelte</title></svelte:head>

<h1 class="visually-hidden">{t('page-resource-planner')}</h1>
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
    <h2 class="visually-hidden" id="characters-title">{t('footer-characters')}</h2>
    <div class="toolbar">
      {#if bulkIds.length}
        <div class="selection-tools" aria-live="polite">
          <span>{bulkCharacters.length} {t('ui-selected')}</span>
          <button onclick={selectVisible}>{t('ui-select-visible')}</button>
          <button onclick={clearSelection}>{t('ui-clear-selection')}</button>
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
      {#if exMaterials.length}
        <label>{t('ui-ex-material')}<select bind:value={exMaterial}><option value="">{t('label-all')}</option>
          {#each exMaterials as option (option.key)}
            {@const localized = t(`artifact-${option.key}`)}
            <option value={option.key}>{localized === 'Undefined' ? option.label.replaceAll('_', ' ') : localized}</option>
          {/each}
        </select></label>
      {/if}
      <label>{t('ui-included')}<select bind:value={included}><option value="">{t('label-all')}</option>
        <option value="yes">{t('ui-included')}</option><option value="no">{t('ui-excluded')}</option></select></label>
      <label>{t('ui-sort')}<select bind:value={sort}>
        {#each legacySortPresetKeys as preset}
          <option value={preset}>{t({ custom: 'ui-custom-order', name: 'ui-name-order', level: 'ui-level-order',
            star: 'label-stars', bond: 'label-bond', academy: 'label-school', ex: 'label-skillex',
            street: 'terrain-urban', outdoor: 'terrain-outdoors', indoor: 'terrain-indoors',
            bullet: 'label-attacktype', armour: 'label-defensetype', role: 'label-role', weapon: 'label-weapontype'
          }[preset])}</option>
        {/each}
      </select></label>
      </div>
      <div class="toolbar">
      <button onclick={() => planner.includeMany(visible.map((character) => character.id), true)}>{t('ui-include-all')}</button>
      <button onclick={() => planner.includeMany(visible.map((character) => character.id), false)}>{t('ui-exclude-all')}</button>
      <button onclick={() => { search = ''; school = ''; role = ''; attack = ''; armour = ''; weapon = ''; rarity = ''; exMaterial = ''; included = ''; groupFilter = ''; upToGroup = false; }}>{t('ui-reset-filters')}</button>
      </div>
    </details>
    <div class="characters" bind:this={grid} style:--card-size={`${sizes[cardSize - 1]}px`}
      use:sortableReorder={{ mode: 'edit', change: showDrag, drop: reorder }} aria-label={t('footer-characters')}>
      {#each visible as character (character.id)}
        <CharacterCard {character} info={$planner.dataset.students[character.id]}
          name={$planner.names[character.id] ?? character.name} {metadata} scribble={$planner.scribble}
          included={!$planner.data.disabled_characters.includes(character.id)} {t}
          {mode} dragging={drag?.source === character.id}
          bulkSelected={bulkIds.includes(character.id)}
          selectionPreview={selectionBox && boxPreviewIds.includes(character.id)
            ? selectionBox.deselect ? (bulkIds.includes(character.id) ? 'deselect' : '')
              : (bulkIds.includes(character.id) ? '' : 'select') : ''}
          selectBulk={(event) => selectCard(event, character.id)}
          edit={() => editing = character.id} include={(value) => planner.include(character.id, value)}
          keyboard={(event) => keyboardMove(event, character.id)} />
      {/each}
      <button class="add-card" onclick={() => adding = true} aria-label={t('ui-add-characters')}>
        <span aria-hidden="true">+</span><span>{t('ui-add-characters')}</span>
      </button>
    </div>
    {#if selectionBox?.moved}
      <div class="selection-box" class:deselect={selectionBox.deselect} aria-hidden="true"
        style:left={`${Math.min(selectionBox.startX, selectionBox.x)}px`}
        style:top={`${Math.min(selectionBox.startY, selectionBox.y)}px`}
        style:width={`${Math.abs(selectionBox.x - selectionBox.startX)}px`}
        style:height={`${Math.abs(selectionBox.y - selectionBox.startY)}px`}>
      </div>
    {/if}
    {#if visible.length === 0}<p>{t('ui-no-characters')}</p>{/if}
  </section>
 {/if}
{/if}

<nav class="planner-actions" aria-label={t('ui-planner-tools')}>
  <button disabled={!totals} onclick={() => dialog = 'resources'}><img src="/planner/icons/Misc/Credit.png" alt="" /><span>{t('footer-resources')}</span></button>
  <button disabled={!totals} onclick={() => dialog = 'gear'}><img src="/planner/icons/Gear/T10_Hat_small.webp" alt="" /><span>{t('footer-gear')}</span></button>
  <button disabled={!$planner.data} onclick={() => { mainView = mainView === 'teams' ? 'characters' : 'teams'; }}>
    <span>{t(mainView === 'teams' ? 'footer-characters' : 'footer-teamseditor')}</span>
  </button>
  <button onclick={() => dialog = 'transfer'}><span>{t('footer-transfer')}</span></button>
  <button aria-label={t($planner.scribble ? 'ui-use-original-portraits' : 'ui-use-scribble-portraits')}
    title={t($planner.scribble ? 'ui-use-original-portraits' : 'ui-use-scribble-portraits')}
    aria-pressed={$planner.scribble} onclick={() => planner.setImageStyle(!$planner.scribble)}>
    <img src={$planner.scribble ? '/planner/icons/UI/ShirokoScribble.png' : '/planner/icons/UI/ShirokoIcon.png'} alt="" />
  </button>
</nav>

{#if dialog === 'resources' && totals && $planner.dataset}
  <ResourceInventory {totals} {metadata} setOwned={planner.owned} {t} gear={false} bind:mode={resourceMode}
    dataset={$planner.dataset} savedServer={$planner.data?.server} setServer={planner.setServer}
    characters={$planner.data?.characters ?? []} disabledCharacters={$planner.data?.disabled_characters ?? []}
    names={$planner.names} scribble={$planner.scribble}
    close={() => dialog = ''} error={$planner.error} {levelCap} setCap={(value) => levelCap = value} />
{:else if dialog === 'gear' && totals && $planner.dataset}
  <ResourceInventory {totals} {metadata} setOwned={planner.owned} {t} gear={true} bind:mode={gearMode}
    bind:campaignMultiplier
    dataset={$planner.dataset} savedServer={$planner.data?.server} setServer={planner.setServer}
    characters={$planner.data?.characters ?? []} disabledCharacters={$planner.data?.disabled_characters ?? []}
    names={$planner.names} scribble={$planner.scribble}
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
      dataset={$planner.dataset} {metadata} language={$preferences.language} scribble={$planner.scribble}
      included={!$planner.data?.disabled_characters.includes(selected.id)} save={planner.edit} remove={() => planner.remove(selected.id)}
      hasPrevious={hasPreviousCharacter} hasNext={hasNextCharacter} navigate={navigateCharacter}
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
  .filters, .toolbar { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 1rem 0; align-items: flex-end; }
  .selection-tools { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
  label { display: flex; flex-direction: column; gap: 0.35rem; }
  .group-range { flex-direction: row; align-items: center; }
  input[type="search"] { padding: 0.6rem; min-width: 0; }
  .characters { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start; gap: 0.9rem 0.75rem; padding: 1rem 0.5rem 5rem; }
  .selection-box { position: fixed; z-index: 30; border: 1px solid #82dafb; background: #82dafb33; pointer-events: none; }
  .selection-box.deselect { border-color: #ed7b7b; background: #ed7b7b33; }
  .shortcut-help { font-size: 0.82rem; margin: 0.5rem 0 0.75rem; line-height: 1.5; }
  .legend { font-size: 0.82rem; margin-bottom: 0.6rem; }
  .legend p { line-height: 1.5; }
  .filter-panel { padding: 0.5rem; border: 1px solid #7c5b7d66; border-radius: 0.4rem; }
  summary { cursor: pointer; }
  .add-card { flex: 0 0 var(--card-size); width: var(--card-size); aspect-ratio: 8 / 9; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0.5rem; color: inherit; background: transparent; border: 2px dashed #7c5b7d; border-radius: 16%; font-size: max(11px, calc(var(--card-size) * 0.085)); }
  .add-card span:first-child { font-size: 2.5rem; line-height: 1; }
  .saved { color: var(--success); margin-left: auto; font-size: 0.85rem; }
  .planner-actions { position: fixed; bottom: max(0.75rem, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; padding: 0.5rem; max-width: calc(100vw - 1rem); width: max-content; border: 1px solid #7c5b7d; border-radius: 0.75rem; background: var(--surface); box-shadow: 0 2px 10px #0005; z-index: 9; }
  .planner-actions button { display: flex; align-items: center; gap: 0.4rem; }
  .planner-actions img { width: 26px; height: 26px; object-fit: contain; }
  .error { color: var(--error); }
  @media (max-width: 480px) {
    .filters label { flex: 1 1 140px; }
    .planner-actions { width: calc(100vw - 0.5rem); max-width: calc(100vw - 0.5rem); flex-wrap: nowrap; gap: 0.1rem; padding: 0.2rem; }
    .planner-actions button { flex: 1 1 auto; min-width: 0; padding: 0.2rem 0.15rem; justify-content: center; gap: 0.12rem; font-size: clamp(0.6rem, 2.6vw, 0.72rem); white-space: nowrap; }
    .planner-actions button span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .planner-actions button[aria-pressed] { flex: 0 0 auto; padding: 0.2rem; }
    .planner-actions img { width: 16px; height: 16px; flex: 0 0 auto; }
    .selection-tools { width: 100%; }
  }
</style>
