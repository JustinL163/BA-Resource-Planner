<script lang="ts">
  import { tick } from 'svelte';
  import type { CharacterInfo, PlannerCharacter, PlannerMetadata } from '$lib/domain/planner/types';
  import {
    cardInvestments, defaultCharacterCardDisplaySettings,
    type CardMode, type CharacterCardDisplaySettings
  } from '$lib/domain/planner/card-display';
  import CharacterPortrait from './CharacterPortrait.svelte';

  let { character, info, name, included, metadata, scribble, edit, include, mode, dragging, keyboard,
    bulkSelected = false, selectionPreview = '', selectBulk = () => {}, longPressBulk = () => {}, preview = false,
    displaySettings = defaultCharacterCardDisplaySettings, styleEditActive = false, styleSelect = () => {}, t }: {
    character: PlannerCharacter; info: CharacterInfo; name: string; included: boolean;
    metadata: PlannerMetadata; scribble: boolean; edit: () => void; mode: CardMode;
    include: (included: boolean) => void; dragging: boolean;
    keyboard: (event: KeyboardEvent) => void; bulkSelected?: boolean;
    selectionPreview?: '' | 'select' | 'deselect'; selectBulk?: (event: MouseEvent) => void;
    longPressBulk?: () => void; preview?: boolean;
    displaySettings?: CharacterCardDisplaySettings; styleEditActive?: boolean; styleSelect?: (card: HTMLButtonElement) => void;
    t: (id: string) => string;
  } = $props();
  let lines = $derived(cardInvestments(character));
  let activeTouchPointer: number | null = null;
  let pendingTouchToggle: { pointerId: number; previousIncluded: boolean } | null = null;
  let pointerEndCleanup: (() => void) | null = null;
  let bulkLongPressTimer: ReturnType<typeof setTimeout> | undefined;
  let bulkClickSuppressionTimer: ReturnType<typeof setTimeout> | undefined;
  let bulkLongPressTriggered = false;
  let suppressBulkClick = false;
  let summary = $derived(`${name}. ${t('label-current')}: ${t('label-level')} ${character.current.level}, ${t('label-stars')} ${character.current.star}, UE ${character.current.ue}, ${t('label-bond')} ${character.current.bond}. ${t('label-target')}: ${t('label-level')} ${character.target.level}, ${t('label-stars')} ${character.target.star}, UE ${character.target.ue}, ${t('label-bond')} ${character.target.bond}. ${lines.filter((line) => line.kind !== 'level' && line.current).map((line) => `${t(`ui-overlay-${line.kind}`)} ${line.current}${line.target ? ` ${t('label-target')} ${line.target}` : ''}`).join('. ')}.${preview ? '' : ` ${t(included ? 'ui-included' : 'ui-excluded')}.`}`);

  function activate(event: MouseEvent) {
    if (suppressBulkClick) {
      suppressBulkClick = false;
      if (bulkClickSuppressionTimer) clearTimeout(bulkClickSuppressionTimer);
      bulkClickSuppressionTimer = undefined;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (styleEditActive) {
      event.preventDefault();
      styleSelect(event.currentTarget);
      return;
    }
    if (mode === 'bulk' || event.ctrlKey || event.metaKey) selectBulk(event);
    else if (!event.shiftKey) edit();
  }

  function contextMenu(event: MouseEvent) {
    event.preventDefault();
    if (styleEditActive) return;
    if (mode === 'bulk') return;
    if (activeTouchPointer !== null) {
      pendingTouchToggle = { pointerId: activeTouchPointer, previousIncluded: included };
    }
    include(!included);
  }

  function trackPointerDown(event: PointerEvent) {
    pointerEndCleanup?.();
    pointerEndCleanup = null;
    if (bulkLongPressTimer) clearTimeout(bulkLongPressTimer);
    bulkLongPressTimer = undefined;
    bulkLongPressTriggered = false;
    activeTouchPointer = event.pointerType === 'touch' ? event.pointerId : null;
    if (activeTouchPointer === null) return;

    const pointerId = activeTouchPointer;
    const startX = event.clientX;
    const startY = event.clientY;
    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId || !bulkLongPressTimer) return;
      if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) >= 12) {
        clearTimeout(bulkLongPressTimer);
        bulkLongPressTimer = undefined;
      }
    };
    const finish = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      if (bulkLongPressTimer) clearTimeout(bulkLongPressTimer);
      bulkLongPressTimer = undefined;
      if (bulkLongPressTriggered && endEvent.type === 'pointerup') {
        suppressBulkClick = true;
        if (bulkClickSuppressionTimer) clearTimeout(bulkClickSuppressionTimer);
        bulkClickSuppressionTimer = setTimeout(() => {
          suppressBulkClick = false;
          bulkClickSuppressionTimer = undefined;
        }, 500);
      }
      if (pendingTouchToggle?.pointerId === pointerId) pendingTouchToggle = null;
      activeTouchPointer = null;
      pointerEndCleanup?.();
      pointerEndCleanup = null;
    };
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', finish, true);
    if (mode === 'bulk') window.addEventListener('pointermove', onMove, true);
    pointerEndCleanup = () => {
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', finish, true);
      window.removeEventListener('pointermove', onMove, true);
      if (bulkLongPressTimer) clearTimeout(bulkLongPressTimer);
      bulkLongPressTimer = undefined;
    };
    if (mode === 'bulk') {
      bulkLongPressTimer = setTimeout(() => {
        bulkLongPressTimer = undefined;
        bulkLongPressTriggered = true;
        longPressBulk();
      }, 500);
    }
  }

  function syncExcludedAppearance(element: HTMLElement | null | undefined, excluded: boolean) {
    if (!element) return;
    element.classList.toggle('excluded', excluded);
    element.querySelector('.portrait')?.classList.toggle('excluded', excluded);
  }

  async function revertTouchToggleOnDragStart(event: Event) {
    const pending = pendingTouchToggle;
    pendingTouchToggle = null;
    if (!pending) return;
    const item = event.currentTarget as HTMLElement;
    const { clone, floatingClone } = (event as CustomEvent<{
      clone?: HTMLElement; floatingClone?: HTMLElement | null
    }>).detail ?? {};
    const excluded = !pending.previousIncluded;
    include(pending.previousIncluded);
    syncExcludedAppearance(item, excluded);
    syncExcludedAppearance(clone, excluded);
    syncExcludedAppearance(floatingClone, excluded);
    await tick();
    syncExcludedAppearance(item, excluded);
    const sourcePortrait = item.querySelector('.portrait');
    for (const copy of [clone, floatingClone]) {
      const copyPortrait = copy?.querySelector('.portrait');
      if (sourcePortrait && copyPortrait) copyPortrait.replaceWith(sourcePortrait.cloneNode(true));
    }
  }

  function watchSortableDragStart(node: HTMLButtonElement) {
    node.addEventListener('planner-card-drag-start', revertTouchToggleOnDragStart);
    return {
      destroy() {
        node.removeEventListener('planner-card-drag-start', revertTouchToggleOnDragStart);
        pendingTouchToggle = null;
        activeTouchPointer = null;
        pointerEndCleanup?.();
        pointerEndCleanup = null;
        if (bulkClickSuppressionTimer) clearTimeout(bulkClickSuppressionTimer);
        bulkClickSuppressionTimer = undefined;
        suppressBulkClick = false;
      }
    };
  }
