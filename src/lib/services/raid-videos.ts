import {
  appendLocalRaidVideo, decodeRaidVideoData, getLocalRaidVideos, pruneLocalRaidVideos,
  type RaidLocation, type RaidVideo, type RaidVideoData, type RaidTeamMember, type RaidVideoSubmissionFields
} from '../domain/raid-videos';
import { validateCredentials, type CloudCredentials } from './cloud-credentials';

const videoDataRoot = 'https://raw.githubusercontent.com/JustinL163/ba-planner-data/main/shared-videos';
const apiRoot = 'https://api.justin163.com';

export interface NewRaidSubmission extends RaidVideoSubmissionFields {
  score: string;
  level: string;
}

export interface RaidApiRequest extends NewRaidSubmission {
  server: string;
  uid: number;
  difficulty: string;
  uuid?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readLocalRaidSubmissionStore(storage: Pick<Storage, 'getItem'>): Record<string, unknown> {
  const source = storage.getItem('local-submissions');
  if (source === null) return {};
  let value: unknown;
  try { value = JSON.parse(source); }
  catch { throw new Error('Saved raid submissions could not be read. They have not been replaced.'); }
  if (!isRecord(value)) throw new Error('Saved raid submissions have an invalid format. They have not been replaced.');
  return value;
}

export async function fetchRaidVideoData(
  server: string, uid: number, transport: typeof fetch = (...args) => fetch(...args), signal?: AbortSignal
): Promise<RaidVideoData> {
  const url = `${videoDataRoot}/${encodeURIComponent(server)}/raids/${encodeURIComponent(String(uid))}.json`;
  const response = await transport(url, { signal });
  if (response.status === 404) return {};
  if (!response.ok) throw new Error(`Could not load raid videos (HTTP ${response.status}).`);
  let value: unknown;
  try { value = await response.json(); }
  catch { throw new Error('Raid video data returned invalid JSON.'); }
  return decodeRaidVideoData(value);
}

export function mergeStoredRaidVideos(
  storage: Pick<Storage, 'getItem' | 'setItem'>, location: RaidLocation,
  remote: RaidVideo[], now = Date.now()
): RaidVideo[] {
  const stored = readLocalRaidSubmissionStore(storage);
  const { store, result } = pruneLocalRaidVideos(stored, location, remote, now);
  if (result.pruned) storage.setItem('local-submissions', JSON.stringify(store));
  return result.videos;
}

export function saveLocalRaidVideo(
  storage: Pick<Storage, 'getItem' | 'setItem'>, location: RaidLocation,
  submission: NewRaidSubmission, uuid: string, now = Date.now()
): void {
  const stored = readLocalRaidSubmissionStore(storage);
  const next = appendLocalRaidVideo(stored, location, submission, uuid, now);
  storage.setItem('local-submissions', JSON.stringify(next));
}

async function postRaidVideo(
  endpoint: 'submitraid' | 'editraid', request: RaidApiRequest, credentials: CloudCredentials,
  transport: typeof fetch
): Promise<string> {
  validateCredentials(credentials);
  const body: Record<string, unknown> = {
    Server: request.server,
    Type: 'raids',
    Raid_Index: request.uid,
    Difficulty: request.difficulty,
    Score: request.score,
    Level: request.level,
    Video_Link: request.link,
    Teams: request.teams
  };
  if (endpoint === 'editraid') {
    if (!request.uuid) throw new Error('The video submission ID is missing.');
    body.UUID = request.uuid;
  }
  const response = await transport(`${apiRoot}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Username: credentials.username,
      'Auth-Key': credentials.authkey
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let value: unknown;
  try { value = JSON.parse(text); }
  catch {
    throw new Error(response.ok ? 'The raid API returned invalid JSON.' : `Raid API request failed (HTTP ${response.status}).`);
  }
  if (isRecord(value) && typeof value.Error === 'string') throw new Error(value.Error);
  if (!response.ok) throw new Error(`Raid API request failed (HTTP ${response.status}).`);
  if (!isRecord(value) || typeof value.UUID !== 'string' || !value.UUID) {
    throw new Error('The raid API did not confirm the submission.');
  }
  return value.UUID;
}

export function submitRaidVideo(
  request: RaidApiRequest, credentials: CloudCredentials,
  transport: typeof fetch = (...args) => fetch(...args)
): Promise<string> {
  return postRaidVideo('submitraid', request, credentials, transport);
}

export function editRaidVideo(
  request: RaidApiRequest, credentials: CloudCredentials,
  transport: typeof fetch = (...args) => fetch(...args)
): Promise<string> {
  return postRaidVideo('editraid', request, credentials, transport);
}

export function storedRaidVideos(storage: Pick<Storage, 'getItem'>, location: RaidLocation): RaidVideo[] {
  return getLocalRaidVideos(readLocalRaidSubmissionStore(storage), location);
}
