<script lang="ts">
  import { tick } from 'svelte';
  import { groupFingerprint, isTenStudentGroup } from '$lib/domain/planner/groups';
  import type { GroupCommand } from '$lib/services/planner-groups';
  import { sortableReorder, type DragState } from './sortable';
  import GroupDialog from './GroupDialog.svelte';
  import PlannerDialog from './PlannerDialog.svelte';

  let { groups, selected, save, choose, renamed, deleted, created, close, error, t }: {
    groups: Record<string, unknown>; selected: string;
    save: (command: GroupCommand) => boolean;
    choose: (name: string) => void;
    renamed: (previous: string, next: string) => void;
    deleted: (name: string, fallback: string) => void;
    created: (name: string) => void;
    close: () => void; error: string; t: (id: string) => string;
  } = $props();

  let editingName = $state('');
  let renameValue = $state('');
  let renameInput = $state<HTMLInputElement>();
  let deleteName = $state('');
  let createOpen = $state(false);
  let dragging = $state<DragState | null>(null);

  async function startRename(name: string) {
    editingName = name;
    renameValue = name;
    await tick();
    renameInput?.focus();
    renameInput?.select();
  }

  function cancelRename() {
    editingName = '';
    renameValue = '';
  }

  function finishRename(name: string) {
    if (renameValue === name) { cancelRename(); return; }
    if (save({ type: 'rename', name, newName: renameValue, expected: groupFingerprint(groups[name]) })) {
      renamed(name, renameValue);
      cancelRename();
    }
  }

  function reorder(state: DragState) {
    const names = Object.keys(groups);
    const sourceIndex = names.indexOf(state.source);
    const targetIndex = names.indexOf(state.target);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const position = targetIndex + 1 + Number(state.after) - Number(sourceIndex < targetIndex);
    save({ type: 'order', name: state.source, position, expectedOrder: JSON.stringify(names) });
  }

  function confirmDelete() {
    const name = deleteName;
    if (!name || !Object.hasOwn(groups, name)) { deleteName = ''; return; }
    const names = Object.keys(groups);
    const fallback = names.find((candidate) => candidate !== name) ?? '';
    if (save({ type: 'delete', name, expected: groupFingerprint(groups[name]) })) {
      deleted(name, fallback);
      deleteName = '';
    }
  }
</script>

