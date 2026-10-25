import { decodeTournamentRecords, type TournamentRecord } from '../domain/tournament';

const apiRoot = 'https://api.justin163.com';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function responseValue(response: Response): Promise<unknown> {
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { throw new Error(response.ok ? 'The tournament API returned invalid JSON.' : `Tournament API request failed (HTTP ${response.status}).`); }
}

function apiError(value: unknown): string | null {
  return isRecord(value) && typeof value.Error === 'string' && value.Error ? value.Error : null;
}

export async function fetchTournamentRecords(
  password: string, transport: typeof fetch = (...args) => fetch(...args), signal?: AbortSignal
): Promise<TournamentRecord[]> {
  if (!password) throw new Error('Tournament Password is required');
  const response = await transport(`${apiRoot}/loadtourneydata`, {
    method: 'GET', headers: { TournamentPassword: password }, signal
  });
  const value = await responseValue(response);
  const message = apiError(value);
  if (message) throw new Error(message);
  if (response.status !== 200) throw new Error(`Tournament API request failed (HTTP ${response.status}).`);
  return decodeTournamentRecords(value);
}

export async function submitTournamentRecord(
  record: TournamentRecord, password: string, transport: typeof fetch = (...args) => fetch(...args)
): Promise<void> {
  if (!password) throw new Error('Tournament Password is required');
  const response = await transport(`${apiRoot}/settourneydata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', TournamentPassword: password },
    body: JSON.stringify(record)
  });
  const value = await responseValue(response);
  const message = apiError(value);
  if (message) throw new Error(message);
  if (response.status !== 200) throw new Error(`Tournament API request failed (HTTP ${response.status}).`);
  if (value === null || value === false) throw new Error('The tournament API did not confirm the save.');
}
