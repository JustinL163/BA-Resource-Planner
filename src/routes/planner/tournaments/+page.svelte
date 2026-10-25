<script lang="ts">
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import { onDestroy, onMount, tick } from 'svelte';
  import { metadata } from '$content/planner';
  import aliases from '$content/search-aliases.json';
  import strings from '$content/strings.json';
  import PlannerDialog from '$lib/components/planner/PlannerDialog.svelte';
  import RaidCharacterSearch from '$lib/components/planner/RaidCharacterSearch.svelte';
  import { anchoredPicker } from '$lib/components/planner/anchored-picker';
  import { getLanguageString } from '$lib/domain/localisation';
  import {
    createStudentSearchIndex, type StudentSearchIndex
  } from '$lib/domain/planner/student-search';
  import type {
    TournamentForm, TournamentRecord, TournamentSelection, TournamentSlot, TournamentTeam
  } from '$lib/domain/tournament';
  import {
    createTournamentForm, decodeTournamentRecords, emptyTournamentTeam, exportTournamentCsv,
    findTournamentRecord, tournamentArmours, tournamentFormFromRecord, tournamentGames,
    tournamentStages, tournamentOptions, updateTournamentRecords, validateTournamentSubmission
  } from '$lib/domain/tournament';
  import { fetchJson } from '$lib/services/planner-data';
  import { fetchTournamentRecords, submitTournamentRecord } from '$lib/services/tournament-api';
  import { preferences } from '$lib/stores/preferences';

  type Student = { Name: string; SquadType: string };
  type TeamField = 'Player1Teams' | 'Player2Teams';
  type BanField = 'Player1Bans' | 'Player2Bans';
  type PickerTarget =
    | { kind: 'force' }
    | { kind: 'ban'; field: BanField; slot: number }
    | { kind: 'team'; field: TeamField; team: number; slot: number };

  let form = $state<TournamentForm>(createTournamentForm());
  let records = $state<TournamentRecord[]>([]);
  let students = $state<Record<string, Student>>({});
  let studentNames = $state<Record<string, string>>({});
  let pageReady = $state(false);
  let loadingStudents = $state(true);
  let pageError = $state('');
  let actionError = $state('');
  let statusMessage = $state('');
  let loading = $state(false);
  let saving = $state(false);
  let password = $state('');
  let pickerTarget = $state<PickerTarget | null>(null);
  let pickerAnchor = $state<HTMLButtonElement | null>(null);
  let pickerSlots = $state<HTMLElement | null>(null);
  let pickerPanel = $state<HTMLDialogElement>();
  let pickerBorrowed = $state(false);
  let restorePickerFocus = true;
  let confirmingSave = $state(false);
  let lastLoadAt = $state<number | null>(null);
  let lastSaveAt = $state<number | null>(null);
  let clock = $state(Date.now());

  const t = (id: string) => getLanguageString(strings, id, $preferences.language);
  const searchIndex: StudentSearchIndex = $derived(createStudentSearchIndex(students, studentNames, aliases, 'En'));
  const exportNames = $derived.by(() => {
    const result = Object.fromEntries(Object.entries(students).map(([id, student]) => [id, student.Name]));
    for (const [id, value] of Object.entries(aliases)) {
      const english = (value as { EN?: unknown }).EN;
      if (Array.isArray(english) && typeof english[0] === 'string') result[id] = english[0];
    }
    return result;
  });
  const showBorrow = $derived.by(() => pickerTarget?.kind === 'team' && !otherBorrowedExists());
  const effectiveBorrow = $derived(pickerTarget?.kind === 'team' && pickerBorrowed && !otherBorrowedExists());
  const searchAllowed = $derived.by(() => {
    const target = pickerTarget;
    if (!target) return new Set<string>();
    if (target.kind !== 'team') return new Set(Object.keys(students));

    const teams = form[target.field];
    const team = teams[target.team] ?? [];
    const inSameTeam = new Set(team.flatMap((slot, index) => index === target.slot ? [] : slot ? [slotId(slot)] : []));
    const usedRegular = new Set(teams.flatMap((entry, teamIndex) => entry.flatMap((slot, index) =>
      slot !== null && !(teamIndex === target.team && index === target.slot) && !isBorrowed(slot) ? [slotId(slot)] : []
    )));
    const role = target.slot < 4 ? 'Main' : 'Support';
    return new Set(Object.entries(students).filter(([id, student]) =>
      student.SquadType === role && !inSameTeam.has(id) && (effectiveBorrow || !usedRegular.has(id))
    ).map(([id]) => id));
  });
  const loadAge = $derived(lastLoadAt === null ? 'Data not loaded' : `Last data update: ${Math.floor((clock - lastLoadAt) / 1000)}s`);

  onMount(() => {
    const controller = new AbortController();
    const timer = window.setInterval(() => { clock = Date.now(); }, 1000);
    void loadStudents(controller.signal);
    try {
      const remembered = localStorage.getItem('TournamentPassword');
      if (remembered) {
        password = remembered;
        lastLoadAt = Date.now();
        void loadData(false, true);
      }
    } catch {
      actionError = 'Unable to read the saved tournament password from this browser.';
    }
    pageReady = true;
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  });

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  async function loadStudents(signal: AbortSignal) {
    try {
      const value = await fetchJson('/planner/json/skillinfo/en.json', signal);
      if (!isRecord(value)) throw new Error('Character data has an invalid format.');
      const result: Record<string, Student> = {};
      for (const [id, raw] of Object.entries(value)) {
        if (!isRecord(raw) || typeof raw.Name !== 'string' || typeof raw.SquadType !== 'string') {
          throw new Error(`Invalid character definition: ${id}.`);
        }
        result[id] = { Name: raw.Name, SquadType: raw.SquadType };
      }
      students = result;
      studentNames = Object.fromEntries(Object.entries(result).map(([id, student]) => [id, student.Name]));
    } catch (error) {
      if (!signal.aborted) pageError = error instanceof Error ? error.message : 'Could not load character data.';
    } finally {
      if (!signal.aborted) loadingStudents = false;
    }
  }

  function currentSelection(): TournamentSelection {
    return {
      Tournament: form.Tournament, Stage: form.Stage, Game: form.Game,
      Player1: form.Player1, Player2: form.Player2, Armour: form.Armour
    };
  }

  function clearRecordFields(selection: TournamentSelection) {
    form = {
      ...createTournamentForm(), ...selection,
      Player1Score: '', Player2Score: '', ForcePick: null,
      Player1Bans: Array.from({ length: 5 }, () => null), Player2Bans: Array.from({ length: 5 }, () => null),
      Player1Teams: [emptyTournamentTeam()], Player2Teams: [emptyTournamentTeam()]
    };
  }

  function findSelection() {
    const selection = currentSelection();
    const record = findTournamentRecord(records, selection);
    if (record) form = tournamentFormFromRecord(record);
    else clearRecordFields(selection);
    actionError = '';
  }

  function storePassword() {
    try {
      localStorage.setItem('TournamentPassword', password);
      actionError = '';
    } catch {
      actionError = 'Unable to save the tournament password in this browser.';
    }
  }

  async function loadData(notify: boolean, automatic = false) {
    if (!password) {
      actionError = 'Tournament Password is required';
      return;
    }
    if (loading) return;
    if (!automatic && lastLoadAt !== null && lastLoadAt > Date.now() - 5_000) {
      actionError = 'Wait 5s before loading again';
      return;
    }
    storePassword();
    loading = true;
    actionError = '';
    statusMessage = automatic ? '' : 'Loading';
    if (automatic) lastLoadAt = Date.now();
    try {
      records = await fetchTournamentRecords(password);
      lastLoadAt = Date.now();
      findSelection();
      statusMessage = notify ? 'Successfully updated' : '';
    } catch (error) {
      actionError = error instanceof Error ? error.message : 'Could not load tournament data.';
      statusMessage = '';
    } finally {
      loading = false;
    }
  }

  function requestSave() {
    actionError = '';
    if (!password) {
      actionError = 'Tournament Password is required';
      return;
    }
    if (saving) return;
    if (lastSaveAt !== null && lastSaveAt > Date.now() - 5_000) {
      actionError = 'Wait 5s before saving again';
      return;
    }
    storePassword();
    confirmingSave = true;
  }

  function buildSubmission(): TournamentRecord {
    const teamValues = (teams: TournamentTeam[]): TournamentTeam[] => teams.map((team) =>
      Array.from({ length: 6 }, (_unused, index) => {
        const slot = team[index] ?? null;
        return Array.isArray(slot) ? [String(slot[0])] as [string] : slot === null ? null : String(slot);
      })
    );
    return {
      Tournament: form.Tournament,
      Stage: form.Stage,
      Game: form.Game,
      Player1: form.Player1,
      Player2: form.Player2,
      Armour: form.Armour,
      ForcePick: form.ForcePick,
      Player1Bans: form.Player1Bans.filter((id): id is string => id !== null),
      Player2Bans: form.Player2Bans.filter((id): id is string => id !== null),
      Player1Teams: teamValues(form.Player1Teams),
      Player2Teams: teamValues(form.Player2Teams),
      Player1Score: form.Player1Score,
      Player2Score: form.Player2Score
    };
  }

  async function confirmSave() {
    confirmingSave = false;
    lastSaveAt = Date.now();
    const invalid = validateTournamentSubmission(form);
    if (invalid) {
      actionError = invalid;
      return;
    }
    const submission = buildSubmission();
    saving = true;
    actionError = '';
    statusMessage = 'Saving';
    try {
      await submitTournamentRecord(submission, password);
      records = updateTournamentRecords(records, submission);
      statusMessage = 'Successfully updated';
    } catch (error) {
      actionError = error instanceof Error ? error.message : 'Could not save tournament data.';
      statusMessage = '';
    } finally {
      saving = false;
    }
  }

  function slotId(slot: TournamentSlot): string {
    return Array.isArray(slot) ? slot[0] ?? '' : slot ?? '';
  }

  function isBorrowed(slot: TournamentSlot): boolean {
    return Array.isArray(slot);
  }

  function otherBorrowedExists() {
    const target = pickerTarget;
    if (!target || target.kind !== 'team') return false;
    return form[target.field].some((team, teamIndex) => team.some((slot, index) =>
      slot !== null && isBorrowed(slot) && !(teamIndex === target.team && index === target.slot)
    ));
  }

  function openPicker(target: PickerTarget, anchor: HTMLButtonElement) {
    pickerTarget = target;
    pickerAnchor = anchor;
    pickerSlots = (anchor.closest('.tournament-page') as HTMLElement | null) ?? anchor.parentElement;
    pickerBorrowed = target.kind === 'team' && isBorrowed(form[target.field][target.team]?.[target.slot] ?? null);
    actionError = '';
    restorePickerFocus = true;
    void tick().then(() => pickerPanel?.querySelector<HTMLInputElement>('input[type="search"]')?.focus({ preventScroll: true }));
  }

  function closePicker(restoreFocus = true) {
    restorePickerFocus = restoreFocus;
    pickerTarget = null;
    pickerBorrowed = false;
  }

  onDestroy(() => {
    if (restorePickerFocus && pickerAnchor?.isConnected &&
        (document.activeElement === document.body || pickerPanel?.contains(document.activeElement))) {
      pickerAnchor.focus({ preventScroll: true });
    }
  });

  function clearPickedSlot() {
    const target = pickerTarget;
    if (!target) return;
    if (target.kind === 'force') form = { ...form, ForcePick: null };
    else if (target.kind === 'ban') {
      const bans = [...form[target.field]];
      bans[target.slot] = null;
      form = { ...form, [target.field]: bans };
    } else {
      const teams = form[target.field].map((team) => [...team]);
      teams[target.team][target.slot] = null;
      form = { ...form, [target.field]: teams };
    }
    closePicker();
  }

  function chooseStudent(id: string): boolean {
    const target = pickerTarget;
    if (!target || !searchAllowed.has(id)) return false;
    if (target.kind === 'force') form = { ...form, ForcePick: id };
    else if (target.kind === 'ban') {
      const bans = [...form[target.field]];
      bans[target.slot] = id;
      form = { ...form, [target.field]: bans };
    } else {
      const teams = form[target.field].map((team) => [...team]);
      teams[target.team][target.slot] = effectiveBorrow ? [id] : id;
      form = { ...form, [target.field]: teams };
    }
    closePicker();
    return true;
  }

  function addTeam(field: TeamField) {
    if (form[field].length >= 25) {
      actionError = 'A player can have at most 25 teams.';
      return;
    }
    form = { ...form, [field]: [...form[field], emptyTournamentTeam()] };
    actionError = '';
  }

  function removeTeam(field: TeamField, index: number) {
    form = { ...form, [field]: form[field].filter((_team, position) => position !== index) };
  }

  function moveTeam(field: TeamField, index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= form[field].length) return;
    const teams = [...form[field]];
    [teams[index], teams[target]] = [teams[target], teams[index]];
    form = { ...form, [field]: teams };
  }

  function studentName(id: string | null): string {
    return id ? exportNames[id] ?? students[id]?.Name ?? id : '';
  }

  function portrait(id: string): string {
    return metadata.portraits[id] ?? `/planner/icons/Portrait/Icon_${encodeURIComponent(id)}.webp`;
  }

  function downloadExport() {
    const blob = new Blob([exportTournamentCsv(records, exportNames)], { type: 'application/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `export-${Math.floor(Date.now() / 1000)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <title>Tournaments · Blue Archive Planner</title>
  <meta name="description" content="Browse and update Blue Archive tournament match records." />
</svelte:head>

<section class="tournament-page">
  <header class="page-heading">
    <div><h1>Tournaments</h1><p>Review match records, lineups, bans and scores.</p></div>
    <button type="button" class="export" onclick={downloadExport} aria-label="Export tournament records as CSV" disabled={!pageReady}>Export CSV</button>
  </header>

  {#if pageError}<p class="error" role="alert">{pageError}</p>{/if}
  {#if actionError}<p class="error" role="alert">{actionError}</p>{/if}
  {#if statusMessage}<p class="status" role="status">{statusMessage}</p>{/if}

  <section class="match-settings" aria-label="Match settings">
    <label>Tournament
      <select aria-label="Tournament" bind:value={form.Tournament} onchange={findSelection} disabled={!pageReady}>
        {#each tournamentOptions as [id, label]}<option value={id}>{label}</option>{/each}
      </select>
    </label>
    <label>Stage
      <select aria-label="Stage" bind:value={form.Stage} onchange={findSelection} disabled={!pageReady}>
        {#each tournamentStages as [id, label]}<option value={id}>{label}</option>{/each}
      </select>
    </label>
    <label>Player 1
      <select aria-label="Player 1" bind:value={form.Player1} onchange={findSelection} disabled={!pageReady}>
        <option value="n/a">Select a player</option>
        {#each ['Wiggle', 'airu', 'papi', 'jqjqhqh', 'Meggumi', 'Mario', 'Koto'] as name}<option value={name}>{name}</option>{/each}
      </select>
    </label>
    <label>Player 2
      <select aria-label="Player 2" bind:value={form.Player2} onchange={findSelection} disabled={!pageReady}>
        <option value="n/a">n/a</option>
        {#each ['Wiggle', 'airu', 'papi', 'jqjqhqh', 'Meggumi', 'Mario', 'Koto'] as name}<option value={name}>{name}</option>{/each}
      </select>
    </label>
    <label>Game
      <select aria-label="Game" bind:value={form.Game} onchange={findSelection} disabled={!pageReady}>
        {#each tournamentGames as [id, label]}<option value={id}>{label}</option>{/each}
      </select>
    </label>
    <label>Armour type
      <select aria-label="Armour type" bind:value={form.Armour} onchange={findSelection} disabled={!pageReady}>
        {#each tournamentArmours as [id, label]}<option value={id}>{label}</option>{/each}
      </select>
    </label>
  </section>

  <section class="filters" aria-label="Force pick and bans">
    <div class="pick-field">
      <h2>Force pick</h2>
      <button class="student-slot" type="button" data-sort-id="force-pick" aria-label={`Force pick${form.ForcePick ? `: ${studentName(form.ForcePick)}` : ''}`} onclick={(event) => openPicker({ kind: 'force' }, event.currentTarget)} disabled={!pageReady || loadingStudents}>
        {#if form.ForcePick}<img src={portrait(form.ForcePick)} alt="" /><span>{studentName(form.ForcePick)}</span>{:else}<span class="plus">+</span>{/if}
      </button>
    </div>
    {#each [{ title: 'Player 1 bans', field: 'Player1Bans' as const }, { title: 'Player 2 bans', field: 'Player2Bans' as const }] as group}
      <div class="pick-field">
        <h2>{group.title}</h2>
        <div class="student-slots">
          {#each form[group.field] as id, slot}
            <button class="student-slot" type="button" data-sort-id={`${group.field}-${slot}`} aria-label={`${group.title}, slot ${slot + 1}${id ? `: ${studentName(id)}` : ''}`} onclick={(event) => openPicker({ kind: 'ban', field: group.field, slot }, event.currentTarget)} disabled={!pageReady || loadingStudents}>
              {#if id}<img src={portrait(id)} alt="" /><span>{studentName(id)}</span>{:else}<span class="plus">+</span>{/if}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </section>

  <section class="team-lists" aria-label="Player teams">
    {#each [{ label: 'Player 1 teams', field: 'Player1Teams' as const }, { label: 'Player 2 teams', field: 'Player2Teams' as const }] as player}
      <section class="player-teams">
        <div class="section-heading"><h2>{player.label}</h2><button type="button" onclick={() => addTeam(player.field)} disabled={!pageReady}>Add team</button></div>
        <div class="team-list">
          {#each form[player.field] as team, teamIndex}
            <article class="team" aria-label={`Team ${teamIndex + 1}`}>
              <span class="team-number">{teamIndex + 1}</span>
              <div class="role-slots" aria-label="Strikers">
                {#each team.slice(0, 4) as slot, slotIndex}
                  {@const id = slotId(slot)}
                  <button class="team-slot" type="button" data-sort-id={`${player.field}-${teamIndex}-${slotIndex}`} aria-label={`${player.label}, team ${teamIndex + 1}, striker ${slotIndex + 1}${id ? `: ${studentName(id)}${isBorrowed(slot) ? ', borrowed' : ''}` : ''}`} title={id ? `${studentName(id)}${isBorrowed(slot) ? ' · Borrowed' : ''}` : 'Choose striker'} onclick={(event) => openPicker({ kind: 'team', field: player.field, team: teamIndex, slot: slotIndex }, event.currentTarget)} disabled={!pageReady || loadingStudents}>
                    {#if id}<img src={portrait(id)} alt="" />{#if isBorrowed(slot)}<span class="borrow-mark">A</span>{/if}{:else}<span class="plus">+</span>{/if}
                  </button>
                {/each}
              </div>
              <div class="role-slots specials" aria-label="Specials">
                {#each team.slice(4, 6) as slot, offset}
                  {@const slotIndex = offset + 4}
                  {@const id = slotId(slot)}
                  <button class="team-slot" type="button" data-sort-id={`${player.field}-${teamIndex}-${slotIndex}`} aria-label={`${player.label}, team ${teamIndex + 1}, special ${offset + 1}${id ? `: ${studentName(id)}${isBorrowed(slot) ? ', borrowed' : ''}` : ''}`} title={id ? `${studentName(id)}${isBorrowed(slot) ? ' · Borrowed' : ''}` : 'Choose special'} onclick={(event) => openPicker({ kind: 'team', field: player.field, team: teamIndex, slot: slotIndex }, event.currentTarget)} disabled={!pageReady || loadingStudents}>
                    {#if id}<img src={portrait(id)} alt="" />{#if isBorrowed(slot)}<span class="borrow-mark">A</span>{/if}{:else}<span class="plus">+</span>{/if}
                  </button>
                {/each}
              </div>
              <div class="team-actions">
                <button type="button" aria-label={`Move team ${teamIndex + 1} up`} onclick={() => moveTeam(player.field, teamIndex, -1)} disabled={!pageReady || teamIndex === 0}>↑</button>
                <button type="button" aria-label={`Move team ${teamIndex + 1} down`} onclick={() => moveTeam(player.field, teamIndex, 1)} disabled={!pageReady || teamIndex === form[player.field].length - 1}>↓</button>
                <button type="button" aria-label={`Remove team ${teamIndex + 1}`} onclick={() => removeTeam(player.field, teamIndex)} disabled={!pageReady}>×</button>
              </div>
            </article>
          {/each}
        </div>
      </section>
    {/each}
  </section>

  <section class="scores" aria-label="Match scores">
    <label>Player 1 score<input use:sanitizeIntegerInput type="number" autocomplete="off" value={form.Player1Score} oninput={(event) => form = { ...form, Player1Score: event.currentTarget.value } } disabled={!pageReady} /></label>
    <label>Player 2 score<input use:sanitizeIntegerInput type="number" autocomplete="off" value={form.Player2Score} oninput={(event) => form = { ...form, Player2Score: event.currentTarget.value } } disabled={!pageReady} /></label>
  </section>

  <section class="account-actions" aria-label="Tournament data account">
    <label>Tournament Password
      <input type="password" autocomplete="current-password" bind:value={password} onchange={storePassword} disabled={!pageReady} />
    </label>
    <div class="buttons">
      <button type="button" onclick={requestSave} disabled={!pageReady || saving || loading}>{saving ? 'Saving…' : 'Save'}</button>
      <button type="button" onclick={() => { void loadData(true); }} disabled={!pageReady || loading || saving}>{loading ? 'Loading…' : 'Get Updates'}</button>
    </div>
  </section>
  <p class="last-update" role="status">{loadAge}</p>

  {#if pickerTarget && pickerAnchor && pickerSlots}
    {@const targetName = pickerTarget.kind === 'force' ? 'Force pick' : pickerTarget.kind === 'ban' ? `${pickerTarget.field === 'Player1Bans' ? 'Player 1' : 'Player 2'} ban` : `${pickerTarget.field === 'Player1Teams' ? 'Player 1' : 'Player 2'} team character`}
    <dialog open aria-modal="false" aria-label={`Choose ${targetName}`} bind:this={pickerPanel}
      use:anchoredPicker={{ anchor: pickerAnchor, slots: pickerSlots, dismiss: closePicker }} class="character-picker" data-html2canvas-ignore>
      <header>
        <span>Choose {targetName}</span>
        <button type="button" aria-label={`Close Choose ${targetName}`} onclick={() => closePicker()}>&times;</button>
      </header>
      {#if (pickerTarget.kind === 'force' && form.ForcePick) || (pickerTarget.kind === 'ban' && form[pickerTarget.field][pickerTarget.slot]) || (pickerTarget.kind === 'team' && form[pickerTarget.field][pickerTarget.team]?.[pickerTarget.slot])}
        <button class="clear-pick" type="button" onclick={clearPickedSlot}>Clear this slot</button>
      {/if}
      <RaidCharacterSearch index={searchIndex} names={studentNames} {metadata} allowed={searchAllowed} bind:borrowed={pickerBorrowed}
        showBorrow={pickerTarget.kind === 'team' && showBorrow} choose={chooseStudent} compact close={() => closePicker()} {t} />
    </dialog>
  {/if}

  {#if confirmingSave}
    <PlannerDialog title="Submit match" close={() => confirmingSave = false} width="440px" {t}>
      <p>Submit changes to database?</p>
      <div class="confirm-actions">
        <button type="button" onclick={() => confirmingSave = false}>Cancel</button>
        <button type="button" class="primary" onclick={() => { void confirmSave(); }}>Submit</button>
      </div>
    </PlannerDialog>
  {/if}
</section>

<style>
  .tournament-page { max-width: 1380px; margin: auto; }
  .page-heading, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .page-heading { margin-bottom: 1.25rem; }
  .page-heading h1 { margin-bottom: 0.25rem; }
  .page-heading p { margin: 0; opacity: 0.8; }
  .export { flex: 0 0 auto; }
  .match-settings, .filters, .team-lists, .scores, .account-actions { padding: 1rem; margin-bottom: 1rem; background: var(--surface); border-radius: 0.75rem; }
  .match-settings { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.85rem 1rem; }
  label { display: flex; flex-direction: column; gap: 0.35rem; font-weight: 600; }
  input, select { min-width: 0; width: 100%; padding: 0.6rem; border: 1px solid #7c5b7d88; border-radius: 0.4rem; background: var(--background); color: var(--text); font: inherit; }
  .filters { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .pick-field { min-width: 0; }
  h2 { font-size: 1.1rem; margin: 0 0 0.65rem; }
  .student-slots { display: flex; flex-wrap: wrap; gap: 0.45rem; }
  .student-slot { display: flex; align-items: center; gap: 0.3rem; min-width: 3.1rem; min-height: 3rem; max-width: 11rem; padding: 0.25rem; overflow: hidden; border: 2px dashed #aaa; background: #ffffff12; color: inherit; }
  .student-slot img { width: 2.3rem; height: 2.55rem; object-fit: cover; border-radius: 0.25rem; }
  .student-slot span:not(.plus) { max-width: 7rem; font-size: 0.75rem; overflow-wrap: anywhere; }
  .plus { font-size: 1.4rem; line-height: 1; margin: auto; }
  .team-lists { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
  .player-teams { min-width: 0; }
  .section-heading { margin-bottom: 0.65rem; }
  .section-heading h2 { margin: 0; }
  .team-list { max-height: 65vh; overflow: auto; display: flex; flex-direction: column; gap: 0.45rem; padding: 0.15rem; }
  .team { display: flex; align-items: center; gap: 0.4rem; width: fit-content; min-width: 100%; padding: 0.4rem; background: #ffffff12; border-radius: 0.6rem; }
  .team-number { min-width: 1.5rem; text-align: center; opacity: 0.8; }
  .role-slots { display: flex; gap: 0.25rem; padding: 0.2rem; background: #ffffff18; border-radius: 0.5rem; }
  .specials { margin-left: 0.35rem; }
  .team-slot { position: relative; width: 3.25rem; height: 3.65rem; flex: 0 0 auto; padding: 0; overflow: hidden; border: 2px dashed #b4a9b9; background: #ffffff10; }
  .team-slot img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .team-slot .plus { display: grid; place-items: center; height: 100%; }
  .borrow-mark { position: absolute; top: 0.1rem; right: 0.1rem; padding: 0.05rem 0.2rem; border-radius: 0.25rem; background: linear-gradient(140deg, #99f8fd, #63a1fe); color: #133c60; font-weight: 700; }
  .team-actions { display: flex; gap: 0.15rem; margin-left: auto; }
  .team-actions button { padding: 0.3rem 0.45rem; }
  .scores { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
  .account-actions { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1rem; align-items: end; }
  .buttons, .confirm-actions { display: flex; gap: 0.5rem; }
  .last-update { position: fixed; left: 1rem; bottom: 0.25rem; margin: 0; padding: 0.35rem 0.55rem; background: #242424c9; border-radius: 0.35rem; font-size: 0.8rem; }
  .error { padding: 0.7rem 1rem; border-radius: 0.45rem; background: #672b39; color: white; }
  .status { padding: 0.65rem 0.9rem; border-radius: 0.45rem; background: #285633; color: white; }
  .character-picker { position: fixed; z-index: 30; inset: auto; margin: 0; width: min(360px, calc(100vw - 12px)); padding: 0.35rem; border: 2px solid #7c5b7d; border-radius: 0.5rem; background: var(--surface); color: var(--text); box-shadow: 0 3px 12px #0005; overflow-y: auto; visibility: hidden; }
  .character-picker header { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; margin-bottom: 0.25rem; font-size: 0.75rem; }
  .character-picker header button { padding: 0.05rem 0.35rem; font-size: 0.9rem; }
  .clear-pick { margin-bottom: 0.35rem; padding: 0.05rem 0.35rem; font-size: 0.75rem; }
  .confirm-actions { justify-content: flex-end; margin-top: 1rem; }
  .primary { background: #7c5b7d; color: white; border: 0; }
  @media (max-width: 800px) {
    .match-settings { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .team-lists { grid-template-columns: 1fr; }
    .team-list { max-height: none; }
  }
  @media (max-width: 600px) {
    .page-heading { align-items: flex-start; }
    .filters { grid-template-columns: 1fr; }
    .match-settings, .scores { grid-template-columns: 1fr; }
    .account-actions { grid-template-columns: 1fr; }
    .buttons button { flex: 1; }
    .team { width: max-content; min-width: 0; max-width: 100%; }
    .team-slot { width: 2.75rem; height: 3.1rem; }
    .team-number { min-width: 1rem; }
    .team-actions { flex-direction: column; }
    .character-picker { width: min(280px, calc(100vw - 12px)); }
  }
</style>
