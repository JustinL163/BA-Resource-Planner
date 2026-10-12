<script lang="ts">
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import { onMount, tick } from 'svelte';
  import { metadata } from '$content/planner';
  import aliases from '$content/search-aliases.json';
  import strings from '$content/strings.json';
  import { getLanguageString } from '$lib/domain/localisation';
  import {
    createStudentSearchIndex, type StudentSearchIndex
  } from '$lib/domain/planner/student-search';
  import { preferences } from '$lib/stores/preferences';
  import {
    decodeRaidHistory, isRaidRecord, matchesVideoStudentFilters, preferredRaidDifficulty, raidDifficultyOptions,
    raidServers, type RaidHistory, type RaidLocation, type RaidRecord, type RaidServer,
    type RaidTeamMember, type RaidVideo, type RaidVideoData
  } from '$lib/domain/raid-videos';
  import { fetchJson } from '$lib/services/planner-data';
  import {
    editRaidVideo, fetchRaidVideoData, mergeStoredRaidVideos,
    readLocalRaidSubmissionStore, saveLocalRaidVideo, submitRaidVideo,
    type NewRaidSubmission
  } from '$lib/services/raid-videos';
  import { readCloudCredentials, type CloudCredentials } from '$lib/services/cloud-credentials';
  import type { CharacterInfo } from '$lib/domain/planner/types';
  import RaidCharacterSearch from '$lib/components/planner/RaidCharacterSearch.svelte';

  type RaidStudent = Pick<CharacterInfo, 'Name' | 'SquadType'>;
  type EditableMember = { id: string; borrowed: boolean } | null;
  type EditableTeam = { members: EditableMember[] };
  type TimelineItem = { kind: 'raid'; key: string; raid: RaidRecord } | { kind: 'blank'; key: string };
  type SearchTarget =
    | { kind: 'team'; team: number; slot: number }
    | { kind: 'include' | 'exclude'; slot: number };

  const t = (id: string) => getLanguageString(strings, id, $preferences.language);
  let history = $state<RaidHistory | null>(null);
  let students = $state<Record<string, RaidStudent>>({});
  let studentNames = $state<Record<string, string>>({});
  let searchIndex = $state<StudentSearchIndex>([]);
  let pageLoading = $state(true);
  let pageError = $state('');
  let searchError = $state('');
  let videoError = $state('');
  let statusMessage = $state('');
  let selectedServer = $state<RaidServer | null>(null);
  let selectedUid = $state<number | null>(null);
  let selectedDifficulty = $state('');
  let videoData = $state<RaidVideoData>({});
  let allVideos = $state<RaidVideo[]>([]);
  let videosLoading = $state(false);
  let defaultServer = $state<RaidServer>('Global');
  let bossFilter = $state('');
  let terrainFilter = $state('');
  let timelineExpanded = $state(true);
  let included = $state<(string | null)[]>([null, null, null]);
  let excluded = $state<(string | null)[]>([null, null, null]);
  let cloudCredentials = $state<CloudCredentials | null>(null);
  let credentialError = $state('');
  let credentialPrompt = $state(false);
  let viewing = $state<RaidVideo | null>(null);
  let editorOpen = $state(false);
  let editorMode = $state<'new' | 'edit'>('new');
  let editingUuid = $state('');
  let editorDifficulty = $state('');
  let editorLink = $state('');
  let editorScore = $state('');
  let editorLevel = $state('');
  let editorTeams = $state<EditableTeam[]>([emptyTeam()]);
  let editorError = $state('');
  let submitting = $state(false);
  let searchTarget = $state<SearchTarget | null>(null);
  let searchQuery = $state('');
  let searchBorrowed = $state(false);
  let sequence = 0;
  let activeVideoController: AbortController | null = null;

  const selectedRaid = $derived.by(() => {
    if (!history || selectedServer === null || selectedUid === null) return null;
    return history[selectedServer].find((entry): entry is RaidRecord => isRaidRecord(entry) && entry.uid === selectedUid) ?? null;
  });
  const timelineRows = $derived.by(() => {
    const currentHistory = history;
    if (!currentHistory) return {} as Record<RaidServer, TimelineItem[]>;
    const length = currentHistory.Japan.length;
    return Object.fromEntries(currentHistory.servers.map((server) => {
      const entries: TimelineItem[] = currentHistory[server].slice().reverse().map((entry, index) =>
        isRaidRecord(entry)
          ? { kind: 'raid', key: `raid-${entry.uid}`, raid: entry }
          : { kind: 'blank', key: `data-blank-${index}` }
      );
      while (entries.length < length) entries.unshift({ kind: 'blank', key: `padding-${length - entries.length}` });
      return [server, entries];
    })) as Record<RaidServer, TimelineItem[]>;
  });
  const bosses = $derived(history ? Object.keys(history.raids) : []);
  const terrains = $derived(bossFilter && history?.raids[bossFilter]
    ? history.raids[bossFilter].Terrains : []);
  const difficultyOptions = $derived(history && selectedRaid ? raidDifficultyOptions(history, selectedRaid) : []);
  const visibleVideos = $derived(allVideos.filter((video) =>
    matchesVideoStudentFilters(video,
      included.filter((id): id is string => id !== null),
      excluded.filter((id): id is string => id !== null))
  ));
  const searchAllowed = $derived.by(() => {
    const target = searchTarget;
    if (!target) return new Set<string>();
    const allowed = new Set<string>();
    if (target.kind === 'team') {
      const selectedTeam = editorTeams[target.team];
      const sameTeamIds = new Set((selectedTeam?.members ?? [])
        .filter((_member, slot) => slot !== target.slot)
        .flatMap((member) => member ? [member.id] : []));
      const usedIds = new Set(editorTeams.flatMap((team, teamIndex) => team.members.flatMap((member, slot) =>
        member && !(teamIndex === target.team && slot === target.slot) ? [member.id] : []
      )));
      const role = target.slot < 4 ? 'Main' : 'Support';
      for (const [id, student] of Object.entries(students)) {
        if (student.SquadType !== role || sameTeamIds.has(id)) continue;
        if (searchBorrowed ? !editorTeams.some((team, teamIndex) => team.members.some((member, slot) =>
          member?.borrowed && !(teamIndex === target.team && slot === target.slot)
        )) : usedIds.has(id)) continue;
        allowed.add(id);
      }
      return allowed;
    }
    const occupied = new Set([
      ...included.filter((id): id is string => id !== null),
      ...excluded.filter((id): id is string => id !== null)
    ]);
    const current = (target.kind === 'include' ? included : excluded)[target.slot];
    if (current) occupied.delete(current);
    for (const id of Object.keys(students)) if (!occupied.has(id)) allowed.add(id);
    return allowed;
  });
  const otherBorrowedExists = $derived.by(() => {
    const target = searchTarget;
    if (!target || target.kind !== 'team') return false;
    return editorTeams.some((team, teamIndex) => team.members.some((member, slot) =>
      member?.borrowed && !(teamIndex === target.team && slot === target.slot)
    ));
  });
  const canEditViewed = $derived(Boolean(viewing && cloudCredentials && viewing.author === cloudCredentials.username));

  function emptyTeam(): EditableTeam {
    return { members: Array.from({ length: 6 }, () => null) };
  }

  function decodeStudents(value: unknown): Record<string, RaidStudent> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Character search data has an invalid format.');
    }
    const decoded: Record<string, RaidStudent> = {};
    for (const [id, raw] of Object.entries(value)) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw) ||
        typeof raw.Name !== 'string' || typeof raw.SquadType !== 'string') {
        throw new Error(`Character search data has an invalid entry for ${id}.`);
      }
      decoded[id] = { Name: raw.Name, SquadType: raw.SquadType };
    }
    return decoded;
  }

  function isRaidServer(value: string | null): value is RaidServer {
    return value !== null && (raidServers as readonly string[]).includes(value);
  }

  function refreshCredentials() {
    try {
      cloudCredentials = readCloudCredentials(localStorage);
      credentialError = '';
    } catch (error) {
      cloudCredentials = null;
      credentialError = error instanceof Error ? error.message : 'Stored account credentials are invalid.';
    }
  }

  function applyVideoDifficulty(difficulty: string) {
    if (selectedServer === null || selectedUid === null) return;
    selectedDifficulty = difficulty;
    included = [null, null, null];
    excluded = [null, null, null];
    videoError = '';
    try {
      allVideos = mergeStoredRaidVideos(localStorage,
        { server: selectedServer, uid: selectedUid, difficulty }, videoData[difficulty] ?? []);
    } catch (error) {
      allVideos = [...(videoData[difficulty] ?? [])].sort((first, second) => Number(second.score) - Number(first.score));
      videoError = error instanceof Error ? error.message : 'Saved raid submissions could not be read.';
    }
  }

  async function selectRaid(server: RaidServer, raid: RaidRecord) {
    if (!history) return;
    selectedServer = server;
    selectedUid = raid.uid;
    timelineExpanded = false;
    viewing = null;
    statusMessage = '';
    videosLoading = true;
    videoError = '';
    videoData = {};
    allVideos = [];
    const requestSequence = ++sequence;
    activeVideoController?.abort();
    activeVideoController = new AbortController();
    const controller = activeVideoController;
    try {
      const data = await fetchRaidVideoData(server, raid.uid, undefined, controller.signal);
      if (requestSequence !== sequence) return;
      videoData = data;
      const preferred = preferredRaidDifficulty(history, raid, selectedDifficulty);
      applyVideoDifficulty(preferred);
    } catch (error) {
      if (controller.signal.aborted || requestSequence !== sequence) return;
      videoError = error instanceof Error ? error.message : 'Could not load raid videos.';
      selectedDifficulty = preferredRaidDifficulty(history, raid, selectedDifficulty);
      included = [null, null, null];
      excluded = [null, null, null];
    } finally {
      if (requestSequence === sequence) videosLoading = false;
    }
  }

  function retryVideos() {
    if (selectedRaid && selectedServer) void selectRaid(selectedServer, selectedRaid);
  }

  async function clickServer(server: RaidServer) {
    defaultServer = server;
    clearTimelineFilters();
    timelineExpanded = true;
    try {
      localStorage.setItem('default-raids-server', server);
      statusMessage = '';
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : 'Could not save the default raid server.';
    }
    await tick();
    const scroller = document.getElementById('timeline-scroll');
    const row = document.getElementById(`server-${server}`);
    const firstRaid = row?.querySelector<HTMLElement>('.raid-card:not(.blank)');
    if (!scroller || !row) return;

    const scrollerRect = scroller.getBoundingClientRect();
    if (window.matchMedia('(max-width: 800px)').matches) {
      const rowRect = row.getBoundingClientRect();
      const targetRect = (firstRaid ?? row).getBoundingClientRect();
      const rowLeft = scroller.scrollLeft + rowRect.left - scrollerRect.left;
      const rowTop = scroller.scrollTop + targetRect.top - scrollerRect.top;
      scroller.scrollTo({
        top: rowTop,
        left: Math.max(0, rowLeft),
        behavior: 'smooth'
      });
      return;
    }

    if (!firstRaid) {
      scroller.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
      return;
    }
    const labelWidth = row.querySelector('.server-label')?.getBoundingClientRect().width ?? 0;
    const raidRect = firstRaid.getBoundingClientRect();
    const raidLeft = scroller.scrollLeft + raidRect.left - scrollerRect.left;
    scroller.scrollTo({ left: Math.max(0, raidLeft - labelWidth - 12), top: 0, behavior: 'smooth' });
  }

  function expandTimeline() { timelineExpanded = true; }

  function raidMatchesFilters(raid: RaidRecord): boolean {
    return (!bossFilter || raid.Boss === bossFilter) && (!terrainFilter || raid.Terrain === terrainFilter);
  }

  function hideTimelineSlot(slot: number): boolean {
    if (!history || (!bossFilter && !terrainFilter)) return false;
    return !history.servers.some((server) => {
      const item = timelineRows[server]?.[slot];
      return item?.kind === 'raid' && raidMatchesFilters(item.raid);
    });
  }

  function clearTimelineFilters() {
    bossFilter = '';
    terrainFilter = '';
  }

  function refreshCurrentDifficulty() {
    if (selectedServer === null || selectedUid === null || !selectedDifficulty) return;
    try {
      allVideos = mergeStoredRaidVideos(localStorage,
        { server: selectedServer, uid: selectedUid, difficulty: selectedDifficulty }, videoData[selectedDifficulty] ?? []);
      videoError = '';
    } catch (error) {
      videoError = error instanceof Error ? error.message : 'Saved raid submissions could not be read.';
    }
  }

  function videoMember(member: RaidTeamMember | unknown): { id: string; borrowed: boolean } | null {
    if (typeof member === 'string') return { id: member, borrowed: false };
    if (Array.isArray(member) && typeof member[0] === 'string') return { id: member[0], borrowed: true };
    return null;
  }

  function toEditableTeams(teams: RaidTeamMember[][]): EditableTeam[] {
    if (!teams.length) return [emptyTeam()];
    return teams.slice(0, 25).map((team) => ({
      members: Array.from({ length: 6 }, (_value, index) => {
        const member = videoMember(team[index]);
        return member ? { ...member } : null;
      })
    }));
  }

  function openFilterSearch(kind: 'include' | 'exclude', slot: number) {
    if (!searchIndex.length) {
      searchError = 'Character search data is still loading.';
      return;
    }
    searchTarget = { kind, slot };
    searchQuery = '';
    searchBorrowed = false;
    searchError = '';
  }

  function openTeamSearch(team: number, slot: number) {
    if (!searchIndex.length) {
      editorError = 'Character search data is still loading.';
      return;
    }
    searchTarget = { kind: 'team', team, slot };
    searchQuery = '';
    searchBorrowed = editorTeams[team]?.members[slot]?.borrowed ?? false;
    searchError = '';
  }

  function selectSearchStudent(id: string): boolean {
    if (!searchTarget) return false;
    if (searchTarget.kind === 'team') {
      const { team, slot } = searchTarget;
      if (!searchAllowed.has(id) || !editorTeams[team]) return false;
      editorTeams = editorTeams.map((entry, index) => {
        if (index !== team) return entry;
        const members = [...entry.members];
        members[slot] = { id, borrowed: searchBorrowed };
        return { members };
      });
      searchTarget = null;
      return true;
    }
    const next = searchTarget.kind === 'include' ? [...included] : [...excluded];
    if (!searchAllowed.has(id)) return false;
    next[searchTarget.slot] = id;
    if (searchTarget.kind === 'include') included = next;
    else excluded = next;
    searchTarget = null;
    return true;
  }

  function clearStudentFilter(kind: 'include' | 'exclude', slot: number) {
    const next = kind === 'include' ? [...included] : [...excluded];
    next[slot] = null;
    if (kind === 'include') included = next;
    else excluded = next;
  }

  function studentPortrait(id: string): string {
    return metadata.portraits[id] ?? `/planner/icons/Portrait/Icon_${encodeURIComponent(id)}.webp`;
  }

  function teamMembers(teams: RaidTeamMember[][]): ({ id: string; borrowed: boolean } | null)[][] {
    return teams.map((team) => Array.from({ length: 6 }, (_value, index) => videoMember(team[index])));
  }

  function formattedScore(value: number | string): string {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString('en-US') : String(value);
  }

  function openNewSubmission() {
    refreshCredentials();
    if (!cloudCredentials) {
      credentialPrompt = true;
      return;
    }
    credentialPrompt = false;
    if (!selectedRaid || !history) return;
    editorMode = 'new';
    editingUuid = '';
    editorDifficulty = selectedDifficulty || difficultyOptions[0] || '';
    editorLink = '';
    editorScore = '';
    editorLevel = '';
    editorTeams = [emptyTeam()];
    editorError = '';
    searchTarget = null;
    editorOpen = true;
  }

  function openEditSubmission(video: RaidVideo) {
    refreshCredentials();
    if (!cloudCredentials) {
      viewing = null;
      credentialPrompt = true;
      return;
    }
    credentialPrompt = false;
    if (video.author !== cloudCredentials.username) return;
    editorMode = 'edit';
    editingUuid = video.uuid;
    editorDifficulty = selectedDifficulty;
    editorLink = video.link;
    editorScore = String(video.score);
    editorLevel = String(video.level);
    editorTeams = toEditableTeams(video.teams);
    editorError = '';
    searchTarget = null;
    viewing = null;
    editorOpen = true;
  }

  function addTeam() {
    if (editorTeams.length >= 25) {
      editorError = 'A submission can contain at most 25 teams.';
      return;
    }
    editorTeams = [...editorTeams, emptyTeam()];
  }

  function removeTeam(index: number) {
    if (editorTeams.length <= 1) return;
    editorTeams = editorTeams.filter((_team, teamIndex) => teamIndex !== index);
  }

  function moveTeam(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= editorTeams.length) return;
    const next = [...editorTeams];
    [next[index], next[destination]] = [next[destination], next[index]];
    editorTeams = next;
  }

  function clearTeamMember(teamIndex: number, slot: number) {
    editorTeams = editorTeams.map((team, index) => {
      if (index !== teamIndex) return team;
      const members = [...team.members];
      members[slot] = null;
      return { members };
    });
  }

  function serializedTeams(): RaidTeamMember[][] {
    return editorTeams.map((team) => team.members.map((member) =>
      member ? (member.borrowed ? [member.id] : member.id) : null
    ));
  }

  async function saveSubmission() {
    editorError = '';
    const link = editorLink.trim();
    let parsedLink: URL;
    try { parsedLink = new URL(link); }
    catch { editorError = t('text-invalidlink'); return; }
    if (!['http:', 'https:'].includes(parsedLink.protocol)) {
      editorError = t('text-invalidlink');
      return;
    }
    if (link.length > 100) { editorError = t('text-linktoolong'); return; }
    const score = Number(editorScore), level = Number(editorLevel);
    if (!Number.isInteger(score) || score < 1 || score > 40348000) { editorError = t('text-invalidraidscore'); return; }
    if (!Number.isInteger(level) || level < 1 || level > 87) { editorError = t('text-invalidraidlevel'); return; }
    if (!selectedServer || selectedUid === null || !selectedRaid || !editorDifficulty) return;
    const teams = serializedTeams();
    if (!teams.some((team) => team.some(Boolean))) { editorError = t('text-submissionemptyteams'); return; }
    if (editorTeams.flatMap((team) => team.members).filter((member) => member?.borrowed).length > 1) {
      editorError = 'Only one student can be borrowed in a submission.';
      return;
    }

    const submission: NewRaidSubmission = { score: String(editorScore), level: String(editorLevel), link, teams };
    const request = {
      server: selectedServer, uid: selectedUid, difficulty: editorDifficulty, ...submission,
      ...(editorMode === 'edit' ? { uuid: editingUuid } : {})
    };
    submitting = true;
    try {
      const credentials = readCloudCredentials(localStorage);
      if (!credentials) throw new Error(t('text-goregisteraccount'));
      const uuid = editorMode === 'edit'
        ? await editRaidVideo(request, credentials)
        : await submitRaidVideo(request, credentials);
      let cacheWarning = '';
      try {
        saveLocalRaidVideo(localStorage,
          { server: selectedServer, uid: selectedUid, difficulty: editorDifficulty }, submission, uuid);
      } catch (error) {
        cacheWarning = error instanceof Error ? ` The server accepted it, but the local display cache could not be saved: ${error.message}` :
          ' The server accepted it, but the local display cache could not be saved.';
      }
      if (selectedDifficulty === editorDifficulty) refreshCurrentDifficulty();
      editorOpen = false;
      statusMessage = `${editorMode === 'edit' ? 'Successfully edited: ' : 'Successfully submitted: '}${uuid}.${cacheWarning}`;
    } catch (error) {
      editorError = error instanceof Error ? error.message : 'The raid video could not be submitted.';
    } finally {
      submitting = false;
    }
  }

  function closeEditor() {
    if (submitting) return;
    editorOpen = false;
    searchTarget = null;
    editorError = '';
  }

  function closeViewer() { viewing = null; }

  function onStorage(event: StorageEvent) {
    if (event.key === 'username' || event.key === 'authkey' || event.key === null) refreshCredentials();
    if (event.key === 'default-raids-server' || event.key === null) {
      try {
        const value = localStorage.getItem('default-raids-server');
        if (isRaidServer(value)) defaultServer = value;
      } catch { /* Keep the current in-memory choice when storage is unavailable. */ }
    }
    if (event.key === 'local-submissions' || event.key === null) refreshCurrentDifficulty();
  }

  onMount(() => {
    const controller = new AbortController();
    try {
      const savedServer = localStorage.getItem('default-raids-server');
      if (isRaidServer(savedServer)) defaultServer = savedServer;
      refreshCredentials();
      readLocalRaidSubmissionStore(localStorage);
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : 'Browser storage could not be read.';
    }
    window.addEventListener('storage', onStorage);
    void (async () => {
      try {
        const [raidValue, studentValue] = await Promise.all([
          fetchJson('/planner/json/raids.json', controller.signal),
          fetchJson('/planner/json/skillinfo/en.json', controller.signal)
        ]);
        history = decodeRaidHistory(raidValue);
        students = decodeStudents(studentValue);
        studentNames = Object.fromEntries(Object.entries(students).map(([id, info]) => [id, info.Name]));
        searchIndex = createStudentSearchIndex(students, studentNames, aliases);
        pageError = '';
      } catch (error) {
        if (!controller.signal.aborted) pageError = error instanceof Error ? error.message : 'Could not load raid data.';
      } finally {
        if (!controller.signal.aborted) pageLoading = false;
      }
    })();
    return () => {
      controller.abort();
      activeVideoController?.abort();
      window.removeEventListener('storage', onStorage);
    };
  });

  async function retryPageData() {
    pageLoading = true;
    pageError = '';
    try {
      const [raidValue, studentValue] = await Promise.all([
        fetchJson('/planner/json/raids.json'), fetchJson('/planner/json/skillinfo/en.json')
      ]);
      history = decodeRaidHistory(raidValue);
      students = decodeStudents(studentValue);
      studentNames = Object.fromEntries(Object.entries(students).map(([id, info]) => [id, info.Name]));
      searchIndex = createStudentSearchIndex(students, studentNames, aliases);
    } catch (error) {
      pageError = error instanceof Error ? error.message : 'Could not load raid data.';
    } finally { pageLoading = false; }
  }
