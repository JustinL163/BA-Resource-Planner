<script lang="ts">
  import type { CharacterInfo, PlannerCharacter, PlannerMetadata } from '$lib/domain/planner/types';
  import { cardInvestments, type CardMode } from '$lib/domain/planner/card-display';
  import CharacterPortrait from './CharacterPortrait.svelte';

  let { character, info, name, included, metadata, scribble, edit, include, mode, dragging, keyboard,
    bulkSelected = false, selectionPreview = '', selectBulk = () => {}, preview = false, t }: {
    character: PlannerCharacter; info: CharacterInfo; name: string; included: boolean;
    metadata: PlannerMetadata; scribble: boolean; edit: () => void; mode: CardMode;
    include: (included: boolean) => void; dragging: boolean;
    keyboard: (event: KeyboardEvent) => void; bulkSelected?: boolean;
    selectionPreview?: '' | 'select' | 'deselect'; selectBulk?: (event: MouseEvent) => void; preview?: boolean;
    t: (id: string) => string;
  } = $props();
  let lines = $derived(cardInvestments(character));
  let summary = $derived(`${name}. ${t('label-current')}: ${t('label-level')} ${character.current.level}, ${t('label-stars')} ${character.current.star}, UE ${character.current.ue}, ${t('label-bond')} ${character.current.bond}. ${t('label-target')}: ${t('label-level')} ${character.target.level}, ${t('label-stars')} ${character.target.star}, UE ${character.target.ue}, ${t('label-bond')} ${character.target.bond}. ${lines.filter((line) => line.kind !== 'level' && line.current).map((line) => `${t(`ui-overlay-${line.kind}`)} ${line.current}${line.target ? ` ${t('label-target')} ${line.target}` : ''}`).join('. ')}.${preview ? '' : ` ${t(included ? 'ui-included' : 'ui-excluded')}.`}`);

  function activate(event: MouseEvent) {
    if (mode === 'bulk' || event.ctrlKey || event.metaKey) selectBulk(event);
    else if (!event.shiftKey) edit();
  }
</script>

{#if preview}
  <div class="character preview" style:--accent={metadata.colours[info.School]} role="img" aria-label={summary}>
    <CharacterPortrait id={character.id} {character} {name} {metadata} {scribble} {preview} radius="22%" />
  </div>
{:else}
  <button class="character" class:excluded={!included} class:dragging
    class:bulk-selected={bulkSelected}
    class:selection-preview-select={selectionPreview === 'select'} class:selection-preview-deselect={selectionPreview === 'deselect'}
    data-sort-id={character.id}
    style:--accent={metadata.colours[info.School]}
    onclick={activate} oncontextmenu={(event) => { event.preventDefault(); include(!included); }}
    onkeydown={keyboard}
    aria-label={`${t(mode === 'bulk' ? 'ui-select-character' : 'ui-edit-character')} ${name}`}
    aria-describedby={`summary-${character.id} card-shortcuts`}
    aria-pressed={mode === 'bulk' ? bulkSelected : undefined}
    title={`${summary}\n${t('ui-card-shortcuts')}`}>
    <CharacterPortrait id={character.id} {character} {name} {metadata} {scribble} excluded={!included} {preview} />
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
  @media (max-width: 600px) {
    .character.preview { --card-size: 60cqw; width: min(100%, 7rem); flex: 0 1 7rem; }
  }
</style>
