<script lang="ts">
  import { tick } from 'svelte';
  import type { CharacterInfo, PlannerMetadata } from '$lib/domain/planner/types';
  import { createStudentSearchIndex, matchesSearchText } from '$lib/domain/planner/student-search';
  import { localizedSchoolName } from '$lib/domain/planner/localized-labels';
  import { preferences } from '$lib/stores/preferences';
  import aliases from '$content/search-aliases.json';
  import PlannerDialog from './PlannerDialog.svelte';
  import RaidCharacterSearch from './RaidCharacterSearch.svelte';

  let { students, names, added, metadata, save, close, error, t }: {
    students: Record<string, CharacterInfo>; names: Record<string, string>;
    added: string[]; metadata: PlannerMetadata; save: (ids: string[]) => boolean;
    close: () => void; error: string; t: (id: string) => string;
  } = $props();
  let query = $state('');
  let selected = $state<string[]>([]);
  let grid = $state(false);
  let gridSearch = $state<HTMLInputElement>();
  let message = $state('');
  let index = $derived(createStudentSearchIndex(students, names, aliases, $preferences.language));
  const searchSchoolName = (name: string) => localizedSchoolName(name, t);
  let allowed = $derived(new Set(Object.keys(students).filter((id) => !added.includes(id) && !['10099', '10144'].includes(id))));
  let available = $derived(Object.entries(students).filter(([id, info]) =>
    allowed.has(id) && (matchesSearchText(index, id, query) ||
      `${info.School} ${searchSchoolName(info.School)} ${id}`.toLowerCase().includes(query.toLowerCase().trim()))
  ).sort(([a, first], [b, second]) => (names[a] ?? first.Name).localeCompare(names[b] ?? second.Name)));
  let pending = $derived(selected.filter((id) => allowed.has(id)));
  async function switchView() {
    grid = !grid;
    await tick();
    gridSearch?.focus();
  }
  function add(id: string) {
    if (!save([id])) return false;
    message = `${t('ui-character-added')} ${names[id] ?? students[id].Name}`;
    return true;
  }
</script>

<PlannerDialog title={t('ui-add-characters')} width={grid ? '1100px' : '680px'} {close} {t}>
  <div class="view-switch"><button type="button" onclick={switchView}>{t(grid ? 'ui-search-picker' : 'ui-grid-picker')}</button></div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if grid}
    <form class="grid-picker-form" onsubmit={(event) => { event.preventDefault(); if (pending.length && save(pending)) close(); }}>
      <label class="search">{t('ui-search-characters')}<input type="search" bind:this={gridSearch} bind:value={query} /></label>
      <p>{pending.length} {t('ui-selected')}</p>
      <div class="choices">
        {#each available as [id, info] (id)}
          <label class="choice">
            <input type="checkbox" checked={pending.includes(id)} onchange={(event) => {
              selected = event.currentTarget.checked ? [...selected, id] : selected.filter((value) => value !== id);
            }} />
            {#if metadata.portraits[id]}<img class="character-image" src={metadata.portraits[id]} alt="" loading="lazy" width="50" height="56" />{/if}
            <span>{names[id] ?? info.Name}<small>{localizedSchoolName(info.School, t)}</small></span>
          </label>
        {/each}
      </div>
      {#if !available.length}<p>{t('ui-no-matches')}</p>{/if}
      <footer><button type="button" onclick={close}>{t('label-cancel')}</button>
        <button type="submit" disabled={!pending.length}>{t('ui-add-selected')}</button></footer>
    </form>
  {:else}
    <RaidCharacterSearch {index} {names} {metadata} {allowed} bind:query choose={add} {t} />
    <p class="note">{t('ui-quick-add-help')}</p>
    {#if message}<p role="status">{message}</p>{/if}
    {#if pending.length}<p>{pending.length} {t('ui-grid-pending')}</p>{/if}
    <footer><button type="button" onclick={close}>{t('ui-done')}</button></footer>
  {/if}
</PlannerDialog>

<style>
  .view-switch { display: flex; justify-content: flex-end; margin-bottom: 0.5rem; }
  .grid-picker-form { width: min(66.625rem, calc(100vw - 3.125rem)); }
  .search { display: flex; gap: 0.75rem; align-items: center; }
  input[type="search"] { flex: 1; min-width: 0; padding: 0.65rem; }
  .choices { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.5rem; max-height: 50vh; overflow: auto; padding: 0.25rem; }
  .choice { display: flex; min-width: 0; gap: 0.5rem; align-items: center; padding: 0.4rem; border: 1px solid #7c5b7d66; border-radius: 0.5rem; }
  .choice > img { flex: 0 0 50px; width: 50px; height: 56px; }
  .choice > span { min-width: 0; overflow-wrap: anywhere; }
  img { object-fit: cover; border-radius: 0.25rem; }
  small { display: block; opacity: 0.75; }
  footer { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
  .note { font-size: 0.85rem; }
  .error { color: var(--error); }

  @media (max-width: 600px) {
    .grid-picker-form { width: calc(100vw - 1.325rem); }
    .choices { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.35rem; }
    .choice { gap: 0.35rem; padding: 0.3rem; font-size: 0.8rem; }
    .choice > img { flex-basis: 40px; width: 40px; height: 48px; }
    small { font-size: 0.7rem; }
  }
</style>
