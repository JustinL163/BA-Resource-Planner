<script lang="ts">
  import { tick, onDestroy, onMount } from 'svelte';
  import type { PlannerDataset, PlannerMetadata, PlannerSave } from '$lib/domain/planner/types';
  import type { createResourcePlanner } from '$lib/stores/resource-planner';
  import { canSwapSlots, emptyTeam, groupFingerprint, groupText, isBorrowed, nextEmptySlot, readTeams, slotId, type SlotLocation } from '$lib/domain/planner/groups';
  import { sortable, sortableTeams, type DragState } from './sortable';
  import CharacterPortrait from './CharacterPortrait.svelte';
  import TeamSlotPicker from './TeamSlotPicker.svelte';
  import GroupPickerDialog from './GroupPickerDialog.svelte';
  import { downloadBlob, downloadTeamImage } from '$lib/services/team-screenshot';

  let { data, dataset, metadata, names, scribble, actions, error, selected = $bindable(''), t }: {
    data: PlannerSave; dataset: PlannerDataset; metadata: PlannerMetadata; names: Record<string, string>;
    scribble: boolean; actions: ReturnType<typeof createResourcePlanner>; error: string;
    selected?: string; t: (id: string) => string;
  } = $props();
  let groupPickerOpen = $state(false);
  let picking = $state<{ name: string; expected: string; location: SlotLocation } | null>(null);
  let drag = $state<DragState | null>(null);
  let teamDrag = $state<number | null>(null);
  let removing = $state<number | null>(null);
  let displayedInfo = $state<'all' | 'current' | 'none'>('all');
  let displayedInfoReady = $state(false);
  const displayedInfoStorageKey = 'teams-editor-displayed-info';
  let removeTimer: ReturnType<typeof setTimeout> | null = null;
  let localError = $state('');
  let copied = $state(false);
  let monospaced = $state(true);
  let capturing = $state(false);
  let capture = $state<HTMLDivElement>();
  let exportTextArea = $state<HTMLTextAreaElement>();
  let pickerAnchor = $state<HTMLButtonElement>();
  let active = true;
  onMount(() => {
    try {
      const saved = window.localStorage.getItem(displayedInfoStorageKey);
      if (saved === 'all' || saved === 'current' || saved === 'none') displayedInfo = saved;
    } catch {
      // Keep the default if local storage is unavailable.
    }
    displayedInfoReady = true;
  });
  onDestroy(() => {
    active = false;
    if (removeTimer !== null) clearTimeout(removeTimer);
  });
  let view = $derived.by(() => {
    try {
      if (!selected || !Object.hasOwn(data.groups, selected)) return { teams: [], error: '' };
      const teams = readTeams(data.groups[selected]);
      return { teams: teams.length ? teams : [emptyTeam()], error: '' };
    } catch (problem) {
      return { teams: [], error: problem instanceof Error ? problem.message : t('ui-team-invalid') };
    }
  });
  let expected = $derived(groupFingerprint(data.groups[selected]));
  let text = $derived(view.error ? '' : groupText(view.teams, data.characters, names, monospaced));
  let textColumns = $derived(Math.max(1, ...text.split('\n').map((line) => line.length)) + 2);
  $effect(() => {
    if (selected && !Object.hasOwn(data.groups, selected)) selected = '';
    if (!selected) groupPickerOpen = true;
  });
  $effect(() => { selected; expected; clearRemoveConfirmation(); teamDrag = null; copied = false; });
  $effect(() => {
    if (!displayedInfoReady) return;
    try {
      window.localStorage.setItem(displayedInfoStorageKey, displayedInfo);
    } catch {
      // The selection remains usable for this session if persistence is unavailable.
    }
  });
  $effect(() => {
    const at = picking?.location;
    const anchor = at && capture?.querySelector<HTMLButtonElement>(`[data-sort-id="${at.team}:${at.slot}"]`);
    if (picking && (picking.name !== selected || view.error || !anchor)) picking = null;
    pickerAnchor = anchor || undefined;
  });

  const location = (id: string): SlotLocation => {
    const [team, slot] = id.split(':').map(Number);
    return { team, slot };
  };
  function canStart(id: string) {
    const at = location(id);
    return Boolean(view.teams[at.team]?.[at.slot]);
  }
  function canDrop(source: string, target: string) { return canSwapSlots(view.teams, location(source), location(target)); }
  function showDrag(value: DragState | null) { drag = value; if (value) picking = null; }
  function showTeamDrag(source: number | null) { teamDrag = source; if (source !== null) picking = null; }
  function swap(value: DragState) { actions.swapTeamSlots(selected, expected, location(value.source), location(value.target)); }
  function reorderTeam(source: number, target: number) { actions.moveTeamTo(selected, expected, source, target); }
  function clearRemoveConfirmation() {
    if (removeTimer !== null) clearTimeout(removeTimer);
    removeTimer = null;
    removing = null;
  }
  function renameGroup(previous: string, next: string) {
    if (selected === previous) selected = next;
  }
  function deleteGroup(name: string, fallback: string) {
    if (selected === name) selected = fallback;
  }
  function removeTeam(index: number) {
    const isEmpty = view.teams[index]?.every((slot) => !slotId(slot)) ?? false;
    if (isEmpty || removing === index) {
      clearRemoveConfirmation();
      actions.removeTeam(selected, expected, index);
      return;
    }
    clearRemoveConfirmation();
    removing = index;
    removeTimer = setTimeout(() => {
      removeTimer = null;
      if (removing === index) removing = null;
    }, 3000);
  }
  function activate(at: SlotLocation) {
    if (picking?.location.team === at.team && picking.location.slot === at.slot) { picking = null; return; }
    picking = { name: selected, expected, location: at };
  }
  async function chooseNext(id: string, borrowed: boolean): Promise<boolean> {
    const selection = picking;
    if (!selection || !actions.teamSlot(selection.name, selection.expected, selection.location, id, borrowed)) return false;
    await tick();
    if (picking !== selection) return true;
    const next = selected === selection.name && !view.error ? nextEmptySlot(view.teams, selection.location) : null;
    picking = next ? { name: selection.name, expected, location: next } : null;
    return true;
  }
  async function keyMove(event: KeyboardEvent, at: SlotLocation) {
    if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const slot = at.slot + (event.key === 'ArrowRight' ? 1 : -1);
    if (slot < 0 || slot >= 6 || (slot < 4) !== (at.slot < 4)) return;
    const destination = { ...at, slot };
    if (canSwapSlots(view.teams, at, destination) && actions.swapTeamSlots(selected, expected, at, destination)) {
      await tick();
      capture?.querySelector<HTMLButtonElement>(`[data-sort-id="${at.team}:${slot}"]`)?.focus({ preventScroll: true });
    }
  }
  async function image() {
    if (!capture) return;
    capturing = true; localError = '';
    const name = selected;
    const snapshot = JSON.stringify([data.groups[name], data.characters, names, scribble]);
    try {
      await downloadTeamImage(capture, name, () => active && selected === name &&
        JSON.stringify([data.groups[name], data.characters, names, scribble]) === snapshot);
    }
    catch (problem) {
      console.error('Team screenshot failed.', problem);
      localError = problem instanceof Error ? problem.message : t('ui-team-export-error');
    } finally { capturing = false; }
  }
  function copyFromTextarea() {
    if (!exportTextArea) return false;
    try {
      exportTextArea.focus({ preventScroll: true });
      exportTextArea.select();
      exportTextArea.setSelectionRange(0, exportTextArea.value.length);
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
  async function copyText() {
    let clipboardError: unknown;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
        localError = '';
        return;
      }
    } catch (problem) {
      clipboardError = problem;
    }
    if (copyFromTextarea()) {
      copied = true;
      localError = '';
      return;
    }
    const problem = clipboardError ?? new Error('Clipboard access is unavailable. Select the export text and copy it manually.');
    console.error('Team text copy failed.', problem);
    localError = problem instanceof Error ? problem.message : t('ui-team-export-error');
  }
