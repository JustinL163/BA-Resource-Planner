<script lang="ts">
  import { untrack } from 'svelte';
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import { groupFingerprint } from '$lib/domain/planner/groups';
  import type { GroupCommand } from '$lib/services/planner-groups';
  import PlannerDialog from './PlannerDialog.svelte';
  let { action, selected, groups, save, changed, close, error, t }: {
    action: 'create' | 'rename' | 'order' | 'delete'; selected: string; groups: Record<string, unknown>;
    save: (command: GroupCommand) => boolean; changed: (name: string) => void;
    close: () => void; error: string; t: (id: string) => string;
  } = $props();
  const snapshot = untrack(() => ({ name: selected, expected: groupFingerprint(groups[selected]), order: JSON.stringify(Object.keys(groups)) }));
  let name = $state(untrack(() => action === 'rename' ? selected : ''));
  let position = $state(untrack(() => Object.keys(groups).indexOf(selected) + 1));
  let confirmed = $state(false);
  function submit() {
    const command: GroupCommand = action === 'create' ? { type: action, name } :
      action === 'rename' ? { type: action, name: snapshot.name, newName: name, expected: snapshot.expected } :
      action === 'delete' ? { type: action, name: snapshot.name, expected: snapshot.expected } :
      { type: action, name: snapshot.name, position, expectedOrder: snapshot.order };
    if (save(command)) { changed(action === 'delete' ? '' : action === 'create' || action === 'rename' ? name : snapshot.name); close(); }
  }
</script>

<PlannerDialog title={t(`ui-group-${action}`)} {close} {t}>
  <form onsubmit={(event) => { event.preventDefault(); submit(); }}>
    {#if action === 'create' || action === 'rename'}
      <label>{t('ui-group-name')}<input type="text" required maxlength="35" bind:value={name} /></label>
    {:else if action === 'order'}
      <label>{t('ui-group-position')}<input use:sanitizeIntegerInput type="number" required min="1" max={Object.keys(groups).length} step="1" bind:value={position} /></label>
    {:else}
      <p>{t('ui-group-delete-warning')} {snapshot.name}</p>
      <label class="confirm"><input type="checkbox" bind:checked={confirmed} />{t('ui-group-delete-confirm')}</label>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <footer><button type="button" onclick={close}>{t('label-cancel')}</button>
      <button type="submit" disabled={action === 'delete' && !confirmed}>{t('button-ok')}</button></footer>
  </form>
</PlannerDialog>

<style>
  form { max-width: 500px; margin: auto; }
  label { display: flex; flex-direction: column; gap: 0.5rem; margin: 1rem 0; }
  input { padding: 0.5rem; }
  .confirm { flex-direction: row; align-items: center; }
  footer { display: flex; gap: 0.5rem; justify-content: flex-end; }
  .error { color: var(--error); }
</style>
