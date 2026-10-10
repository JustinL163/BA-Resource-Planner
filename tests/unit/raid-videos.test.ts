import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  combineRaidVideos, decodeRaidHistory, isRaidRecord, matchesVideoStudentFilters, preferredRaidDifficulty,
  type RaidLocation, type RaidRecord, type RaidVideo
} from '../../src/lib/domain/raid-videos';
import {
  editRaidVideo, fetchRaidVideoData, mergeStoredRaidVideos, saveLocalRaidVideo,
  submitRaidVideo
} from '../../src/lib/services/raid-videos';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const location: RaidLocation = { server: 'Global', uid: 3, difficulty: 'Insane' };
const video = (uuid: string, score: number, teams: RaidVideo['teams'] = [['10093', null, null, null, null, null]]): RaidVideo => ({
  uuid, score, level: 87, link: `https://youtu.be/${uuid}`, teams
});

describe('raid video migration contracts', () => {
  it('decodes the bundled raid catalog and preserves max-difficulty selection rules', () => {
    const source = readFileSync(resolve('planner/json/raids.json'), 'utf8');
    const history = decodeRaidHistory(JSON.parse(source));
    expect(history.servers).toEqual(['Japan', 'Global', 'China']);
    expect(history.Global).toHaveLength(61);
    const raid = history.Global.find((entry): entry is RaidRecord => isRaidRecord(entry) && entry.Max_Difficulty === 'INS');
    expect(raid).toBeDefined();
    expect(preferredRaidDifficulty(history, raid!, 'Extreme')).toBe('Extreme');
    expect(preferredRaidDifficulty(history, raid!, 'Normal')).toBe('Normal');
  });

  it('combines videos by score and removes expired or remotely published local copies', () => {
    const now = 100_000;
    const remote = [video('published', 40), video('other', 20)];
    const local = [
      { ...video('cached', 50), local_submission: true, expiry: now + 10_000 },
      { ...video('published', 60), local_submission: true, expiry: now + 10_000 },
      { ...video('expired', 90), local_submission: true, expiry: now - 1 },
      { ...video('no-expiry', 80), local_submission: true }
    ];
    const result = combineRaidVideos(remote, local, now);
    expect(result.videos.map((entry) => entry.uuid)).toEqual(['cached', 'published', 'other']);
    expect(result.retainedLocal.map((entry) => entry.uuid)).toEqual(['cached']);
    expect(result.pruned).toBe(true);
  });

  it('stores one-hour temporary copies and preserves unrelated local submission fields', () => {
    const storage = new MemoryStorage();
    storage.setItem('local-submissions', JSON.stringify({ untouched: { value: 5 }, Global: { unrelated: true } }));
    const now = 100_000;
    saveLocalRaidVideo(storage, location, {
      score: '12345678', level: '87', link: 'https://youtu.be/new',
      teams: [['10093', null, null, null, null, null]]
    }, 'from-api', now);
    const saved = JSON.parse(storage.getItem('local-submissions')!);
    expect(saved.untouched).toEqual({ value: 5 });
    expect(saved.Global.unrelated).toBe(true);
    expect(saved.Global.raids['3'].Insane[0]).toMatchObject({
      uuid: 'from-api', score: '12345678', local_submission: true, expiry: now + 3_600_000
    });
  });

  it('prunes local copies after the remote feed contains the UUID without rewriting other branches', () => {
    const storage = new MemoryStorage();
    const now = 100_000;
    storage.setItem('local-submissions', JSON.stringify({
      keep: 'unknown field',
      Global: { raids: { '3': { Insane: [
        { ...video('published', 30), local_submission: true, expiry: now + 1000 },
        { ...video('still-local', 20), local_submission: true, expiry: now + 1000 }
      ] } } }
    }));
    const shown = mergeStoredRaidVideos(storage, location, [video('published', 30)], now);
    expect(shown.map((entry) => entry.uuid)).toEqual(['published', 'still-local']);
    const saved = JSON.parse(storage.getItem('local-submissions')!);
    expect(saved.keep).toBe('unknown field');
    expect(saved.Global.raids['3'].Insane.map((entry: RaidVideo) => entry.uuid)).toEqual(['still-local']);
  });

  it('uses exact student ids for AND-includes and OR-excludes, including borrowed arrays', () => {
    const record = video('filter', 1, [['10093', ['10024'], null, null, null, null]]);
    expect(matchesVideoStudentFilters(record, ['10093', '10024'], [])).toBe(true);
    expect(matchesVideoStudentFilters(record, ['10093', '1001'], [])).toBe(false);
    expect(matchesVideoStudentFilters(record, [], ['10024'])).toBe(false);
  });

  it('fetches the existing static JSON URL and treats an absent raid file as an empty feed', async () => {
    let requested = '';
    const missing: typeof fetch = async (input) => {
      requested = String(input);
      return new Response('', { status: 404 });
    };
    expect(await fetchRaidVideoData('Global', 4, missing)).toEqual({});
    expect(requested).toBe('https://raw.githubusercontent.com/JustinL163/ba-planner-data/main/shared-videos/Global/raids/4.json');
  });

  it('posts the legacy submit and edit payloads with authenticated client headers', async () => {
    const credentials = { username: 'planner-user', authkey: 'abcdef' };
    const base = {
      server: 'Japan', uid: 7, difficulty: 'Torment', score: '40348000', level: '87',
      link: 'https://youtu.be/example',
      teams: [['10093', ['10024'], null, null, null, null]] as import('../../src/lib/domain/raid-videos').RaidTeamMember[][]
    };
    const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
    const transport: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>
      });
      return new Response(JSON.stringify({ UUID: 'saved-id' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    expect(await submitRaidVideo(base, credentials, transport)).toBe('saved-id');
    expect(await editRaidVideo({ ...base, uuid: 'existing-id' }, credentials, transport)).toBe('saved-id');
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.justin163.com/submitraid', 'https://api.justin163.com/editraid'
    ]);
    expect(calls[0].headers.get('Username')).toBe('planner-user');
    expect(calls[0].headers.get('Auth-Key')).toBe('abcdef');
    expect(calls[0].body).toEqual({
      Server: 'Japan', Type: 'raids', Raid_Index: 7, Difficulty: 'Torment',
      Score: '40348000', Level: '87', Video_Link: 'https://youtu.be/example', Teams: base.teams
    });
    expect(calls[1].body).toEqual({ ...calls[0].body, UUID: 'existing-id' });
  });

  it('surfaces raid API errors without inventing a successful UUID', async () => {
    const transport: typeof fetch = async () => new Response(JSON.stringify({ Error: 'Not authorized' }), { status: 403 });
    await expect(submitRaidVideo({
      server: 'Global', uid: 1, difficulty: 'Insane', score: '1', level: '1',
      link: 'https://youtu.be/example', teams: [['10093', null, null, null, null, null]]
    }, { username: 'planner-user', authkey: 'abcdef' }, transport)).rejects.toThrow('Not authorized');
  });
});