</script>

<section aria-labelledby="team-editor-heading">
  <h2 id="team-editor-heading">{t('footer-teamseditor')}</h2>
  <div class="toolbar">
    <div class="group-picker-control">
      <span>{t('label-group')}</span>
      <button class="group-picker-trigger" aria-haspopup="dialog" aria-expanded={groupPickerOpen}
        onclick={() => groupPickerOpen = true}>
        <span>{selected || t('ui-select-group')}</span><span class="group-picker-caret" aria-hidden="true">▾</span>
      </button>
    </div>
    {#if selected && !view.error}
      <label>{t('ui-displayed-info')}<select bind:value={displayedInfo}>
        <option value="all">{t('label-all')}</option>
        <option value="current">{t('label-current')}</option>
        <option value="none">{t('label-none')}</option>
      </select></label>
      <button disabled={capturing} onclick={image}>{t(capturing ? 'ui-team-exporting' : 'ui-team-image')}</button>
    {/if}
  </div>
  {#if error || localError || view.error}<p class="error" role="alert">{error || localError || view.error}</p>{/if}
  {#if selected && !view.error}
    <p class="help">{t('ui-team-move-help')}</p>
    <div id="team-capture" class="capture" bind:this={capture}
      use:sortable={{ mode: 'edit', change: showDrag, drop: swap, canStart, canDrop }}>
      <h3>{selected}</h3>
      <div class="teams-list" use:sortableTeams={{ change: showTeamDrag, drop: reorderTeam }}>
      {#each view.teams as team, teamIndex}
        <div class="team" class:team-dragging={teamDrag === teamIndex}
          class:team-drop-target={teamDrag !== null && teamDrag !== teamIndex} data-team-index={teamIndex}>
          <div class="team-label">
            <span class="team-drag-handle" oncontextmenu={(event) => event.preventDefault()}>
              <strong>{t('ui-team')} {teamIndex + 1}</strong>
              <span class="team-grip" aria-hidden="true" data-html2canvas-ignore></span>
            </span>
            <span data-html2canvas-ignore>
              <button disabled={view.teams.length >= 50}
                aria-label={`${t('ui-add-team-below')} ${t('ui-team')} ${teamIndex + 1}`}
                title={t('ui-add-team-below')} onclick={() => actions.addTeamAfter(selected, expected, teamIndex)}>+</button>
              <button class:boundary-hidden={teamIndex === 0} disabled={teamIndex === 0}
                aria-label={`${t('ui-move-up')} ${t('ui-team')} ${teamIndex + 1}`} onclick={() => actions.moveTeam(selected, expected, teamIndex, -1)}>&uarr;</button>
              <button class:boundary-hidden={teamIndex === view.teams.length - 1} disabled={teamIndex === view.teams.length - 1}
                aria-label={`${t('ui-move-down')} ${t('ui-team')} ${teamIndex + 1}`} onclick={() => actions.moveTeam(selected, expected, teamIndex, 1)}>&darr;</button>
              <button aria-label={`${t(removing === teamIndex ? 'ui-confirm' : 'ui-remove-team')} ${t('ui-team')} ${teamIndex + 1}`}
                onclick={() => removeTeam(teamIndex)}>{t(removing === teamIndex ? 'ui-confirm' : 'ui-remove')}</button>
            </span>
          </div>
          <div class="roles">
            {#each [{ start: 0, end: 4, label: 'Striker' }, { start: 4, end: 6, label: 'Special' }] as role}
              <div><span class="role-label">{role.label}</span><div class="slots">
                {#each team.slice(role.start, role.end) as slot, local}
                  {@const index = local + role.start}
                  {@const id = slotId(slot)}
                  <button class="slot" class:dragging={drag?.source === `${teamIndex}:${index}`}
                    class:picker-active={picking?.location.team === teamIndex && picking.location.slot === index}
                    aria-expanded={picking?.location.team === teamIndex && picking.location.slot === index}
                    class:valid-drop-target={drag !== null && drag.source !== `${teamIndex}:${index}` && drag.target !== `${teamIndex}:${index}` && canDrop(drag.source, `${teamIndex}:${index}`)}
                    class:drop={drag?.target === `${teamIndex}:${index}` && drag.source !== drag.target}
                    data-sort-id={`${teamIndex}:${index}`}
                    aria-label={`${t('ui-team')} ${teamIndex + 1}, ${role.label} ${local + 1}, ${id ? names[id] ?? id : t('ui-empty-slot')}${isBorrowed(slot) ? ', ' + t('label-borrowed') : ''}`}
                    onclick={() => activate({ team: teamIndex, slot: index })}
                    onkeydown={(event) => { void keyMove(event, { team: teamIndex, slot: index }); }}
                    oncontextmenu={(event) => event.preventDefault()}>
                    {#if id}
                      <CharacterPortrait {id} name={names[id] ?? id} {metadata} {scribble} borrowed={isBorrowed(slot)}
                        borrowedLabel={t('label-borrowed')} {displayedInfo}
                        character={data.characters.find((character) => character.id === id)} />
                    {:else}<span class="plus">+</span>{/if}
                  </button>
                {/each}
              </div></div>
            {/each}
          </div>
        </div>
      {/each}
      </div>
    </div>
    <details class="exports"><summary>{t('ui-team-text')}</summary>
      <label><input type="checkbox" bind:checked={monospaced} />{t('text-monospaced')}</label>
      <textarea aria-label={t('ui-team-text')} rows="8" cols={textColumns} wrap="off" readonly bind:this={exportTextArea} value={text}></textarea>
      <button onclick={() => downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${selected}.txt`)}>{t('ui-download-text')}</button>
      <button onclick={copyText}>{t('ui-copy-text')}</button>
      {#if copied}<span role="status">{t('ui-text-copied')}</span>{/if}
    </details>
  {/if}
</section>

{#if groupPickerOpen}
  <GroupPickerDialog groups={data.groups} {selected} save={actions.group}
    choose={(name) => { selected = name; groupPickerOpen = false; }}
    renamed={renameGroup} deleted={deleteGroup} created={(name) => selected = name}
    close={() => groupPickerOpen = false} {error} {t} />
{/if}
{#if picking && pickerAnchor && capture}
  <TeamSlotPicker teams={view.teams} location={picking.location} {dataset} {names} {metadata}
    anchor={pickerAnchor} slots={capture}
    assign={(id, borrowed) => picking !== null && actions.teamSlot(picking.name, picking.expected, picking.location, id, borrowed)}
    choose={chooseNext}
    close={() => picking = null} {error} {t} />
{/if}

<style>
  section { justify-self: anchor-center; padding-bottom: 5rem; }
  .toolbar { display: flex; flex-wrap: wrap; align-items: end; gap: 0.5rem; margin: 0.75rem 0; }
  .toolbar label { display: flex; flex-direction: column; gap: 0.3rem; max-width: 100%; min-width: 0; }
  .group-picker-control { display: flex; flex-direction: column; gap: 0.3rem; min-width: min(18rem, 100%); max-width: 100%; }
  .group-picker-trigger { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-width: 12rem; max-width: 100%; text-align: left; }
  .group-picker-trigger > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .group-picker-caret { flex: none; }
  select { max-width: 100%; min-width: 0; }
  h3 { overflow-wrap: anywhere; margin: 0;}
  button[aria-pressed="true"] { background: #7c5b7d; color: white; }
  .help { font-size: 0.85rem; line-height: 1.5; }
  .capture { --card-size: 130px; padding: 0.75rem; background: var(--background); width: fit-content;}
  .team { padding: 0.5rem; border-bottom: 1px solid #7c5b7d; width: fit-content; }
  .team-dragging { opacity: 0.5; }
  .team-drag-handle { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.2rem 0.35rem; border-radius: 0.3rem; cursor: grab; touch-action: none; user-select: none; }
  .team-drag-handle:hover { background: #82dafb22; }
  .team-drag-handle:active { cursor: grabbing; }
  .team-grip { width: 2rem; height: 2rem; background-color: currentColor; -webkit-mask: url('/planner/icons/UI/grip-solid-full.svg') center / contain no-repeat; mask: url('/planner/icons/UI/grip-solid-full.svg') center / contain no-repeat; }
  .team-label { display: flex; align-items: center; justify-content: space-between; }
  .team-drop-target { background: #82dafb2e; outline: 2px dashed #82dafb; outline-offset: 3px; box-shadow: 0 0 0 3px #82dafb24; border-radius: 0.5rem; }
  .team-label button { padding: 0.2rem 0.45rem; font-size: 0.8rem; }
  .team-label button.boundary-hidden { visibility: hidden; }
  .roles { display: flex; flex-wrap: wrap; gap: 1.25rem; justify-content: center; }
  .role-label { display: block; font-size: 0.8rem; margin-bottom: 0.45rem; opacity: 0.8; }
  .slots { display: flex; gap: 0.5rem; }
  .slot { width: var(--card-size); aspect-ratio: 8 / 9; padding: 0; border: 2px solid #7c5b7d; border-radius: 16%; background: var(--surface); color: inherit; touch-action: none; cursor: grab; user-select: none; }
  .slot.valid-drop-target { border: 2px dashed #82dafb; }
  .plus { font-size: 2rem; }
  .slot:active { cursor: grabbing; }
  .dragging { opacity: 0.5; }
  .drop, .picker-active { outline: 3px solid #82dafb; outline-offset: 2px; }
  :global(.team-sortable-fallback) { opacity: 0.95; filter: drop-shadow(0 3px 8px #0008); pointer-events: none; }
  :global(.team-order-fallback) { opacity: 0.95; filter: drop-shadow(0 3px 8px #0008); pointer-events: none; }
  :global(.sortable-swap-highlight) { outline: 3px solid #82dafb; outline-offset: 2px; }
  .exports textarea { display: block; width: auto; max-width: 100%; box-sizing: border-box; resize: vertical; margin: 0.6rem 0; padding: 0.5rem; font-family: monospace; -webkit-user-select: text; user-select: text; }
  .error { color: var(--error); }
  @media (max-width: 600px) {
    .capture { --card-size: 80px; padding: 0.25rem; }
    .team { padding: 0.25rem; }
    .roles { gap: 0.25rem; }
    .role-label { margin-bottom: 0.25rem; }
    .slots { gap: 0.3rem; }
    .slot, .team-drag-handle { touch-action: pan-y; }
    .exports textarea { max-width: min(90vw, 32rem); }
  }
</style>
