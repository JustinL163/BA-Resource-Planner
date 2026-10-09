<script lang="ts">
  import type { CharacterInfo, PlannerCharacter, PlannerMetadata } from '$lib/domain/planner/types';
  import { cardInvestments, type CardMode } from '$lib/domain/planner/card-display';
  import CharacterPortrait from './CharacterPortrait.svelte';

  let { character, info, name, included, metadata, scribble, edit, include, mode, dragging, dropPosition, keyboard,
    bulkSelected = false, selectBulk = () => {}, t }: {
    character: PlannerCharacter; info: CharacterInfo; name: string; included: boolean;
    metadata: PlannerMetadata; scribble: boolean; edit: () => void; mode: CardMode;
    include: (included: boolean) => void; dragging: boolean; dropPosition: '' | 'before' | 'after';
    keyboard: (event: KeyboardEvent) => void; bulkSelected?: boolean; selectBulk?: () => void;
    t: (id: string) => string;
  } = $props();
  let lines = $derived(cardInvestments(character));
  let summary = $derived(`${name}. ${t('label-current')}: ${t('label-level')} ${character.current.level}, ${t('label-stars')} ${character.current.star}, UE ${character.current.ue}, ${t('label-bond')} ${character.current.bond}. ${t('label-target')}: ${t('label-level')} ${character.target.level}, ${t('label-stars')} ${character.target.star}, UE ${character.target.ue}, ${t('label-bond')} ${character.target.bond}. ${lines.filter((line) => line.kind !== 'level' && line.current).map((line) => `${t(`ui-overlay-${line.kind}`)} ${line.current}${line.target ? ` ${t('label-target')} ${line.target}` : ''}`).join('. ')}. ${t(included ? 'ui-included' : 'ui-excluded')}.`);

  function activate(event: MouseEvent) {
    if (mode === 'bulk') selectBulk();
    else if (mode === 'disable' || event.ctrlKey || event.metaKey) include(!included);
    else if (mode === 'edit' && !event.shiftKey) edit();
  }
</script>

<button class="character" class:excluded={!included} class:dragging class:before={dropPosition === 'before'} class:after={dropPosition === 'after'}
  class:movable={mode === 'move'} class:bulk-selected={bulkSelected} data-sort-id={character.id}
  style:--accent={metadata.colours[info.School]}
  onclick={activate} oncontextmenu={(event) => { event.preventDefault(); if (mode === 'bulk') selectBulk(); else include(!included); }}
  onkeydown={keyboard}
  aria-label={`${t(mode === 'bulk' ? 'ui-select-character' : mode === 'disable' ? 'ui-toggle-character' : mode === 'move' ? 'ui-move-character' : 'ui-edit-character')} ${name}`}
  aria-describedby={`summary-${character.id} card-shortcuts`}
  aria-pressed={mode === 'bulk' ? bulkSelected : mode === 'disable' ? included : undefined}
  title={`${summary}\n${t('ui-card-shortcuts')}`}>
  <CharacterPortrait id={character.id} {character} {name} {metadata} {scribble} excluded={!included} />
  <span class="visually-hidden" id={`summary-${character.id}`}>{summary}</span>
</button>

<style>
  .character { position: relative; display: block; width: var(--card-size, 160px); flex: 0 0 var(--card-size, 160px); padding: 0; border: 2px solid var(--accent, #7c5b7d); border-radius: 16%; background: var(--surface); color: white; text-align: center; user-select: none; }
  .movable { cursor: grab; touch-action: none; }
  .dragging { opacity: 0.45; cursor: grabbing; }
  .bulk-selected { outline: 3px solid #82dafb; outline-offset: 3px; }
  .before::before, .after::after { content: ''; position: absolute; top: 0; bottom: 0; width: 4px; background: #b9efbb; border-radius: 2px; }
  .before::before { left: -7px; } .after::after { right: -7px; }
</style>