<PlannerDialog title={t('ui-groups')} {close} {t} width="560px">
  <div class="picker-content">
    {#if Object.keys(groups).length}
      <ul class="group-list" use:sortableReorder={{ mode: 'edit', handle: '.group-grip', change: (value) => dragging = value, drop: reorder }}>
        {#each Object.keys(groups) as name, index (name)}
          <li class="group-row" class:selected={selected === name} class:dragging={dragging?.source === name} data-sort-id={name}>
            <span class="group-grip" aria-hidden="true"></span>
            {#if editingName === name}
              <form class="rename-form" onsubmit={(event) => { event.preventDefault(); finishRename(name); }}>
                <input bind:this={renameInput} bind:value={renameValue} type="text" required maxlength="35" aria-label={`${t('ui-group-name')} ${name}`}
                  onkeydown={(event) => {
                    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelRename(); }
                  }} />
                <button type="submit">{t('button-ok')}</button>
                <button type="button" onclick={cancelRename}>{t('label-cancel')}</button>
              </form>
            {:else}
              <button class="group-choice" aria-current={selected === name ? 'true' : undefined}
                aria-label={isTenStudentGroup(groups[name]) ? `${name}, ${t('ui-ten-student-teams')}` : name}
                onclick={() => choose(name)}><span class="group-index">{index + 1}.</span><span class="group-name">{name}</span>
                {#if isTenStudentGroup(groups[name])}<span class="team-size-badge" title={t('ui-ten-student-teams')} aria-hidden="true">10</span>{/if}
              </button>
            {/if}
            <div class="row-actions">
              <button class="icon-button" aria-label={`${t('ui-group-rename')} ${name}`} title={t('ui-group-rename')}
                onclick={() => { deleteName = ''; void startRename(name); }}>
                <span class="icon pencil-icon" aria-hidden="true"></span>
              </button>
              <button class="icon-button delete-button" aria-label={`${t('ui-group-delete')} ${name}`} title={t('ui-group-delete')}
                onclick={() => { cancelRename(); deleteName = name; }}>
                <span class="icon trash-icon" aria-hidden="true"></span>
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty-groups">{t('ui-group-empty')}</p>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <footer><button onclick={() => createOpen = true}>{t('ui-group-create')}</button></footer>
  </div>
</PlannerDialog>

{#if deleteName}
  <PlannerDialog title={t('ui-group-delete')} close={() => deleteName = ''} {t} width="440px" showClose={false}>
    <div class="confirmation">
      <p>{t('ui-group-delete-warning')} <strong>{deleteName}</strong></p>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <footer>
        <button onclick={() => deleteName = ''}>{t('label-cancel')}</button>
        <button class="delete-button" onclick={confirmDelete}>{t('ui-group-delete')}</button>
      </footer>
    </div>
  </PlannerDialog>
{/if}

{#if createOpen}
  <GroupDialog action="create" selected groups={groups} {save} changed={created}
    close={() => createOpen = false} {error} {t} />
{/if}

<style>
  .picker-content { min-width: min(28rem, calc(100vw - 3rem)); }
  .group-list { display: grid; gap: 0.4rem; max-height: min(58dvh, 32rem); overflow-y: auto; margin: 0; padding: 0.15rem; list-style: none; }
  .group-row { display: grid; grid-template-columns: 1.5rem minmax(0, 1fr) auto; align-items: center; gap: 0.55rem; min-height: 2.8rem; padding: 0.35rem 0.45rem; border: 1px solid #7c5b7d66; border-radius: 0.45rem; background: var(--background); }
  .group-row.selected { border-color: #ab65ad; box-shadow: inset 0 0 0 1px #ab65ad55; }
  .group-row.dragging { opacity: 0.55; }
  .group-grip { width: 1.1rem; height: 1.4rem; justify-self: center; background: currentColor; -webkit-mask: url('/planner/icons/UI/grip-solid-full.svg') center / contain no-repeat; mask: url('/planner/icons/UI/grip-solid-full.svg') center / contain no-repeat; cursor: grab; touch-action: none; }
  .group-grip:active { cursor: grabbing; }
  .group-choice { display: flex; align-items: center; gap: 0.45rem; min-width: 0; padding: 0.45rem 0.25rem; border: 0; background: transparent; color: inherit; text-align: left; }
  .group-choice[aria-current="true"] { color: var(--text); font-weight: 700; }
  .group-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .group-index { flex: none; opacity: 0.65; font-variant-numeric: tabular-nums; }
  .team-size-badge { flex: none; padding: 0.1rem 0.35rem; border: 1px solid #82dafb88; border-radius: 999px; background: #82dafb24; font-size: 0.7rem; line-height: 1.2; }
  .row-actions { display: flex; align-items: center; gap: 0.2rem; }
  .icon-button { display: grid; place-items: center; width: 2.15rem; height: 2.15rem; padding: 0.45rem; }
  .icon { display: block; width: 100%; height: 100%; background: currentColor; }
  .pencil-icon { -webkit-mask: url('/planner/icons/UI/pencil-solid.svg') center / contain no-repeat; mask: url('/planner/icons/UI/pencil-solid.svg') center / contain no-repeat; }
  .trash-icon { -webkit-mask: url('/planner/icons/UI/trash-solid-full.svg') center / contain no-repeat; mask: url('/planner/icons/UI/trash-solid-full.svg') center / contain no-repeat; }
  .delete-button { color: #e77; }
  .rename-form { display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem; min-width: 0; }
  .rename-form input { flex: 1 1 8rem; min-width: 0; width: 100%; }
  .rename-form button { padding: 0.3rem 0.5rem; font-size: 0.85rem; }
  .empty-groups { margin: 0.4rem 0 1rem; opacity: 0.8; }
  footer { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem; }
  .confirmation { min-width: min(22rem, calc(100vw - 3rem)); }
  .error { color: var(--error); }
  @media (max-width: 600px) { .picker-content { min-width: 0; } .group-row { gap: 0.35rem; padding-inline: 0.35rem; } }
</style>
