<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { searchStudents, type StudentSearchIndex } from '$lib/domain/planner/student-search';
  import type { PlannerMetadata } from '$lib/domain/planner/types';

  let { index, names, metadata, allowed, choose, query = $bindable(''),
    borrowed = $bindable(false), showBorrow = false, compact = false, close, t }: {
    index: StudentSearchIndex; names: Record<string, string>; metadata: PlannerMetadata;
    allowed: ReadonlySet<string>; choose: (id: string) => boolean | Promise<boolean>;
    query?: string; borrowed?: boolean; showBorrow?: boolean; compact?: boolean; close?: () => void; t: (id: string) => string;
  } = $props();
  let searchbox = $state<HTMLInputElement>();
  let selecting = $state(false);
  let matches = $derived(searchStudents(index, query, allowed));
  onMount(() => { void tick().then(() => searchbox?.focus()); });

  async function select(id: string) {
    if (selecting) return;
    selecting = true;
    try {
      if (await choose(id)) query = '';
    } finally {
      selecting = false;
      await tick();
      searchbox?.focus();
    }
  }

  function keydown(event: KeyboardEvent) {
    if (!searchbox?.closest('dialog')?.contains(document.activeElement)) return;
    if (event.isComposing || selecting || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.repeat && (/^[1-5]$/.test(event.key) || event.key === 'Enter' || event.key === 'Tab')) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && query) {
      event.preventDefault(); event.stopPropagation(); query = ''; searchbox?.focus();
    } else if (event.key === 'Escape' && close) {
      event.preventDefault(); close();
    } else if (event.key === 'Shift' && showBorrow && !event.repeat) {
      event.preventDefault(); borrowed = !borrowed;
    } else if (!event.shiftKey && /^[1-5]$/.test(event.key)) {
      event.preventDefault();
      const id = matches[Number(event.key) - 1];
      if (id) void select(id);
    } else if (event.target === searchbox && (event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey && matches[0]) {
      event.preventDefault(); void select(matches[0]);
    }
  }
</script>

<svelte:window onkeydown={keydown} />

<div class="raid-search" class:compact>
  <div class="results" role="group" aria-label={t('ui-search-results')}>
    {#each matches as id, position (id)}
      <button type="button" disabled={selecting} aria-label={`${t('ui-pick')} ${names[id] ?? id}`} title={names[id] ?? id} onclick={() => { void select(id); }}>
        {#if metadata.portraits[id]}
          <span class="character-image-frame" aria-hidden="true">
            <img class="character-image" src={metadata.portraits[id]} alt="" draggable="false" width="100" height="112" />
          </span>
        {/if}
        <span class="number" aria-hidden="true">{position + 1}</span>
        <span class="name" class:visually-hidden={compact}>{names[id] ?? id}</span>
      </button>
    {/each}
  </div>
  <div class="search-footer">
    <label><span class="visually-hidden">{t('ui-search-characters')}</span>
      <input type="search" autocomplete="off" disabled={selecting} bind:this={searchbox} bind:value={query} aria-describedby="raid-search-help" />
    </label>
    {#if showBorrow}
      <label class="borrow" class:active={borrowed}><input type="checkbox" bind:checked={borrowed} />{t('label-borrowed')}</label>
    {:else if borrowed}<span class="borrow-label">{t('label-borrowed')}</span>{/if}
  </div>
  <p id="raid-search-help" class:visually-hidden={compact}>{t('ui-search-keyboard-help')}{#if showBorrow} {t('ui-search-borrow-help')}{/if}</p>
  {#if !matches.length}<p role="status">{t('ui-no-matches')}</p>{/if}
</div>

<style>
  .raid-search { margin: 0.5rem 0; }
  .results { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.35rem; min-height: 100px; }
  .results button { position: relative; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 0; border: 2px solid #7c5b7d; border-radius: 0.5rem; background: transparent; color: inherit; overflow: hidden; min-width: 0; }
  img { width: 100%; height: auto; display: block; }
  .character-image-frame { position: relative; display: block; width: 100%; aspect-ratio: 25 / 28; flex: 0 0 auto; overflow: hidden; }
  .character-image-frame > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .number { position: absolute; top: 0; left: 0; background: #282a35e8; color: white; padding: 0.15rem 0.35rem; font: bold 1rem monospace; border-radius: 0 0 0.3rem 0; }
  .name { display: -webkit-box; min-height: 2.4em; flex: 0 0 auto; padding: 0.3rem 0.15rem; overflow: hidden; font-size: 0.8rem; overflow-wrap: anywhere; line-height: 1.2; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .search-footer { display: flex; gap: 0.5rem; align-items: stretch; margin-top: 0.6rem; }
  .search-footer > label:first-child { flex: 1; min-width: 0; }
  input[type="search"] { width: 100%; padding: 0.6rem; font: inherit; }
  .borrow { display: flex; align-items: center; gap: 0.25rem; padding: 0.4rem; border: 1px solid #7c5b7d; border-radius: 0.3rem; cursor: pointer; font-size: 0.9rem; }
  .borrow.active { background: #7c5b7d; color: white; }
  .borrow-label { align-self: center; }
  p { font-size: 0.8rem; line-height: 1.4; }
  .compact { margin: 0; }
  .compact .results { min-height: 0; gap: 0.2rem; }
  .compact .results button { aspect-ratio: 8 / 9; }
  .compact .number { font-size: 0.8rem; padding: 0.05rem 0.25rem; }
  .compact .search-footer { margin-top: 0.25rem; gap: 0.25rem; }
  .compact input[type="search"] { padding: 0.25rem; font-size: 16px; }
  .compact .borrow { padding: 0.2rem; font-size: 0.8rem; }
  @media (max-width: 600px) { .name { font-size: 0.7rem; } .results { gap: 0.2rem; } }
</style>