</script>

{#if preview}
  <div class="character preview" style:--accent={metadata.colours[info.School]} role="img" aria-label={summary}>
    <CharacterPortrait id={character.id} {character} {name} {metadata} {scribble} {preview} radius="22%" />
  </div>
{:else}
  <button use:watchSortableDragStart class="character" class:excluded={!included} class:dragging class:style-editable={styleEditActive}
    class:bulk-selected={bulkSelected}
    class:selection-preview-select={selectionPreview === 'select'} class:selection-preview-deselect={selectionPreview === 'deselect'}
    data-sort-id={character.id}
    style:--accent={metadata.colours[info.School]}
    style:border-color={displaySettings.schoolBorder ? metadata.colours[info.School] : 'color-mix(in srgb, var(--text) 35%, transparent)'}
    onclick={activate} oncontextmenu={contextMenu} onpointerdown={trackPointerDown}
    onkeydown={keyboard}
    aria-label={`${t(mode === 'bulk' ? 'ui-select-character' : 'ui-edit-character')} ${name}`}
    aria-describedby={`summary-${character.id} card-shortcuts`}
    aria-pressed={mode === 'bulk' ? bulkSelected : undefined}
    title={`${summary}\n${t('ui-card-shortcuts')}`}>
    <CharacterPortrait id={character.id} {character} {name} {metadata} {scribble} excluded={!included} {preview} {displaySettings} />
    <span class="visually-hidden" id={`summary-${character.id}`}>{summary}</span>
  </button>
{/if}

<style>
  .character { position: relative; display: block; width: var(--card-size, 160px); flex: 0 0 var(--card-size, 160px); padding: 0; border: 2px solid var(--accent, #7c5b7d); border-radius: 16%; background: var(--surface); color: white; text-align: center; user-select: none; }
  .character.preview { --card-size: 100cqw; width: min(100%, 10rem); flex: 0 1 10rem; border-radius: 22%; }
  .dragging { opacity: 0.45; cursor: grabbing; }
  .bulk-selected { outline: 3px solid #82dafb; outline-offset: 3px; }
  .selection-preview-select { outline: 3px solid #82dafb; outline-offset: 3px; }
  .selection-preview-deselect { outline: 3px solid #ed7b7b; outline-offset: 3px; }
  .style-editable { cursor: crosshair; isolation: isolate; }
  .style-editable::after, .style-editable::before { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
  .style-editable::after { content: ''; z-index: 3; background: #82dafb4d; }
  .style-editable::before {
    content: ''; z-index: 4;
    background: linear-gradient(135deg, transparent 43%, #bfeaff9c 50%, transparent 57%);
    background-size: 300% 300%; background-repeat: no-repeat;
    animation: card-style-shine 2.8s ease-in-out infinite;
  }
  @keyframes card-style-shine {
    0% { background-position: 140% 140%; }
    24% { background-position: -140% -140%; }
    24.01%, 100% { background-position: 140% 140%; }
  }
  @media (prefers-reduced-motion: reduce) { .style-editable::before { animation: none; } }
  @media (max-width: 600px) {
    .character.preview { --card-size: 60cqw; width: min(100%, 7rem); flex: 0 1 7rem; }
  }
</style>
