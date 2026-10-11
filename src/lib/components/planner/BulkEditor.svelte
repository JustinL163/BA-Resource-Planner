<script lang="ts">
  import { untrack } from 'svelte';
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import type { InvestmentKey, PlannerCharacter, PlannerDataset, PlannerMetadata } from '$lib/domain/planner/types';
  import { characterFingerprint } from '$lib/domain/planner/defaults';
  import { applyBulkPatch, validateBulkPatch, type BulkPatch } from '$lib/domain/planner/bulk';
  import { calculateStudentResources } from '$lib/domain/resources/calculator';
  import { formatAmount } from '$lib/domain/planner/catalog';
  import PlannerDialog from './PlannerDialog.svelte';
  let { characters, dataset, metadata, names, save, close, error, t }: {
    characters: PlannerCharacter[]; dataset: PlannerDataset; metadata: PlannerMetadata; names: Record<string, string>;
    save: (ids: string[], expected: Record<string, string>, patch: BulkPatch) => boolean;
    close: () => void; error: string; t: (id: string) => string;
  } = $props();
  const snapshot = untrack(() => characters.map((character) => structuredClone(character)));
  const ids = snapshot.map((character) => character.id);
  const expected = Object.fromEntries(snapshot.map((character) => [character.id, characterFingerprint(character)]));
  let current = $state<Partial<Record<InvestmentKey, number>>>({});
  let target = $state<Partial<Record<InvestmentKey, number>>>({});
  let confirmed = $state(false);
  let preview = $derived.by(() => {
    const patch: BulkPatch = {
      current: {}, target: {}, stars: {
        star: current.star ?? 0, star_target: target.star ?? 0,
        ue: current.ue ?? (current.star === 5 ? 1 : 0),
        ue_target: target.ue ?? (target.star === 5 ? 1 : 0)
      }
    };
    for (const field of metadata.fields) {
      if (field.key === 'star' || field.key === 'ue') continue;
      patch.current[field.key] = current[field.key] === undefined ? '' : String(current[field.key]);
      patch.target[field.key] = target[field.key] === undefined ? '' : String(target[field.key]);
    }
    try {
      validateBulkPatch(patch, metadata);
      const next = snapshot.map((character) => applyBulkPatch(character, dataset.students[character.id], patch));
      const credit = next.reduce((sum, character) => sum +
        (calculateStudentResources(dataset.context, character, dataset.students[character.id]).Credit ?? 0), 0);
      return { patch, next, credit, error: '' };
    } catch (problem) {
      return { patch, next: [], credit: 0, error: problem instanceof Error ? problem.message : t('ui-invalid-input') };
    }
  });

  function stars(side: 'current' | 'target', key: InvestmentKey) {
    const values = side === 'current' ? current : target;
    if (key === 'ue' && values.ue !== undefined) values.star = 5;
    if (key === 'star' && values.star !== 5) values.ue = values.star === undefined ? undefined : 0;
  }
</script>

<PlannerDialog title={`${t('ui-bulk-edit')} (${ids.length})`} {close} {t}>
  <form onsubmit={(event) => { event.preventDefault(); if (confirmed && !preview.error && save(ids, expected, preview.patch)) close(); }}>
    <p>{t('ui-bulk-help')}</p>
    <div class="table-scroll"><table>
      <thead><tr><th>{t('ui-investment')}</th><th>{t('label-current')}</th><th>{t('label-target')}</th></tr></thead>
      <tbody>{#each metadata.fields as field}
        <tr><th scope="row">{field.label}</th>
          <td><input use:sanitizeIntegerInput type="number" min={field.min} max={field.max} step="1" data-allow-blank aria-label={`Bulk ${field.label} ${t('label-current')}`}
            bind:value={current[field.key]} onchange={() => stars('current', field.key)} /></td>
          <td><input use:sanitizeIntegerInput type="number" min={field.min} max={field.max} step="1" data-allow-blank aria-label={`Bulk ${field.label} ${t('label-target')}`}
            bind:value={target[field.key]} onchange={() => stars('target', field.key)} /></td>
        </tr>
      {/each}</tbody>
    </table></div>
    {#if error || preview.error}<p class="error" role="alert">{error || preview.error}</p>{/if}
    {#if preview.next.length}
      <details><summary>{t('ui-bulk-preview')}</summary>
        <ul>{#each preview.next as character}<li>{names[character.id] ?? character.name}: {character.current.level} &rarr; {character.target.level},
          {t('label-stars')} {character.current.star} &rarr; {character.target.star}, UE {character.current.ue} &rarr; {character.target.ue}</li>{/each}</ul>
        <p>{t('ui-bulk-credit')}: {formatAmount(preview.credit)}</p>
      </details>
    {/if}
    <label class="confirm"><input type="checkbox" bind:checked={confirmed} />{t('ui-bulk-confirm')}</label>
    <footer><button type="button" onclick={close}>{t('label-cancel')}</button>
      <button type="submit" disabled={!confirmed || Boolean(preview.error)}>{t('ui-bulk-apply')}</button></footer>
  </form>
</PlannerDialog>

<style>
  form { max-width: 700px; margin: auto; }
  p { font-size: 0.9rem; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 0.3rem; text-align: left; border-bottom: 1px solid #7c5b7d44; }
  td { width: 28%; } input[type="number"] { width: 100%; min-width: 0; padding: 0.3rem; }
  .confirm { display: flex; align-items: center; gap: 0.5rem; margin: 1rem 0; }
  footer { display: flex; justify-content: flex-end; gap: 0.5rem; }
  .error { color: var(--error); }
</style>
