<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import type { Language } from '$lib/domain/localisation';
  import type { CharacterInfo, PlannerCharacter, PlannerDataset, PlannerMetadata, ResourceTotals } from '$lib/domain/planner/types';
  import { farmServer, farmServers, type FarmServer } from '$lib/domain/planner/gear-farm';
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

  let { character, info, name, dataset, metadata, language, scribble, included, hasPrevious, hasNext, savedServer, setServer, navigate, save, remove, close, error, t }: {
    character: PlannerCharacter; info: CharacterInfo; name: string; dataset: PlannerDataset;
    metadata: PlannerMetadata; language: Language; scribble: boolean; included: boolean; hasPrevious: boolean; hasNext: boolean;
    savedServer: unknown; setServer: (server: FarmServer) => boolean;
    navigate: (direction: -1 | 1) => void; save: (character: PlannerCharacter, expected: string) => boolean;
    remove: () => boolean; close: () => void; error: string; t: (id: string) => string;
  } = $props();
  let draft = $state(untrack(() => structuredClone(character)));
  let expected = $state(untrack(() => characterFingerprint(character)));
  let editorCharacterId = untrack(() => character.id);
  let dirty = $derived(characterFingerprint(draft) !== expected);
  let numberInputFocused = $state(false);
  let discardPrompt = $state(false);
  let pendingNavigation = $state<-1 | 1 | null>(null);
  let swipeStart: { pointerId: number; x: number; y: number; time: number } | null = null;
  let deleting = $state(false);
  let presetOpen = $state(false);
  let presetServer = $state<FarmServer>('Global');
  let mounted = $state(false);
  let touchDebugEnabled = $state(false);
  let touchDebugVisible = $state(true);
  let touchDebugEntries = $state<string[]>([]);
  let touchDebugCopyText = $state(JSON.stringify({ events: [] }, null, 2));
  let touchDebugCopyTextarea: HTMLTextAreaElement | null = null;
  let skillData = $state<SkillData | null>(null);
  let skillError = $state('');
  let skillLoading = $state(false);
  let skillRetry = $state(0);
  const skillFields: SkillKey[] = ['ex', 'basic', 'passive', 'sub'];
  let hardModeStages = $derived.by(() => {
    const stages = dataset.context.data.hard_modes[character.id];
    return Array.isArray(stages) ? stages.filter((stage): stage is string => typeof stage === 'string') : [];
  });
  const presetServerPreferenceKey = 'planner-character-preset-server';
  let purchase = $derived(dataset.context.data.shop_characters[character.id]);
  let shopCurrency = $derived(typeof purchase === 'string' ? purchase : purchase?.currency);
  const shopCurrencyLabels: Record<string, string> = {
    RaidToken: 'label-raidtokens',
    RareRaidToken: 'label-rareraidtokens',
    EliminationRaidToken: 'label-eliminationraidtokens',
    RareEliminationRaidToken: 'label-rareeliminationraidtokens',
    ArenaCoin: 'label-arenacoins',
    JECoin: 'label-jecoins',
    MasteryCertificate: 'label-expertpermits'
  };
  const raidCurrencies = new Set(['RaidToken', 'RareRaidToken', 'EliminationRaidToken', 'RareEliminationRaidToken']);
  $effect(() => {
    const nextCharacterId = character.id;
    if (nextCharacterId === editorCharacterId) return;
    const nextDraft = untrack(() => structuredClone(character));
    const nextExpected = untrack(() => characterFingerprint(character));
    editorCharacterId = nextCharacterId;
    draft = nextDraft;
    expected = nextExpected;
    numberInputFocused = false;
    discardPrompt = false;
    pendingNavigation = null;
    deleting = false;
    presetOpen = false;
  });
  let activeServer = $derived.by(() => {
    try { return farmServer(savedServer); }
    catch { return 'Global'; }
  });
  function countAvailableStages(server: FarmServer): number {
    const cap = metadata.worldCaps[server];
    return hardModeStages.filter((stage) => cap === null || Number.parseInt(stage.split('-')[0], 10) <= cap).length;
  }
  let availableHardModeStages = $derived.by(() => {
    return countAvailableStages(activeServer);
  });
  let dailySweepLimit = $derived(availableHardModeStages * (draft.eleph.node_refresh ? 6 : 3));
  let shopCurrencyName = $derived(shopCurrency
    ? (shopCurrencyLabels[shopCurrency] ? t(shopCurrencyLabels[shopCurrency]) : shopCurrency.replace(/([a-z])([A-Z])/g, '$1 $2'))
    : '');
  let shopUseLabel = $derived(shopCurrency ? `${t('ui-use-currency')} ${shopCurrencyName}` : '');
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
  function startCharacterSwipe(event: PointerEvent) {
    swipeStart = null;
    if (event.pointerType !== 'touch' || !event.isPrimary || !(event.currentTarget instanceof HTMLDialogElement) || !(event.target instanceof Element)) return;
    if (event.target.closest('[data-touch-debug-panel]')) return;
    const dialog = event.currentTarget;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    if (event.target.closest('dialog') !== dialog) return;
    swipeStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, time: Date.now() };
  }
  function finishCharacterSwipe(event: PointerEvent) {
    const start = swipeStart;
    swipeStart = null;
    if (!start || start.pointerId !== event.pointerId || Date.now() - start.time > 1000) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) {
      const isStationaryTap = Math.hypot(deltaX, deltaY) <= 10;
      const target = event.target;
      if (isStationaryTap && event.pointerType === 'touch' && target instanceof HTMLInputElement &&
        target.type === 'number' && !target.disabled && !target.readOnly) {
        target.focus({ preventScroll: true });
      }
      return;
    }
    if (dirty) return;
    requestNavigation(deltaX < 0 ? 1 : -1);
  }
  function cancelCharacterSwipe(event: PointerEvent) {
    if (swipeStart?.pointerId === event.pointerId) swipeStart = null;
  }
  function describeTouchDebugElement(element: Element | null) {
    if (!element) return null;
    return {
      tag: element.tagName.toLowerCase(),
      class: element.getAttribute('class'),
      label: element.getAttribute('aria-label'),
      name: element.getAttribute('name'),
      type: element.getAttribute('type')
    };
  }
  function formatTouchDebugElement(element: Element | null) {
    const details = describeTouchDebugElement(element);
    if (!details) return 'none';
    const attrs = [details.class, details.label && `label=${details.label}`, details.name && `name=${details.name}`, details.type && `type=${details.type}`]
      .filter(Boolean)
      .join(' ');
    return `${details.tag}${attrs ? `.${attrs}` : ''}`;
  }
  function logCharacterEditorTouchEvent(event: Event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('[data-character-editor-dialog]') || target.closest('[data-touch-debug-panel]')) return;
    const pointer = event instanceof PointerEvent ? {
      id: event.pointerId,
      type: event.pointerType,
      primary: event.isPrimary,
      x: event.clientX,
      y: event.clientY
    } : null;
    const point = event instanceof MouseEvent ? { x: event.clientX, y: event.clientY } : null;
    const hitTarget = point ? document.elementFromPoint(point.x, point.y) : null;
    const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
    const pointerLabel = pointer ? ` ${pointer.type}#${pointer.id} (${pointer.x},${pointer.y})` : '';
    const pointLabel = point ? ` hit=${formatTouchDebugElement(hitTarget)} hitInput=${formatTouchDebugElement(hitTarget?.closest('input') ?? null)}` : '';
    const inputLabel = ` input=${formatTouchDebugElement(target.closest('input'))}`;
    const activeLabel = ` active=${formatTouchDebugElement(activeElement)}`;
    const statusLabel = ` trusted=${event.isTrusted} prevented=${event.defaultPrevented}`;
    touchDebugEntries = [...touchDebugEntries.slice(-29), `${event.type}${pointerLabel} target=${formatTouchDebugElement(target)}${inputLabel}${pointLabel}${activeLabel}${statusLabel}`];
    touchDebugCopyText = JSON.stringify({ events: touchDebugEntries }, null, 2);
  }
  function selectTouchDebugJson() {
    touchDebugCopyTextarea?.focus({ preventScroll: true });
    touchDebugCopyTextarea?.select();
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
  function updateFarmRunsForServer(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    const selected = farmServers.find((server) => server === select.value);
    if (!selected) return;
    if (!setServer(selected)) {
      select.value = activeServer;
      return;
    }
    const nextLimit = countAvailableStages(selected) * (draft.eleph.node_refresh ? 6 : 3);
    if (Number(draft.eleph.farm_nodes) > nextLimit) draft.eleph.farm_nodes = nextLimit;
  }
  function updatePresetServer(event: Event) {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    const selected = farmServers.find((server) => server === select.value);
    if (!selected) return;
    presetServer = selected;
    try { window.localStorage.setItem(presetServerPreferenceKey, selected); }
    catch { /* Keep the preset selection usable if storage is unavailable. */ }
  }
  function applyPreset(kind: 'character' | 'targets' | 'min-character' | 'min-targets') {
    const minimum = kind.startsWith('min-');
    const updateCharacter = kind === 'character' || kind === 'min-character' || kind === 'min-targets';
    const updateTargets = kind !== 'min-character';
    for (const field of metadata.fields) {
      const value = minimum
        ? (field.key === 'star' ? Math.max(field.min, info.StarGrade) : field.min)
        : (field.key === 'bond_gear' && !draft.hasBondGear ? field.min : field.max);
      if (updateCharacter) draft.current[field.key] = value;
      if (updateTargets) draft.target[field.key] = value;
    }
    presetOpen = false;
  }
  function confirmRemoval() {
    if (remove()) close();
  }
  function closeOnBackdrop(event: MouseEvent, dismiss: () => void) {
    const dialog = event.currentTarget;
    if (!(dialog instanceof HTMLDialogElement) || event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
  }
  function updateNodeRefresh(event: Event) {
    const checkbox = event.currentTarget;
    if (!(checkbox instanceof HTMLInputElement)) return;
    draft.eleph.node_refresh = checkbox.checked;
    const nextLimit = availableHardModeStages * (checkbox.checked ? 6 : 3);
    if (Number(draft.eleph.farm_nodes) > nextLimit) draft.eleph.farm_nodes = nextLimit;
  }
  function updateUseEligma(event: Event) {
    const checkbox = event.currentTarget;
    if (!(checkbox instanceof HTMLInputElement)) return;
    draft.eleph.use_eligma = checkbox.checked;
    if (checkbox.checked) draft.eleph.use_shop = false;
  }
  function updateUseShop(event: Event) {
    const checkbox = event.currentTarget;
    if (!(checkbox instanceof HTMLInputElement)) return;
    draft.eleph.use_shop = checkbox.checked;
    if (checkbox.checked) draft.eleph.use_eligma = false;
  }
  function skillLevelForPreview(value: unknown, key: SkillKey): number {
    const level = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    return Number.isInteger(level) && level >= 0 && level <= (key === 'ex' ? 5 : 10) ? level : 0;
  }
  function interceptEditorKeys(event: KeyboardEvent) {
    if (event.key === 'Escape' && (deleting || presetOpen)) return;
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
    try {
      const lastPresetServer = window.localStorage.getItem(presetServerPreferenceKey);
      if (lastPresetServer !== null) presetServer = farmServer(lastPresetServer);
      else {
        try { presetServer = farmServer(savedServer); }
        catch { presetServer = 'Global'; }
        window.localStorage.setItem(presetServerPreferenceKey, presetServer);
      }
    } catch {
      try { presetServer = farmServer(savedServer); }
      catch { presetServer = 'Global'; }
    }
    mounted = true;
    window.addEventListener('keydown', interceptEditorKeys, true);
    touchDebugEnabled = [...new URLSearchParams(window.location.search).keys()]
      .some((key) => key.toLowerCase() === 'touchdebug');
    const touchDebugEvents = ['pointerdown', 'pointerup', 'pointercancel', 'click', 'focusin', 'focusout'];
    if (touchDebugEnabled) {
      for (const type of touchDebugEvents) window.addEventListener(type, logCharacterEditorTouchEvent, true);
    }
    return () => {
      window.removeEventListener('keydown', interceptEditorKeys, true);
      if (touchDebugEnabled) {
        for (const type of touchDebugEvents) window.removeEventListener(type, logCharacterEditorTouchEvent, true);
      }
    };
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
  let elephSummary = $derived.by(() => {
    const resets = Number(validation.resources?.ShopResets ?? 0);
    if (!Number.isFinite(resets) || resets <= 0) return null;
    if (hardModeStages.length) {
      return { image: `/planner/icons/Eleph/Eleph_${character.id}.webp`, label: t('label-avgdays'), value: resets };
    }
    if (shopCurrency) {
      return {
        image: `/planner/icons/Misc/${shopCurrency}.png`,
        label: t(raidCurrencies.has(shopCurrency) ? 'label-minraids' : 'label-shopresets'),
        value: resets
      };
    }
    return null;
  });
  let elephCostDisplay = $derived.by(() => {
    const resources = validation.resources;
    if (!resources) return null;
    if (draft.eleph.use_eligma) {
      return { image: metadata.images.Eligma ?? '/planner/icons/Misc/Eligma.png', value: Number(resources.Eligma ?? 0), label: t('label-eligma') };
    }
    if (draft.eleph.use_shop && shopCurrency) {
      return {
        image: metadata.images[shopCurrency] ?? `/planner/icons/Misc/${shopCurrency}.png`,
        value: Number(resources[`${shopCurrency}Cost`] ?? 0),
        label: shopCurrencyName
      };
    }
    return null;
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
    return { rows, summary: entries.filter((entry) => !materialGroups.has(entry.item.group) && entry.item.key !== 'ShopResets') };
  });
  function ignoreOwnedResource(_key: string, _amount: number): boolean {
    return false;
  }
</script>

<dialog use:modal={{ focusDialog: true }} tabindex="-1" aria-labelledby="editor-title" data-character-editor-dialog class:form-dirty={dirty}
  oncancel={(event) => { event.preventDefault(); requestClose(); }}
  onpointerdown={startCharacterSwipe}
  onpointerup={finishCharacterSwipe}
  onpointercancel={cancelCharacterSwipe}
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
        <button type="button" class="cancel-button" onclick={requestClose}>{t('label-cancel')}</button>
        <button type="submit" class="save-button" disabled={Boolean(validation.error)}>{t('label-save').trim()}</button>
      </div>
    </header>
    <div class="editor-content">
      <div class="editor-layout">
        <div class="editor-primary">
      <SkillDetails skills={skillViews.skills} character={draft} {info} {name} {metadata} {scribble} {included} {t}
        onInvestmentChange={(key, side, value) => { draft[side][key] = value; }} />
      {#if error || (validation.error && !numberInputFocused)}<p class="error" role="alert">{error || validation.error}</p>{/if}
      {#if skillLoading}<p role="status">{t('ui-skill-loading')}</p>{/if}
      {#if skillError || skillViews.error}
        <p class="error" role="alert">{skillError || skillViews.error}
          {#if skillError}<button type="button" onclick={() => skillRetry++}>{t('ui-retry')}</button>{/if}
        </p>
      {/if}
      <fieldset class="eleph-panel">
        <legend>{t('ui-eleph-settings')}</legend>
        <div class="eleph-layout">
          <div class="eleph-group">
            <img class="eleph-icon" src={`/planner/icons/Eleph/Eleph_${character.id}.webp`} alt="" draggable="false" />
            <div class="eleph-fields">
              <label>{t('ui-eleph-owned')}<input use:sanitizeIntegerInput class="eleph-number-input owned-eleph-input" type="number" min="0" max="9999" step="1" required bind:value={draft.eleph.owned} /></label>
              <label class="eleph-check"><input type="checkbox" bind:checked={draft.eleph.unlocked} />{t('ui-unlocked')}</label>
            </div>
          </div>
          <div class="eleph-group">
            <img class="eleph-icon" src="/planner/icons/Misc/Eligma.png" alt="" draggable="false" />
            <div class="eleph-fields">
              <label>{t('label-eligmacost')}<input use:sanitizeIntegerInput class="eleph-number-input" type="number" min="1" max="5" step="1" required bind:value={draft.eleph.cost} /></label>
              {#if Number(draft.eleph.cost) < 5}
                <label>{t('ui-eligma-remaining')}<input use:sanitizeIntegerInput class="eleph-number-input" type="number" min="0" max="20" step="1" required bind:value={draft.eleph.purchasable} /></label>
              {/if}
            </div>
          </div>
          <div class="eleph-options">
            <label class="eleph-check"><input type="checkbox" checked={draft.eleph.use_eligma} onchange={updateUseEligma} />{t('ui-use-eligma')}</label>
            {#if shopCurrency && !hardModeStages.length}
              <label class="eleph-check"><input type="checkbox" checked={draft.eleph.use_shop} onchange={updateUseShop} />{shopUseLabel}</label>
            {/if}
          </div>
          {#if hardModeStages.length}
            <div class="eleph-farming">
              <div class="farm-missions">
                <strong class="hardmode-label">{t('ui-hard-missions')}</strong>
                <select class="farm-server-select" aria-label={t('ui-server')} value={activeServer} onchange={updateFarmRunsForServer}>
                  {#each farmServers as server}<option value={server}>{server}</option>{/each}
                </select>
              </div>
              <div class="farm-daily">
                <label>{t('ui-daily-sweeps')}
                  <span class="sweep-input"><input use:sanitizeIntegerInput class="eleph-number-input" type="number" min="0" max={dailySweepLimit} step="1" required bind:value={draft.eleph.farm_nodes} /><span>/ {dailySweepLimit}</span></span>
                </label>
                <label class="eleph-check"><input type="checkbox" checked={draft.eleph.node_refresh} onchange={updateNodeRefresh} />{t('label-noderefreshing')}</label>
              </div>
              {#if elephSummary}
                <div class="eleph-summary">
                  <img class="eleph-icon" src={elephSummary.image} alt="" draggable="false" />
                  <div><span>{elephSummary.label}</span><strong>{formatAmount(elephSummary.value)}</strong></div>
                </div>
              {/if}
              {#if elephCostDisplay}
                <div class="eleph-cost-display" role="img" aria-label={`${elephCostDisplay.label}: ${formatAmount(elephCostDisplay.value)}`} title={`${elephCostDisplay.label}: ${formatAmount(elephCostDisplay.value)}`}>
                  <img src={elephCostDisplay.image} alt="" draggable="false" />
                  <strong>{formatAmount(elephCostDisplay.value)}</strong>
                </div>
              {/if}
            </div>
          {/if}
          {#if elephSummary && !hardModeStages.length}
            <div class="eleph-summary standalone-eleph-summary">
              <img class="eleph-icon" src={elephSummary.image} alt="" draggable="false" />
              <div><span>{elephSummary.label}</span><strong>{formatAmount(elephSummary.value)}</strong></div>
            </div>
          {/if}
          {#if elephCostDisplay && !hardModeStages.length}
            <div class="eleph-cost-display" role="img" aria-label={`${elephCostDisplay.label}: ${formatAmount(elephCostDisplay.value)}`} title={`${elephCostDisplay.label}: ${formatAmount(elephCostDisplay.value)}`}>
              <img src={elephCostDisplay.image} alt="" draggable="false" />
              <strong>{formatAmount(elephCostDisplay.value)}</strong>
            </div>
          {/if}
        </div>
      </fieldset>
      <footer>
        <button type="button" class="danger" onclick={() => deleting = true}>{t('ui-remove-character')}</button>
        <button type="button" onclick={() => presetOpen = true}>{t('ui-preset')}</button>
      </footer>
        </div>
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
      </div>
    </div>
  </form>
  {#if touchDebugEnabled}
    <aside class="touch-debug-popup" data-touch-debug-panel aria-label="Touch event debug information" aria-live="polite">
      {#if touchDebugVisible}
        <header class="touch-debug-header">
          <strong>Touch debug · {touchDebugEntries.length} events</strong>
          <div>
            <button type="button" onclick={selectTouchDebugJson}>Select JSON</button>
            <button type="button" onclick={() => { touchDebugEntries = []; touchDebugCopyText = JSON.stringify({ events: [] }, null, 2); }}>Clear</button>
            <button type="button" onclick={() => touchDebugVisible = false}>Hide</button>
          </div>
        </header>
        <label class="touch-debug-copy-label">
          Tap Select JSON, then choose Copy:
          <textarea readonly bind:this={touchDebugCopyTextarea} bind:value={touchDebugCopyText}></textarea>
        </label>
        <div class="touch-debug-log">
          {#if touchDebugEntries.length}
            {#each touchDebugEntries as entry}
              <div>{entry}</div>
            {/each}
          {:else}
            <div>Waiting for pointer, click, and focus events…</div>
          {/if}
        </div>
      {:else}
        <button type="button" class="touch-debug-reopen" onclick={() => touchDebugVisible = true}>Show touch debug ({touchDebugEntries.length})</button>
      {/if}
    </aside>
  {/if}
  {#if deleting}
    <dialog use:modal={{ focusDialog: true, blurPreviousOnClose: false }} class="editor-confirmation" role="alertdialog"
      aria-labelledby="remove-confirmation-title"
      onclick={(event) => closeOnBackdrop(event, () => { deleting = false; })}
      oncancel={(event) => { event.preventDefault(); event.stopPropagation(); deleting = false; }}>
      <h2 id="remove-confirmation-title">{t('label-areyousure')}</h2>
      <p>{t('ui-confirm-remove')} {name}?</p>
      <div class="dialog-actions">
        <button type="button" onclick={() => deleting = false}>{t('label-cancel')}</button>
        <button type="button" class="discard-button" onclick={confirmRemoval}>{t('confirmdeletion')}</button>
      </div>
    </dialog>
  {/if}
  {#if presetOpen}
    <dialog use:modal={{ focusDialog: true, blurPreviousOnClose: false }} class="preset-dialog" aria-labelledby="preset-dialog-title"
      onclick={(event) => closeOnBackdrop(event, () => { presetOpen = false; })}
      oncancel={(event) => { event.preventDefault(); event.stopPropagation(); presetOpen = false; }}>
      <h2 id="preset-dialog-title">{t('ui-preset')}</h2>
      <label class="preset-server-label">{t('ui-server')}
        <select value={presetServer} onchange={updatePresetServer}>
          {#each farmServers as server}<option value={server}>{server}</option>{/each}
        </select>
      </label>
      <div class="preset-options">
        <button type="button" onclick={() => applyPreset('character')}>{t('ui-preset-max-character')}</button>
        <button type="button" onclick={() => applyPreset('targets')}>{t('ui-preset-max-targets')}</button>
        <button type="button" onclick={() => applyPreset('min-character')}>{t('ui-preset-min-character')}</button>
        <button type="button" onclick={() => applyPreset('min-targets')}>{t('ui-preset-min-targets')}</button>
      </div>
      <div class="dialog-actions">
        <button type="button" onclick={() => presetOpen = false}>{t('label-cancel')}</button>
      </div>
    </dialog>
  {/if}
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
  dialog:not(.discard-confirmation):not(.editor-confirmation):not(.preset-dialog) { width: min(1400px, calc(100vw - 1.5rem)); max-height: 90dvh; padding: 0; background: var(--surface); color: var(--text); border-radius: 0.75rem; border: 1px solid #7c5b7d; overflow-y: auto; overscroll-behavior: contain; }
  [data-character-editor-dialog] { touch-action: pan-y; }
  [data-character-editor-dialog].form-dirty { touch-action: auto; }
  .touch-debug-popup { position: fixed; z-index: 2147483647; right: 0.5rem; bottom: 0.5rem; display: flex; box-sizing: border-box; width: min(95vw, 34rem); max-height: 36dvh; flex-direction: column; overflow: hidden; border: 1px solid #ab65ad; border-radius: 0.45rem; background: #17151aee; color: #fff; font: 0.65rem/1.3 monospace; pointer-events: none; }
  .touch-debug-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.3rem 0.5rem; padding: 0.3rem 0.4rem; border-bottom: 1px solid #ab65ad; }
  .touch-debug-header > div { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 0.25rem; pointer-events: auto; }
  .touch-debug-header button, .touch-debug-reopen { padding: 0.15rem 0.35rem; font: inherit; pointer-events: auto; }
  .touch-debug-copy-label { display: grid; flex: 0 0 auto; gap: 0.2rem; padding: 0.3rem 0.4rem; pointer-events: auto; }
  .touch-debug-copy-label textarea { box-sizing: border-box; width: 100%; height: 5rem; resize: vertical; user-select: text; -webkit-user-select: text; touch-action: pan-y; }
  .touch-debug-log { min-height: 0; flex: 1 1 auto; overflow: auto; padding: 0.3rem 0.4rem; overflow-wrap: anywhere; pointer-events: auto; touch-action: pan-y; }
  .touch-debug-log > div { padding: 0.08rem 0; border-bottom: 1px solid #ffffff22; }
  .touch-debug-reopen { display: block; margin-left: auto; }
  form { margin: 0; }
  .editor-header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.7rem 1rem; background: var(--surface); border-bottom: 1px solid #7c5b7d66; }
  .editor-header h2 { flex: 1; min-width: 0; margin: 0; font-size: 1.25rem; }
  .editor-navigation { display: flex; gap: 0.35rem; }
  .editor-navigation button { min-width: 2.25rem; padding: 0.25rem 0.5rem; font-size: 1.25rem; line-height: 1; }
  .editor-navigation button.boundary-hidden { visibility: hidden; }
  .header-actions { display: flex; align-items: center; gap: 0.5rem; }
  .header-actions button { white-space: nowrap; }
  .header-actions .cancel-button { background: #dd33334f; }
  .header-actions .save-button { background: #42a4f84d; }
  .editor-content { padding: 0.75rem 1rem 1rem; }
  .editor-layout { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: 1rem; }
  .editor-primary { width: 100%; max-width: 700px; min-width: 0; }
  .live-cost-preview { min-width: 0; }
  dialog.discard-confirmation, dialog.editor-confirmation, dialog.preset-dialog { width: min(27rem, calc(100vw - 2rem)); max-height: none; padding: 1.25rem; background: var(--surface); color: var(--text); border: 1px solid #7c5b7d; border-radius: 0.75rem; box-shadow: 0 1rem 3rem #0008; }
  .discard-confirmation h2, .editor-confirmation h2, .preset-dialog h2 { margin: 0; font-size: 1.15rem; }
  .editor-confirmation p { margin: 0.75rem 0 0; }
  .discard-actions, .dialog-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.2rem; }
  .preset-server-label { display: grid; gap: 0.3rem; margin-top: 1rem; }
  .preset-server-label select { width: 100%; }
  .preset-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; margin-top: 1rem; }
  .discard-button { background: #a32f3d; color: white; }
  dialog::backdrop { background: #000a; }
  input[type="number"] { width: 100%; min-width: 0; padding: 0.4rem; }
  .eleph-number-input[type="number"] { box-sizing: content-box; width: 2.4ch; min-width: 2.4ch; max-width: 100%; padding: 0.1rem 0; border: 0; border-bottom: 1px solid #ab65ad; border-radius: 0; background: transparent; color: var(--text); font: 600 0.9rem/1 monospace; text-align: center; appearance: textfield; -moz-appearance: textfield; }
  .eleph-number-input[type="number"]::-webkit-inner-spin-button, .eleph-number-input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  .eleph-number-input.owned-eleph-input[type="number"] { width: 4.4ch; min-width: 4.4ch; }
  fieldset { margin: 1rem 0; border: 1px solid #7c5b7d66; border-radius: 0.5rem; background: var(--background); }
  fieldset > label { display: block; margin: 0.5rem 0; }
  .eleph-layout { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem 0.8rem; align-items: center; }
  .eleph-group, .eleph-summary { display: flex; align-items: center; gap: 0.55rem; min-width: 0; }
  .eleph-icon { width: 3.1rem; height: 3.1rem; flex: 0 0 3.1rem; object-fit: contain; }
  .eleph-fields { display: grid; flex: 1; gap: 0.35rem; min-width: 0; }
  .eleph-fields label, .farm-daily > label:not(.eleph-check) { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; font-size: 0.82rem; }
  .eleph-options { display: grid; align-content: center; gap: 0.65rem; min-width: 0; }
  .eleph-check { display: flex !important; flex-direction: row !important; align-items: center; gap: 0.35rem !important; margin: 0 !important; font-size: 0.82rem; line-height: 1.2; }
  .eleph-check input { width: auto; flex: 0 0 auto; margin: 0; }
  .eleph-farming { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.55rem; min-width: 0; }
  .farm-missions, .farm-daily { display: grid; flex: 0 0 auto; align-content: start; justify-items: start; gap: 0.35rem; min-width: 0; }
  .hardmode-label { padding: 0.2rem 0.75rem; border-radius: 0.15rem; background: #c63b45; color: #fff; font-size: 0.75rem; }
  .sweep-input { display: flex; align-items: center; gap: 0.4rem; }
  .sweep-input input { width: 2.4ch; }
  .sweep-input > span { white-space: nowrap; font-size: 0.82rem; }
  .farm-server-select { width: 6rem; max-width: 100%; padding-inline: 0.45rem; }
  .eleph-summary { flex: 0 0 auto; align-self: center; }
  .eleph-summary > div { display: grid; gap: 0.15rem; min-width: 0; }
  .eleph-summary span { font-size: 0.82rem; }
  .eleph-summary strong { font-size: 1rem; }
  .eleph-cost-display { display: flex; flex: 0 0 auto; align-items: center; align-self: center; gap: 0.4rem; min-width: 0; justify-self: start; white-space: nowrap; }
  .eleph-cost-display img { width: 2.2rem; height: 2.2rem; flex: 0 0 2.2rem; object-fit: contain; }
  .eleph-cost-display strong { font-size: 1rem; font-variant-numeric: tabular-nums; }
  footer { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-start; margin-top: 1rem; }
  .error { color: var(--error); }
  .cost-preview-content { display: grid; gap: 0.65rem; }
  .cost-preview-materials { display: grid; gap: 0.45rem; padding: 0.2rem; }
  .cost-preview-row h4, .cost-preview-row > summary { margin: 0 0 0.2rem; font-size: 0.8rem; font-weight: 700; }
  .cost-preview-row > summary { cursor: pointer; }
  .cost-material-items { display: flex; flex-wrap: wrap; align-items: center; gap: 0.15rem; }
  .cost-material-type-group { display: contents; }
  .cost-material-items.atomic-groups .cost-material-type-group { display: flex; flex: 0 0 auto; flex-wrap: nowrap; align-items: center; gap: 0.15rem; }
  .cost-material-cell { position: relative; display: grid; box-sizing: border-box; width: 4.5rem; height: 3.5rem; aspect-ratio: 1 / 1; flex: 0 0 4.5rem; place-items: center; background-position: center; background-repeat: no-repeat; background-size: contain; }
  .cost-material-cell.rarity-1 { background-image: url('/planner/icons/Misc/background_n.png'); }
  .cost-material-cell.rarity-2 { background-image: url('/planner/icons/Misc/background_r.png'); }
  .cost-material-cell.rarity-3 { background-image: url('/planner/icons/Misc/background_sr.png'); }
  .cost-material-cell.rarity-4 { background-image: url('/planner/icons/Misc/background_ssr.png'); }
  .cost-material-cell.type-end::after { position: absolute; z-index: 2; top: -0.05rem; right: -0.16rem; height: calc(100% + 0.1rem); border-right: 2px dashed #fff; content: ''; transform: skewX(-10deg); pointer-events: none; }
  .cost-material-cell > img { box-sizing: border-box; width: 74%; aspect-ratio: 1 / 1; object-fit: contain; }
  .cost-material-amount { position: absolute; inset: 50% 0 auto; transform: translateY(-50%); color: #17151a; font: 700 1.3rem/1 sans-serif; font-variant-numeric: tabular-nums; text-align: center; text-shadow: -1px -1px 0 #fff, 0 -1px 0 #fff, 1px -1px 0 #fff, -1px 0 0 #fff, 1px 0 0 #fff, -1px 1px 0 #fff, 0 1px 0 #fff, 1px 1px 0 #fff; pointer-events: none; }
  .cost-material-name { max-width: 100%; padding: 0.2rem; overflow-wrap: anywhere; color: var(--text); font-size: 0.65rem; text-align: center; }
  .cost-summary-tiles { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.2rem 0.1rem 0.5rem; overflow: visible; }
  .cost-summary-tiles :global(.resource-cell) { flex: 0 0 180px; width: 180px; min-width: 120px; min-height: 54px; height: 54px; border: 1px solid #7c5b7d66; border-radius: 0.4rem; background: var(--background); }
  :global(.site[data-theme="dark"]) .cost-material-cell > img { filter: brightness(0.9); }
  @media (min-width: 1200px) {
    .editor-content { position: relative; }
    .editor-content::after { position: absolute; top: 0; bottom: 0; left: calc(1rem + 700px); border-left: 1px solid #7c5b7d66; content: ''; pointer-events: none; }
    .editor-layout { grid-template-columns: minmax(0, 700px) minmax(0, 1fr); column-gap: 0; }
    .editor-primary { box-sizing: border-box; padding-right: 1rem; }
    .live-cost-preview { padding-left: 1rem; }
  }
  @media (max-width: 600px) {
    dialog:not(.discard-confirmation):not(.editor-confirmation):not(.preset-dialog) { width: 100vw; max-width: 100vw; margin-inline: 0; }
    .editor-header, .editor-content { padding: 0.6rem; }
    .eleph-layout { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.8rem 0.55rem; }
    .eleph-icon { width: 2.55rem; height: 2.55rem; flex-basis: 2.55rem; }
    .eleph-options { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 0.8rem; }
    .eleph-farming { grid-column: 1 / -1; gap: 0.35rem; }
    .hardmode-label { padding-inline: 0.4rem; font-size: 0.68rem; }
    .farm-server-select { width: 5rem; padding-inline: 0.3rem; }
    .farm-daily { max-width: 6rem; }
    .eleph-summary { gap: 0.3rem; }
    .eleph-summary .eleph-icon { width: 2rem; height: 2rem; flex-basis: 2rem; }
    .eleph-summary span { font-size: 0.72rem; }
    .eleph-cost-display img { width: 2rem; height: 2rem; flex-basis: 2rem; }
    .cost-summary-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: visible; }
    .cost-summary-tiles :global(.resource-cell) { flex: initial; width: 100%; min-width: 0; }
  }
</style>
