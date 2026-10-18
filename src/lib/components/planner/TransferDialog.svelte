<script lang="ts">
  import { tick } from 'svelte';
  import { page } from '$app/state';
  import PlannerDialog from './PlannerDialog.svelte';
  import CloudTransfer from './CloudTransfer.svelte';
  import type { CloudCredentials } from '$lib/services/cloud-credentials';
  let { ready, canImport, exportData, currentSource, importCloud, importData, close, error, t }: {
    ready: boolean; canImport: boolean; exportData: () => string;
    importData: (source: string) => Promise<boolean>; close: () => void; error: string;
    currentSource: () => string; importCloud: (source: string, expected: string | null, credentials: CloudCredentials) => Promise<boolean>;
    t: (id: string) => string;
  } = $props();
  let source = $state('');
  let confirmingImport = $state(false);
  let importing = $state(false);
  let localError = $state('');
  let cloudBusy = $state(false);
  let showCloudTransfer = $derived(page.url.searchParams.get('show-cloud-save') === '1');

  function download() {
    try {
      const url = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'blue-archive-planner.json';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      localError = '';
    } catch (problem) {
      console.error('Planner export failed.', problem);
      localError = problem instanceof Error ? problem.message : t('ui-transfer-failed');
    }
  }

  async function confirmImport() {
    importing = true;
    confirmingImport = false;
    await tick();
    try { if (await importData(source)) close(); }
    finally { importing = false; }
  }
</script>

<PlannerDialog title={t('footer-transfer')} {close} {t} busy={cloudBusy || importing} width="640px">
  {#if localError || error}<p class="error" role="alert">{localError || error}</p>{/if}
  {#if showCloudTransfer}
    <CloudTransfer {ready} {canImport} {currentSource} {importCloud} bind:busy={cloudBusy} {t} />
  {/if}
  <fieldset disabled={cloudBusy || importing}>
  <h3>{t('ui-local-transfer')}</h3>
  <div class="local-transfer-actions">
    <button disabled={!ready} onclick={download}>{t('ui-export-save')}</button>
    <button disabled={!canImport || !source.trim() || importing} onclick={() => confirmingImport = true}>{t('ui-import-save')}</button>
  </div>
  <label>{t('ui-import-file')}<input type="file" accept=".json,application/json" onchange={async (event) => {
    try {
      const file = event.currentTarget.files?.[0];
      if (file) source = await file.text();
      localError = '';
    } catch (problem) {
      console.error('Planner file read failed.', problem);
      localError = problem instanceof Error ? problem.message : t('ui-transfer-failed');
    }
  }} /></label>
  <label>{t('ui-import-json')}<textarea rows="6" bind:value={source}></textarea></label>
  </fieldset>
</PlannerDialog>

{#if confirmingImport}
  <PlannerDialog title={t('label-areyousure')} close={() => confirmingImport = false} {t} width="440px" showClose={false}>
    <div class="confirmation">
      <p>{t('ui-import-warning')}</p>
      <footer>
        <button onclick={() => confirmingImport = false}>{t('label-cancel')}</button>
        <button class="import-button" onclick={() => void confirmImport()}>{t('ui-import-save')}</button>
      </footer>
    </div>
  </PlannerDialog>
{/if}

<style>
  h3 { margin: 0.25rem 0 0.6rem; }
  .local-transfer-actions { display: flex; gap: 0.75rem; margin-bottom: 0.75rem; }
  .local-transfer-actions > button { flex: 1 1 0; min-width: 0; }
  label { display: flex; flex-direction: column; gap: 0.4rem; margin: 0.75rem 0; }
  textarea { width: 100%; min-width: 0; padding: 0.5rem; }
  p { line-height: 1.5; }
  .error { color: var(--error); }
  fieldset { padding: 0; border: 0; min-width: 0; }
  .confirmation { min-width: min(22rem, calc(100vw - 3rem)); }
  .confirmation p { margin: 0; }
  .confirmation footer { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
  @media (max-width: 600px) { .confirmation { min-width: 0; } }
</style>