</script>

<svelte:head>
  <title>{t('page-raids')} - Svelte</title>
  <meta name="description" content="Browse Blue Archive raid history and video submissions by server, boss, terrain, and difficulty." />
</svelte:head>

<div class="raid-page">
  <div class="raid-background" aria-hidden="true"></div>
  <h1>{t('page-raids')}</h1>
  <details class="migration-note">
    <summary>{t('ui-migration-status')} &middot; <a href="/planner/raids.html" data-sveltekit-reload>{t('ui-legacy-tools')}</a></summary>
    <p>The original raid video page remains available at <a href="/planner/raids.html" data-sveltekit-reload>/planner/raids.html</a>.</p>
  </details>

  {#if pageLoading}<p role="status">Loading raid history and character search...</p>{/if}
  {#if pageError}
    <div class="error-banner" role="alert">{pageError} <button type="button" onclick={() => void retryPageData()}>{t('ui-retry')}</button></div>
  {/if}
  {#if statusMessage}<p class="status" role="status">{statusMessage}</p>{/if}
  {#if history}
    <section class="timeline-section" class:collapsed={!timelineExpanded} aria-label="Raid timeline">
      <div class="timeline-heading">
        <h2>Raid timeline</h2>
        {#if !timelineExpanded}<button class="quiet-button" type="button" aria-expanded={timelineExpanded} aria-controls="timeline-scroll" onclick={expandTimeline}>Show all raids</button>{/if}
      </div>
      <div class="timeline-controls">
        <label>Boss
          <select aria-label="Filter by boss" bind:value={bossFilter} onchange={() => terrainFilter = ''}>
            <option value="">All bosses</option>
            {#each bosses as boss}<option value={boss}>{boss}</option>{/each}
          </select>
        </label>
        <label>Terrain
          <select aria-label="Filter by terrain" bind:value={terrainFilter} disabled={!bossFilter}>
            <option value="">All terrains</option>
            {#each terrains as terrain}<option value={terrain}>{terrain}</option>{/each}
          </select>
        </label>
        <button class="quiet-button" type="button" onclick={clearTimelineFilters} disabled={!bossFilter && !terrainFilter}>Clear filters</button>
      </div>
      <div class="timeline-scroll" id="timeline-scroll">
        <div class="timeline-board">
          {#each history.servers as server (server)}
            {#if timelineExpanded || selectedServer === server}
              <section class="server-row" id={`server-${server}`} aria-label={`${server} raids`}>
                <button class="server-label" class:default={defaultServer === server} type="button" onclick={() => void clickServer(server)}>
                  <span>{server === 'Japan' ? 'JP' : server === 'Global' ? 'Global' : 'CN'}</span>
                  <small>{server}</small>
                </button>
                <div class="server-timeline" aria-label={`${server} timeline`}>
                  {#each timelineRows[server] ?? [] as item, slot (`${server}-${item.key}`)}
                    {#if item.kind === 'blank'}
                      <div class="raid-card blank" class:timeline-padding={item.key.startsWith('padding-')} aria-hidden="true" style:display={hideTimelineSlot(slot) ? 'none' : ''}></div>
                    {:else}
                    {@const raid = item.raid}
                    <button
                      class="raid-card"
                      class:raid-heavy={raid.Armour.toLowerCase() === 'heavy'}
                      class:raid-light={raid.Armour.toLowerCase() === 'light'}
                      class:raid-special={raid.Armour.toLowerCase() === 'special'}
                      class:raid-elastic={raid.Armour.toLowerCase() === 'elastic'}
                      class:selected={selectedServer === server && selectedUid === raid.uid}
                      type="button"
                      aria-label={`${server} ${raid.Boss}, ${raid.Terrain}, season ${raid.Season}, ${raid.Max_Difficulty}`}
                      aria-pressed={selectedServer === server && selectedUid === raid.uid}
                      style:display={hideTimelineSlot(slot) ? 'none' : ''}
                      style:visibility={raidMatchesFilters(raid) ? '' : 'hidden'}
                      onclick={() => void selectRaid(server, raid)}
                    >
                      <img class="boss-icon" src={`/planner/icons/Raids/Raid_Portrait_${encodeURIComponent(raid.Boss)}.png`} alt="" loading="lazy" />
                      <div class="raid-card-topline">
                        <span class="terrain-bubble"><img src={`/planner/icons/Mood/Terrain_${encodeURIComponent(raid.Terrain)}.png`} alt="" loading="lazy" /></span>
                        <span class="raid-season-stack">
                          <span class="raid-season">S {raid.Season}</span>
                          <span class="raid-counts" aria-hidden="true">
                            <span class="raid-bosscount"># {raid.Boss_Count}</span>
                            <span class="raid-terraincount"># {raid.Boss_Terrain_Count}</span>
                          </span>
                        </span>
                      </div>
                      <span class="raid-card-bottom">
                        <span class="raid-date">{raid.Start_Date.Year}-{String(raid.Start_Date.Month).padStart(2, '0')}-{String(raid.Start_Date.Day).padStart(2, '0')}</span>
                        <span class="raid-difficulty">{raid.Max_Difficulty}</span>
                      </span>
                    </button>
                    {/if}
                  {/each}
                </div>
              </section>
            {/if}
          {/each}
        </div>
      </div>
    </section>
  {/if}

  {#if selectedRaid && selectedServer}
    <section class="submissions" aria-label="Raid video submissions">
      <div class="selected-raid-heading">
        <img src={`/planner/icons/Raids/Raid_Portrait_${encodeURIComponent(selectedRaid.Boss)}.png`} alt="" />
        <div>
          <h2>{selectedServer} · {selectedRaid.Boss}</h2>
          <p>{selectedRaid.Terrain} · Season {selectedRaid.Season} · Maximum {selectedRaid.Max_Difficulty}</p>
        </div>
        <button class="submit-button" type="button" onclick={openNewSubmission}>{t('button-submitvideo')}</button>
      </div>

      {#if difficultyOptions.length}
        <div class="difficulty-tabs" role="tablist" aria-label="Raid difficulty">
          {#each difficultyOptions as difficulty (difficulty)}
            <button type="button" role="tab" aria-selected={selectedDifficulty === difficulty} class:selected={selectedDifficulty === difficulty} onclick={() => applyVideoDifficulty(difficulty)}>{difficulty}</button>
          {/each}
        </div>
      {/if}

      <div class="video-filters">
        <div class="video-filter-group">
          <span>{t('label-includedstudents')}</span>
          <div class="filter-slots">
            {#each included as student, slot}
              <div class="filter-slot-wrap">
                <button class="student-filter-slot" type="button" aria-label={`${t('label-includedstudents')} ${slot + 1}${student ? `: ${studentNames[student] ?? student}` : ''}`} onclick={() => openFilterSearch('include', slot)}>
                  {#if student}<img src={studentPortrait(student)} alt={studentNames[student] ?? student} />{:else}<span aria-hidden="true">+</span>{/if}
                </button>
                {#if student}<button class="clear-filter" type="button" aria-label={`Clear included student ${studentNames[student] ?? student}`} onclick={() => clearStudentFilter('include', slot)}>×</button>{/if}
              </div>
            {/each}
          </div>
        </div>
        <div class="video-filter-group">
          <span>{t('label-excludedstudents')}</span>
          <div class="filter-slots">
            {#each excluded as student, slot}
              <div class="filter-slot-wrap">
                <button class="student-filter-slot" type="button" aria-label={`${t('label-excludedstudents')} ${slot + 1}${student ? `: ${studentNames[student] ?? student}` : ''}`} onclick={() => openFilterSearch('exclude', slot)}>
                  {#if student}<img src={studentPortrait(student)} alt={studentNames[student] ?? student} />{:else}<span aria-hidden="true">+</span>{/if}
                </button>
                {#if student}<button class="clear-filter" type="button" aria-label={`Clear excluded student ${studentNames[student] ?? student}`} onclick={() => clearStudentFilter('exclude', slot)}>×</button>{/if}
              </div>
            {/each}
          </div>
        </div>
      </div>

      {#if videosLoading}<p role="status">Loading videos...</p>{/if}
      {#if videoError}<p class="error" role="alert">{videoError} {#if videosLoading === false}<button type="button" class="quiet-button" onclick={retryVideos}>{t('ui-retry')}</button>{/if}</p>{/if}
      {#if !videosLoading && !videoError && visibleVideos.length === 0}<p class="empty-videos">No videos match the selected difficulty and student filters.</p>{/if}

      <div class="video-grid">
        {#each visibleVideos as video, videoIndex (`${video.uuid}-${videoIndex}`)}
          <article class="raid-video-card" class:own-submission={cloudCredentials?.username === video.author}>
            <button class="video-card-open" type="button" aria-label={`Open video submission, score ${formattedScore(video.score)}`} onclick={() => viewing = video}>
              <div class="video-card-header">
                <strong class="raid-score">{formattedScore(video.score)}</strong>
                <span class="player-level">{t('label-levelshort')} {video.level}</span>
              </div>
              <div class="raid-teams" aria-label="Teams">
                {#each teamMembers(video.teams) as team, teamIndex (`${video.uuid}-${teamIndex}`)}
                  <div class="raid-team">
                    <span class="team-num">{teamIndex + 1}</span>
                    <div class="team-strikers">
                      {#each team.slice(0, 4) as member, slot (`${video.uuid}-${teamIndex}-s${slot}`)}
                        <span class="student" class:student-empty={!member} class:student-borrow={member?.borrowed}>
                          {#if member}<img src={studentPortrait(member.id)} alt={studentNames[member.id] ?? member.id} loading="lazy" />{/if}
                        </span>
                      {/each}
                    </div>
                    <div class="team-specials">
                      {#each team.slice(4, 6) as member, slot (`${video.uuid}-${teamIndex}-p${slot}`)}
                        <span class="student" class:student-empty={!member} class:student-borrow={member?.borrowed}>
                          {#if member}<img src={studentPortrait(member.id)} alt={studentNames[member.id] ?? member.id} loading="lazy" />{/if}
                        </span>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            </button>
            <a class="raid-video-link" href={video.link} target="_blank" rel="noopener noreferrer">{video.link}</a>
          </article>
        {/each}
      </div>
    </section>
  {:else if history}
    <p class="select-raid-hint">Select a raid in the timeline to browse its video submissions.</p>
  {/if}
</div>

{#if credentialPrompt}
  <div class="modal-backdrop" role="presentation" tabindex="-1" onclick={(event) => { if (event.target === event.currentTarget) credentialPrompt = false; }} onkeydown={(event) => { if (event.key === 'Escape') credentialPrompt = false; }}>
    <dialog open class="modal-content credential-content" aria-modal="true" aria-labelledby="credential-title">
      <header class="modal-header">
        <h2 id="credential-title">Cloud save account required</h2>
        <button type="button" class="icon-close" aria-label="Close" onclick={() => credentialPrompt = false}>×</button>
      </header>
      <p role="alert">{credentialError || t('text-goregisteraccount')}</p>
      <footer class="modal-footer">
        <a class="submit-button" href="/planner/index.html" data-sveltekit-reload>Open the account page</a>
        <button class="quiet-button" type="button" onclick={() => credentialPrompt = false}>Close</button>
      </footer>
    </dialog>
  </div>
{/if}

{#if viewing}
  <div class="modal-backdrop" role="presentation" tabindex="-1" onclick={(event) => { if (event.target === event.currentTarget) closeViewer(); }} onkeydown={(event) => { if (event.key === 'Escape') closeViewer(); }}>
    <dialog open class="modal-content" aria-modal="true" aria-labelledby="viewer-title">
      <header class="modal-header">
        <div><h2 id="viewer-title">{t('text-videosubmission')}</h2><p>{selectedServer} · {selectedRaid?.Boss} · {selectedDifficulty}</p></div>
        <button type="button" class="icon-close" aria-label="Close" onclick={closeViewer}>×</button>
      </header>
      <div class="viewer-details">
        <div class="viewer-info">
          <span>{t('text-videolink')}</span><a href={viewing.link} target="_blank" rel="noopener noreferrer">{viewing.link}</a>
          <span>{t('text-score')}</span><strong>{formattedScore(viewing.score)}</strong>
          <span>{t('text-levelhighestnonborrow')}</span><strong>{viewing.level}</strong>
        </div>
        <h3>{t('text-teams')}</h3>
        <div class="viewer-teams">
          {#each teamMembers(viewing.teams) as team, teamIndex (`viewer-${viewing.uuid}-${teamIndex}`)}
            <div class="raid-team">
              <span class="team-num">{teamIndex + 1}</span>
              <div class="team-strikers">
                {#each team.slice(0, 4) as member, slot (`viewer-${viewing.uuid}-${teamIndex}-s${slot}`)}
                  <span class="student" class:student-empty={!member} class:student-borrow={member?.borrowed}>
                    {#if member}<img src={studentPortrait(member.id)} alt={studentNames[member.id] ?? member.id} />{/if}
                  </span>
                {/each}
              </div>
              <div class="team-specials">
                {#each team.slice(4, 6) as member, slot (`viewer-${viewing.uuid}-${teamIndex}-p${slot}`)}
                  <span class="student" class:student-empty={!member} class:student-borrow={member?.borrowed}>
                    {#if member}<img src={studentPortrait(member.id)} alt={studentNames[member.id] ?? member.id} />{/if}
                  </span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
      {#if canEditViewed}<footer class="modal-footer"><button class="submit-button" type="button" onclick={() => openEditSubmission(viewing!)}>{t('text-editvideosubmission')}</button></footer>{/if}
    </dialog>
  </div>
{/if}

{#if editorOpen}
  <div class="modal-backdrop" role="presentation" tabindex="-1" onclick={(event) => { if (event.target === event.currentTarget) closeEditor(); }} onkeydown={(event) => { if (event.key === 'Escape') closeEditor(); }}>
    <dialog open class="modal-content editor-content" aria-modal="true" aria-labelledby="editor-title">
      <header class="modal-header">
        <div><h2 id="editor-title">{editorMode === 'edit' ? t('text-editvideosubmission') : t('text-newvideosubmission')}</h2><p>{selectedServer} · {selectedRaid?.Boss}</p></div>
        <button type="button" class="icon-close" aria-label="Close" disabled={submitting} onclick={closeEditor}>×</button>
      </header>
      <div class="submission-form">
        <label>{t('text-difficulty')}
          <select bind:value={editorDifficulty}>
            {#each difficultyOptions as difficulty}<option value={difficulty}>{difficulty}</option>{/each}
          </select>
        </label>
        <label>{t('text-videolink')}
          <input type="url" maxlength="100" autocomplete="off" bind:value={editorLink} placeholder="https://www.youtube.com/watch?v=..." />
        </label>
        <div class="form-two-col">
          <label>{t('text-score')}<input use:sanitizeIntegerInput type="number" min="1" max="40348000" step="1" bind:value={editorScore} /></label>
          <label>{t('text-levelhighestnonborrow')}<input use:sanitizeIntegerInput type="number" min="1" max="87" step="1" bind:value={editorLevel} /></label>
        </div>
      </div>
      <div class="editor-team-heading"><h3>{t('text-teams')}</h3><button class="quiet-button" type="button" onclick={addTeam} disabled={editorTeams.length >= 25}>Add team</button></div>
      <div class="editor-teams">
        {#each editorTeams as team, teamIndex (`editor-team-${teamIndex}`)}
          <section class="editor-team" aria-label={`Team ${teamIndex + 1}`}>
            <div class="team-toolbar">
              <strong>Team {teamIndex + 1}</strong>
              <div>
                <button type="button" aria-label={`Move team ${teamIndex + 1} up`} class="icon-action" disabled={teamIndex === 0} onclick={() => moveTeam(teamIndex, -1)}>↑</button>
                <button type="button" aria-label={`Move team ${teamIndex + 1} down`} class="icon-action" disabled={teamIndex === editorTeams.length - 1} onclick={() => moveTeam(teamIndex, 1)}>↓</button>
                <button type="button" aria-label={`Remove team ${teamIndex + 1}`} class="icon-action" disabled={editorTeams.length === 1} onclick={() => removeTeam(teamIndex)}>×</button>
              </div>
            </div>
            <div class="editor-slots">
              {#each team.members as member, slot (`editor-${teamIndex}-${slot}`)}
                <div class="team-slot-wrap">
                  <button type="button" class="team-student" class:student-blank={!member} class:student-borrow={member?.borrowed}
                    aria-label={`${slot < 4 ? 'Striker' : 'Special'} slot ${slot < 4 ? slot + 1 : slot - 3}${member ? `: ${studentNames[member.id] ?? member.id}` : ': empty'}`}
                    onclick={() => openTeamSearch(teamIndex, slot)}>
                    {#if member}<img src={studentPortrait(member.id)} alt="" />{:else}<img src="/planner/icons/UI/plus-solid.svg" alt="" />{/if}
                  </button>
                  {#if member}<button type="button" class="clear-member" aria-label={`Clear ${studentNames[member.id] ?? member.id}`} onclick={() => clearTeamMember(teamIndex, slot)}>×</button>{/if}
                </div>
              {/each}
            </div>
          </section>
        {/each}
      </div>
      {#if credentialError && !cloudCredentials}<p class="error" role="alert">{credentialError} <a href="/planner/index.html" data-sveltekit-reload>Open the account page</a></p>{/if}
      {#if editorError}<p class="error" role="alert">{editorError} {#if editorError === t('text-goregisteraccount')}<a href="/planner/index.html" data-sveltekit-reload>Open the account page</a>{/if}</p>{/if}
      <footer class="modal-footer">
        <button class="quiet-button" type="button" disabled={submitting} onclick={closeEditor}>{t('label-cancel')}</button>
        <button class="submit-button" type="button" disabled={submitting} onclick={() => void saveSubmission()}>{submitting ? 'Saving...' : 'Save video'}</button>
      </footer>
    </dialog>
  </div>
{/if}

{#if searchTarget}
  <div class="search-backdrop" role="presentation" tabindex="-1" onclick={(event) => { if (event.target === event.currentTarget) searchTarget = null; }} onkeydown={(event) => { if (event.key === 'Escape') searchTarget = null; }}></div>
  <dialog open class="student-search-dialog" aria-modal="true" aria-labelledby="student-search-title">
    <div class="search-dialog-heading"><h2 id="student-search-title">Choose a student</h2><button type="button" class="icon-close" aria-label="Close search" onclick={() => searchTarget = null}>×</button></div>
    <RaidCharacterSearch
      index={searchIndex}
      names={studentNames}
      {metadata}
      allowed={searchAllowed}
      choose={selectSearchStudent}
      bind:query={searchQuery}
      bind:borrowed={searchBorrowed}
      showBorrow={searchTarget.kind === 'team' && !otherBorrowedExists}
      close={() => searchTarget = null}
      {t}
    />
    {#if searchError}<p class="error" role="alert">{searchError}</p>{/if}
  </dialog>
{/if}

<style>
  .raid-page { position: relative; isolation: isolate; min-height: 70vh; padding-bottom: 3rem; }
  .raid-background { position: fixed; inset: 0; z-index: -1; pointer-events: none; background: center / cover no-repeat url('/planner/icons/Backgrounds/chesed-indoor.jpg'); filter: blur(45px); opacity: 0.22; transform: scale(1.05); }
  .raid-page h1 { margin-top: 0; }
  .migration-note { margin: 0.75rem 0 1.25rem; padding: 0.65rem 0.85rem; border: 1px solid #7c5b7d80; border-radius: 0.6rem; background: color-mix(in srgb, Canvas 85%, transparent); }
  .migration-note summary { cursor: pointer; }
  .migration-note p { margin-bottom: 0; }
  button, select, input { font: inherit; }
  button { cursor: pointer; color: inherit; }
  button:disabled { cursor: not-allowed; opacity: 0.55; }
  .timeline-section, .submissions { border: 1px solid #7c5b7d80; border-radius: 0.8rem; background: color-mix(in srgb, Canvas 85%, transparent); padding: 0.9rem; margin: 1rem 0; box-shadow: 0 0.5rem 1.5rem #0002; }
  .timeline-controls { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: end; margin-bottom: 0.8rem; }
  .timeline-controls label, .submission-form label { display: grid; gap: 0.25rem; font-weight: 650; }
  .timeline-controls select, .submission-form input, .submission-form select { min-width: 11rem; padding: 0.45rem 0.55rem; border: 1px solid #7c5b7d88; border-radius: 0.35rem; background: Canvas; color: CanvasText; }
  .timeline-controls select:disabled { cursor: not-allowed; }
  .quiet-button, .submit-button { border: 1px solid #7c5b7d; border-radius: 0.4rem; padding: 0.45rem 0.75rem; background: transparent; }
  .submit-button { background: #7c5b7d; color: white; font-weight: 700; }
  .quiet-button:hover, .submit-button:hover { filter: brightness(1.15); }
  .timeline-heading { display: flex; align-items: center; justify-content: flex-start; gap: 0.75rem; margin-bottom: 0.55rem; }
  .timeline-heading h2 { margin: 0; font-size: 1.1rem; }
  .timeline-section.collapsed .timeline-controls { display: none; }
  .timeline-section.collapsed .raid-card.timeline-padding { display: none; }
  .timeline-scroll { max-width: 100%; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; scroll-behavior: smooth; }
  .timeline-board { display: grid; width: max-content; min-width: 100%; gap: 0.65rem; }
  .server-row { display: grid; grid-template-columns: 6rem max-content; min-height: 9.3rem; gap: 0.5rem; }
  .server-label { position: sticky; z-index: 4; left: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0.1rem; border: 1px solid #ffffff20; border-radius: 0.55rem; background: #282a35ed; color: white; }
  .server-label span { font-size: 1.1rem; font-weight: 800; }
  .server-label small { opacity: 0.8; }
  .server-label.default { outline: 2px solid #ffdd00; outline-offset: -3px; }
  .server-timeline { display: flex; width: max-content; min-width: max-content; gap: 0.4rem; overflow: visible; padding: 0.25rem; }
  .raid-card { position: relative; display: flex; flex: 0 0 6.6rem; height: 8.5rem; overflow: hidden; padding: 0.25rem; border: 1px solid #ffffff45; border-radius: 0.55rem; background: #282a35aa; color: white; }
  .raid-card.blank { border-color: transparent; background: transparent; box-shadow: none; pointer-events: none; }
  .raid-card:hover { filter: brightness(1.12); }
  .raid-card.selected { outline: 3px solid #ffdd00; outline-offset: -3px; }
  .raid-card.raid-heavy { border-top: 4px solid #f1a24a; }
  .raid-card.raid-light { border-top: 4px solid #e86b6b; }
  .raid-card.raid-special { border-top: 4px solid #bd87de; }
  .raid-card.raid-elastic { border-top: 4px solid #70c2af; }
  .boss-icon { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.8; transition: scale 0.2s linear; }
  .raid-card:hover .boss-icon { scale: 1.08; }
  .raid-card-topline { position: absolute; z-index: 1; inset: 0.25rem 0.25rem auto; display: flex; justify-content: space-between; align-items: flex-start; }
  .terrain-bubble { display: grid; place-items: center; width: 1.8rem; height: 1.8rem; padding: 0.15rem; border-radius: 50%; background: #282a35ed; }
  .terrain-bubble img { width: 100%; height: 100%; object-fit: contain; }
  .raid-season-stack { display: grid; justify-items: end; gap: 0.1rem; }
  .raid-date, .raid-season, .raid-bosscount, .raid-terraincount, .raid-difficulty { z-index: 1; padding: 0.1rem 0.25rem; border-radius: 0.2rem; background: #282a35ed; color: white; line-height: 1.25; text-shadow: 0 1px 3px #000; }
  .raid-date { justify-self: start; font-size: 0.76rem; font-weight: 700; }
  .raid-season, .raid-bosscount, .raid-terraincount { font-size: 0.7rem; }
  .raid-counts { display: grid; justify-items: end; gap: 0.1rem; opacity: 0; transform: translateY(-0.45rem); transition: transform 0.3s ease, opacity 0.3s ease; }
  .raid-card:hover .raid-counts, .raid-card:focus-visible .raid-counts { opacity: 1; transform: translateY(0); }
  .raid-card-bottom { position: absolute; z-index: 1; inset: auto 0.25rem 0.25rem; display: grid; justify-items: stretch; gap: 0.1rem; }
  .raid-difficulty { justify-self: stretch; text-align: center; font-weight: 800; }
  .selected-raid-heading { display: flex; align-items: center; gap: 0.75rem; }
  .selected-raid-heading > img { width: 4rem; height: 4rem; object-fit: contain; }
  .selected-raid-heading h2, .selected-raid-heading p { margin: 0; }
  .selected-raid-heading p { opacity: 0.8; margin-top: 0.2rem; }
  .selected-raid-heading .submit-button { margin-left: auto; }
  .difficulty-tabs { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.9rem 0; }
  .difficulty-tabs button { padding: 0.4rem 0.7rem; border: 1px solid #7c5b7d88; border-radius: 0.35rem; background: transparent; }
  .difficulty-tabs button.selected { background: #7c5b7d; color: white; }
  .video-filters { display: flex; flex-wrap: wrap; gap: 1.5rem; padding: 0.75rem; border-radius: 0.55rem; background: #7c5b7d18; }
  .video-filter-group { display: grid; gap: 0.35rem; }
  .filter-slots { display: flex; gap: 0.55rem; }
  .filter-slot-wrap, .team-slot-wrap { position: relative; }
  .student-filter-slot { display: grid; place-items: center; width: 3.4rem; aspect-ratio: 1; padding: 0; border: 2px solid #7c5b7d; border-radius: 0.45rem; background: #282a3577; color: inherit; font-size: 1.5rem; }
  .student-filter-slot img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
  .clear-filter, .clear-member { position: absolute; top: -0.45rem; right: -0.45rem; width: 1.25rem; height: 1.25rem; border: 0; border-radius: 50%; background: #8e3434; color: white; line-height: 1; }
  .video-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr)); gap: 0.75rem; margin-top: 0.85rem; }
  .raid-video-card { min-width: 0; overflow: hidden; border: 1px solid #ffffff35; border-radius: 0.6rem; background: #282a3587; color: white; }
  .raid-video-card.own-submission { background: #4d775687; }
  .video-card-open { display: block; width: 100%; padding: 0.6rem; border: 0; background: transparent; color: inherit; text-align: left; }
  .video-card-header { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; margin-bottom: 0.45rem; }
  .raid-score { font-size: 1.25rem; }
  .player-level { white-space: nowrap; opacity: 0.85; }
  .raid-teams, .viewer-teams { display: grid; gap: 0.3rem; }
  .raid-teams { --team-row-size: clamp(2.25rem, 3vw, 3rem); grid-auto-rows: var(--team-row-size); max-height: calc(3.5 * var(--team-row-size) + 3 * 0.3rem); overflow-y: auto; overscroll-behavior: contain; }
  .raid-team { display: grid; grid-template-columns: 1.2rem minmax(0, 1fr) 5rem; align-items: center; gap: 0.3rem; min-width: 0; }
  .raid-teams .raid-team { height: 100%; min-height: 0; }
  .team-num { display: grid; place-items: center; width: 1.1rem; height: 1.1rem; border-radius: 50%; background: #ffffff20; font-size: 0.7rem; }
  .team-strikers, .team-specials { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.15rem; min-width: 0; }
  .team-specials { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .student { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: 0.25rem; background: #ffffff12; }
  .raid-teams .student { height: 100%; aspect-ratio: auto; }
  .student img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .student-empty { border: 1px dashed #ffffff35; }
  .student-borrow::after { content: 'Borrow'; position: absolute; inset: auto 0 0; padding: 0.05rem; background: #24242bce; text-align: center; font-size: 0.52rem; line-height: 1.1; }
  .raid-video-link { display: block; overflow: hidden; padding: 0.35rem 0.6rem 0.65rem; color: #aed4ff; font-size: 0.78rem; text-overflow: ellipsis; white-space: nowrap; }
  .empty-videos, .select-raid-hint { padding: 1rem; text-align: center; opacity: 0.8; }
  .status { padding: 0.6rem 0.8rem; border-radius: 0.4rem; background: #35714255; overflow-wrap: anywhere; }
  .error { color: #d45d5d; }
  .error-banner { padding: 0.75rem; border: 1px solid #aa5656; border-radius: 0.5rem; color: #b73232; }
  .modal-backdrop, .search-backdrop { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 1rem; background: #09090dc9; }
  .modal-content { position: relative; inset: auto; margin: 0; width: min(48rem, calc(100vw - 2rem)); max-height: min(90vh, 60rem); overflow: auto; border: 1px solid #7c5b7d; border-radius: 0.8rem; background: Canvas; color: CanvasText; box-shadow: 0 1rem 3rem #0008; padding: 1rem; }
  .editor-content { width: min(54rem, calc(100vw - 2rem)); }
  .credential-content { width: min(32rem, calc(100vw - 2rem)); }
  .modal-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.9rem; }
  .modal-header h2, .modal-header p { margin: 0; }
  .modal-header p { margin-top: 0.2rem; opacity: 0.7; }
  .icon-close { width: 2rem; height: 2rem; border: 0; border-radius: 0.4rem; background: #7c5b7d22; font-size: 1.5rem; line-height: 1; }
  .viewer-info { display: grid; grid-template-columns: minmax(8rem, 12rem) minmax(0, 1fr); gap: 0.4rem 0.75rem; overflow-wrap: anywhere; }
  .viewer-info > span { opacity: 0.7; }
  .viewer-info a { color: #3974b5; }
  .viewer-details h3 { margin-bottom: 0.5rem; }
  .viewer-teams { max-height: 45vh; overflow: auto; padding: 0.3rem; }
  .viewer-teams .raid-team { grid-template-columns: 1.5rem minmax(0, 1fr) minmax(6rem, 0.32fr); }
  .modal-footer { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
  .submission-form { display: grid; gap: 0.7rem; }
  .submission-form input, .submission-form select { width: 100%; box-sizing: border-box; }
  .form-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
  .editor-team-heading { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; }
  .editor-team-heading h3 { margin: 0.5rem 0; }
  .editor-teams { display: grid; gap: 0.6rem; max-height: 34vh; overflow: auto; padding: 0.2rem; }
  .editor-team { padding: 0.55rem; border: 1px solid #7c5b7d66; border-radius: 0.5rem; }
  .team-toolbar { display: flex; justify-content: space-between; margin-bottom: 0.35rem; }
  .team-toolbar > div { display: flex; gap: 0.2rem; }
  .icon-action { width: 1.8rem; height: 1.7rem; border: 1px solid #7c5b7d66; border-radius: 0.25rem; background: transparent; }
  .editor-slots { display: grid; grid-template-columns: repeat(4, minmax(2.5rem, 1fr)) repeat(2, minmax(2.5rem, 0.7fr)); gap: 0.45rem; }
  .team-student { display: grid; place-items: center; width: 100%; aspect-ratio: 1; overflow: hidden; padding: 0; border: 2px solid #7c5b7d88; border-radius: 0.4rem; background: #7c5b7d12; }
  .team-student img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .team-student.student-blank img { width: 1.2rem; height: 1.2rem; object-fit: contain; opacity: 0.65; }
  .team-student.student-borrow::after { content: 'Borrow'; position: absolute; inset: auto 0 0; background: #24242bce; color: white; text-align: center; font-size: 0.58rem; }
  .search-backdrop { z-index: 90; background: #09090d88; }
  .student-search-dialog { position: fixed; z-index: 91; inset: 50% auto auto 50%; transform: translate(-50%, -50%); width: min(28rem, calc(100vw - 2rem)); max-height: calc(100vh - 2rem); overflow: auto; margin: 0; padding: 0.9rem; border: 1px solid #7c5b7d; border-radius: 0.7rem; background: Canvas; color: CanvasText; box-shadow: 0 1rem 3rem #0008; }
  .search-dialog-heading { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .search-dialog-heading h2 { margin: 0; font-size: 1.1rem; }
  @media (max-width: 800px) {
    .timeline-scroll { max-height: 70vh; overflow-x: auto; overflow-y: auto; overscroll-behavior: contain; }
    .timeline-board { width: max-content; min-width: 0; grid-template-columns: repeat(3, 10rem); align-items: stretch; }
    .server-row { display: flex; width: 10rem; min-height: 0; flex-direction: column; gap: 0.35rem; }
    .server-label { position: static; flex-direction: row; justify-content: flex-start; padding: 0.35rem 0.55rem; }
    .server-label span { font-size: 1rem; }
    .server-label small { display: inline; }
    .server-timeline { display: grid; width: 100%; min-width: 0; grid-template-columns: minmax(0, 1fr); align-content: end; gap: 0.4rem; margin-top: auto; }
    .raid-card { width: 100%; min-width: 0; max-width: none; height: 7.8rem; }
    .timeline-section.collapsed .server-label { display: none; }
    .timeline-section.collapsed .timeline-board { width: 100%; grid-template-columns: minmax(0, 1fr); }
    .timeline-section.collapsed .server-row { width: 100%; }
    .timeline-section.collapsed .server-timeline { grid-template-columns: minmax(0, 1fr); }
    .timeline-section.collapsed .raid-card:not(.selected) { display: none; }
    .timeline-section.collapsed .raid-card.selected { width: 100%; }
    .selected-raid-heading { align-items: flex-start; flex-wrap: wrap; }
    .selected-raid-heading .submit-button { margin-left: auto; }
    .selected-raid-heading > img { width: 3rem; height: 3rem; }
    .selected-raid-heading h2 { font-size: 1.2rem; }
    .raid-team { grid-template-columns: 1rem minmax(0, 1fr) 3.5rem; gap: 0.2rem; }
    .student-borrow::after { font-size: 0.42rem; }
    .viewer-info { grid-template-columns: 1fr; gap: 0.15rem; }
    .viewer-info > strong, .viewer-info > a { margin-bottom: 0.45rem; }
  }
  @media (max-width: 600px) {
    .timeline-section, .submissions { padding: 0.55rem; }
    .editor-slots { gap: 0.25rem; }
    .student-filter-slot { width: 2.8rem; }
    .form-two-col { grid-template-columns: 1fr; }
    .selected-raid-heading .submit-button { width: 100%; }
  }
</style>
