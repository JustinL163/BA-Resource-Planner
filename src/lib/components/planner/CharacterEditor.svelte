<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import type { Language } from '$lib/domain/localisation';
  import type { CharacterInfo, PlannerCharacter, PlannerDataset, PlannerMetadata, ResourceTotals } from '$lib/domain/planner/types';
  import { formatSkill, type SkillKey } from '$lib/domain/planner/skills';
  import { loadSkillData, studentSkills, type SkillData } from '$lib/services/planner-skills';
  import { characterFingerprint } from '$lib/domain/planner/defaults';
  import { validateCharacterEdit } from '$lib/domain/planner/save';
  import { calculateStudentResources } from '$lib/domain/resources/calculator';
  import { formatAmount, resourceItem, type ResourceItem } from '$lib/domain/planner/catalog';
  import { modal } from './dialog';
  import SkillDetails from './SkillDetails.svelte';
  import ResourceCell from './ResourceCell.svelte';

  type CostPreviewEntry = { item: ResourceItem; amount: number; rarityTier: number; sortTier: number; sortType: string };

  let { character, info, name, dataset, metadata, language, scribble, included, hasPrevious, hasNext, navigate, save, remove, close, error, t }: {
    character: PlannerCharacter; info: CharacterInfo; name: string; dataset: PlannerDataset;
    metadata: PlannerMetadata; language: Language; scribble: boolean; included: boolean; hasPrevious: boolean; hasNext: boolean;
    navigate: (direction: -1 | 1) => void; save: (character: PlannerCharacter, expected: string) => boolean;
    remove: () => boolean; close: () => void; error: string; t: (id: string) => string;
  } = $props();
  let draft = $state(untrack(() => structuredClone(character)));
  let expected = $state(untrack(() => characterFingerprint(character)));
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
  function requestClose() {
    if (!dirty) { close(); return; }
    pendingNavigation = null;
    discardPrompt = true;
  }
  function saveDraft() {
    if (!validation.error && save(draft, expected)) expected = characterFingerprint(draft);
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
  let previewTotals = $derived({
    required: {}, needed: validation.resources ?? {}, leftover: {}, owned: {}, perCharacter: {}
  } satisfies ResourceTotals);
  function previewItem(key: string): ResourceItem {
    const item = resourceItem(key, metadata);
    if (key === 'Eleph') return { ...item, image: `/planner/icons/Eleph/Eleph_${character.id}.webp` };
    if (key.endsWith('_Xp')) return { ...item, image: '/planner/icons/Misc/uexp.png' };
    if (key.endsWith('Cost')) return { ...item, image: metadata.images[key.slice(0, -4)] ?? item.image };
    return item;
  }
  function materialTier(key: string, item: ResourceItem): { rarityTier: number; sortTier: number } {
    if (item.group === 'Equipment') {
      const tier = Number(key.match(/^T(\d+)_/)?.[1]) || 1;
      return { rarityTier: 1, sortTier: tier };
    }
    if (item.group === 'Limit break books' || item.group === 'Gifts') return { rarityTier: 3, sortTier: 3 };
    const name = metadata.materialNames[key] ?? key;
    const tier = item.group === 'School materials'
      ? Number(name.match(/^(?:BD|TN)_(\d+)_/)?.[1]) || 1
      : Number(name.match(/(?:^|_)(?:T)?([1-4])$/)?.[1]) || 1;
    return { rarityTier: tier, sortTier: tier };
  }
  function materialSortType(key: string, item: ResourceItem): string {
    const name = metadata.materialNames[key] ?? key;
    if (item.group === 'Equipment') return key.replace(/^T\d+_/, '');
    if (item.group === 'School materials') return name.replace(/^(BD|TN)_\d+_/, '$1_');
    if (item.group === 'Artifacts') return name.replace(/_(?:T)?[1-4]$/, '');
    if (item.group === 'Limit break books') return '0-limit-break-books';
    if (item.group === 'Gifts') return `1-${name}`;
    return name;
  }
  let costPreview = $derived.by(() => {
    const entries: CostPreviewEntry[] = Object.entries(validation.resources ?? {}).flatMap(([key, rawAmount]) => {
      const amount = Number(rawAmount);
      if (amount === 0) return [];
      const item = previewItem(key);
      return [{ item, amount, ...materialTier(key, item), sortType: materialSortType(key, item) }];
    });
    const definitions = [
      { key: 'school', title: 'ui-group-school-materials', groups: ['School materials'] },
      { key: 'artifacts', title: 'ui-artifacts', groups: ['Artifacts'] },
      { key: 'limit-break-gifts', title: 'ui-group-limit-break-books', groups: ['Limit break books', 'Gifts'] },
      { key: 'equipment', title: 'footer-gear', groups: ['Equipment'] }
    ];
    const rows = definitions.map((definition) => {
      const items = entries.filter((entry) => definition.groups.includes(entry.item.group))
        .sort((first, second) => first.sortType.localeCompare(second.sortType)
          || second.sortTier - first.sortTier || first.item.name.localeCompare(second.item.name));
      const types: Array<{ sortType: string; items: CostPreviewEntry[] }> = [];
      for (const entry of items) {
        const lastType = types.at(-1);
        if (lastType?.sortType === entry.sortType) lastType.items.push(entry);
        else types.push({ sortType: entry.sortType, items: [entry] });
      }
      return { ...definition, items, types };
    }).filter((row) => row.items.length > 0);
    const materialGroups = new Set(definitions.flatMap((definition) => definition.groups));
    return { rows, summary: entries.filter((entry) => !materialGroups.has(entry.item.group)) };
  });
  function ignoreOwnedResource(_key: string, _amount: number): boolean {
    return false;
  }
</script>

<dialog use:modal={{ focusDialog: true }} tabindex="-1" aria-labelledby="editor-title"
  oncancel={(event) => { event.preventDefault(); requestClose(); }}
  onclick={(event) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) requestClose();
  }}>
  <form onsubmit={(event) => { event.preventDefault(); saveDraft(); }}
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
      <section class="live-cost-preview" aria-label={t('ui-cost-preview')}>
        {#if validation.resources}
          <div class="cost-preview-content">
            {#if costPreview.rows.length}
              <div class="cost-preview-materials">
                {#each costPreview.rows as row (row.key)}
                  {#if row.key === 'equipment'}
                    <details class="cost-preview-row">
                      <summary>{t(row.title)}</summary>
                      <div class="cost-material-items">
                        {#each row.types as type, typeIndex (`${row.key}-${type.sortType}`)}
                          <div class="cost-material-type-group">
                            {#each type.items as entry, index (`${row.key}-${entry.item.key}`)}
                              <div class={`cost-material-cell rarity-${entry.rarityTier}${typeIndex < row.types.length - 1 && index === type.items.length - 1 ? ' type-end' : ''}`} role="img" title={`${entry.item.name}: ${formatAmount(entry.amount)}`}
                                aria-label={`${entry.item.name}: ${formatAmount(entry.amount)}`}>
                                {#if entry.item.image}<img src={entry.item.image} alt="" loading="lazy" draggable="false" />
                                {:else}<span class="cost-material-name">{entry.item.name}</span>{/if}
                                <span class="cost-material-amount">{formatAmount(entry.amount)}</span>
                              </div>
                            {/each}
                        </div>
                        {/each}
                      </div>
                    </details>
                  {:else}
                    <section class="cost-preview-row">
                      <h4>{t(row.title)}{#if row.key === 'limit-break-gifts'} + {t('ui-group-gifts')}{/if}</h4>
                      <div class={`cost-material-items${row.key === 'school' || row.key === 'artifacts' ? ' atomic-groups' : ''}`}>
                        {#each row.types as type, typeIndex (`${row.key}-${type.sortType}`)}
                          <div class="cost-material-type-group">
                            {#each type.items as entry, index (`${row.key}-${entry.item.key}`)}
                              <div class={`cost-material-cell rarity-${entry.rarityTier}${typeIndex < row.types.length - 1 && index === type.items.length - 1 ? ' type-end' : ''}`} role="img" title={`${entry.item.name}: ${formatAmount(entry.amount)}`}
                                aria-label={`${entry.item.name}: ${formatAmount(entry.amount)}`}>
                                {#if entry.item.image}<img src={entry.item.image} alt="" loading="lazy" draggable="false" />
                                {:else}<span class="cost-material-name">{entry.item.name}</span>{/if}
                                <span class="cost-material-amount">{formatAmount(entry.amount)}</span>
                              </div>
                            {/each}
                          </div>
                        {/each}
                      </div>
                    </section>
                  {/if}
                {/each}
              </div>
            {/if}
            {#if costPreview.summary.length}
              <div class="cost-summary-tiles" role="group" aria-label={t('ui-resource')}>
                {#each costPreview.summary as entry (entry.item.key)}
                  <ResourceCell item={entry.item} totals={previewTotals} mode="needed" setOwned={ignoreOwnedResource} {t} inlineAmount={true} />
                {/each}
              </div>
            {/if}
          </div>
          {#if !Number.isFinite(validation.resources.ShopResets ?? 0)}<p>{t('ui-farm-warning')}</p>{/if}
        {/if}
      </section>
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
  input[type="number"] { width: 100%; min-width: 0; padding: 0.4rem; }
  fieldset { margin: 1rem 0; border: 1px solid #7c5b7d; border-radius: 0.5rem; }
  fieldset > label { display: block; margin: 0.5rem 0; }
  .eleph-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .eleph-fields label { display: flex; flex-direction: column; gap: 0.3rem; }
  footer { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; }
  .danger { margin-right: auto; }
  .error { color: var(--error); }
  .cost-preview-content { display: grid; gap: 0.65rem; }
  .cost-preview-materials { display: grid; gap: 0.45rem; padding: 0.2rem; }
  .cost-preview-row h4, .cost-preview-row > summary { margin: 0 0 0.2rem; font-size: 0.8rem; font-weight: 700; }
  .cost-preview-row > summary { cursor: pointer; }
  .cost-material-items { display: flex; flex-wrap: wrap; align-items: center; gap: 0.15rem; }
  .cost-material-type-group { display: contents; }
  .cost-material-items.atomic-groups .cost-material-type-group { display: flex; flex: 0 0 auto; flex-wrap: nowrap; align-items: center; gap: 0.15rem; }
  .cost-material-cell { position: relative; display: grid; box-sizing: border-box; width: 4.5rem; height: 4.5rem; aspect-ratio: 1 / 1; flex: 0 0 4.5rem; place-items: center; background-position: center; background-repeat: no-repeat; background-size: contain; }
  .cost-material-cell.rarity-1 { background-image: url('/planner/icons/Misc/background_n.png'); }
  .cost-material-cell.rarity-2 { background-image: url('/planner/icons/Misc/background_r.png'); }
  .cost-material-cell.rarity-3 { background-image: url('/planner/icons/Misc/background_sr.png'); }
  .cost-material-cell.rarity-4 { background-image: url('/planner/icons/Misc/background_ssr.png'); }
  .cost-material-cell.type-end::after { position: absolute; z-index: 2; top: -0.05rem; right: -0.16rem; height: calc(100% + 0.1rem); border-right: 2px dashed #fff; content: ''; transform: skewX(-10deg); pointer-events: none; }
  .cost-material-cell > img { box-sizing: border-box; width: 74%; height: 74%; aspect-ratio: 1 / 1; object-fit: contain; }
  .cost-material-amount { position: absolute; inset: 50% 0 auto; transform: translateY(-50%); color: #17151a; font: 700 0.78rem/1 sans-serif; font-variant-numeric: tabular-nums; text-align: center; text-shadow: -1px -1px 0 #fff, 0 -1px 0 #fff, 1px -1px 0 #fff, -1px 0 0 #fff, 1px 0 0 #fff, -1px 1px 0 #fff, 0 1px 0 #fff, 1px 1px 0 #fff; pointer-events: none; }
  .cost-material-name { max-width: 100%; padding: 0.2rem; overflow-wrap: anywhere; color: var(--text); font-size: 0.65rem; text-align: center; }
  .cost-summary-tiles { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.2rem 0.1rem 0.5rem; overflow: visible; }
  .cost-summary-tiles :global(.resource-cell) { flex: 0 0 180px; width: 180px; min-width: 120px; min-height: 54px; height: 54px; border: 1px solid #7c5b7d; border-radius: 0.4rem; }
  :global(.site[data-theme="dark"]) .cost-material-cell > img { filter: brightness(0.9); }
  @media (max-width: 600px) {
    dialog:not(.discard-confirmation) { width: 100vw; max-width: 100vw; margin-inline: 0; }
  }
  @media (max-width: 480px) { .editor-header { padding: 0.6rem; } .editor-content { padding: 0.6rem; } }
  @media (max-width: 600px) {
    .cost-summary-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: visible; }
    .cost-summary-tiles :global(.resource-cell) { flex: initial; width: 100%; min-width: 0; }
  }
</style>
