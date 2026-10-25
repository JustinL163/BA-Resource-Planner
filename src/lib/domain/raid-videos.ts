export const raidServers = ['Japan', 'Global', 'China'] as const;
export type RaidServer = (typeof raidServers)[number];

export interface RaidRecord {
  Boss: string;
  Terrain: string;
  Max_Difficulty: string;
  Armour: string;
  Start_Date: { Year: number; Month: number; Day: number };
  Season: number;
  Boss_Count: number;
  Boss_Terrain_Count: number;
  uid: number;
}

export interface RaidBlank { Blank: true }
export type RaidTimelineEntry = RaidRecord | RaidBlank;

export interface RaidHistory {
  servers: RaidServer[];
  raids: Record<string, { Terrains: string[] }>;
  raid_difficulties: string[];
  raid_difficulties_short: string[];
  Japan: RaidTimelineEntry[];
  Global: RaidTimelineEntry[];
  China: RaidTimelineEntry[];
}

export type RaidTeamMember = string | [string] | null;

export interface RaidVideo extends Record<string, unknown> {
  uuid: string;
  score: number | string;
  level: number | string;
  link: string;
  teams: RaidTeamMember[][];
  author?: string;
  local_submission?: boolean;
  expiry?: number;
}

export interface RaidVideoSubmissionFields extends Record<string, unknown> {
  score: number | string;
  level: number | string;
  link: string;
  teams: RaidTeamMember[][];
}

export type RaidVideoData = Record<string, RaidVideo[]>;

