<script lang="ts">
  import { onMount } from 'svelte';
  import PlannerDialog from './PlannerDialog.svelte';
  import { cloudTransfers } from '$lib/services/cloud-transfers';
  import { readCloudCredentials, validateCredentials, type CloudCredentials } from '$lib/services/cloud-credentials';
  import { writeStorageTransaction } from '$lib/services/storage-transaction';

  let { ready, canImport, currentSource, importCloud, busy = $bindable(false), t }: {
    ready: boolean; canImport: boolean; currentSource: () => string;
    importCloud: (source: string, expected: string | null, credentials: CloudCredentials) => Promise<boolean>;
    busy?: boolean; t: (id: string) => string;
  } = $props();
  let username = $state('');
  let authkey = $state('');
  let reveal = $state(false);
  let confirmingLoad = $state(false);
  let stored = $state<CloudCredentials | null>(null);
  let created = $state(false);
  let message = $state('');
  let error = $state('');
  let now = $state(0);
  let operation = $state<'' | 'register' | 'save' | 'load'>('');
  let validUsername = $derived(username.length >= 5 && username.length <= 20 && Boolean(username.trim()));
  let validCredentials = $derived(validUsername && authkey.length === 6);
  let matchesAccount = $derived(stored?.username === username && stored?.authkey === authkey);
  const controller = new AbortController();
  let saveWait = $derived.by(() => { operation; return cloudTransfers.remaining('save', now); });
  let loadWait = $derived.by(() => { operation; return cloudTransfers.remaining('load', now); });

  function report(problem: unknown) {
    console.error('Cloud transfer failed.', problem);
    error = problem instanceof Error ? problem.message : t('ui-cloud-error');
  }
  onMount(() => {
    try {
      username = localStorage.getItem('username') ?? '';
      authkey = localStorage.getItem('authkey') ?? '';
      stored = readCloudCredentials(localStorage);
    } catch (problem) { report(problem); }
    now = Date.now();
    const timer = setInterval(() => now = Date.now(), 1000);
    return () => { clearInterval(timer); controller.abort(); };
  });
  function remember(credentials: CloudCredentials) {
    writeStorageTransaction(localStorage, { username: credentials.username, authkey: credentials.authkey });
    stored = credentials;
  }
  async function transfer(kind: 'register' | 'save' | 'load') {
    if (busy) return;
    busy = true; operation = kind; error = ''; message = '';
    try {
      if (kind === 'register') {
        if (readCloudCredentials(localStorage)) throw new Error(t('ui-cloud-account-changed'));
        const credentials = await cloudTransfers.register(username, controller.signal);
        created = true; username = credentials.username; authkey = credentials.authkey;
        message = t('ui-cloud-registered');
        remember(credentials);
        const source = currentSource();
        await cloudTransfers.save(credentials, source, controller.signal);
        message = t('ui-cloud-snapshot-saved');
        message = currentSource() === source ? t('ui-cloud-registered-saved') : t('ui-cloud-snapshot-saved');
      } else {
        const credentials = { username, authkey };
        validateCredentials(credentials);
        if (kind === 'save') {
          const remembered = readCloudCredentials(localStorage);
          if (remembered?.username !== username || remembered?.authkey !== authkey) throw new Error(t('ui-cloud-account-changed'));
          const source = currentSource();
          await cloudTransfers.save(credentials, source, controller.signal);
          message = t('ui-cloud-snapshot-saved');
          message = currentSource() === source ? t('ui-cloud-saved') : t('ui-cloud-snapshot-saved');
          remember(credentials);
        } else {
          const expected = localStorage.getItem('save-data');
          const source = await cloudTransfers.load(credentials, controller.signal);
          if (await importCloud(source, expected, credentials)) {
            stored = credentials; confirmingLoad = false; message = t('ui-cloud-loaded');
          }
        }
      }
    } catch (problem) {
      if (!controller.signal.aborted) report(problem);
    } finally {
      busy = false; operation = ''; now = Date.now();
    }
  }
  async function confirmLoad() {
    confirmingLoad = false;
    await transfer('load');
  }
</script>

<section aria-labelledby="cloud-transfer-heading">
  <h3 id="cloud-transfer-heading">{t('ui-cloud-transfer')}</h3>
  <p class="note">{t('ui-cloud-help')}</p>
  <fieldset disabled={busy}>
    <div class="credentials">
      <label>{t('ui-cloud-username')}<input autocomplete="username" maxlength="20" bind:value={username} /></label>
      <label>{t('ui-cloud-authkey')}<input type={reveal ? 'text' : 'password'} autocomplete="off" maxlength="6" bind:value={authkey} /></label>
    </div>
    <label class="confirm"><input type="checkbox" bind:checked={reveal} />{t('ui-show-authkey')}</label>
    {#if stored}<p class="note">{t('ui-cloud-account')}: {stored.username}</p>{/if}
    <div class="buttons">
      <button disabled={!ready || !validUsername || Boolean(authkey) || Boolean(stored) || created} onclick={() => { void transfer('register'); }}>{t('ui-cloud-register')}</button>
      <button disabled={!ready || !matchesAccount || saveWait > 0} onclick={() => { void transfer('save'); }}>{t('ui-cloud-save')}</button>
      <button disabled={!canImport || !validCredentials || loadWait > 0} onclick={() => confirmingLoad = true}>{t('ui-cloud-load')}</button>
    </div>
  </fieldset>
  {#if busy}<p role="status">{t(`ui-cloud-${operation}-pending`)}</p>{/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if saveWait || loadWait}<p class="note">{t('ui-cloud-cooldown')}: {t('ui-cloud-save')} {Math.ceil(saveWait / 1000)}s,
    {t('ui-cloud-load')} {Math.ceil(loadWait / 1000)}s</p>{/if}
</section>

{#if confirmingLoad}
  <PlannerDialog title={t('label-areyousure')} close={() => confirmingLoad = false} {t} width="440px" showClose={false}>
    <div class="confirmation">
      <p>{t('ui-cloud-overwrite-confirm')}</p>
      <footer>
        <button onclick={() => confirmingLoad = false}>{t('label-cancel')}</button>
        <button onclick={() => void confirmLoad()}>{t('ui-cloud-load')}</button>
      </footer>
    </div>
  </PlannerDialog>
{/if}

<style>
  section { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #7c5b7d66; }
  fieldset { border: 0; padding: 0; min-width: 0; }
  .credentials { display: flex; flex-wrap: wrap; gap: 1rem; }
  label { display: flex; flex-direction: column; gap: 0.4rem; }
  input:not([type="checkbox"]) { padding: 0.5rem; min-width: 0; }
  .confirm { flex-direction: row; align-items: center; gap: 0.5rem; margin: 0.8rem 0; }
  .buttons { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .confirmation { min-width: min(22rem, calc(100vw - 3rem)); }
  .confirmation p { margin: 0; line-height: 1.5; }
  .confirmation footer { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
  .note { font-size: 0.85rem; line-height: 1.5; }
  .error { color: var(--error); }
  @media (max-width: 600px) { .confirmation { min-width: 0; } }
</style>
