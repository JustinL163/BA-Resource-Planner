<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { isBorrowed, slotId, type SlotLocation, type Team } from '$lib/domain/planner/groups';
  import type { PlannerDataset, PlannerMetadata } from '$lib/domain/planner/types';
  import { createStudentSearchIndex } from '$lib/domain/planner/student-search';
  import { preferences } from '$lib/stores/preferences';
  import aliases from '$content/search-aliases.json';
  import { anchoredPicker } from './anchored-picker';
  import RaidCharacterSearch from './RaidCharacterSearch.svelte';
  let { teams, location, dataset, names, metadata, anchor, slots, assign, choose, close, error, t }: {
    teams: Team[]; location: SlotLocation; dataset: PlannerDataset; names: Record<string, string>; metadata: PlannerMetadata;
    assign: (id: string | null, borrowed: boolean) => boolean; choose: (id: string, borrowed: boolean) => Promise<boolean>;
    anchor: HTMLButtonElement; slots: HTMLElement;
    close: () => void; error: string; t: (id: string) => string;
  } = $props();
  let borrowed = $state(false);
  let query = $state('');
  let panel = $state<HTMLDialogElement>();
  let restoreFocus = true;
  let other = $derived(teams.flatMap((team, index) => team.filter((_slot, slot) => index !== location.team || slot !== location.slot)));
  let used = $derived(new Set(other.filter((slot) => !isBorrowed(slot)).map(slotId)));
  let hasOtherBorrow = $derived(other.some(isBorrowed));
  let showBorrow = $derived(!teams.some((team) => team.some(isBorrowed)));
  let effectiveBorrow = $derived(borrowed && !hasOtherBorrow);
  let index = $derived(createStudentSearchIndex(dataset.students, names, aliases, $preferences.language));
  let allowed = $derived(new Set(Object.entries(dataset.students).filter(([id, info]) =>
    info.SquadType === (location.slot < 4 ? 'Main' : 'Support') &&
    (effectiveBorrow || !used.has(id))
  ).map(([id]) => id)));
  $effect(() => { borrowed = isBorrowed(teams[location.team]?.[location.slot] ?? null); });
  $effect(() => {
    anchor;
    query = '';
    void tick().then(() => panel?.querySelector<HTMLInputElement>('input[type="search"]')?.focus({ preventScroll: true }));
  });
  function dismiss(restore = true) { restoreFocus = restore; close(); }
  onDestroy(() => {
    if (restoreFocus && anchor.isConnected &&
        (document.activeElement === document.body || panel?.contains(document.activeElement))) {
      anchor.focus({ preventScroll: true });
    }
  });
</script>

<dialog open aria-modal="false" aria-label={t('ui-pick-team-character')} bind:this={panel}
  use:anchoredPicker={{ anchor, slots, dismiss }} class="team-picker" data-html2canvas-ignore>
  <header>
    <span>{t('ui-team')} {location.team + 1} &middot; {location.slot < 4 ? 'Striker' : 'Special'} {(location.slot < 4 ? location.slot : location.slot - 4) + 1}</span>
    <div>
      <button aria-label={t('ui-clear-slot')} onclick={() => { if (assign(null, false)) dismiss(); }}>{t('ui-clear')}</button>
      <button aria-label={`${t('ui-close')} ${t('ui-pick-team-character')}`} onclick={() => dismiss()}>&times;</button>
    </div>
  </header>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <RaidCharacterSearch {index} {names} {metadata} {allowed} bind:query bind:borrowed {showBorrow}
    choose={(id) => choose(id, effectiveBorrow)} compact close={() => dismiss()} {t} />
</dialog>

<style>
  .team-picker { position: fixed; z-index: 30; inset: auto; margin: 0; width: min(360px, calc(100vw - 12px)); padding: 0.35rem; border: 2px solid #7c5b7d; border-radius: 0.5rem; background: var(--surface); color: var(--text); box-shadow: 0 3px 12px #0005; overflow-y: auto; visibility: hidden; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; margin-bottom: 0.25rem; font-size: 0.75rem; }
  header div { display: flex; gap: 0.25rem; }
  header button { padding: 0.05rem 0.35rem; font-size: 0.75rem; }
  .error { color: var(--error); font-size: 0.8rem; margin: 0.3rem 0; }
  @media (max-width: 620px) { .team-picker { width: min(280px, calc(100vw - 12px)); } }
</style>
