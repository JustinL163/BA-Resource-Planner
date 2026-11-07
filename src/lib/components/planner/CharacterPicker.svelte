<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { CharacterInfo, PlannerMetadata } from '$lib/domain/planner/types';
  import { createStudentSearchIndex, studentSearchRank } from '$lib/domain/planner/student-search';
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
  const pickerModePreferenceKey = 'planner-character-picker-mode';
  let gridSearch = $state<HTMLInputElement>();
  let message = $state('');
  let index = $derived(createStudentSearchIndex(students, names, aliases, $preferences.language));
  let termsByStudent = $derived(new Map(index.map(({ id, terms }) => [id, terms] as const)));
  const searchSchoolName = (name: string) => localizedSchoolName(name, t);
  const academyIconFiles: Record<string, string> = {
    Abydos: 'Abydos', Arius: 'Arius', ETC: 'ETC', Gehenna: 'Gehenna', Highlander: 'Highlander',
    Hyakkiyako: 'Hyakkiyako', Millennium: 'Millennium', Odyssey: 'Odyssey', RedWinter: 'RedWinter',
    Shanhaijing: 'Shanhaijing', SRT: 'SRT', Tokiwadai: 'ETC', Trinity: 'Trinity', Valkyrie: 'Valkyrie',
    WildHunt: 'Wildhunt', Wildhunt: 'Wildhunt'
  };
  const schoolIconPath = (school: string) => `/planner/icons/Academies/${academyIconFiles[school] ?? 'ETC'}.png`;
  let allowed = $derived(new Set(Object.keys(students).filter((id) => !added.includes(id) && !['10099', '10144'].includes(id))));
  let available = $derived(Object.entries(students)
    .map(([id, info]) => ({ id, info, rank: studentSearchRank(termsByStudent.get(id), query, [info.School, searchSchoolName(info.School), id]) }))
    .filter(({ id, rank }) => allowed.has(id) && rank > 0)
    .sort((a, b) => b.rank - a.rank || (names[a.id] ?? a.info.Name).localeCompare(names[b.id] ?? b.info.Name))
    .map(({ id, info }) => [id, info] as const));
  let pending = $derived(selected.filter((id) => allowed.has(id)));
  onMount(() => {
    try { grid = localStorage.getItem(pickerModePreferenceKey) === 'grid'; }
    catch { /* Keep search mode when local storage is unavailable. */ }
  });
  $effect(() => {
    if (grid) void tick().then(() => gridSearch?.focus({ preventScroll: true }));
  });
  function switchView() {
    grid = !grid;
    try { localStorage.setItem(pickerModePreferenceKey, grid ? 'grid' : 'search'); }
    catch { /* Keep the selected mode for this session if local storage is unavailable. */ }
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
      <p class="selected-count">{pending.length} {t('ui-selected')}</p>
      <div class="choices">
        {#each available as [id, info] (id)}
          <label class="choice">
            <input type="checkbox" checked={pending.includes(id)} onchange={(event) => {
              selected = event.currentTarget.checked ? [...selected, id] : selected.filter((value) => value !== id);
            }} />
            {#if metadata.portraits[id]}
              <img class="character-image" src={metadata.portraits[id]} alt="" loading="lazy" width="160" height="180" draggable="false" />
            {/if}
            <img class="school-icon" src={schoolIconPath(info.School)} alt="" loading="lazy" draggable="false" />
            <span class="choice-name">{names[id] ?? info.Name}</span>
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
  .selected-count { margin-block: 0.5rem; }
  input[type="search"] { flex: 1; min-width: 0; padding: 0.65rem; }
  .choices { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.5rem; max-height: 50vh; overflow: auto; padding: 0.25rem; }
  .choice { position: relative; display: block; min-width: 0; aspect-ratio: 8 / 9; overflow: hidden; padding: 0; border: 1px solid #7c5b7d66; border-radius: 0.65rem; background: var(--background); cursor: pointer; }
  .choice > .character-image { display: block; width: 100%; height: 100%; object-fit: cover; }
  .choice > .school-icon { position: absolute; z-index: 1; top: 0.3rem; left: 0.3rem; width: 1.7rem; height: 1.7rem; padding: 0.12rem; border-radius: 0.3rem; background: #17151ac9; object-fit: contain; }
  .choice-name { position: absolute; z-index: 1; inset: auto 0 0; display: -webkit-box; max-height: 2.6rem; padding: 0.25rem 0.3rem; overflow: hidden; background: #121625c9; color: #fff; font-size: 0.9rem; line-height: 1.2; text-align: center; text-shadow: -1px -1px 0 #000, 0 -1px 0 #000, 1px -1px 0 #000, -1px 0 0 #000, 1px 0 0 #000, -1px 1px 0 #000, 0 1px 0 #000, 1px 1px 0 #000; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .choice > input { position: absolute; z-index: 2; top: 0.3rem; right: 0.3rem; width: 1.15rem; height: 1.15rem; margin: 0; accent-color: #82dafb; }
  .choice:has(input:checked) { outline: 2px solid #82dafb; outline-offset: 1px; }
  img { object-fit: cover; border-radius: 0.25rem; }
  footer { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
  .note { font-size: 0.85rem; }
  .error { color: var(--error); }

  @media (max-width: 600px) {
    .grid-picker-form { width: calc(100vw - 1.325rem); }
    .choices { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.35rem; }
    .choice-name { font-size: 0.6rem; padding: 0.1rem 0.3rem;}
    .choice > .school-icon { top: 0.2rem; left: 0.2rem; width: 1.45rem; height: 1.45rem; }
    .choice > input { top: 0.2rem; right: 0.2rem; width: 1rem; height: 1rem; }
  }
</style>
