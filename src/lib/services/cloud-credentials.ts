export interface CloudCredentials { username: string; authkey: string }

export function validateUsername(username: string): void {
  if (username.length < 5 || username.length > 20 || !username.trim()) throw new Error('Username must contain 5-20 characters.');
}

export function validateCredentials(credentials: CloudCredentials): void {
  validateUsername(credentials.username);
  if (credentials.authkey.length !== 6) throw new Error('Auth Key must contain six characters.');
}

export function readCloudCredentials(storage: Pick<Storage, 'getItem'>): CloudCredentials | null {
  const username = storage.getItem('username'), authkey = storage.getItem('authkey');
  if (username === null && authkey === null) return null;
  if (username === null || authkey === null) throw new Error('Stored cloud credentials are incomplete. Enter your account details to load the account.');
  const credentials = { username, authkey };
  validateCredentials(credentials);
  return credentials;
}
