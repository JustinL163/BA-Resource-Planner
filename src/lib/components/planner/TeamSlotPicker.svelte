<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { isBorrowed, slotId, strikerSlotCount, type SlotLocation, type Team } from '$lib/domain/planner/groups';
  import type { PlannerDataset, PlannerMetadata } from '$lib/domain/planner/types';
  import { createStudentSearchIndex, studentSearchRank } from '$lib/domain/planner/student-search';
import { localizedSchoolName } from '$lib/domain/planner/localized-labels';
  import { preferences } from '$lib/stores/preferences';
  import aliases from '$content/search-aliases.json';
  import { anchoredPicker } from './anchored-picker';
  import RaidCharacterSearch from './RaidCharacterSearch.svelte';
  import PlannerDialog from './PlannerDialog.svelte';
  let { teams, location, dataset, names, metadata, anchor, slots, assign, choose, close, error, t,
    gridOpen = $bindable(false) }: {
    teams: Team[]; location: SlotLocation; dataset: PlannerDataset; names: Record<string, string>; metadata: PlannerMetadata;
    assign: (id: string | null, borrowed: boolean) => boolean; choose: (id: string, borrowed: boolean) => Promise<boolean>;
    anchor: HTMLButtonElement; slots: HTMLElement;
    close: () => void; error: string; t: (id: string) => string; gridOpen?: boolean;
  } = $props();
  let borrowed = $state(false);
  let query = $state('');
  let panel = $state<HTMLDialogElement>();
  let restoreFocus = true;
  let other = $derived(teams.flatMap((team, index) => team.filter((_slot, slot) => index !== location.team || slot !== location.slot)));
  let used = $derived(new Set(other.filter((slot) => !isBorrowed(slot)).map(slotId)));
  let strikers = $derived(strikerSlotCount(teams[location.team] ?? []));
  let currentId = $derived(slotId(teams[location.team]?.[location.slot] ?? null));
  let role = $derived(location.slot < strikers ? t('type-striker') : t('type-special'));
  let roleSlot = $derived((location.slot < strikers ? location.slot : location.slot - strikers) + 1);
  let usedInTeam = $derived(new Set(teams[location.team]
    .filter((_slot, slot) => slot !== location.slot)
    .map(slotId)));
  let hasOtherBorrow = $derived(other.some(isBorrowed));
  let showBorrow = $derived(!teams.some((team) => team.some(isBorrowed)));
  let effectiveBorrow = $derived(borrowed && !hasOtherBorrow);
  let index = $derived(createStudentSearchIndex(dataset.students, names, aliases, $preferences.language));
  let termsByStudent = $derived(new Map(index.map(({ id, terms }) => [id, terms] as const)));
  let gridSearch = $state<HTMLInputElement>();
  let allowed = $derived(new Set(Object.entries(dataset.students).filter(([id, info]) =>
    info.SquadType === (location.slot < strikers ? 'Main' : 'Support') &&
    (effectiveBorrow || !used.has(id)) && !usedInTeam.has(id)
  ).map(([id]) => id)));
  let gridMatches = $derived(Object.entries(dataset.students)
    .map(([id, info]) => ({ id, rank: studentSearchRank(termsByStudent.get(id), query, [info.School, localizedSchoolName(info.School, t), id]) }))
    .filter(({ id, rank }) => (allowed.has(id) || id === currentId) && (rank > 0 || id === currentId))
    .sort((a, b) => Number(b.id === currentId) - Number(a.id === currentId) || b.rank - a.rank ||
      (names[a.id] ?? a.id).localeCompare(names[b.id] ?? b.id))
    .map(({ id }) => id));
  const academyIconFiles: Record<string, string> = {
    Abydos: 'Abydos', Arius: 'Arius', ETC: 'ETC', Gehenna: 'Gehenna', Highlander: 'Highlander',
    Hyakkiyako: 'Hyakkiyako', Millennium: 'Millennium', Odyssey: 'Odyssey', RedWinter: 'RedWinter',
    Shanhaijing: 'Shanhaijing', SRT: 'SRT', Tokiwadai: 'ETC', Trinity: 'Trinity', Valkyrie: 'Valkyrie',
    WildHunt: 'Wildhunt', Wildhunt: 'Wildhunt'
  };
  const schoolIconPath = (school: string) => `/planner/icons/Academies/${academyIconFiles[school] ?? 'ETC'}.png`;
  $effect(() => { borrowed = isBorrowed(teams[location.team]?.[location.slot] ?? null); });
  $effect(() => {
    anchor;
    query = '';
    if (!gridOpen) void tick().then(() => panel?.querySelector<HTMLInputElement>('input[type="search"]')?.focus({ preventScroll: true }));
  });
  $effect(() => {
    if (gridOpen) void tick().then(() => gridSearch?.focus({ preventScroll: true }));
  });
  function dismiss(restore = true) { restoreFocus = restore; gridOpen = false; close(); }
  async function selectGrid(id: string) {
    if (await choose(id, effectiveBorrow)) query = '';
    await tick();
    gridSearch?.focus({ preventScroll: true });
  }
  onDestroy(() => {
    if (restoreFocus && anchor.isConnected &&
        (document.activeElement === document.body || panel?.contains(document.activeElement))) {
      anchor.focus({ preventScroll: true });
    }
  });
</script>

