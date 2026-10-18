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
  let filtersOpen = $state(false);
  let uiError = $state('');
  let announcement = $state('');
  let moveWarningVisible = $state(false);
  let moveWarningAnimation = $state(0);
  let moveWarningTimeout: ReturnType<typeof setTimeout> | undefined;
  let grid = $state<HTMLDivElement>();
  let filterPanel = $state<HTMLDetailsElement>();
  let resourceMode = $state<ResourceMode>('needed');
  let gearMode = $state<ResourceMode>('needed');
  let campaignMultiplier = $state(1);
  const sizes = [80, 100, 120, 140, 160];
  const characterTransitionFilter = 'grayscale(1) sepia(50%) hue-rotate(260deg) saturate(200%) opacity(0.3)';
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
  let hasActiveFilters = $derived(Boolean(search.trim() || groupFilter || upToGroup || school || role || attack || armour || weapon || rarity || exMaterial || included || sort !== 'custom'));

  function listCharacterCard(characterId: string): HTMLElement | null {
    return Array.from(grid?.querySelectorAll<HTMLElement>('[data-sort-id]') ?? [])
      .find((card) => card.dataset.sortId === characterId) ?? null;
  }

  function keepCharacterCardOnscreen(card: HTMLElement): DOMRect {
    let bounds = card.getBoundingClientRect();
    if (bounds.top < 0 || bounds.left < 0 || bounds.bottom > window.innerHeight || bounds.right > window.innerWidth) {
      card.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
      bounds = card.getBoundingClientRect();
    }
    return bounds;
  }

  function preventDesktopFilterToggle(event: MouseEvent) {
    if (window.matchMedia('(min-width: 801px)').matches) {
      event.preventDefault();
      filtersOpen = true;
    }
  }

  function preventDesktopFilterToggleKey(event: KeyboardEvent) {
    if (window.matchMedia('(min-width: 801px)').matches && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      filtersOpen = true;
    }
  }

  function characterCardFlash(characterId: string): HTMLElement | null {
    const source = listCharacterCard(characterId);
    if (!source) return null;

    const bounds = keepCharacterCardOnscreen(source);
    if (!bounds.width || !bounds.height) return null;

    const flash = source.cloneNode(true) as HTMLElement;
    flash.removeAttribute('data-sort-id');
    flash.removeAttribute('aria-label');
    flash.removeAttribute('aria-describedby');
    flash.removeAttribute('title');
    flash.setAttribute('aria-hidden', 'true');
    flash.tabIndex = -1;
    flash.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));

    const style = flash.style;
    style.setProperty('position', 'fixed', 'important');
    style.setProperty('left', `${bounds.left}px`, 'important');
    style.setProperty('top', `${bounds.top}px`, 'important');
    style.setProperty('width', `${bounds.width}px`, 'important');
    style.setProperty('height', `${bounds.height}px`, 'important');
    style.setProperty('--card-size', `${bounds.width}px`, 'important');
    style.setProperty('max-width', 'none', 'important');
    style.setProperty('margin', '0', 'important');
    style.setProperty('flex', 'none', 'important');
    style.setProperty('transform', 'none', 'important');
    style.setProperty('z-index', '10000', 'important');
    style.setProperty('pointer-events', 'none', 'important');
    style.setProperty('filter', characterTransitionFilter, 'important');
    return flash;
  }

  async function navigateCharacter(direction: -1 | 1) {
    if (selectedVisibleIndex < 0) return;
    const adjacent = visible[selectedVisibleIndex + direction];
    if (!adjacent) return;

    const flash = characterCardFlash(adjacent.id);
    editing = adjacent.id;
    if (!flash) return;

    await tick();
    const editorDialog = document.querySelector<HTMLDialogElement>('[data-character-editor-dialog]');
    if (!editorDialog?.open) return;

    editorDialog.append(flash);
    const animation = flash.animate([{ opacity: 1 }, { opacity: 0 }], {
      delay: 300,
      duration: 280,
      easing: 'ease-out',
      fill: 'forwards'
    });
    animation.onfinish = () => flash.remove();
  }

  async function closeCharacterEditor() {
    const card = listCharacterCard(editing);
    if (card) keepCharacterCardOnscreen(card);
    editing = '';
    if (!card) return;

    await tick();
    if (!card.isConnected) return;

    const animation = card.animate(
      [{ filter: characterTransitionFilter }, { filter: 'none' }],
      { delay: 300, duration: 280, easing: 'ease-out', fill: 'both' }
    );
    animation.onfinish = () => animation.cancel();
  }

  onMount(() => {
    const controller = new AbortController();
    void planner.initialise(controller.signal);
    const filterDesktopLayout = window.matchMedia('(min-width: 801px)');
    const filterOverlayLayout = window.matchMedia('(max-width: 800px)');
    const syncFiltersForLayout = () => { filtersOpen = filterDesktopLayout.matches; };
    const collapseFiltersOnOutsideClick = (event: MouseEvent) => {
      if (!filterOverlayLayout.matches || !filtersOpen || !filterPanel) return;
      if (event.target instanceof Node && !filterPanel.contains(event.target)) filtersOpen = false;
    };
    syncFiltersForLayout();
    filterDesktopLayout.addEventListener('change', syncFiltersForLayout);
    const defaultSize = window.matchMedia('(max-width: 600px)').matches ? 1 : 5;
    cardSize = defaultSize;
    try {
      const savedSizeValue = localStorage.getItem('character_box_size');
      const savedSize = savedSizeValue === null ? NaN : Number(savedSizeValue);
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
    window.addEventListener('click', collapseFiltersOnOutsideClick, true);
    window.addEventListener('click', clearBulkOnBlankClick, true);
    window.addEventListener('keydown', plannerShortcuts);
    return () => {
      controller.abort();
      if (moveWarningTimeout) clearTimeout(moveWarningTimeout);
      filterDesktopLayout.removeEventListener('change', syncFiltersForLayout);
      window.removeEventListener(saveChangedEvent, refresh);
      window.removeEventListener('storage', storage);
      window.removeEventListener('pointerdown', beginSelectionBox, true);
      window.removeEventListener('pointermove', moveSelectionBox);
      window.removeEventListener('pointerup', finishSelectionBox);
      window.removeEventListener('pointercancel', cancelSelectionBox);
      window.removeEventListener('click', collapseFiltersOnOutsideClick, true);
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

  function showCustomSortWarning() {
    moveWarningAnimation += 1;
    moveWarningVisible = true;
    if (moveWarningTimeout) clearTimeout(moveWarningTimeout);
    moveWarningTimeout = setTimeout(() => {
      moveWarningVisible = false;
      moveWarningTimeout = undefined;
    }, 1500);
  }

  function showDrag(value: DragState | null) { drag = value; }

  async function reorder(value: DragState) {
    if (sort !== 'custom') {
      showCustomSortWarning();
      return;
    }
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
    if (sort !== 'custom') {
      showCustomSortWarning();
      return;
    }
    const ids = visible.map((character) => character.id);
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const target = ids[ids.indexOf(id) + (forward ? 1 : -1)];
    if (target) void reorder({ source: id, target, after: forward });
  }

</script>

<svelte:head><title>{t('page-resource-planner')} - Svelte</title></svelte:head>

{#if moveWarningVisible}
  {#key moveWarningAnimation}
    <div class="sort-warning-toast" role="status" aria-live="polite">{t('ui-custom-sort-required')}</div>
  {/key}
{/if}
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
    <details class="filter-panel" bind:this={filterPanel} class:has-active-filters={hasActiveFilters} bind:open={filtersOpen}>
      <summary onclick={preventDesktopFilterToggle} onkeydown={preventDesktopFilterToggleKey}>{t('ui-filters-sort')}</summary>
      <div class="filters">
      <div class="group-filter">
        <div class="group-filter-heading">
          <label for="character-group-filter">{t('label-group')}</label>
          <label class="group-range"><input type="checkbox" class:is-filtered={upToGroup} bind:checked={upToGroup} />{t('button-groupmodeupto')}</label>
        </div>
        <select id="character-group-filter" class:is-filtered={groupFilter !== ''} bind:value={groupFilter}><option value="">{t('label-all')}</option>
          {#each Object.keys($planner.data.groups) as name}<option>{name}</option>{/each}</select>
      </div>
      <label>{t('label-school')}<select class:is-filtered={school !== ''} bind:value={school}><option value="">{t('label-all')}</option>
        {#each schools as name}<option>{name}</option>{/each}</select></label>
      <label>{t('ui-role')}<select class:is-filtered={role !== ''} bind:value={role}><option value="">{t('label-all')}</option>
        <option value="Main">Striker</option><option value="Support">Special</option></select></label>
      <label>{t('label-attacktype')}<select class:is-filtered={attack !== ''} bind:value={attack}><option value="">{t('label-all')}</option>
        {#each attacks as name}<option>{name}</option>{/each}</select></label>
      <label>{t('label-defensetype')}<select class:is-filtered={armour !== ''} bind:value={armour}><option value="">{t('label-all')}</option>
        {#each armours as name}<option value={name}>{t(`deftype-${name.toLowerCase()}`)}</option>{/each}</select></label>
      <label>{t('ui-weapon-type')}<select class:is-filtered={weapon !== ''} bind:value={weapon}><option value="">{t('label-all')}</option>
        {#each weapons as name}<option>{name}</option>{/each}</select></label>
      <label>{t('ui-base-rarity')}<select class:is-filtered={rarity !== ''} bind:value={rarity}><option value="">{t('label-all')}</option>
        {#each rarities as value}<option value={String(value)}>{value}</option>{/each}</select></label>
      {#if exMaterials.length}
        <label>{t('ui-ex-material')}<select class:is-filtered={exMaterial !== ''} bind:value={exMaterial}><option value="">{t('label-all')}</option>
          {#each exMaterials as option (option.key)}
            {@const localized = t(`artifact-${option.key}`)}
            <option value={option.key}>{localized === 'Undefined' ? option.label.replaceAll('_', ' ') : localized}</option>
          {/each}
        </select></label>
      {/if}
      <label>{t('ui-included')}<select class:is-filtered={included !== ''} bind:value={included}><option value="">{t('label-all')}</option>
        <option value="yes">{t('ui-included')}</option><option value="no">{t('ui-excluded')}</option></select></label>
      <label>{t('ui-sort')}<select class:is-filtered={sort !== 'custom'} bind:value={sort}>
        {#each legacySortPresetKeys as preset}
          <option value={preset}>{t({ custom: 'ui-custom-order', name: 'ui-name-order', level: 'ui-level-order',
            star: 'label-stars', bond: 'label-bond', academy: 'label-school', ex: 'label-skillex',
            street: 'terrain-urban', outdoor: 'terrain-outdoors', indoor: 'terrain-indoors',
            bullet: 'label-attacktype', armour: 'label-defensetype', role: 'label-role', weapon: 'label-weapontype'
          }[preset])}</option>
        {/each}
      </select></label>
      <button class="reset-filter-button" onclick={() => { search = ''; school = ''; role = ''; attack = ''; armour = ''; weapon = ''; rarity = ''; exMaterial = ''; included = ''; groupFilter = ''; upToGroup = false; sort = 'custom'; }}>{t('button-resetfilters')}</button>
      </div>
    </details>
    <div class="toolbar">
      {#if bulkIds.length}
        <div class="selection-tools" aria-live="polite">
          <span>{bulkCharacters.length} {t('ui-selected')}</span>
          <button onclick={selectVisible}>{t('ui-select-visible')}</button>
          <button onclick={clearSelection}>{t('ui-clear-selection')}</button>
          <button disabled={!bulkCharacters.length} onclick={() => bulkOpen = true}>{t('ui-bulk-edit')}</button>
        </div>
      {/if}
      <label class="character-search">{t('ui-search-characters')}<input type="search" class:is-filtered={search.trim().length > 0} bind:value={search} onclick={() => search = ''} /></label>
      <button class="filter-action" onclick={() => planner.includeMany(visible.map((character) => character.id), true)}>{t('button-enableall')}</button>
      <button class="filter-action" onclick={() => planner.includeMany(visible.map((character) => character.id), false)}>{t('button-disableall')}</button>
      <label class="card-size-control">{t('ui-card-size')}<input type="range" min="1" max="5" step="1" value={cardSize}
        oninput={(event) => resize(event.currentTarget.valueAsNumber)} /></label>
    </div>
    {#if visible.length === 0}<p class="empty-state">{t('ui-no-characters')}</p>{/if}
    <div class="characters" bind:this={grid} style:--card-size={`${sizes[cardSize - 1]}px`}
      use:sortableReorder={{ mode: 'edit', change: showDrag, drop: reorder,
        canStart: () => sort === 'custom', onStartRejected: showCustomSortWarning }} aria-label={t('footer-characters')}>
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
  <CharacterEditor character={selected} info={$planner.dataset.students[selected.id]} name={$planner.names[selected.id] ?? selected.name}
    dataset={$planner.dataset} {metadata} language={$preferences.language} scribble={$planner.scribble}
    savedServer={$planner.data?.server} setServer={planner.setServer}
    included={!$planner.data?.disabled_characters.includes(selected.id)} save={planner.edit} remove={() => planner.remove(selected.id)}
    hasPrevious={hasPreviousCharacter} hasNext={hasNextCharacter} navigate={navigateCharacter}
    close={closeCharacterEditor} error={$planner.error} {t} />
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
  .character-search { flex: 0 1 12rem; min-width: 8rem; }
  .character-search input { width: 100%; }
  .card-size-control { flex: 0 1 9rem; min-width: 7rem; }
  .card-size-control input { width: 100%; }
  .toolbar > .filter-action { white-space: nowrap; }
  .group-filter { display: flex; max-width: 100%; min-width: 0; flex-direction: column; gap: 0.35rem; }
  .group-filter-heading { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 0.35rem; }
  .group-filter-heading > label:first-child { flex: 0 0 auto; }
  .group-filter select { min-width: 0; }
  .reset-filter-button { align-self: flex-end; }
  .filters :is(input.is-filtered:not([type="checkbox"]):not([type="search"]), select.is-filtered) { background-color: #c8a0ef; border-color: #ab65ad; color: #21172b; }
  .character-search input[type="search"].is-filtered { border-color: #ab65ad; color: #c8a0ef; }
  .group-range { flex-direction: row; align-items: center; }
  .group-range input.is-filtered { accent-color: #ab65ad; }
  input[type="search"] { padding: 0.6rem; min-width: 0; }
  .characters { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start; gap: 0.9rem 0.75rem; padding: 1rem 0.5rem 5rem; }
  .empty-state { margin: 1rem 0 0; text-align: center; }
  .sort-warning-toast { position: fixed; z-index: 1001; top: max(0.75rem, env(safe-area-inset-top)); left: max(0.75rem, env(safe-area-inset-left)); max-width: min(24rem, calc(100vw - 1.5rem)); margin: 0; padding: 0.65rem 1rem; border: 1px solid #7c5b7d66; border-radius: 0.45rem; background: var(--background); color: var(--text); box-shadow: 0 2px 12px #0005; transform-origin: 12% 0; animation: sort-warning-shake 520ms ease-in-out; }
  @keyframes sort-warning-shake {
    0%, 100% { transform: rotate(0); }
    15% { transform: rotate(-3deg); }
    30% { transform: rotate(3deg); }
    45% { transform: rotate(-2.25deg); }
    60% { transform: rotate(2.25deg); }
    75% { transform: rotate(-1.1deg); }
    90% { transform: rotate(0.75deg); }
  }
  .selection-box { position: fixed; z-index: 30; border: 1px solid #82dafb; background: #82dafb33; pointer-events: none; }
  .selection-box.deselect { border-color: #ed7b7b; background: #ed7b7b33; }
  .filter-panel { padding: 0.5rem; border: 1px solid #7c5b7d66; border-radius: 0.4rem; }
  summary { cursor: pointer; }
  @media (min-width: 801px) {
    .filters, .toolbar { justify-content: center; }
    .filter-panel { width: max-content; max-width: 100%; margin-inline: auto; }
    .filter-panel > .filters { width: max-content; max-width: 100%; }
    .filter-panel > summary { cursor: default; list-style: none; }
    .filter-panel > summary::marker { content: ''; }
  }
  .add-card { flex: 0 0 var(--card-size); width: var(--card-size); aspect-ratio: 8 / 9; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0.5rem; color: inherit; background: transparent; border: 2px dashed #7c5b7d; border-radius: 16%; font-size: max(11px, calc(var(--card-size) * 0.085)); }
  .add-card span:first-child { font-size: 2.5rem; line-height: 1; }
  .planner-actions { position: fixed; bottom: max(0.75rem, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; padding: 0.5rem; max-width: calc(100vw - 1rem); width: max-content; border: 1px solid #7c5b7d; border-radius: 0.75rem; background: var(--surface); box-shadow: 0 2px 10px #0005; z-index: 9; }
  .planner-actions button { display: flex; align-items: center; gap: 0.4rem; }
  .planner-actions img { width: 26px; height: 26px; object-fit: contain; }
  .error { color: var(--error); }
  @media (max-width: 800px) {
    .filter-panel { position: fixed; z-index: 11; top: 3rem; left: 0.25rem; width: fit-content; max-width: calc(100vw - 0.5rem); padding: 0.4rem; background-color: color-mix(in srgb, var(--background) 80%, transparent); }
    .filter-panel[open] { width: calc(100vw - 0.5rem); }
    .filter-panel.has-active-filters:not([open]) { background-color: color-mix(in srgb, #c8a0ef 80%, transparent); }
    .filter-panel .filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.35rem 0.5rem; margin: 0.5rem 0; }
    .filter-panel .filters > label, .filter-panel .filters > .group-filter { min-width: 0; gap: 0.15rem; }
    .filter-panel .filters select { width: 100%; min-width: 0; padding: 0.25rem 0.3rem; }
    .group-filter-heading { gap: 0.2rem; }
    .group-filter-heading .group-range { flex: 0 1 auto; flex-direction: row; align-items: center; gap: 0.2rem; white-space: nowrap; }
    .filter-panel .filters > .reset-filter-button { min-width: 0; margin-top: 0.35rem; padding: 0.25rem 0.3rem; }
  }
  @media (max-width: 600px) {
    .filters label { flex: 1 1 140px; }
    .filter-panel .filters > label, .filter-panel .filters > .group-filter { font-size: 0.75rem; }
    .filter-panel .filters select { font-size: 0.75rem; }
    .group-filter-heading .group-range { font-size: 0.68rem; }
    .filter-panel .filters > .reset-filter-button { font-size: 0.75rem; }
    .toolbar { gap: 0.25rem; }
    .character-search { flex: 0 0 7rem; min-width: 7rem; font-size: 0.75rem; }
    .character-search input { padding: 0.3rem; font-size: 0.8rem; }
    .card-size-control { flex: 0 0 4.5rem; min-width: 4.5rem; font-size: 0.72rem; }
    .toolbar > .filter-action { padding: 0.25rem 0.2rem; font-size: 0.65rem; }
    .characters { margin-inline: -0.75rem; gap: 0.9rem 0.4rem;}
    .planner-actions { width: calc(100vw - 0.5rem); max-width: calc(100vw - 0.5rem); flex-wrap: nowrap; gap: 0.1rem; padding: 0.2rem; bottom: 0; }
    .planner-actions button { flex: 1 1 auto; min-width: 0; padding: 0.2rem 0.15rem; justify-content: center; gap: 0.12rem; font-size: clamp(0.6rem, 2.6vw, 0.72rem); white-space: nowrap; }
    .planner-actions button span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .planner-actions button[aria-pressed] { flex: 0 0 auto; padding: 0.2rem; }
    .planner-actions img { width: 16px; height: 16px; flex: 0 0 auto; }
    .selection-tools { width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sort-warning-toast { animation: none; }
  }
</style>
