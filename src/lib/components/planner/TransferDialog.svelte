<script lang="ts">
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
  let confirmed = $state(false);
  let importing = $state(false);
  let localError = $state('');
  let cloudBusy = $state(false);

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
</script>

<PlannerDialog title={t('footer-transfer')} {close} {t} busy={cloudBusy || importing}>
  {#if localError || error}<p class="error" role="alert">{localError || error}</p>{/if}
  <CloudTransfer {ready} {canImport} {currentSource} {importCloud} bind:busy={cloudBusy} {t} />
  <fieldset disabled={cloudBusy || importing}>
  <h3>{t('ui-local-transfer')}</h3>
  <button disabled={!ready} onclick={download}>{t('ui-export-save')}</button>
  <p>{t('ui-import-warning')}</p>
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
  <label class="confirm"><input type="checkbox" bind:checked={confirmed} />{t('ui-confirm-import')}</label>
  <button disabled={!canImport || !source.trim() || !confirmed || importing} onclick={async () => {
    importing = true;
    try { if (await importData(source)) close(); }
    finally { importing = false; }
  }}>{t('ui-import-save')}</button>
  </fieldset>
</PlannerDialog>

<style>
  label { display: flex; flex-direction: column; gap: 0.4rem; margin: 1rem 0; }
  textarea { width: 100%; min-width: 0; padding: 0.5rem; }
  .confirm { flex-direction: row; align-items: center; }
  p { line-height: 1.5; }
  .error { color: var(--error); }
  fieldset { padding: 0; border: 0; min-width: 0; }
</style>