{#if gridOpen}
    <PlannerDialog title={t('ui-pick-team-character')} close={() => dismiss()} width="1100px" {t}>
      <div class="grid-picker-content">
        <p class="slot-summary">{t('ui-team')} {location.team + 1} &middot; {role} {roleSlot}</p>
        <div class="grid-controls">
          <label class="grid-search">{t('ui-search-characters')}<input bind:this={gridSearch} type="search" autocomplete="off" bind:value={query} /></label>
          {#if showBorrow}
            <label class="grid-borrow"><input type="checkbox" bind:checked={borrowed} />{t('label-borrowed')}</label>
          {:else if borrowed}<span class="borrow-label">{t('label-borrowed')}</span>{/if}
        </div>
        <div class="choices" role="group" aria-label={t('ui-pick-team-character')}>
          {#each gridMatches as id (id)}
            {@const info = dataset.students[id]}
            <button type="button" class="choice" class:selected={id === currentId} aria-pressed={id === currentId}
              title={names[id] ?? id} aria-label={`${t('ui-pick')} ${names[id] ?? id}`}
              onclick={() => { void selectGrid(id); }}>
              {#if metadata.portraits[id]}<img class="character-image" src={metadata.portraits[id]} alt="" loading="lazy" draggable="false" />{/if}
              <img class="school-icon" src={schoolIconPath(info.School)} alt="" loading="lazy" draggable="false" />
              <span class="choice-name">{names[id] ?? info.Name}</span>
            </button>
          {/each}
        </div>
        {#if !gridMatches.length}<p role="status">{t('ui-no-matches')}</p>{/if}
      </div>
    </PlannerDialog>
{:else}
  <dialog open aria-modal="false" aria-label={t('ui-pick-team-character')} bind:this={panel}
    use:anchoredPicker={{ anchor, slots, dismiss }} class="team-picker" data-html2canvas-ignore>
    <header>
      <span>{t('ui-team')} {location.team + 1} &middot; {role} {roleSlot}</span>
      <div>
        <button aria-label={t('ui-grid-picker')} title={t('ui-grid-picker')} onclick={() => gridOpen = true}>{t('ui-grid-picker')}</button>
        <button aria-label={t('ui-remove')} onclick={() => { if (assign(null, false)) dismiss(); }}>{t('ui-remove')}</button>
        <button aria-label={`${t('ui-close')} ${t('ui-pick-team-character')}`} onclick={() => dismiss()}>&times;</button>
      </div>
    </header>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <RaidCharacterSearch {index} {names} {metadata} {allowed} bind:query bind:borrowed {showBorrow}
      choose={(id) => choose(id, effectiveBorrow)} compact close={() => dismiss()} {t} />
  </dialog>
{/if}

<style>
  .team-picker { position: fixed; z-index: 30; inset: auto; margin: 0; width: min(360px, calc(100vw - 12px)); padding: 0.35rem; border: 2px solid #7c5b7d; border-radius: 0.5rem; background: var(--surface); color: var(--text); box-shadow: 0 3px 12px #0005; overflow-y: auto; visibility: hidden; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; margin-bottom: 0.25rem; font-size: 0.75rem; }
  header div { display: flex; gap: 0.25rem; }
  header button { padding: 0.05rem 0.35rem; font-size: 0.75rem; }
  .grid-picker-content { width: min(66.625rem, calc(100vw - 3.125rem)); }
  .slot-summary { margin: 0 0 0.6rem; font-size: 0.85rem; opacity: 0.8; }
  .grid-controls { display: flex; align-items: end; gap: 0.75rem; margin-bottom: 0.6rem; }
  .grid-search { display: flex; flex: 1; align-items: center; gap: 0.75rem; min-width: 0; }
  .grid-search input { flex: 1; min-width: 0; padding: 0.55rem; }
  .grid-borrow { display: flex; align-items: center; gap: 0.25rem; padding: 0.4rem; border: 1px solid #7c5b7d; border-radius: 0.3rem; cursor: pointer; }
  .borrow-label { align-self: center; }
  .choices { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.5rem; max-height: min(58dvh, 42rem); overflow: auto; padding: 0.25rem; }
  .choice { position: relative; display: block; min-width: 0; aspect-ratio: 8 / 9; overflow: hidden; padding: 0; border: 1px solid #7c5b7d66; border-radius: 0.65rem; background: var(--background); color: inherit; cursor: pointer; }
  .choice.selected { outline: 3px solid #82dafb; outline-offset: 1px; }
  .character-image { display: block; width: 100%; height: 100%; object-fit: cover; }
  .school-icon { position: absolute; z-index: 1; top: 0.3rem; left: 0.3rem; width: 1.7rem; height: 1.7rem; padding: 0.12rem; border-radius: 0.3rem; background: #17151ac9; object-fit: contain; }
  .choice-name { position: absolute; z-index: 1; inset: auto 0 0; display: -webkit-box; max-height: 2.6rem; padding: 0.25rem 0.3rem; overflow: hidden; background: #121625c9; color: #fff; font-size: 0.9rem; line-height: 1.2; text-align: center; text-shadow: -1px -1px 0 #000, 0 -1px 0 #000, 1px -1px 0 #000, -1px 0 0 #000, 1px 0 0 #000, -1px 1px 0 #000, 0 1px 0 #000, 1px 1px 0 #000; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .error { color: var(--error); font-size: 0.8rem; margin: 0.3rem 0; }
  @media (max-width: 600px) { .team-picker { width: min(280px, calc(100vw - 12px)); } }
  @media (max-width: 600px) {
    .grid-picker-content { width: calc(100vw - 1.325rem); }
    .grid-controls { align-items: stretch; gap: 0.4rem; }
    .grid-search { flex-direction: column; align-items: stretch; gap: 0.2rem; }
    .grid-search input { padding: 0.4rem; }
    .choices { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.35rem; }
    .choice-name { max-height: 2.6rem; padding: 0.1rem 0.2rem; font-size: 0.65rem; }
    .school-icon { top: 0.2rem; left: 0.2rem; width: 1.45rem; height: 1.45rem; }
  }
</style>
