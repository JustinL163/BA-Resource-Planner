import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudTransfers, cloudCooldownMs } from '../../src/lib/services/cloud-transfers';
import { readCloudCredentials } from '../../src/lib/services/cloud-credentials';
import { writeStorageTransaction } from '../../src/lib/services/storage-transaction';

const credentials = { username: 'fixture-user', authkey: 'ABC123' };
const source = '{"exportVersion":2,"characters":[]}';
const bytes = new Uint8Array([1, 2, 255]);
const codec = {
  compress: vi.fn(async () => bytes),
  decompress: vi.fn(async () => source)
};
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('compatible cloud request protocol', () => {
  it('registers with the original JSON body and reads the generated Auth Key', async () => {
    const transport = vi.fn(async () => new Response('{"Auth_Key":"ABC123"}'));
    const client = new CloudTransfers(transport, codec);
    await expect(client.register('fixture-user')).resolves.toEqual(credentials);
    expect(transport).toHaveBeenCalledWith('https://api.justin163.com/register', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"Username":"fixture-user"}'
    }));
  });
  it('uploads the exact compressed binary format and authentication headers', async () => {
    const transport = vi.fn(async () => new Response('{"Result":"Data saved"}'));
    const client = new CloudTransfers(transport, codec);
    await client.save(credentials, source);
    expect(codec.compress).toHaveBeenCalledWith(source, undefined);
    expect(transport).toHaveBeenCalledWith('https://api.justin163.com/save', expect.objectContaining({
      method: 'POST', body: bytes.buffer,
      headers: { 'Content-Type': 'application/octet-stream', Username: 'fixture-user', 'Auth-Key': 'ABC123' }
    }));
  });
  it('loads binary data through the existing decompressor', async () => {
    const transport = vi.fn(async () => new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }));
    const client = new CloudTransfers(transport, codec);
    await expect(client.load(credentials)).resolves.toBe(source);
    expect(codec.decompress).toHaveBeenCalledWith(bytes, undefined);
    expect(transport).toHaveBeenCalledWith('https://api.justin163.com/load', expect.objectContaining({
      headers: { Username: 'fixture-user', 'Auth-Key': 'ABC123' }
    }));
  });
  it('preserves independent save/load cooldowns', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01'));
    const client = new CloudTransfers(async () => new Response('{"Result":"Data saved"}'), codec);
    await client.save(credentials, source);
    expect(client.remaining('save')).toBe(cloudCooldownMs);
    expect(client.remaining('load')).toBe(0);
    await expect(client.save(credentials, source)).rejects.toThrow('wait 130 seconds');
    vi.advanceTimersByTime(cloudCooldownMs + 1);
    await expect(client.save(credentials, source)).resolves.toBeUndefined();
  });
  it('reports API errors, invalid confirmations and malformed responses explicitly', async () => {
    await expect(new CloudTransfers(async () => new Response('{"Error":"Invalid account"}', { status: 403 }), codec)
      .load(credentials)).rejects.toThrow('Invalid account');
    await expect(new CloudTransfers(async () => new Response('{"Result":"Unexpected"}'), codec)
      .save(credentials, source)).rejects.toThrow('did not confirm');
    await expect(new CloudTransfers(async () => new Response('not json', { status: 500 }), codec)
      .register('fixture-user')).rejects.toThrow('invalid JSON (HTTP 500)');
  });
  it('rejects invalid input before contacting the service', async () => {
    const transport = vi.fn();
    const client = new CloudTransfers(transport, codec);
    await expect(client.register('x')).rejects.toThrow('5-20');
    await expect(client.load({ ...credentials, authkey: 'wrong' })).rejects.toThrow('six');
    await expect(client.save(credentials, 'null')).rejects.toThrow('valid planner');
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('cloud credentials and transactional storage', () => {
  it('reads existing credential keys and does not turn partial credentials into a logged-in account', () => {
    expect(readCloudCredentials({ getItem: (key) => key === 'username' ? credentials.username : credentials.authkey })).toEqual(credentials);
    expect(readCloudCredentials({ getItem: () => null })).toBeNull();
    expect(() => readCloudCredentials({ getItem: (key) => key === 'username' ? credentials.username : null })).toThrow('incomplete');
  });
  it('rolls back earlier writes when a later write fails', () => {
    const map = new Map([['username', 'old-user'], ['save-data', 'old-save']]);
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem(key: string, value: string) { if (key === 'save-data') throw new Error('Quota exceeded'); map.set(key, value); },
      removeItem: (key: string) => { map.delete(key); }
    };
    expect(() => writeStorageTransaction(storage, { username: 'new-user', authkey: 'ABC123', 'save-data': 'new-save' })).toThrow('Quota exceeded');
    expect(map.get('username')).toBe('old-user');
    expect(map.get('save-data')).toBe('old-save');
    expect(map.has('authkey')).toBe(false);
  });
});
