<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import type { Language } from '$lib/domain/localisation';
  import type { CharacterInfo, InvestmentKey, PlannerCharacter, PlannerDataset, PlannerMetadata } from '$lib/domain/planner/types';
  import { formatSkill, type SkillKey } from '$lib/domain/planner/skills';
  import { loadSkillData, studentSkills, type SkillData } from '$lib/services/planner-skills';
  import { characterFingerprint } from '$lib/domain/planner/defaults';
  import { validateCharacterEdit } from '$lib/domain/planner/save';
  import { calculateStudentResources } from '$lib/domain/resources/calculator';
  import { formatAmount, resourceItem } from '$lib/domain/planner/catalog';
  import { modal } from './dialog';
  import SkillDetails from './SkillDetails.svelte';

  let { character, info, name, dataset, metadata, language, scribble, included, hasPrevious, hasNext, navigate, save, remove, close, error, t }: {
    character: PlannerCharacter; info: CharacterInfo; name: string; dataset: PlannerDataset;
    metadata: PlannerMetadata; language: Language; scribble: boolean; included: boolean; hasPrevious: boolean; hasNext: boolean;
    navigate: (direction: -1 | 1) => void; save: (character: PlannerCharacter, expected: string) => boolean;
    remove: () => boolean; close: () => void; error: string; t: (id: string) => string;
  } = $props();
  let draft = $state(untrack(() => structuredClone(character)));
  const expected = untrack(() => characterFingerprint(character));
  let dirty = $derived(characterFingerprint(draft) !== expected);
  let numberInputFocused = $state(false);
  let discardPrompt = $state(false);
  let pendingNavigation = $state<-1 | 1 | null>(null);
  let deleting = $state(false);
  let mounted = $state(false);
  let skillData = $state<SkillData | null>(null);
  let skillError = $state('');
  let skillLoading = $state(false);
  let skillRetry = $state(0);
  const skillFields: SkillKey[] = ['ex', 'basic', 'passive', 'sub'];
  const fieldsShownInDetails = new Set<InvestmentKey>([
    'level', 'bond', ...skillFields, 'gear1', 'gear2', 'gear3', 'bond_gear'
  ]);
  function requestClose() {
    if (!dirty) { close(); return; }
    pendingNavigation = null;
    discardPrompt = true;
  }
  function requestNavigation(direction: -1 | 1) {
    if (direction < 0 ? !hasPrevious : !hasNext) return;
    if (!dirty) { navigate(direction); return; }
    pendingNavigation = direction;
    discardPrompt = true;
  }
  function cancelDiscard() {
    discardPrompt = false;
    pendingNavigation = null;
  }
  function discardAndProceed() {
    const direction = pendingNavigation;
    discardPrompt = false;
    pendingNavigation = null;
    if (direction) navigate(direction);
    else close();
  }
  function trackNumberInputFocus(event: FocusEvent) {
    const target = event.type === 'focusout' ? event.relatedTarget : event.target;
    numberInputFocused = target instanceof HTMLInputElement && target.type === 'number';
  }
  function fieldMinimum(key: string, side: 'current' | 'target', minimum: number): number {
    let result = minimum;
    if (side === 'target') result = Math.max(result, Number(draft.current[key]) || 0);
    if (key === 'star') {
      if (side === 'current') result = Math.max(result, info.StarGrade);
      if (Number(draft[side].ue) > 0) result = Math.max(result, 5);
    }
    return result;
  }
  function fieldMaximum(key: string, side: 'current' | 'target', maximum: number): number {
    if (key === 'ue' && Number(draft[side].star) < 5) return 0;
    if (key === 'ue_level') return [0, 30, 40, 50, 60][Number(draft[side].ue)] ?? 0;
    if (key === 'bond_gear' && !draft.hasBondGear) return 0;
    if (key.startsWith('book_') && !Number(draft[side].ue)) return 0;
    return maximum;
  }
  function skillLevelForPreview(value: unknown, key: SkillKey): number {
    const level = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    return Number.isInteger(level) && level >= 0 && level <= (key === 'ex' ? 5 : 10) ? level : 0;
  }
  function interceptEditorKeys(event: KeyboardEvent) {
    if (event.key === 'Escape' && dirty) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (discardPrompt) cancelDiscard();
      else {
        pendingNavigation = null;
        discardPrompt = true;
      }
      return;
    }
    const target = event.target;
    if (event.key === 'Enter' && target instanceof HTMLInputElement && target.closest('dialog[aria-labelledby="editor-title"]')) {
      event.preventDefault();
      if (discardPrompt || event.repeat) return;
      if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) target.form?.requestSubmit();
      else target.blur();
      return;
    }
    if (discardPrompt || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
    if (event.key === 'ArrowLeft' && hasPrevious) {
      event.preventDefault();
      event.stopPropagation();
      requestNavigation(-1);
    } else if (event.key === 'ArrowRight' && hasNext) {
      event.preventDefault();
      event.stopPropagation();
      requestNavigation(1);
    }
  }
  onMount(() => {
    mounted = true;
    window.addEventListener('keydown', interceptEditorKeys, true);
    return () => window.removeEventListener('keydown', interceptEditorKeys, true);
  });
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
          const description = formatSkill(definitions, data.buffNames, key,
            skillLevelForPreview(draft.current[key], key), skillLevelForPreview(draft.target[key], key), draft.target.ue, draft.target.bond_gear);
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

