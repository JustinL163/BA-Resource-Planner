import { describe, expect, it, vi } from 'vitest';
import { fetchTournamentRecords, submitTournamentRecord } from '../../src/lib/services/tournament-api';
import type { TournamentRecord } from '../../src/lib/domain/tournament';

const sample: TournamentRecord = {
  Tournament: 'tournament-7', Stage: 'qualifiers', Game: 'game-1', Player1: 'Wiggle', Player2: 'airu', Armour: 'light',
  ForcePick: '10000', Player1Bans: ['10001'], Player2Bans: [],
  Player1Teams: [['10000', null, null, null, ['10001'], null]],
  Player2Teams: [[null, null, null, null, null, null]], Player1Score: '2', Player2Score: '1'
};

describe('tournament API', () => {
  it('loads the legacy Data envelope with a client-side password header', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const transport: typeof fetch = async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify({ Data: JSON.stringify([JSON.stringify(sample)]) }), { status: 200 });
    };
    await expect(fetchTournamentRecords('private-value', transport)).resolves.toEqual([sample]);
    expect(requestUrl).toBe('https://api.justin163.com/loadtourneydata');
    expect(requestInit?.method).toBe('GET');
    expect(new Headers(requestInit?.headers).get('TournamentPassword')).toBe('private-value');
    expect(requestInit?.body).toBeUndefined();
  });

  it('posts the record as JSON and keeps the password out of the body', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    const transport: typeof fetch = async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify({ Result: 'Data saved' }), { status: 200 });
    };
    await expect(submitTournamentRecord(sample, 'private-value', transport)).resolves.toBeUndefined();
    expect(requestUrl).toBe('https://api.justin163.com/settourneydata');
    expect(requestInit?.method).toBe('POST');
    expect(new Headers(requestInit?.headers).get('TournamentPassword')).toBe('private-value');
    expect(new Headers(requestInit?.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(requestInit?.body))).toEqual(sample);
    expect(String(requestInit?.body)).not.toContain('private-value');
  });

  it('surfaces API errors and malformed successful responses', async () => {
    const apiFailure: typeof fetch = async () => new Response(JSON.stringify({ Error: 'Wrong tournament password' }), { status: 401 });
    const invalidSuccess: typeof fetch = async () => new Response('not json', { status: 200 });
    await expect(fetchTournamentRecords('private-value', apiFailure)).rejects.toThrow('Wrong tournament password');
    await expect(submitTournamentRecord(sample, 'private-value', invalidSuccess)).rejects.toThrow('invalid JSON');
  });

  it('requires a password without making a network request', async () => {
    const transport = vi.fn<typeof fetch>();
    await expect(fetchTournamentRecords('', transport)).rejects.toThrow('Tournament Password is required');
    await expect(submitTournamentRecord(sample, '', transport)).rejects.toThrow('Tournament Password is required');
    expect(transport).not.toHaveBeenCalled();
  });
});
