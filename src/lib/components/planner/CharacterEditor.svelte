<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Language } from '$lib/domain/localisation';
  import type { CharacterInfo, PlannerCharacter, PlannerDataset, PlannerMetadata } from '$lib/domain/planner/types';
  import { formatSkill, type SkillKey } from '$lib/domain/planner/skills';
  import { loadSkillData, studentSkills, type SkillData } from '$lib/services/planner-skills';
  import { characterFingerprint } from '$lib/domain/planner/defaults';
  import { validateCharacterEdit } from '$lib/domain/planner/save';
  import { calculateStudentResources } from '$lib/domain/resources/calculator';
  import { formatAmount, resourceItem } from '$lib/domain/planner/catalog';
  import { modal } from './dialog';
  import SkillDetails from './SkillDetails.svelte';

  let { character, info, name, dataset, metadata, language, save, remove, close, error, t }: {
    character: PlannerCharacter; info: CharacterInfo; name: string; dataset: PlannerDataset;
    metadata: PlannerMetadata; language: Language; save: (character: PlannerCharacter, expected: string) => boolean;
    remove: () => boolean; close: () => void; error: string; t: (id: string) => string;
  } = $props();
  let draft = $state(untrack(() => structuredClone(character)));
  const expected = untrack(() => characterFingerprint(character));
  let deleting = $state(false);
  let mounted = $state(false);
  let skillData = $state<SkillData | null>(null);
  let skillError = $state('');
  let skillLoading = $state(false);
  let skillRetry = $state(0);
  const skillFields: SkillKey[] = ['ex', 'basic', 'passive', 'sub'];
  onMount(() => { mounted = true; });
  $effect(() => {
    if (!mounted) return;
    const selectedLanguage = language;
    void skillRetry;
    const controller = new AbortController();
    skillData = null;
    skillError = '';
    skillLoading = true;
    void loadSkillData(selectedLanguage, controller.signal).then((data) => {
      if (!controller.signal.aborted) skillData = data;
    }).catch((problem: unknown) => {
      if (controller.signal.aborted) return;
      console.error('Could not load skill descriptions.', problem);
      skillError = problem instanceof Error ? problem.message : t('ui-skill-load-failed');
    }).finally(() => {
      if (!controller.signal.aborted) skillLoading = false;
    });
    return () => controller.abort();
  });
  let skillViews = $derived.by(() => {
    const data = skillData;
    if (!data) return { skills: [], error: '' };
    try {
      const { definitions, fallback } = studentSkills(info.Skills, data, character.id);
      return {
        skills: skillFields.map((key) => {
          const description = formatSkill(definitions, data.buffNames, key, draft.current[key], draft.target[key], draft.target.ue, draft.target.bond_gear);
          return { key, label: t(`label-skill${key}`), description, fallback: fallback.has(description.variant) };
        }),
        error: ''
      };
    } catch (problem) {
      return { skills: [], error: problem instanceof Error ? problem.message : t('ui-skill-load-failed') };
    }
  });
  let validation = $derived.by(() => {
    try {
      validateCharacterEdit(draft, info, metadata);
      return { resources: calculateStudentResources(dataset.context, draft, info), error: '' };
    } catch (problem) {
      return { resources: null, error: problem instanceof Error ? problem.message : t('ui-invalid-input') };
    }
  });
</script>