<dialog use:modal={{ focusDialog: true }} tabindex="-1" aria-labelledby="editor-title"
  oncancel={(event) => { event.preventDefault(); requestClose(); }}
  onclick={(event) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) requestClose();
  }}>
  <form onsubmit={(event) => { event.preventDefault(); if (!validation.error && save(draft, expected)) close(); }}
    onfocusin={trackNumberInputFocus} onfocusout={trackNumberInputFocus}>
    <header class="editor-header">
      <h2 id="editor-title">{t('ui-edit-character')}</h2>
      <div class="editor-navigation">
        <button type="button" class:boundary-hidden={!hasPrevious} aria-hidden={!hasPrevious} disabled={!hasPrevious}
          aria-label={t('ui-previous-character')} onclick={() => requestNavigation(-1)}>&larr;</button>
        <button type="button" class:boundary-hidden={!hasNext} aria-hidden={!hasNext} disabled={!hasNext}
          aria-label={t('ui-next-character')} onclick={() => requestNavigation(1)}>&rarr;</button>
      </div>
      <div class="header-actions">
        <button type="button" onclick={requestClose}>{t('label-cancel')}</button>
        <button type="submit" disabled={Boolean(validation.error)}>{t('label-save').trim()}</button>
      </div>
    </header>
    <div class="editor-content">
      <SkillDetails skills={skillViews.skills} character={draft} {info} {name} {metadata} {scribble} {included} {t}
        onInvestmentChange={(key, side, value) => { draft[side][key] = value; }} />
      {#if error || (validation.error && !numberInputFocused)}<p class="error" role="alert">{error || validation.error}</p>{/if}
      {#if skillLoading}<p role="status">{t('ui-skill-loading')}</p>{/if}
      {#if skillError || skillViews.error}
        <p class="error" role="alert">{skillError || skillViews.error}
          {#if skillError}<button type="button" onclick={() => skillRetry++}>{t('ui-retry')}</button>{/if}
        </p>
      {/if}
      <div class="table-scroll">
        <table>
          <thead><tr><th>{t('ui-investment')}</th><th>{t('label-current')}</th><th>{t('label-target')}</th></tr></thead>
          <tbody>
            {#each metadata.fields.filter((field) => !fieldsShownInDetails.has(field.key)) as field (field.key)}
              <tr>
                <th scope="row">{field.label}</th>
                {#each ['current', 'target'] as side}
                  <td>
                    {#if side === 'current'}
                      <input use:sanitizeIntegerInput type="number" aria-label={`${field.label} ${t('label-current')}`} min={fieldMinimum(field.key, 'current', field.min)} max={fieldMaximum(field.key, 'current', field.max)} step="1" required bind:value={draft.current[field.key]} />
                    {:else}
                      <input use:sanitizeIntegerInput type="number" aria-label={`${field.label} ${t('label-target')}`} min={fieldMinimum(field.key, 'target', field.min)} max={fieldMaximum(field.key, 'target', field.max)} step="1" required bind:value={draft.target[field.key]} />
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
            <label>{t(field.label)}<input use:sanitizeIntegerInput type="number" min={field.min} max={field.max} step="1" required bind:value={draft.eleph[field.key]} /></label>
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
      </footer>
    </div>
  </form>
  {#if discardPrompt}
    <dialog use:modal={{ blurPreviousOnClose: false }} class="discard-confirmation" role="alertdialog" aria-labelledby="discard-title"
      oncancel={(event) => { event.preventDefault(); event.stopPropagation(); cancelDiscard(); }}>
      <h2 id="discard-title">{t('text-unsavedchanges')}</h2>
      <div class="discard-actions">
        <button type="button" onclick={cancelDiscard}>{t('button-goback')}</button>
        <button type="button" class="discard-button" onclick={discardAndProceed}>{t('button-discardchanges')}</button>
      </div>
    </dialog>
  {/if}
</dialog>

<style>
  dialog:not(.discard-confirmation) { width: min(700px, calc(100vw - 1.5rem)); max-height: 90dvh; padding: 0; background: var(--surface); color: var(--text); border-radius: 0.75rem; border: 1px solid #7c5b7d; overflow-y: auto; overscroll-behavior: contain; }
  form { margin: 0; }
  .editor-header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.7rem 1rem; background: var(--surface); border-bottom: 1px solid #7c5b7d66; }
  .editor-header h2 { flex: 1; min-width: 0; margin: 0; font-size: 1.25rem; }
  .editor-navigation { display: flex; gap: 0.35rem; }
  .editor-navigation button { min-width: 2.25rem; padding: 0.25rem 0.5rem; font-size: 1.25rem; line-height: 1; }
  .editor-navigation button.boundary-hidden { visibility: hidden; }
  .header-actions { display: flex; align-items: center; gap: 0.5rem; }
  .header-actions button { white-space: nowrap; }
  .editor-content { padding: 0.75rem 1rem 1rem; }
  dialog.discard-confirmation { width: min(27rem, calc(100vw - 2rem)); max-height: none; padding: 1.25rem; background: var(--surface); color: var(--text); border: 1px solid #7c5b7d; border-radius: 0.75rem; box-shadow: 0 1rem 3rem #0008; }
  .discard-confirmation h2 { margin: 0; font-size: 1.15rem; }
  .discard-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.2rem; }
  .discard-button { background: #a32f3d; color: white; }
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
  @media (max-width: 600px) {
    dialog:not(.discard-confirmation) { width: 100vw; max-width: 100vw; margin-inline: 0; }
  }
  @media (max-width: 480px) { .editor-header { padding: 0.6rem; } .editor-content { padding: 0.6rem; } th, td { padding: 0.3rem; } }
</style>