export interface RaidLocation {
  server: RaidServer;
  uid: number;
  difficulty: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validRaid(value: unknown): value is RaidRecord {
  if (!isRecord(value) || !isRecord(value.Start_Date)) return false;
  const startDate = value.Start_Date;
  return typeof value.Boss === 'string' && typeof value.Terrain === 'string' &&
    typeof value.Max_Difficulty === 'string' && typeof value.Armour === 'string' &&
    ['Year', 'Month', 'Day'].every((key) => typeof startDate[key] === 'number') &&
    ['Season', 'Boss_Count', 'Boss_Terrain_Count', 'uid'].every((key) => typeof value[key] === 'number');
}

export function isRaidRecord(value: RaidTimelineEntry): value is RaidRecord {
  return !('Blank' in value);
}

export function decodeRaidHistory(value: unknown): RaidHistory {
  if (!isRecord(value) || !Array.isArray(value.servers) ||
    !value.servers.every((server) => raidServers.includes(server as RaidServer)) ||
    !isRecord(value.raids) || !Array.isArray(value.raid_difficulties) ||
    !value.raid_difficulties.every((difficulty) => typeof difficulty === 'string') ||
    !Array.isArray(value.raid_difficulties_short) ||
    !value.raid_difficulties_short.every((difficulty) => typeof difficulty === 'string')) {
    throw new Error('Raid history has an invalid format.');
  }
  const servers = value.servers as RaidServer[];
  if (servers.length !== raidServers.length || raidServers.some((server) => !servers.includes(server))) {
    throw new Error('Raid history must include Japan, Global, and China.');
  }
  const raidMeta: Record<string, { Terrains: string[] }> = {};
  for (const [boss, raw] of Object.entries(value.raids)) {
    if (!isRecord(raw) || !Array.isArray(raw.Terrains) || !raw.Terrains.every((terrain) => typeof terrain === 'string')) {
      throw new Error(`Raid history has invalid terrain data for ${boss}.`);
    }
    raidMeta[boss] = { Terrains: raw.Terrains };
  }
  const result = {} as RaidHistory;
  for (const server of raidServers) {
    const raids = value[server];
    if (!Array.isArray(raids) || !raids.every((entry) =>
      (isRecord(entry) && entry.Blank === true && Object.keys(entry).length === 1) || validRaid(entry)
    )) throw new Error(`Raid history for ${server} has an invalid format.`);
    result[server] = raids as RaidTimelineEntry[];
  }
  result.servers = servers;
  result.raids = raidMeta;
  result.raid_difficulties = value.raid_difficulties as string[];
  result.raid_difficulties_short = value.raid_difficulties_short as string[];
  if (result.raid_difficulties.length !== result.raid_difficulties_short.length) {
    throw new Error('Raid history has mismatched difficulty labels.');
  }
  return result;
}

function validVideo(value: unknown): value is RaidVideo {
  if (!isRecord(value)) return false;
  return (typeof value.uuid === 'string' || typeof value.uuid === 'number') &&
    (typeof value.score === 'string' || typeof value.score === 'number') &&
    (typeof value.level === 'string' || typeof value.level === 'number') &&
    typeof value.link === 'string' && Array.isArray(value.teams) &&
    value.teams.every((team) => Array.isArray(team));
}

export function decodeRaidVideoData(value: unknown): RaidVideoData {
  if (!isRecord(value)) throw new Error('Raid video data has an invalid format.');
  const result: RaidVideoData = {};
  for (const [difficulty, entries] of Object.entries(value)) {
    if (!Array.isArray(entries) || !entries.every(validVideo)) {
      throw new Error(`Raid video data for ${difficulty} has an invalid format.`);
    }
    result[difficulty] = entries.map((entry) => ({ ...entry, uuid: String(entry.uuid) }));
  }
  return result;
}

function objectAt(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
}

export function getLocalRaidVideos(store: unknown, location: RaidLocation): RaidVideo[] {
  const server = objectAt(store, location.server);
  const type = objectAt(server?.raids, String(location.uid));
  const entries = type?.[location.difficulty];
  return Array.isArray(entries) ? entries.filter(validVideo).map((entry) => ({ ...entry, uuid: String(entry.uuid) })) : [];
}

export interface CombinedRaidVideos {
  videos: RaidVideo[];
  retainedLocal: RaidVideo[];
  pruned: boolean;
}

export function combineRaidVideos(
  remote: RaidVideo[], local: RaidVideo[], now = Date.now()
): CombinedRaidVideos {
  const remoteUuids = new Set(remote.filter((video) => !video.local_submission).map((video) => video.uuid));
  const retainedLocal = local.filter((video) =>
    Boolean(video.expiry) && Number(video.expiry) >= now && !remoteUuids.has(video.uuid)
  );
  const videos = [...remote, ...retainedLocal].sort((first, second) => Number(second.score) - Number(first.score));
  return { videos, retainedLocal, pruned: retainedLocal.length !== local.length };
}

function setLocalRaidVideos(
  store: Record<string, unknown>, location: RaidLocation, videos: RaidVideo[]
): Record<string, unknown> {
  const next = { ...store };
  const server = { ...(objectAt(next, location.server) ?? {}) };
  const raids = { ...(objectAt(server, 'raids') ?? {}) };
  const raid = { ...(objectAt(raids, String(location.uid)) ?? {}) };
  raid[location.difficulty] = videos;
  raids[String(location.uid)] = raid;
  server.raids = raids;
  next[location.server] = server;
  return next;
}

export function appendLocalRaidVideo(
  store: unknown, location: RaidLocation, submission: RaidVideoSubmissionFields,
  uuid: string, now = Date.now()
): Record<string, unknown> {
  const root = isRecord(store) ? store : {};
  const existing = getLocalRaidVideos(root, location);
  const localVideo: RaidVideo = {
    ...submission,
    uuid,
    local_submission: true,
    expiry: now + 60 * 60 * 1000
  };
  return setLocalRaidVideos(root, location, [...existing, localVideo]);
}

export function pruneLocalRaidVideos(
  store: unknown, location: RaidLocation, remote: RaidVideo[], now = Date.now()
): { store: Record<string, unknown>; result: CombinedRaidVideos } {
  const root = isRecord(store) ? store : {};
  const local = getLocalRaidVideos(root, location);
  const result = combineRaidVideos(remote, local, now);
  return {
    store: result.pruned ? setLocalRaidVideos(root, location, result.retainedLocal) : root,
    result
  };
}

export function studentIdsInVideo(video: RaidVideo): Set<string> {
  const ids = new Set<string>();
  for (const team of video.teams) {
    for (const member of team) {
      if (typeof member === 'string') ids.add(member);
      else if (Array.isArray(member) && typeof member[0] === 'string') ids.add(member[0]);
    }
  }
  return ids;
}

export function matchesVideoStudentFilters(video: RaidVideo, included: string[], excluded: string[]): boolean {
  const students = studentIdsInVideo(video);
  return included.every((id) => students.has(id)) && excluded.every((id) => !students.has(id));
}

export function raidDifficultyOptions(history: RaidHistory, raid: RaidRecord): string[] {
  const start = history.raid_difficulties_short.indexOf(raid.Max_Difficulty);
  if (start < 0) throw new Error(`Unknown maximum raid difficulty ${raid.Max_Difficulty}.`);
  return history.raid_difficulties.slice(start);
}

export function preferredRaidDifficulty(history: RaidHistory, raid: RaidRecord, previous: string): string {
  const start = history.raid_difficulties_short.indexOf(raid.Max_Difficulty);
  const previousIndex = history.raid_difficulties.indexOf(previous);
  return previousIndex >= start && previousIndex >= 0 ? previous : history.raid_difficulties[start];
}