<dialog use:modal aria-labelledby="editor-title" oncancel={(event) => { event.preventDefault(); close(); }}>
  <form onsubmit={(event) => { event.preventDefault(); if (!validation.error && save(draft, expected)) close(); }}>
    <h2 id="editor-title">{t('ui-edit-character')} {name}</h2>
    {#if error || validation.error}<p class="error" role="alert">{error || validation.error}</p>{/if}
    {#if skillLoading}<p role="status">{t('ui-skill-loading')}</p>{/if}
    {#if skillError || skillViews.error}
      <p class="error" role="alert">{skillError || skillViews.error}
        {#if skillError}<button type="button" onclick={() => skillRetry++}>{t('ui-retry')}</button>{/if}
      </p>
    {/if}
    <div hidden={skillLoading || Boolean(skillError || skillViews.error)}>
      <SkillDetails skills={skillViews.skills} {t} />
    </div>
    <div class="table-scroll">
      <table>
        <thead><tr><th>{t('ui-investment')}</th><th>{t('label-current')}</th><th>{t('label-target')}</th></tr></thead>
        <tbody>
          {#each metadata.fields as field (field.key)}
            <tr>
              <th scope="row">{field.label}</th>
              {#each ['current', 'target'] as side}
                <td>
                  {#if side === 'current'}
                    <input type="number" aria-label={`${field.label} ${t('label-current')}`} min={field.min} max={field.max} step="1" required bind:value={draft.current[field.key]} />
                  {:else}
                    <input type="number" aria-label={`${field.label} ${t('label-target')}`} min={Math.max(field.min, Number(draft.current[field.key]) || 0)} max={field.max} step="1" required bind:value={draft.target[field.key]} />
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <fieldset>
      <legend>{t('ui-eleph-settings')}</legend>
      <div class="eleph-fields">
        {#each [
          { key: 'owned', label: 'ui-eleph-owned', min: 0, max: undefined },
          { key: 'cost', label: 'ui-eligma-price', min: 1, max: 5 },
          { key: 'purchasable', label: 'ui-eligma-remaining', min: 0, max: undefined },
          { key: 'farm_nodes', label: 'ui-farm-runs', min: 0, max: undefined }
        ] as field}
          <label>{t(field.label)}<input type="number" min={field.min} max={field.max} step="1" required bind:value={draft.eleph[field.key]} /></label>
        {/each}
      </div>
      <label><input type="checkbox" bind:checked={draft.eleph.unlocked} />{t('ui-unlocked')}</label>
      <label><input type="checkbox" bind:checked={draft.eleph.use_eligma} />{t('ui-use-eligma')}</label>
      <label><input type="checkbox" bind:checked={draft.eleph.use_shop} />{t('ui-use-shop')}</label>
      <label><input type="checkbox" bind:checked={draft.eleph.node_refresh} />{t('ui-node-refresh')}</label>
    </fieldset>
    <details>
      <summary>{t('ui-cost-preview')}</summary>
      {#if validation.resources}
        <dl>{#each Object.entries(validation.resources) as [key, amount]}
          <div><dt>{resourceItem(key, metadata).name}</dt><dd>{formatAmount(amount)}</dd></div>
        {/each}</dl>
        {#if !Number.isFinite(validation.resources.ShopResets ?? 0)}<p>{t('ui-farm-warning')}</p>{/if}
      {/if}
    </details>
    {#if deleting}
      <p role="alert">{t('ui-confirm-remove')} {name}?</p>
      <button type="button" onclick={() => { if (remove()) close(); }}>{t('ui-confirm-remove')}</button>
      <button type="button" onclick={() => deleting = false}>{t('label-cancel')}</button>
    {/if}
    <footer>
      <button type="button" class="danger" onclick={() => deleting = true}>{t('ui-remove-character')}</button>
      <button type="button" onclick={close}>{t('label-cancel')}</button>
      <button type="submit" disabled={Boolean(validation.error)}>{t('ui-save-character')}</button>
    </footer>
  </form>
</dialog>

<style>
  dialog { width: min(700px, calc(100vw - 1.5rem)); max-height: 90vh; padding: 1.25rem; background: var(--surface); color: var(--text); border-radius: 0.75rem; border: 1px solid #7c5b7d; }
  dialog::backdrop { background: #000a; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 0.4rem; }
  tbody tr:nth-child(odd) { background: #7c5b7d22; }
  input[type="number"] { width: 100%; min-width: 0; padding: 0.4rem; }
  td { width: 30%; }
  fieldset { margin: 1rem 0; border: 1px solid #7c5b7d; border-radius: 0.5rem; }
  fieldset > label { display: block; margin: 0.5rem 0; }
  .eleph-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .eleph-fields label { display: flex; flex-direction: column; gap: 0.3rem; }
  footer { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; }
  .danger { margin-right: auto; }
  .error { color: var(--error); }
  dl div { display: flex; justify-content: space-between; gap: 1rem; padding: 0.25rem; }
  dd { margin: 0; }
  @media (max-width: 480px) { dialog { padding: 0.75rem; } th, td { padding: 0.3rem; } }
</style>
