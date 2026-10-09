<script lang="ts">
  import { tick, onDestroy } from 'svelte';
  import type { PlannerDataset, PlannerMetadata, PlannerSave } from '$lib/domain/planner/types';
  import type { createResourcePlanner } from '$lib/stores/resource-planner';
  import { emptyTeam, groupFingerprint, groupText, isBorrowed, nextEmptySlot, readTeams, slotId, type SlotLocation } from '$lib/domain/planner/groups';
  import { sortable, type DragState } from './sortable';
  import CharacterPortrait from './CharacterPortrait.svelte';
  import TeamSlotPicker from './TeamSlotPicker.svelte';
  import GroupDialog from './GroupDialog.svelte';
  import { downloadBlob, downloadTeamImage } from '$lib/services/team-screenshot';

  let { data, dataset, metadata, names, scribble, actions, error, selected = $bindable(''), t }: {
    data: PlannerSave; dataset: PlannerDataset; metadata: PlannerMetadata; names: Record<string, string>;
    scribble: boolean; actions: ReturnType<typeof createResourcePlanner>; error: string;
    selected?: string; t: (id: string) => string;
  } = $props();
  let mode = $state<'edit' | 'move' | 'remove'>('edit');
  const modes: ('edit' | 'move' | 'remove')[] = ['edit', 'move', 'remove'];
  let management = $state<'' | 'create' | 'rename' | 'order' | 'delete'>('');
  let picking = $state<{ name: string; expected: string; location: SlotLocation } | null>(null);
  let swapping = $state<{ location: SlotLocation; expected: string } | null>(null);
  let drag = $state<DragState | null>(null);
  let removing = $state<number | null>(null);
  let localError = $state('');
  let copied = $state(false);
  let monospaced = $state(true);
  let capturing = $state(false);
  let capture = $state<HTMLDivElement>();
  let pickerAnchor = $state<HTMLButtonElement>();
  let active = true;
  onDestroy(() => { active = false; });
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
  $effect(() => {
    if (selected && !Object.hasOwn(data.groups, selected)) selected = '';
  });
  $effect(() => { selected; expected; swapping = null; removing = null; copied = false; });
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
  function canDrop(source: string, target: string) { return (location(source).slot < 4) === (location(target).slot < 4); }
  function showDrag(value: DragState | null) { drag = value; if (value) picking = null; }
  function swap(value: DragState) { actions.swapTeamSlots(selected, expected, location(value.source), location(value.target)); }
  function activate(at: SlotLocation) {
    if (picking?.location.team === at.team && picking.location.slot === at.slot) { picking = null; return; }
    if (mode === 'remove') { actions.teamSlot(selected, expected, at, null); return; }
    if (swapping) {
      if (actions.swapTeamSlots(selected, swapping.expected, swapping.location, at)) swapping = null;
      return;
    }
    if (mode === 'move' && view.teams[at.team][at.slot]) swapping = { location: at, expected };
    else picking = { name: selected, expected, location: at };
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
    if (!(event.altKey || mode === 'move') || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const slot = at.slot + (event.key === 'ArrowRight' ? 1 : -1);
    if (slot < 0 || slot >= 6 || (slot < 4) !== (at.slot < 4)) return;
    if (actions.swapTeamSlots(selected, expected, at, { ...at, slot })) {
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
</script>

<section aria-labelledby="team-editor-heading">
  <h2 id="team-editor-heading">{t('footer-teamseditor')}</h2>
  <div class="toolbar">
    <label>{t('label-group')}<select bind:value={selected}><option value="">{t('ui-select-group')}</option>
      {#each Object.keys(data.groups) as name, index}<option value={name}>{index + 1}. {name}</option>{/each}
    </select></label>
    <button onclick={() => management = 'create'}>{t('ui-group-create')}</button>
    <button disabled={!selected} onclick={() => management = 'rename'}>{t('ui-group-rename')}</button>
    <button disabled={!selected} onclick={() => management = 'order'}>{t('ui-group-order')}</button>
    <button disabled={!selected} onclick={() => management = 'delete'}>{t('ui-group-delete')}</button>
  </div>
  {#if error || localError || view.error}<p class="error" role="alert">{error || localError || view.error}</p>{/if}
  {#if selected && !view.error}
    <div class="toolbar">
      <div role="group" aria-label={t('ui-team-mode')}>
        {#each modes as item}
          <button aria-pressed={mode === item} onclick={() => { mode = item; swapping = null; }}>{t(`ui-team-mode-${item}`)}</button>
        {/each}
      </div>
      <button disabled={view.teams.length >= 50} onclick={() => actions.addTeam(selected, expected)}>{t('ui-add-team')}</button>
      <button disabled={capturing} onclick={image}>{t(capturing ? 'ui-team-exporting' : 'ui-team-image')}</button>
    </div>
    <p class="help">{t('ui-team-move-help')}</p>
    {#if swapping}<p role="status">{t('ui-team-swap-prompt')}<button onclick={() => swapping = null}>{t('label-cancel')}</button></p>{/if}
    <div id="team-capture" class="capture" bind:this={capture}
      use:sortable={{ mode: mode === 'remove' ? 'disable' : mode, change: showDrag, drop: swap, canStart, canDrop }}>
      <h3>{selected}</h3>
      {#each view.teams as team, teamIndex}
        <div class="team">
          <div class="team-label"><strong>{t('ui-team')} {teamIndex + 1}</strong>
            <span data-html2canvas-ignore>
              <button disabled={teamIndex === 0} aria-label={`${t('ui-move-up')} ${t('ui-team')} ${teamIndex + 1}`} onclick={() => actions.moveTeam(selected, expected, teamIndex, -1)}>&uarr;</button>
              <button disabled={teamIndex === view.teams.length - 1} aria-label={`${t('ui-move-down')} ${t('ui-team')} ${teamIndex + 1}`} onclick={() => actions.moveTeam(selected, expected, teamIndex, 1)}>&darr;</button>
              <button aria-label={`${t('ui-remove-team')} ${teamIndex + 1}`} onclick={() => removing = teamIndex}>{t('ui-remove')}</button>
            </span>
          </div>
          {#if removing === teamIndex}
            <p data-html2canvas-ignore role="alert">{t('ui-team-remove-confirm')}
              <button onclick={() => { if (actions.removeTeam(selected, expected, teamIndex)) removing = null; }}>{t('ui-confirm-remove')}</button>
              <button onclick={() => removing = null}>{t('label-cancel')}</button>
            </p>
          {/if}
          <div class="roles">
            {#each [{ start: 0, end: 4, label: 'Striker' }, { start: 4, end: 6, label: 'Special' }] as role}
              <div><span class="role-label">{role.label}</span><div class="slots">
                {#each team.slice(role.start, role.end) as slot, local}
                  {@const index = local + role.start}
                  {@const id = slotId(slot)}
                  <button class="slot" class:move-mode={mode === 'move'} class:dragging={drag?.source === `${teamIndex}:${index}`}
                    class:picker-active={picking?.location.team === teamIndex && picking.location.slot === index}
                    aria-expanded={picking?.location.team === teamIndex && picking.location.slot === index}
                    class:drop={drag?.target === `${teamIndex}:${index}` && drag.source !== drag.target}
                    class:swap-selected={swapping?.location.team === teamIndex && swapping.location.slot === index}
                    data-sort-id={`${teamIndex}:${index}`}
                    aria-label={`${t('ui-team')} ${teamIndex + 1}, ${role.label} ${local + 1}, ${id ? names[id] ?? id : t('ui-empty-slot')}${isBorrowed(slot) ? ', ' + t('label-borrowed') : ''}`}
                    onclick={() => activate({ team: teamIndex, slot: index })}
                    onkeydown={(event) => { void keyMove(event, { team: teamIndex, slot: index }); }}
                    oncontextmenu={(event) => { event.preventDefault(); picking = { name: selected, expected, location: { team: teamIndex, slot: index } }; }}>
                    {#if id}
                      <CharacterPortrait {id} name={names[id] ?? id} {metadata} {scribble} borrowed={isBorrowed(slot)}
                        borrowedLabel={t('label-borrowed')}
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
    <details class="exports"><summary>{t('ui-team-text')}</summary>
      <label><input type="checkbox" bind:checked={monospaced} />{t('text-monospaced')}</label>
      <textarea aria-label={t('ui-team-text')} rows="8" readonly value={text}></textarea>
      <button onclick={() => downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${selected}.txt`)}>{t('ui-download-text')}</button>
      <button onclick={async () => {
        try { await navigator.clipboard.writeText(text); copied = true; localError = ''; }
        catch (problem) { console.error('Team text copy failed.', problem); localError = problem instanceof Error ? problem.message : t('ui-team-export-error'); }
      }}>{t('ui-copy-text')}</button>
      {#if copied}<span role="status">{t('ui-text-copied')}</span>{/if}
    </details>
  {:else if !selected}<p>{t('ui-select-group')}</p>{/if}
</section>

{#if management}
  <GroupDialog action={management} {selected} groups={data.groups} save={actions.group} changed={(name) => selected = name}
    close={() => management = ''} {error} {t} />
{/if}
{#if picking && pickerAnchor && capture}
  <TeamSlotPicker teams={view.teams} location={picking.location} {dataset} {names} {metadata}
    anchor={pickerAnchor} slots={capture}
    assign={(id, borrowed) => picking !== null && actions.teamSlot(picking.name, picking.expected, picking.location, id, borrowed)}
    choose={chooseNext}
    close={() => picking = null} {error} {t} />
{/if}

<style>
  section { padding-bottom: 5rem; }
  .toolbar { display: flex; flex-wrap: wrap; align-items: end; gap: 0.5rem; margin: 0.75rem 0; }
  .toolbar label { display: flex; flex-direction: column; gap: 0.3rem; max-width: 100%; min-width: 0; }
  select { max-width: 100%; min-width: 0; }
  h3 { overflow-wrap: anywhere; }
  button[aria-pressed="true"] { background: #7c5b7d; color: white; }
  .help { font-size: 0.85rem; line-height: 1.5; }
  .capture { --card-size: 130px; padding: 0.75rem; background: var(--background); }
  .team { margin: 1rem 0; padding: 0.5rem; border-bottom: 1px solid #7c5b7d; }
  .team-label { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
  .team-label button { padding: 0.2rem 0.45rem; font-size: 0.8rem; }
  .roles { display: flex; flex-wrap: wrap; gap: 1.25rem; }
  .role-label { display: block; font-size: 0.8rem; margin-bottom: 0.25rem; opacity: 0.8; }
  .slots { display: flex; gap: 0.5rem; }
  .slot { width: var(--card-size); aspect-ratio: 8 / 9; padding: 0; border: 2px solid #7c5b7d; border-radius: 16%; background: var(--surface); color: inherit; user-select: none; }
  .plus { font-size: 2rem; }
  .move-mode { touch-action: none; cursor: grab; }
  .dragging { opacity: 0.5; }
  .drop, .swap-selected, .picker-active { outline: 3px solid #82dafb; outline-offset: 2px; }
  .exports textarea { display: block; width: 100%; margin: 0.6rem 0; padding: 0.5rem; font-family: monospace; }
  .error { color: var(--error); }
  @media (max-width: 620px) { .capture { --card-size: 65px; padding: 0.25rem; } .team { padding: 0.25rem; } .roles { gap: 0.75rem; } .slots { gap: 0.3rem; } }
</style>
