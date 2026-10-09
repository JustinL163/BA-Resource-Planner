import { isRecord } from '../domain/planner/save';
import { compressSave, decompressSave } from './compression';
import { validateCredentials, validateUsername, type CloudCredentials } from './cloud-credentials';

interface CloudCodec {
  compress: (source: string, signal?: AbortSignal) => Promise<Uint8Array>;
  decompress: (bytes: Uint8Array, signal?: AbortSignal) => Promise<string>;
}
const codec: CloudCodec = {
  compress: (source, signal) => compressSave(source, { signal }),
  decompress: (bytes, signal) => decompressSave(bytes, { signal })
};
export const cloudCooldownMs = 130000;
const api = 'https://api.justin163.com';

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new Error(`Cloud request returned invalid JSON (HTTP ${response.status}).`); }
  if (!isRecord(value)) throw new Error('Cloud request returned an invalid response object.');
  if (typeof value.Error === 'string') throw new Error(value.Error);
  if (!response.ok) throw new Error(`Cloud request failed (HTTP ${response.status}).`);
  return value;
}

export class CloudTransfers {
  private deadlines = { save: 0, load: 0 };
  constructor(
    private transport: typeof fetch = (...args) => fetch(...args),
    private compression: CloudCodec = codec
  ) {}
  remaining(kind: 'save' | 'load', now = Date.now()): number { return Math.max(this.deadlines[kind] - now, 0); }
  private begin(kind: 'save' | 'load') {
    const remaining = this.remaining(kind);
    if (remaining > 0) throw new Error(`Please wait ${Math.ceil(remaining / 1000)} seconds before another cloud ${kind}.`);
    this.deadlines[kind] = Date.now() + cloudCooldownMs;
  }
  async register(username: string, signal?: AbortSignal): Promise<CloudCredentials> {
    validateUsername(username);
    const response = await this.transport(`${api}/register`, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ Username: username })
    });
    const value = await responseJson(response);
    if (typeof value.Auth_Key !== 'string') throw new Error('Cloud registration did not return an Auth Key.');
    const credentials = { username, authkey: value.Auth_Key };
    validateCredentials(credentials);
    return credentials;
  }
  async save(credentials: CloudCredentials, source: string, signal?: AbortSignal): Promise<void> {
    validateCredentials(credentials);
    const value: unknown = JSON.parse(source);
    if (!isRecord(value)) throw new Error('Only a valid planner save can be uploaded.');
    this.begin('save');
    const bytes = await this.compression.compress(source, signal);
    const response = await this.transport(`${api}/save`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/octet-stream', Username: credentials.username, 'Auth-Key': credentials.authkey },
      body: new Uint8Array(bytes).buffer
    });
    const result = await responseJson(response);
    if (result.Result !== 'Data saved') throw new Error('The cloud service did not confirm that data was saved.');
  }
  async load(credentials: CloudCredentials, signal?: AbortSignal): Promise<string> {
    validateCredentials(credentials);
    this.begin('load');
    const response = await this.transport(`${api}/load`, {
      signal, headers: { Username: credentials.username, 'Auth-Key': credentials.authkey }
    });
    if (!response.ok || response.headers.get('Content-Type')?.includes('application/json')) {
      await responseJson(response);
      throw new Error('The cloud service returned JSON instead of a compressed save.');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) throw new Error('The cloud service returned an empty save.');
    return this.compression.decompress(bytes, signal);
  }
}

export const cloudTransfers = new CloudTransfers();
