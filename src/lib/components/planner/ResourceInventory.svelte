<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { fitResourceText } from '$lib/actions/fit-resource-text';
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import type { PlannerCharacter, PlannerMetadata, ResourceTotals } from '$lib/domain/planner/types';
  import { formatAmount, shopCurrencyKeys, type ResourceItem } from '$lib/domain/planner/catalog';
  import { inventoryLayout, type MaterialPanel } from '$lib/domain/planner/inventory-layout';
  import { localizedSchoolName } from '$lib/domain/planner/localized-labels';
  import { weaponXpSummary } from '$lib/domain/planner/aggregates';
  import ResourceCell, { type ResourceMode } from './ResourceCell.svelte';
  import PlannerDialog from './PlannerDialog.svelte';
  import KeyboardShortcutLabel from './KeyboardShortcutLabel.svelte';
  import GearFarming from './GearFarming.svelte';
  import GearBlueprintUsage from './GearBlueprintUsage.svelte';
  import type { PlannerDataset } from '$lib/domain/planner/types';
  import { farmedGeneralConversions, farmServer, type FarmServer, type GearFarmPlan } from '$lib/domain/planner/gear-farm';
import { cacheGearFarmPlan, getCachedGearFarmPlan, recommendGear } from '$lib/services/gear-farm';
  import ResourceUsersDialog, { type ResourceUserRow } from './ResourceUsersDialog.svelte';

  let { totals, metadata, dataset, savedServer, setServer, setOwned, gear, close, error, levelCap, setCap,
    characters, disabledCharacters, names, scribble,
    campaignMultiplier = $bindable(1), mode = $bindable<ResourceMode>('needed'), t }: {
    totals: ResourceTotals; metadata: PlannerMetadata; setOwned: (key: string, amount: number) => boolean;
    gear: boolean; close: () => void; error: string; levelCap: number; setCap: (value: number) => void;
    mode?: ResourceMode; t: (id: string) => string;
    dataset: PlannerDataset; savedServer: unknown; setServer: (server: FarmServer) => boolean;
    characters: PlannerCharacter[]; disabledCharacters: string[]; names: Record<string, string>; scribble: boolean;
    campaignMultiplier?: number;
  } = $props();
  const gearTransposePreferenceKey = 'planner-gear-table-transposed';
  const gearFarmingSortPreferenceKey = 'planner-gear-farming-sort-by-stage-number';
  const resourceLayoutPreferenceKey = 'planner-resource-table-stacked';
  const resourceArtifactsAbovePreferenceKey = 'planner-resource-table-artifacts-above';
  const resourceLargeIconPreferenceKey = 'planner-resource-table-large-icons';
  const resourceZeroVisibilityPreferenceKey = 'planner-resource-zero-visibility';
  type ResourceZeroVisibilityType = 'currencies' | 'limit-break-books' | 'gifts';
  type ResourceStyleSection = ResourceZeroVisibilityType | 'tables';
  let capError = $state('');
  let selectedResource = $state<ResourceItem | null>(null);
  let transposeGearTable = $state(true);
  let sortGearFarmingStagesByNumber = $state(false);
  let gearFarmingStyleActive = $state(false);
  let gearFarmingStylePanelOpen = $state(false);
  let gearFarmingStylePanel = $state<HTMLDivElement>();
  let gearFarmingStylePosition = $state({ left: 8, top: 8 });
  let forceStackedMaterials = $state(false);
  let forceArtifactsAbove = $state(false);
  let displayLargerIcons = $state(false);
  let resourceTableStyleActive = $state(false);
  let resourceTableStylePanelOpen = $state(false);
  let resourceTableStylePanel = $state<HTMLDivElement>();
  let resourceTableStylePosition = $state({ left: 8, top: 8 });
  let resourceTableStyleSection = $state<ResourceStyleSection>('tables');
  let visibleWithZeroQuantity = $state<Record<ResourceZeroVisibilityType, boolean>>({
    currencies: false, 'limit-break-books': false, gifts: false
  });
  let gearEnterDebugEnabled = $state(false);
  let gearEnterDebugEvents = $state<string[]>([]);
  let lastGearFocusedInput: HTMLInputElement | null = null;
  let pendingGearPointerKey = '';
  let pendingGearPointerAt = 0;
  let lastGearPointerType = '';
  let gearFocusRedirectToken = 0;
  let redirectingGearFocus = false;
  const shopCurrencyLabelKeys: Record<string, string> = {
    RaidToken: 'label-raidtokens',
    RareRaidToken: 'label-rareraidtokens',
    EliminationRaidToken: 'label-eliminationraidtokens',
    RareEliminationRaidToken: 'label-rareeliminationraidtokens',
    ArenaCoin: 'label-arenacoins',
    JECoin: 'label-jecoins',
    MasteryCertificate: 'label-expertpermits',
    BountyCoin: 'label-bountycoins'
  };
  const currencyLabel = (key: string) => {
    const currency = key.endsWith('Cost') ? key.slice(0, -4) : key;
    const labelKey = shopCurrencyLabelKeys[currency];
    if (!labelKey) return undefined;
    const label = t(labelKey);
    return label && label !== 'Undefined' ? label : currency;
  };
  let layout = $derived.by(() => {
    const inventory = inventoryLayout(metadata, totals, gear);
    return {
      ...inventory,
      extra: inventory.extra.map((item) => {
        const name = currencyLabel(item.key);
        return name ? { ...item, name } : item;
      })
    };
  });
  let gearFarmCompleted = $state<{ key: string; plan: GearFarmPlan } | null>(null);
  let gearFarmFailure = $state<{ key: string; message: string } | null>(null);
  let gearFarmBusy = $state(false);
  let excludeOwnedChoiceBlueprints = $state(false);
  let excludeOwnedGeneralBlueprints = $state(false);
  let gearFarmRetry = $state(0);
  $effect(() => {
    if (gear && mode === 'needed') return;
    gearFarmingStyleActive = false;
    gearFarmingStylePanelOpen = false;
  });
  let gearFarmNeeded = $derived(Object.fromEntries<number>(metadata.equipment.flatMap((key) => (totals.needed[key] ?? 0) > 0 ? [[key, totals.needed[key]]] : [])));
  let gearFarmOwned = $derived(Object.fromEntries<number>(Object.entries(totals.owned)
    .filter(([key]) => (key.startsWith('Choice_T') && !excludeOwnedChoiceBlueprints) ||
      (key.startsWith('G_') && !excludeOwnedGeneralBlueprints))
    .map(([key, amount]) => [key, Number(amount)])));
  let gearFarmKey = $derived(gear ? JSON.stringify([
    savedServer, campaignMultiplier, gearFarmNeeded, gearFarmOwned,
    dataset.context.data.gear_rates, dataset.context.data.gear_drops, dataset.context.data.universal_bp_cost, metadata.worldCaps
  ]) : '');
  let gearFarmResult = $derived(
    gearFarmFailure?.key === gearFarmKey ? null : gearFarmCompleted?.plan ?? null
  );
  let gearFarmError = $derived(gearFarmFailure?.key === gearFarmKey ? gearFarmFailure.message : '');
  $effect(() => {
    const key = gearFarmKey;
    gearFarmRetry;
    if (!key) return;
    const cachedPlan = getCachedGearFarmPlan(key);
    if (cachedPlan) {
      gearFarmCompleted = { key, plan: cachedPlan };
      gearFarmFailure = null;
      gearFarmBusy = false;
      return;
    }
    const input = untrack(() => ({
      data: dataset.context.data, needed: gearFarmNeeded, owned: gearFarmOwned,
      server: savedServer, multiplier: campaignMultiplier, caps: metadata.worldCaps
    }));
    const controller = new AbortController();
    gearFarmFailure = null;
    gearFarmBusy = true;
    try {
      const server = farmServer(input.server);
      void recommendGear(input.data, input.needed, input.owned, server, input.multiplier, input.caps, { signal: controller.signal })
        .then((plan) => {
          if (controller.signal.aborted) return;
          cacheGearFarmPlan(key, plan);
          gearFarmCompleted = { key, plan };
        })
        .catch((problem) => {
          if (controller.signal.aborted) return;
          console.error('Gear farming failed.', problem);
          gearFarmFailure = { key, message: problem instanceof Error ? problem.message : t('ui-farming-error') };
        })
        .finally(() => { if (!controller.signal.aborted) gearFarmBusy = false; });
    } catch (problem) {
      gearFarmBusy = false;
      gearFarmFailure = { key, message: problem instanceof Error ? problem.message : t('ui-farming-error') };
    }
    return () => controller.abort();
  });
  const modes = [
    { key: 'needed', label: 'label-remainingneeded', shortcut: 'r' }, { key: 'owned', label: 'label-owned', shortcut: 'o' },
    { key: 'required', label: 'label-totalneeded', shortcut: 't' }, { key: 'leftover', label: 'label-leftover', shortcut: 'l' }
  ] as const;
  const inlineAmountKeys = new Set(['9999', 'Xp', 'GearXp', 'Credit', 'Eligma', ...shopCurrencyKeys]);
  const pairedExtraGroupNames = new Set(['XP items', 'Limit break books', 'Gifts']);
  const academyIconFiles: Record<string, string> = {
    Abydos: 'Abydos', Arius: 'Arius', ETC: 'ETC', Gehenna: 'Gehenna', Highlander: 'Highlander',
    Hyakkiyako: 'Hyakkiyako', Millennium: 'Millennium', Odyssey: 'Odyssey', RedWinter: 'RedWinter',
    Shanhaijing: 'Shanhaijing', SRT: 'SRT', Tokiwadai: 'ETC', Trinity: 'Trinity', Valkyrie: 'Valkyrie',
    WildHunt: 'Wildhunt', Wildhunt: 'Wildhunt'
  };
  const inlineAmount = (key: string) => inlineAmountKeys.has(key) || key.endsWith('Cost');
  const schoolName = (name: string) => localizedSchoolName(name, t).replaceAll('_', ' ');
  const gearTypeName = (name: string) => {
    const translated = t(`gear-${name.toLowerCase()}`);
    return translated === 'Undefined' ? name : translated;
  };
  const choiceTiers = Array.from({ length: 9 }, (_, index) => `T${index + 2}`);
  const choiceItem = (tier: string): ResourceItem | undefined => choiceTiers.includes(tier) ? {
    key: `Choice_${tier}`, name: `Choice ${tier}`, group: 'Equipment', image: `/planner/icons/Gear/Choice_${tier}.webp`
  } : undefined;
  const isUniversalGearItem = (item: ResourceItem | undefined) =>
    !!item && (item.key.startsWith('Choice_') || item.key.startsWith('G_'));
  const generalItem = (type: string): ResourceItem => ({
    key: `G_${type}`, name: `${t('gear-general-blueprint')} (${gearTypeName(type)})`, group: 'Equipment', image: `/planner/icons/Gear/G_${type}.png`
  });
  function transposeGearPanel(panel: MaterialPanel): MaterialPanel {
    return {
      ...panel,
      columns: panel.rows.map((row) => row.name),
      rows: panel.columns.map((name, columnIndex) => ({
        name,
        cells: panel.rows.map((row) => row.cells[columnIndex])
      }))
    };
  }

  function focusOutsideMatrix(matrixRoot: HTMLElement, currentInput: HTMLInputElement, direction: -1 | 1) {
    const dialog = matrixRoot.closest('dialog');
    const scope: ParentNode = dialog ?? document;
    const candidates = [...scope.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]'
    )].filter((element) => element.tabIndex >= 0 && !element.closest('[inert]') &&
      getComputedStyle(element).visibility !== 'hidden' && element.getClientRects().length > 0);
    const currentIndex = candidates.indexOf(currentInput);
    if (currentIndex < 0) return false;

    for (let distance = 1; distance <= candidates.length; distance += 1) {
      let index = currentIndex + direction * distance;
      if (index < 0 || index >= candidates.length) {
        if (!dialog) break;
        index = (index + candidates.length) % candidates.length;
      }
      const candidate = candidates[index];
      if (candidate && !matrixRoot.contains(candidate)) {
        candidate.focus();
        return true;
      }
    }
    return false;
  }

  let gearUsage = $derived(gearFarmResult?.allocation ?? {
    remainingByGear: {}, choiceUsedByGear: {}, generalUsedByGear: {}, specialLeftover: {}
  });
  let gearDisplayTotals: ResourceTotals = $derived({
    ...totals,
    needed: { ...totals.needed, ...gearUsage.remainingByGear },
    leftover: { ...totals.leftover, ...gearUsage.specialLeftover }
  });
  let gearPlaceholderTotals: ResourceTotals = $derived({
    ...gearDisplayTotals,
    needed: Object.fromEntries(Object.entries(gearDisplayTotals.needed).map(([key, amount]) =>
      [key, key.startsWith('Choice_') || key.startsWith('G_') ? 0 : amount])),
    required: Object.fromEntries(Object.entries(gearDisplayTotals.required).map(([key, amount]) =>
      [key, key.startsWith('Choice_') || key.startsWith('G_') ? 0 : amount]))
  });
  let showUniversalInventory = $derived(mode === 'owned' || mode === 'leftover');
  let showUniversalPlaceholders = $derived(mode === 'needed' || mode === 'required');
  let panels = $derived.by(() => {
    if (!gear) return layout.panels;
    const source = layout.panels[0];
    if (!source) return [];
    const columns = [...source.columns, 'Choice'];
    const rows = source.rows.map((row) => ({
      ...row, cells: [...row.cells, choiceItem(row.name)]
    }));
    rows.push({ name: 'General', cells: [...source.columns.map(generalItem), undefined] });
    const panel = { ...source, columns, rows };
    return [transposeGearTable ? transposeGearPanel(panel) : panel];
  });
  let matrixFitRows = $derived.by(() => {
    if (gear) {
      const gearRows = panels[0]?.rows ?? [];
      const visibleRows = showUniversalInventory ? gearRows : gearRows.filter((row) => row.name !== 'Choice' && row.name !== 'General');
      return Math.max(1, visibleRows.length);
    }
    const schoolRows = panels.find((panel) => panel.columnGroups)?.rows.length ?? 0;
    const artifactRows = panels.filter((panel) => panel.title === 'ui-artifacts')
      .reduce((max, panel) => Math.max(max, panel.rows.length), 0);
    return Math.max(1, Math.max(schoolRows, artifactRows));
  });
  let hasFarmedBlueprintUses = $derived.by(() => gear && !!gearFarmResult &&
    farmedGeneralConversions(gearFarmResult, dataset.context.data).length > 0);
  let gearReferenceRows = $derived.by(() => {
    if (!gear) return matrixFitRows;
    const neededModeRows = (panels[0]?.rows ?? []).filter((row) => row.name !== 'Choice' && row.name !== 'General');
    return Math.max(1, neededModeRows.length);
  });
  // Keep the cell size anchored to Remaining Needed, including farmed-blueprint space when present.
  let gearSizingRows = $derived(gearReferenceRows + 1 + (hasFarmedBlueprintUses ? 6 : 0));
  let gearTableWidthTerms = $derived(Array.from({ length: panels[0]?.columns.length ?? 0 }, () =>
    'var(--inventory-cell-size, 75px)').join(' + '));
  let summaryTiles = $derived(layout.extra.filter((item) => inlineAmount(item.key)));
  const leadingSummaryKeys = ['Credit', 'Xp', '9999'];
  let leadingSummaryTiles = $derived(leadingSummaryKeys.flatMap((key) => summaryTiles.filter((item) => item.key === key)));
  let remainingSummaryTiles = $derived(summaryTiles.filter((item) =>
    !leadingSummaryKeys.includes(item.key) && (
      item.key === 'GearXp' ||
      (mode === 'owned' && !['Xp', 'GearXp', 'Eleph', 'ShopResets'].includes(item.key) && !item.key.endsWith('Cost')) ||
      Number(totals[mode][item.key] ?? 0) !== 0 ||
      (!gear && shouldShowZeroQuantity('currencies'))
    )));
  let gearXpSummaryItem: ResourceItem = $derived(
    remainingSummaryTiles.find((item) => item.key === 'GearXp') ?? layout.extra.find((item) => item.key === 'GearXp')!
  );
  let remainingCurrencyTiles = $derived(remainingSummaryTiles.filter((item) => item.key !== 'GearXp'));
  let matrixCurrencyTiles = $derived(gear ? remainingCurrencyTiles : remainingSummaryTiles);
  let allExtras = $derived(layout.extra.filter((item) => !inlineAmount(item.key)));
  let extras = $derived(allExtras.filter((item) => {
    if (mode === 'owned') return true;
    if (item.group === 'XP items' || item.group === 'Weapon items') return false;
    if (!gear && item.group === 'Limit break books' && shouldShowZeroQuantity('limit-break-books')) return true;
    if (!gear && item.group === 'Gifts' && shouldShowZeroQuantity('gifts')) return true;
    return Number(totals[mode][item.key] ?? 0) !== 0;
  }));
  const weaponMaterialTiers = ['T1', 'T2', 'T3', 'T4'];
  const weaponMaterialTypes = ['Spring', 'Hammer', 'Barrel', 'Needle'];
  let weaponMaterialRows = $derived(weaponMaterialTypes.map((type) => ({
    type,
    items: weaponMaterialTiers
      .map((tier) => allExtras.find((item) => item.key === `${tier}_${type}`))
      .filter((item): item is ResourceItem => item !== undefined)
  })).filter((row) => row.items.some((item) => extras.some((extra) => extra.key === item.key))));
  let groups = $derived([...new Set(extras.map((item) => item.group))]);
  let pairedGroups = $derived(['XP items', 'Limit break books', 'Gifts'].filter((group) =>
    groups.includes(group) && !(group === 'XP items' && mode === 'leftover')));
  let hasWeaponItems = $derived(groups.includes('Weapon items'));
  let otherGroups = $derived(groups.filter((group) => !pairedExtraGroupNames.has(group) && group !== 'Weapon items'));
  let weapons = $derived(weaponXpSummary(totals));
  let weaponXpDisplayRows = $derived(weapons.rows.map((row) => ({
    ...row,
    displayAmount: mode === 'owned' ? row.owned : mode === 'required' ? row.required :
      mode === 'leftover' ? Math.max(row.owned - row.required, 0) : row.remaining
  })));
  const weaponXpBalanceKey = 'WeaponXpBalance';
  let weaponXpBalanceItem: ResourceItem = $derived({
    key: weaponXpBalanceKey, name: t('ui-weapon-xp'), group: 'Currency', image: '/planner/icons/LevelPart/All_All.png'
  });
  let weaponXpBalanceTotals: ResourceTotals = $derived({
    ...totals,
    needed: { ...totals.needed, [weaponXpBalanceKey]: weapons.remaining },
    required: { ...totals.required, [weaponXpBalanceKey]: weapons.remainingNeeded },
    leftover: { ...totals.leftover, [weaponXpBalanceKey]: Math.max(weapons.remainingOwned - weapons.remainingNeeded, 0) }
  });
  let showWeaponXpBalance = $derived(mode !== 'owned');
  let usersByResource = $derived.by(() => {
    const users: Record<string, ResourceUserRow[]> = {};
    const excluded = new Set(disabledCharacters);
    for (const character of characters) {
      if (excluded.has(character.id)) continue;
      const portrait = (scribble && metadata.scribblePortraits[character.id]) || metadata.portraits[character.id] || '';
      for (const [key, rawAmount] of Object.entries(totals.perCharacter[character.id] ?? {})) {
        const amount = Number(rawAmount);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        (users[key] ??= []).push({
          id: character.id, name: names[character.id] ?? character.name, amount, portrait
        });
      }
    }
    for (const rows of Object.values(users)) rows.sort((first, second) => second.amount - first.amount);
    return users;
  });
  let selectedUsers = $derived(selectedResource ? usersByResource[selectedResource.key] ?? [] : []);

  function addGearEnterDebugEvent(message: string) {
    gearEnterDebugEvents = [...gearEnterDebugEvents.slice(-119), message];
  }

  function describeInput(target: EventTarget | null): string {
    if (target instanceof HTMLInputElement) return target.dataset.resourceKey ?? target.getAttribute('aria-label') ?? 'input';
    return target instanceof Element ? target.tagName.toLowerCase() : 'unknown';
  }

  function recordGearEnterDebugEvent(event: Event) {
    if (!gearEnterDebugEnabled || !(event.target instanceof Element) || !event.target.closest('.matrices.gear')) return;
    const target = describeInput(event.target);
    let details = '';
    if (event instanceof KeyboardEvent) {
      details = ` key=${JSON.stringify(event.key)} code=${event.code || '-'} location=${event.location} keyCode=${event.keyCode} prevented=${event.defaultPrevented}`;
    } else if (event instanceof InputEvent) {
      details = ` inputType=${event.inputType || '-'} data=${JSON.stringify(event.data)}`;
    } else if (event instanceof PointerEvent) {
      details = ` pointerType=${event.pointerType}`;
    } else if (event instanceof FocusEvent) {
      details = ` related=${describeInput(event.relatedTarget)}`;
    }
    addGearEnterDebugEvent(`${event.type} target=${target}${details}`);
    if (event instanceof KeyboardEvent && event.type === 'keydown') {
      queueMicrotask(() => addGearEnterDebugEvent(`after keydown prevented=${event.defaultPrevented} active=${describeInput(document.activeElement)}`));
    }
  }

  function usesTouchInput() {
    return navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
  }

  function matrixInputOrder(matrixRoot: HTMLElement, rowMajorOrder: boolean, isGearMatrix: boolean) {
    const entries = [...matrixRoot.querySelectorAll('table')].flatMap((table, tableIndex) => {
      const rows = [...table.tBodies].flatMap((body) => [...body.rows]);
      return rows.flatMap((row, rowIndex) => {
        const rowHeaderOffset = row.querySelector(':scope > th[scope="row"]') ? 1 : 0;
        return [...row.cells].flatMap((cell) => {
          if (!(cell instanceof HTMLTableCellElement) || cell.tagName !== 'TD') return [];
          const input = cell.querySelector<HTMLInputElement>('input.resource-input');
          if (!input) return [];
          const key = input.dataset.resourceKey ?? input.closest<HTMLElement>('[data-resource]')?.dataset.resource ?? '';
          const group = key.startsWith('G_') ? 1 : key.startsWith('Choice_') ? 2 : 0;
          return [{ input, tableIndex, column: cell.cellIndex - rowHeaderOffset, rowIndex, group }];
        });
      });
    });
    const comparePosition = (first: typeof entries[number], second: typeof entries[number]) =>
      first.tableIndex - second.tableIndex || (rowMajorOrder
        ? first.rowIndex - second.rowIndex || first.column - second.column
        : first.column - second.column || first.rowIndex - second.rowIndex);
    return isGearMatrix
      ? [0, 1, 2].flatMap((group) => entries.filter((entry) => entry.group === group).sort(comparePosition).map((entry) => entry.input))
      : entries.sort(comparePosition).map((entry) => entry.input);
  }

  function inventorySideInputOrder(inventoryRoot: HTMLElement, isGearMatrix: boolean): HTMLInputElement[] {
    const inventorySide = inventoryRoot.querySelector<HTMLElement>('.inventory-side');
    if (!inventorySide) return [];
    const inputs = [...inventorySide.querySelectorAll<HTMLInputElement>('input.resource-input')];
    if (!isGearMatrix) return inputs;

    const weaponGridInputs = [...inventorySide.querySelectorAll<HTMLInputElement>('.weapon-material-grid input.resource-input')];
    if (!weaponGridInputs.length) return inputs;
    const firstGridIndex = inputs.indexOf(weaponGridInputs[0]);
    if (firstGridIndex < 0) return inputs;
    const rowCount = Math.ceil(weaponGridInputs.length / 4);
    const columnMajorWeaponInputs = Array.from({ length: 4 }, (_, column) =>
      Array.from({ length: rowCount }, (_, row) => weaponGridInputs[row * 4 + column])
        .filter((input): input is HTMLInputElement => input !== undefined)
    ).flat();
    return [
      ...inputs.slice(0, firstGridIndex),
      ...columnMajorWeaponInputs,
      ...inputs.slice(firstGridIndex + weaponGridInputs.length)
    ];
  }

  function directionalMatrixInput(input: HTMLInputElement, matrix: HTMLElement, direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight') {
    const current = input.getBoundingClientRect();
    const horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight';
    const sign = direction === 'ArrowLeft' || direction === 'ArrowUp' ? -1 : 1;
    const currentPrimary = horizontal ? current.left + current.width / 2 : current.top + current.height / 2;
    const currentCrossStart = horizontal ? current.top : current.left;
    const currentCrossEnd = horizontal ? current.bottom : current.right;
    const inputs = [...matrix.querySelectorAll<HTMLInputElement>('input.resource-input')]
      .filter((candidate) => candidate !== input && !candidate.disabled &&
        getComputedStyle(candidate).visibility !== 'hidden' && candidate.getClientRects().length > 0)
      .map((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const primary = horizontal ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
        const crossStart = horizontal ? rect.top : rect.left;
        const crossEnd = horizontal ? rect.bottom : rect.right;
        const primaryDelta = (primary - currentPrimary) * sign;
        const overlap = Math.max(0, Math.min(currentCrossEnd, crossEnd) - Math.max(currentCrossStart, crossStart));
        const crossDistance = Math.abs((crossStart + crossEnd) / 2 - (currentCrossStart + currentCrossEnd) / 2);
        return { input: candidate, primaryDelta, overlap, crossDistance };
      })
      .filter((candidate) => candidate.primaryDelta > 1);
    const aligned = inputs.filter((candidate) => candidate.overlap > 0);
    const candidates = aligned.length ? aligned : inputs;
    candidates.sort((first, second) => aligned.length
      ? first.primaryDelta - second.primaryDelta || first.crossDistance - second.crossDistance
      : first.crossDistance - second.crossDistance || first.primaryDelta - second.primaryDelta);
    return candidates[0]?.input;
  }

  function handleGearPointerDown(event: PointerEvent) {
    gearFocusRedirectToken += 1;
    lastGearPointerType = event.pointerType;
    if (!(event.target instanceof Element)) return;
    const input = event.target.closest<HTMLInputElement>('input.resource-input') ??
      event.target.closest<HTMLElement>('.resource-cell')?.querySelector<HTMLInputElement>('input.resource-input');
    if (!input?.closest('.matrices.gear')) return;
    pendingGearPointerKey = input.dataset.resourceKey ?? '';
    pendingGearPointerAt = Date.now();
  }

  function handleGearFocusIn(event: FocusEvent) {
    if (!(event.target instanceof HTMLInputElement) || !event.target.matches('.resource-input')) return;
    const input = event.target;
    const matrixRoot = input.closest<HTMLElement>('.matrices.gear');
    if (!matrixRoot) return;

    const previous = lastGearFocusedInput;
    const pointerFocusedThisInput = Date.now() - pendingGearPointerAt < 1000 &&
      pendingGearPointerKey === (input.dataset.resourceKey ?? '');
    if (pendingGearPointerKey && Date.now() - pendingGearPointerAt >= 1000) pendingGearPointerKey = '';
    else if (pointerFocusedThisInput) pendingGearPointerKey = '';

    const touchNavigation = usesTouchInput() || lastGearPointerType === 'touch';
    const sameGearMatrix = previous?.isConnected && previous.closest('.matrices.gear') === matrixRoot;
    if (gearEnterDebugEnabled) {
      addGearEnterDebugEvent(`focus-order check from=${describeInput(previous)} to=${describeInput(input)} touch=${touchNavigation} pointerFocus=${pointerFocusedThisInput} redirecting=${redirectingGearFocus} sameMatrix=${Boolean(sameGearMatrix)}`);
    }
    if (previous && previous !== input && sameGearMatrix &&
      !pointerFocusedThisInput && !redirectingGearFocus && touchNavigation) {
      const domInputs = [...matrixRoot.querySelectorAll<HTMLInputElement>('input.resource-input')];
      const previousDomIndex = domInputs.indexOf(previous);
      const incomingDomIndex = domInputs.indexOf(input);
      const direction = incomingDomIndex > previousDomIndex ? 1 : -1;
      const orderedInputs = matrixInputOrder(matrixRoot, true, true);
      const previousOrderIndex = orderedInputs.indexOf(previous);
      const desiredInput = orderedInputs[previousOrderIndex + direction];
      if (desiredInput && desiredInput !== input) {
        const redirectToken = ++gearFocusRedirectToken;
        if (gearEnterDebugEnabled) {
          addGearEnterDebugEvent(`focus-order deferred redirect from=${describeInput(previous)} native=${describeInput(input)} to=${describeInput(desiredInput)}`);
        }
        // The virtual keyboard's built-in Next action may keep running after
        // focusin. Let it finish before applying our ordered destination.
        window.setTimeout(() => {
          if (redirectToken !== gearFocusRedirectToken || !desiredInput.isConnected || document.activeElement !== input) return;
          if (gearEnterDebugEnabled) {
            addGearEnterDebugEvent(`focus-order apply redirect from=${describeInput(input)} to=${describeInput(desiredInput)}`);
          }
          redirectingGearFocus = true;
          desiredInput.focus();
          redirectingGearFocus = false;
          lastGearFocusedInput = desiredInput;
        }, 0);
        return;
      }
    }
    lastGearFocusedInput = input;
  }

  function handleGearFocusOut(event: FocusEvent) {
    if (!(event.target instanceof HTMLInputElement) || !event.target.matches('.resource-input')) return;
    const matrixRoot = event.target.closest('.matrices.gear');
    if (!matrixRoot) return;
    if (event.relatedTarget instanceof Element && event.relatedTarget.closest('.matrices.gear') === matrixRoot) return;
    window.setTimeout(() => {
      if (lastGearFocusedInput === event.target &&
        (!(document.activeElement instanceof HTMLInputElement) || document.activeElement.closest('.matrices.gear') !== matrixRoot)) {
        lastGearFocusedInput = null;
      }
    }, 50);
  }

  function focusMatrixInput(input: HTMLInputElement) {
    if (!input.closest('.matrices.gear')) {
      input.focus();
      return;
    }
    redirectingGearFocus = true;
    input.focus();
    redirectingGearFocus = false;
  }

  onMount(() => {
    if (gear) return;
    try {
      forceStackedMaterials = localStorage.getItem(resourceLayoutPreferenceKey) === 'true';
      forceArtifactsAbove = localStorage.getItem(resourceArtifactsAbovePreferenceKey) === 'true';
      if (forceArtifactsAbove) forceStackedMaterials = false;
      displayLargerIcons = localStorage.getItem(resourceLargeIconPreferenceKey) === 'true';
      loadVisibleWithZeroQuantity(localStorage.getItem(resourceZeroVisibilityPreferenceKey));
    }
    catch { /* Keep the default resource table layout if storage is unavailable. */ }
    const storage = (event: StorageEvent) => {
      if (event.key === resourceLayoutPreferenceKey || event.key === null) {
        forceStackedMaterials = event.key !== null && event.newValue === 'true';
        if (forceStackedMaterials) forceArtifactsAbove = false;
      }
      if (event.key === resourceArtifactsAbovePreferenceKey || event.key === null) {
        forceArtifactsAbove = event.key !== null && event.newValue === 'true';
        if (forceArtifactsAbove) forceStackedMaterials = false;
      }
      if (event.key === resourceLargeIconPreferenceKey || event.key === null) {
        displayLargerIcons = event.key !== null && event.newValue === 'true';
      }
      if (event.key === resourceZeroVisibilityPreferenceKey || event.key === null) {
        loadVisibleWithZeroQuantity(event.key === null ? null : event.newValue);
      }
    };
    window.addEventListener('storage', storage);
    window.addEventListener('click', closeResourceTableStyleOnOutsideClick);
    return () => {
      window.removeEventListener('storage', storage);
      window.removeEventListener('click', closeResourceTableStyleOnOutsideClick);
    };
  });

  onMount(() => {
    if (!gear) return;
    try {
      const savedPreference = localStorage.getItem(gearTransposePreferenceKey);
      if (savedPreference !== null) transposeGearTable = savedPreference === 'true';
      sortGearFarmingStagesByNumber = localStorage.getItem(gearFarmingSortPreferenceKey) === 'true';
    }
    catch { /* Keep the default gear table preferences if storage is unavailable. */ }

    document.addEventListener('pointerdown', closeGearFarmingStyleOnOutsideClick, true);
    gearEnterDebugEnabled = new URLSearchParams(window.location.search).get('gearenterdebug') === '1';
    const debugEventTypes = ['keydown', 'keyup', 'keypress', 'focusin', 'focusout', 'beforeinput', 'input', 'change', 'pointerdown', 'pointerup'] as const;
    if (gearEnterDebugEnabled) {
      addGearEnterDebugEvent(`device maxTouchPoints=${navigator.maxTouchPoints} coarse=${window.matchMedia('(pointer: coarse)').matches}`);
      for (const type of debugEventTypes) document.addEventListener(type, recordGearEnterDebugEvent, true);
    }
    document.addEventListener('pointerdown', handleGearPointerDown, true);
    document.addEventListener('focusin', handleGearFocusIn, true);
    document.addEventListener('focusout', handleGearFocusOut, true);
    return () => {
      document.removeEventListener('pointerdown', closeGearFarmingStyleOnOutsideClick, true);
      if (gearEnterDebugEnabled) {
        for (const type of debugEventTypes) document.removeEventListener(type, recordGearEnterDebugEvent, true);
      }
      document.removeEventListener('pointerdown', handleGearPointerDown, true);
      document.removeEventListener('focusin', handleGearFocusIn, true);
      document.removeEventListener('focusout', handleGearFocusOut, true);
    };
  });

  function toggleGearTableTranspose() {
    transposeGearTable = !transposeGearTable;
    try { localStorage.setItem(gearTransposePreferenceKey, String(transposeGearTable)); }
    catch { /* Keep the current orientation for this session if storage is unavailable. */ }
  }

  function toggleGearFarmingStyleMode() {
    gearFarmingStyleActive = !gearFarmingStyleActive;
    gearFarmingStylePanelOpen = false;
  }

  async function openGearFarmingStylePanel(event: PointerEvent) {
    if (!gearFarmingStyleActive || !(event.target instanceof Element) || !event.target.closest('.stage-runs [data-farm-stage]')) return;
    event.preventDefault();
    event.stopPropagation();
    gearFarmingStylePanelOpen = true;
    await tick();
    if (!gearFarmingStyleActive || !gearFarmingStylePanelOpen) return;
    const panelBounds = gearFarmingStylePanel?.getBoundingClientRect();
    const width = Math.min(panelBounds?.width || 260, window.innerWidth - 16);
    const height = panelBounds?.height || 54;
    const rightSpace = window.innerWidth - event.clientX;
    const left = rightSpace >= width + 12 ? event.clientX + 12 : event.clientX - width - 12;
    gearFarmingStylePosition = {
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(event.clientY - height / 2, window.innerHeight - height - 8))
    };
  }

  function closeGearFarmingStyleOnOutsideClick(event: PointerEvent) {
    if (!gearFarmingStyleActive) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-gear-farming-style-toggle], .gear-farming-style-panel, .stage-runs.style-editable [data-farm-stage]')) return;
    gearFarmingStyleActive = false;
    gearFarmingStylePanelOpen = false;
  }

  function updateSortGearFarmingStages(value: boolean) {
    sortGearFarmingStagesByNumber = value;
    try { localStorage.setItem(gearFarmingSortPreferenceKey, String(value)); }
    catch { /* Keep the setting for this session if storage is unavailable. */ }
  }

  function toggleResourceTableStyleMode() {
    resourceTableStyleActive = !resourceTableStyleActive;
    if (!resourceTableStyleActive) resourceTableStylePanelOpen = false;
  }

  function openResourceTableStylePanel(event: PointerEvent) {
    if (gear || !resourceTableStyleActive) return;
    const target = event.target instanceof Element ? event.target : null;
    const section = target?.closest<HTMLElement>('[data-resource-zero-style-type]')?.dataset.resourceZeroStyleType;
    if (section === 'currencies' || section === 'limit-break-books' || section === 'gifts') {
      resourceTableStyleSection = section;
    } else if (target?.closest('.matrices:not(.gear)')) {
      resourceTableStyleSection = 'tables';
    } else {
      return;
    }
    const width = Math.min(260, window.innerWidth - 16);
    const height = Math.min(resourceTableStylePanel?.getBoundingClientRect().height ?? 64, window.innerHeight - 16);
    const rightSpace = window.innerWidth - event.clientX;
    const left = rightSpace >= width + 12 ? event.clientX + 12 : event.clientX - width - 12;
    resourceTableStylePosition = {
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(event.clientY - height / 2, window.innerHeight - height - 8))
    };
    resourceTableStylePanelOpen = true;
    event.preventDefault();
    event.stopPropagation();
  }

  function closeResourceTableStyleOnOutsideClick(event: MouseEvent) {
    if (!resourceTableStyleActive) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-resource-table-style-toggle], .resource-table-style-panel, .matrices:not(.gear), [data-resource-zero-style-type]')) return;
    resourceTableStyleActive = false;
    resourceTableStylePanelOpen = false;
  }

  function updateForceStackedMaterials(value: boolean) {
    forceStackedMaterials = value;
    if (value) forceArtifactsAbove = false;
    try {
      localStorage.setItem(resourceLayoutPreferenceKey, String(value));
      if (value) localStorage.setItem(resourceArtifactsAbovePreferenceKey, 'false');
    }
    catch { /* Keep the current layout for this session if storage is unavailable. */ }
  }

  function updateForceArtifactsAbove(value: boolean) {
    forceArtifactsAbove = value;
    if (value) forceStackedMaterials = false;
    try {
      localStorage.setItem(resourceArtifactsAbovePreferenceKey, String(value));
      if (value) localStorage.setItem(resourceLayoutPreferenceKey, 'false');
    }
    catch { /* Keep the current layout for this session if storage is unavailable. */ }
  }

  function updateDisplayLargerIcons(value: boolean) {
    displayLargerIcons = value;
    try { localStorage.setItem(resourceLargeIconPreferenceKey, String(value)); }
    catch { /* Keep the current icon size preference for this session if storage is unavailable. */ }
  }

  function loadVisibleWithZeroQuantity(value: string | null) {
    try {
      const saved = value ? JSON.parse(value) as Partial<Record<ResourceZeroVisibilityType, unknown>> : {};
      visibleWithZeroQuantity = {
        currencies: saved.currencies === true,
        'limit-break-books': saved['limit-break-books'] === true,
        gifts: saved.gifts === true
      };
    } catch {
      visibleWithZeroQuantity = { currencies: false, 'limit-break-books': false, gifts: false };
    }
  }

  function shouldShowZeroQuantity(section: ResourceZeroVisibilityType) {
    return resourceTableStyleActive || visibleWithZeroQuantity[section];
  }

  function updateVisibleWithZeroQuantity(section: ResourceZeroVisibilityType, value: boolean) {
    visibleWithZeroQuantity = { ...visibleWithZeroQuantity, [section]: value };
    try { localStorage.setItem(resourceZeroVisibilityPreferenceKey, JSON.stringify(visibleWithZeroQuantity)); }
    catch { /* Keep the setting for this session if storage is unavailable. */ }
  }

  function openUsers(item: ResourceItem) {
    if (mode !== 'owned' && usersByResource[item.key]?.length) selectedResource = item;
  }

  function handleInventoryKeydown(event: KeyboardEvent) {
    const isEnterNavigation = event.key === 'Enter' || ['Go', 'Next', 'Done'].includes(event.key) || event.keyCode === 13;
    const isCtrlArrowNavigation = event.ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key);
    if (gearEnterDebugEnabled && event.target instanceof HTMLInputElement) {
      addGearEnterDebugEvent(`matrix keydown key=${JSON.stringify(event.key)} target=${describeInput(event.target)} recognized=${isEnterNavigation || event.key === 'Tab' || isCtrlArrowNavigation}`);
    }
    if (
      (!isEnterNavigation && event.key !== 'Tab' && !isCtrlArrowNavigation) ||
      !(event.target instanceof HTMLInputElement) || !event.target.matches('.resource-input')
    ) return;

    if (isCtrlArrowNavigation) {
      const matrix = event.target.closest<HTMLElement>('.matrices.gear, .school-pair, .artifact-pair, .weapon-material-grid');
      if (!matrix) return;
      event.preventDefault();
      const nextInput = directionalMatrixInput(event.target, matrix, event.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight');
      if (nextInput) focusMatrixInput(nextInput);
      return;
    }

    const inventoryRoot = event.currentTarget as HTMLElement;
    const matrixRoot = inventoryRoot.querySelector<HTMLElement>('.matrices');
    if (!matrixRoot) return;
    const isGearMatrix = matrixRoot.classList.contains('gear');
    const isMatrixInput = matrixRoot.contains(event.target);
    if (event.key === 'Tab') {
      if (!isGearMatrix || !isMatrixInput || !(event.target instanceof HTMLInputElement)) return;
      const inputs = matrixInputOrder(matrixRoot, true, true);
      const currentIndex = inputs.findIndex((input) => input === event.target);
      if (currentIndex < 0) return;
      const nextInput = inputs[currentIndex + (event.shiftKey ? -1 : 1)];
      if (nextInput) {
        event.preventDefault();
        focusMatrixInput(nextInput);
      } else if (focusOutsideMatrix(matrixRoot, event.target, event.shiftKey ? -1 : 1)) {
        event.preventDefault();
      }
      return;
    }

    const mobileEnterUsesTabOrder = isEnterNavigation && isGearMatrix && isMatrixInput &&
      (event.location === KeyboardEvent.DOM_KEY_LOCATION_MOBILE || navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches);
    const matrixInputs = matrixInputOrder(matrixRoot, mobileEnterUsesTabOrder, isGearMatrix);
    const inputs = [...matrixInputs, ...inventorySideInputOrder(inventoryRoot, isGearMatrix)];
    const currentIndex = inputs.findIndex((input) => input === event.target);
    if (currentIndex < 0) return;

    const nextInput = inputs[currentIndex + (event.shiftKey ? -1 : 1)];
    if (gearEnterDebugEnabled && isGearMatrix && isEnterNavigation) {
      const order = isMatrixInput && mobileEnterUsesTabOrder ? 'row' : isMatrixInput ? 'column' :
        event.target instanceof Element && event.target.closest('.weapon-material-grid') ? 'weapon-column' : 'tab';
      addGearEnterDebugEvent(`navigation order=${order} from=${describeInput(event.target)} to=${describeInput(nextInput ?? null)}`);
    }
    event.preventDefault();
    if (nextInput) focusMatrixInput(nextInput);
  }

  function fitRowName(node: HTMLElement, _initialValue: string) {
    let frame = 0;
    let observer: ResizeObserver | undefined;
    const range = document.createRange();
    const baseFontSize = Number.parseFloat(getComputedStyle(node).fontSize) || 11;

    function fit() {
      node.style.removeProperty('font-size');
      range.selectNodeContents(node);
      if (range.getBoundingClientRect().width <= node.clientWidth) return;

      let low = 5.5;
      let high = baseFontSize;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const size = (low + high) / 2;
        node.style.fontSize = `${size}px`;
        range.selectNodeContents(node);
        if (range.getBoundingClientRect().width <= node.clientWidth) low = size;
        else high = size;
      }
      node.style.fontSize = `${low}px`;
    }

    function scheduleFit() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    }

    if (typeof ResizeObserver !== 'undefined' && node.parentElement) {
      observer = new ResizeObserver(scheduleFit);
      observer.observe(node.parentElement);
    }
    scheduleFit();

    return {
      update() {
        scheduleFit();
      },
      destroy() {
        observer?.disconnect();
        cancelAnimationFrame(frame);
        node.style.removeProperty('font-size');
      }
    };
  }
</script>

<PlannerDialog title={t(gear ? 'footer-gear' : 'footer-resources')} {close} {t}>
  {#snippet headerAccessory()}
    <span class={`selected-mode-chip ${mode}`}>
      {t(modes.find((item) => item.key === mode)!.label)}
    </span>
    {#if !gear}
      <button class="resource-table-style-toggle" data-resource-table-style-toggle type="button"
        aria-label={t('ui-customize-resource-tables')} title={t('ui-customize-resource-tables')}
        aria-pressed={resourceTableStyleActive} onclick={toggleResourceTableStyleMode}>
        <span class="resource-table-style-icon" aria-hidden="true"></span>
      </button>
    {:else if mode === 'needed'}
      <button class="resource-table-style-toggle" data-gear-farming-style-toggle type="button"
        aria-label={t('ui-customize-gear-farming')} title={t('ui-customize-gear-farming')}
        aria-pressed={gearFarmingStyleActive} onclick={toggleGearFarmingStyleMode}>
        <span class="resource-table-style-icon" aria-hidden="true"></span>
      </button>
    {/if}
  {/snippet}
  <div class="controls" class:resource-controls={!gear}>
    <div class="display-modes" role="group" aria-label={t('ui-display')}>
      {#each modes as option}
        <button class={option.key} data-key-shortcut={option.shortcut} data-key-shortcut-allow-number-input
          aria-keyshortcuts={option.shortcut.toUpperCase()} aria-pressed={mode === option.key} onclick={() => mode = option.key}>
          <KeyboardShortcutLabel label={t(option.label)} shortcut={option.shortcut} wrap={true} />
        </button>
      {/each}
    </div>
    {#if !gear}
      <label hidden>{t('ui-level-cap')}<input use:sanitizeIntegerInput type="number" min="78" max={metadata.maxLevel} step="1" value={levelCap}
        onchange={(event) => {
          const value = event.currentTarget.valueAsNumber;
          if (Number.isInteger(value) && value >= 78 && value <= metadata.maxLevel) { setCap(value); capError = ''; }
          else { capError = t('ui-invalid-input'); event.currentTarget.value = String(levelCap); }
        }} /></label>
    {/if}
    {#if leadingSummaryTiles.length || gear}
      <div class="summary-tiles controls-summary" class:gear-controls-summary={gear} role="group" aria-label={t('ui-resource')}>
        {#each leadingSummaryTiles as item (item.key)}
          <ResourceCell {item} {totals} {mode} {setOwned} {t}
            userCount={usersByResource[item.key]?.length ?? 0}
            inlineAmount={inlineAmount(item.key)}
            showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
        {/each}
        {#if gear}
          <ResourceCell item={gearXpSummaryItem} {totals} {mode} {setOwned} {t} inlineAmount />
          <div class="gear-balance-summary-slot" aria-hidden={!showWeaponXpBalance} inert={!showWeaponXpBalance}>
            {#if showWeaponXpBalance}
            <ResourceCell item={weaponXpBalanceItem} totals={weaponXpBalanceTotals} {mode} {setOwned} {t} inlineAmount />
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
  {#if error || capError || gearFarmError}
    <p class="error" role="alert">{error || capError || gearFarmError}
      {#if gearFarmError}<button onclick={() => gearFarmRetry++}>{t('ui-retry')}</button>{/if}
    </p>
  {/if}
  {#if matrixCurrencyTiles.length}
    <section class="resource-zero-group" class:matrix-currency-section={!gear}
      class:zero-visibility-editable={!gear && resourceTableStyleActive}
      data-resource-zero-style-type={!gear ? 'currencies' : undefined} onpointerdown={openResourceTableStylePanel}>
      {#if !gear}<h3 class="resource-currency-title">{t('ui-group-currencies')}</h3>{/if}
      <div class="summary-tiles matrix-currencies" role="group" aria-label={t('ui-group-currencies')}>
        {#each matrixCurrencyTiles as item (item.key)}
          <ResourceCell {item} {totals} {mode} {setOwned} {t}
            userCount={usersByResource[item.key]?.length ?? 0}
            inlineAmount={inlineAmount(item.key)}
            showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
        {/each}
      </div>
    </section>
  {/if}
  <div class="inventory-sections" class:gear-layout={gear} class:stacked-materials={!gear && (forceStackedMaterials || forceArtifactsAbove)}
    class:large-icons={!gear && displayLargerIcons}
    style={`--matrix-row-count: ${gearSizingRows};--matrix-column-count: ${panels[0]?.columns.length ?? 1};${gear ? `--gear-table-max-width: calc(40px + ${gearTableWidthTerms})` : ''}`}
    onkeydown={handleInventoryKeydown}>
  <div class="matrices" class:gear class:show-universal={gear && showUniversalInventory}
    class:show-universal-placeholders={gear && showUniversalPlaceholders} class:needed-mode={gear && mode === 'needed'}
    class:force-stacked-materials={!gear && (forceStackedMaterials || forceArtifactsAbove)}
    class:artifacts-first={!gear && forceArtifactsAbove}
    class:table-style-editable={!gear && resourceTableStyleActive}
    role="group" aria-label={t(gear ? 'footer-gear' : 'footer-resources')}
    aria-busy={gear && gearFarmBusy} onpointerdown={openResourceTableStylePanel}>
    {#if gear}
      {#each panels as panel, index}
        <section>
          <div class="table-scroll">
            <table aria-label={`${t(panel.title)} ${index + 1} - ${t(modes.find((item) => item.key === mode)!.label)}`}>
              <thead><tr><th class="gear-transpose-cell">
                <button class="gear-transpose-button" type="button" title={t('ui-transpose-gear-table')}
                  aria-label={t('ui-transpose-gear-table')} aria-pressed={transposeGearTable} onclick={toggleGearTableTranspose}>
                  <span class="gear-transpose-icon" aria-hidden="true"></span>
                </button>
              </th>{#each panel.columns as column}<th scope="col"
                class:gear-special-header={transposeGearTable ? column === 'General' : column === 'Choice'}>
                {#if transposeGearTable}
                  <span class="gear-transposed-header" class:gear-general-header={column === 'General'}>
                    {column === 'General' ? t('gear-general-blueprint') : column}
                  </span>
                {:else if column === 'Choice'}
                  <span class="gear-header-name">Choice</span>
                  <img class="gear-header-image" src="/planner/icons/Gear/Choice_T2.webp" alt="Choice" draggable="false" />
                {:else}
                  <span class="gear-header-name">{column}</span>
                  <img class="gear-header-image" src={`/planner/icons/Gear/T1_${column}.webp`} alt={column} draggable="false" />
                {/if}
              </th>{/each}</tr></thead>
              <tbody>{#each panel.rows as row}
                <tr style:background-color={row.colour}
                  class:gear-special-row={transposeGearTable ? row.name === 'Choice' : row.name === 'General'}>
                  <th scope="row" class:gear-special-header={transposeGearTable ? row.name === 'Choice' : row.name === 'General'}>
                    {#if transposeGearTable}
                      {#if row.name === 'Choice'}
                        <img class="gear-row-image" src="/planner/icons/Gear/Choice_T2.webp" alt="Choice" draggable="false" />
                      {:else}
                        <img class="gear-row-image" src={`/planner/icons/Gear/T1_${row.name}.webp`}
                          alt={row.name.replaceAll('_', ' ')} draggable="false" />
                      {/if}
                    {:else if row.name === 'General'}
                      <span class="gear-special-name">{t('gear-general-blueprint')}</span>
                    {:else}
                      {row.name.replaceAll('_', ' ')}
                    {/if}
                  </th>
                  {#each row.cells as item, cellIndex}
                    <td class:gear-special-cell={isUniversalGearItem(item) || (!transposeGearTable && cellIndex === panel.columns.length - 1)}>{#if item}
                      {@const placeholderOnly = showUniversalPlaceholders && isUniversalGearItem(item)}
                      <div class="gear-cell">
                        {#if showUniversalInventory || !isUniversalGearItem(item) || showUniversalPlaceholders}
                          <ResourceCell {item} totals={placeholderOnly ? gearPlaceholderTotals : gearDisplayTotals} {mode} {setOwned} {t}
                            userCount={placeholderOnly ? 0 : usersByResource[item.key]?.length ?? 0}
                            showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
                        {/if}
                        {#if mode === 'needed' && item.group === 'Equipment'}
                          {@const choiceUsed = gearUsage.choiceUsedByGear[item.key] ?? 0}
                          {@const generalUsed = gearUsage.generalUsedByGear[item.key] ?? 0}
                          {@const itemTier = item.key.split('_')[0]}
                          {@const itemType = item.key.split('_')[1]}
                          {#if choiceUsed > 0}
                            <span class={`gear-use-indicator choice ${transposeGearTable ? 'top-right' : 'bottom-left'}`} aria-label={`${choiceUsed} ${itemTier} choice blueprints used`}>
                              <img src={`/planner/icons/Gear/Choice_${itemTier}.webp`} alt="" draggable="false" />
                              <span>{formatAmount(choiceUsed)}</span>
                            </span>
                          {/if}
                          {#if generalUsed > 0}
                            <span class={`gear-use-indicator general ${transposeGearTable ? 'bottom-left' : 'top-right'}`} aria-label={`${generalUsed} general ${itemType} blueprints used`}>
                              <span>{formatAmount(generalUsed)}</span>
                              <img src={`/planner/icons/Gear/G_${itemType}.png`} alt="" draggable="false" />
                            </span>
                          {/if}
                        {/if}
                      </div>
                    {/if}</td>
                  {/each}
                </tr>
              {/each}</tbody>
            </table>
          </div>
        </section>
      {/each}
    {:else}
      {#each panels as panel, index}
        {#if panel.columnGroups}
          <section class="school-matrices">
            <div class="school-pair" style={`--matrix-max-width: ${(panel.columns.length + 1) * 75}px`}>
              <div class="table-scroll">
                <table class="school-blu-ray-table" aria-label={`${t('ui-blu-rays')} - ${t(modes.find((item) => item.key === mode)!.label)}`}>
                  <thead>
                    <tr><th></th>{#each panel.columns.slice(0, 4) as column}<th scope="col">{column}</th>{/each}</tr>
                  </thead>
                  <tbody>{#each panel.rows as row}
                    <tr style:background-color={row.colour}>
                      <th class="school-row-header" scope="row" title={schoolName(row.name)} aria-label={schoolName(row.name)}>
                        <img class="school-row-icon" src={`/planner/icons/Academies/${academyIconFiles[row.name] ?? 'ETC'}.png`}
                          alt="" draggable="false" />
                      </th>
                      {#each row.cells.slice(0, 4) as item}
                        <td>{#if item}<ResourceCell {item} {totals} {mode} {setOwned} {t}
                          userCount={usersByResource[item.key]?.length ?? 0}
                          showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />{/if}</td>
                      {/each}
                    </tr>
                  {/each}</tbody>
                </table>
              </div>
              <div class="table-scroll">
                <table class="school-tech-note-table" aria-label={`${t('ui-tech-notes')} - ${t(modes.find((item) => item.key === mode)!.label)}`}>
                  <thead><tr>{#each panel.columns.slice(4) as column}<th scope="col">{column}</th>{/each}</tr></thead>
                  <tbody>{#each panel.rows as row}
                    <tr aria-label={row.name.replaceAll('_', ' ')} style:background-color={row.colour}>
                      {#each row.cells.slice(4, 8) as item}
                        <td>{#if item}<ResourceCell {item} {totals} {mode} {setOwned} {t}
                          userCount={usersByResource[item.key]?.length ?? 0}
                          showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />{/if}</td>
                      {/each}
                    </tr>
                  {/each}</tbody>
                </table>
              </div>
            </div>
          </section>
        {:else if panel.title === 'ui-artifacts'}
          {#if index === panels.findIndex((item) => item.title === 'ui-artifacts')}
            <section class="artifact-matrices">
              <div class="artifact-pair">
                {#each panels.filter((item) => item.title === 'ui-artifacts') as artifactPanel, artifactIndex}
                  <div class="table-scroll">
                    <table style={`--matrix-max-width: ${100 + artifactPanel.columns.length * 75}px`}
                      aria-label={`${t(artifactPanel.title)} ${artifactIndex + 1} - ${t(modes.find((item) => item.key === mode)!.label)}`}>
                      <thead><tr><th></th>{#each artifactPanel.columns as column}<th scope="col">{column}</th>{/each}</tr></thead>
                      <tbody>{#each artifactPanel.rows as row}
                        <tr style:background-color={row.colour}>
                          <th scope="row" title={row.name.replaceAll('_', ' ')}>
                            <span class="row-name" use:fitRowName={row.name.replaceAll('_', ' ')}>{row.name.replaceAll('_', ' ')}</span>
                          </th>
                          {#each row.cells as item}
                            <td>{#if item}<ResourceCell {item} {totals} {mode} {setOwned} {t}
                              userCount={usersByResource[item.key]?.length ?? 0}
                              showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />{/if}</td>
                          {/each}
                        </tr>
                      {/each}</tbody>
                    </table>
                  </div>
                {/each}
              </div>
            </section>
          {/if}
        {/if}
      {/each}
    {/if}

  </div>
  {#if !gear && resourceTableStyleActive && resourceTableStylePanelOpen}
    <div class="resource-table-style-panel" bind:this={resourceTableStylePanel} role="group"
      aria-label={t(resourceTableStyleSection === 'tables' ? 'ui-resource-table-layout' : 'ui-visible-with-zero-quantity')}
      style:left={`${resourceTableStylePosition.left}px`} style:top={`${resourceTableStylePosition.top}px`}>
      {#if resourceTableStyleSection === 'tables'}
        <label><input type="checkbox" checked={forceStackedMaterials}
          onchange={(event) => updateForceStackedMaterials(event.currentTarget.checked)} />
          {t('ui-stack-artifacts-below-school-materials')}</label>
        <label><input type="checkbox" checked={forceArtifactsAbove}
          onchange={(event) => updateForceArtifactsAbove(event.currentTarget.checked)} />
          {t('ui-stack-artifacts-above-school-materials')}</label>
        <label class="large-layout-only"><input type="checkbox" checked={displayLargerIcons}
          onchange={(event) => updateDisplayLargerIcons(event.currentTarget.checked)} />
          {t('ui-display-larger-icons')}</label>
      {:else}
        <label><input type="checkbox" checked={visibleWithZeroQuantity[resourceTableStyleSection]}
          onchange={(event) => updateVisibleWithZeroQuantity(resourceTableStyleSection as ResourceZeroVisibilityType, event.currentTarget.checked)} />
          {t('ui-visible-with-zero-quantity')}</label>
      {/if}
    </div>
  {/if}
  {#if gear && mode === 'needed' && gearFarmingStyleActive && gearFarmingStylePanelOpen}
    <div class="resource-table-style-panel gear-farming-style-panel" bind:this={gearFarmingStylePanel} role="group"
      aria-label={t('ui-customize-gear-farming')} style:left={`${gearFarmingStylePosition.left}px`}
      style:top={`${gearFarmingStylePosition.top}px`}>
      <label><input type="checkbox" checked={sortGearFarmingStagesByNumber}
        onchange={(event) => updateSortGearFarmingStages(event.currentTarget.checked)} />
        {t('ui-sort-by-stage-number')}</label>
    </div>
  {/if}
    <div class="inventory-side">
      {#if gear}
        <section class="weapon-xp-summary-section" aria-label={t('ui-weapon-xp')}>
          <div class="weapon-xp-displays" role="group" aria-label={t('ui-weapon-xp')}>
            {#each weaponXpDisplayRows as row (row.type)}
              {@const amountText = formatAmount(row.displayAmount)}
              <div class="weapon-xp-display" data-weapon-xp={row.type}
                title={`${row.type}: ${amountText}`}
                aria-label={`${row.type}, ${t(modes.find((item) => item.key === mode)!.label)}: ${amountText}`}>
                <img src={`/planner/icons/LevelPart/${row.type}_All.png`} alt="" draggable="false" />
                <span class="weapon-xp-display-amount"
                  use:fitResourceText={{ text: amountText, layout: 'inline-amount' }}>{amountText}</span>
              </div>
            {/each}
          </div>
          <p class="note">{t('ui-weapon-xp-help')}</p>
        </section>
      {/if}
      {#if pairedGroups.length}
        <div class="xp-book-groups">
          {#each pairedGroups as group}
            <section class:resource-zero-group={group === 'Limit break books' || group === 'Gifts'}
              class:zero-visibility-editable={!gear && resourceTableStyleActive && (group === 'Limit break books' || group === 'Gifts')}
              data-resource-zero-style-type={group === 'Limit break books' ? 'limit-break-books' : group === 'Gifts' ? 'gifts' : undefined}
              onpointerdown={openResourceTableStylePanel}>
              <h3>{t(`ui-group-${group.toLowerCase().replaceAll(' ', '-')}`)}</h3>
              <div class="tiles">
                {#each extras.filter((item) => item.group === group) as item (item.key)}
                  <ResourceCell {item} {totals} {mode} {setOwned} {t}
                    userCount={usersByResource[item.key]?.length ?? 0}
                    inlineAmount={inlineAmount(item.key)}
                    showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
                {/each}
              </div>
            </section>
          {/each}
        </div>
      {/if}
      {#if hasWeaponItems}
        <section class="weapon-materials">
          <h3>{t('ui-group-weapon-items')}</h3>
          <div class="weapon-material-grid">
            {#each weaponMaterialRows as row}
              {#each row.items as item (item.key)}
                <ResourceCell {item} {totals} {mode} {setOwned} {t}
                  userCount={usersByResource[item.key]?.length ?? 0}
                  inlineAmount={inlineAmount(item.key)}
                  showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
              {/each}
            {/each}
          </div>
        </section>
      {/if}
      <div class="extra-groups">
        {#each otherGroups as group}
          <section>
            <h3>{t(`ui-group-${group.toLowerCase().replaceAll(' ', '-')}`)}</h3>
            <div class="tiles">
              {#each extras.filter((item) => item.group === group) as item (item.key)}
                <ResourceCell {item} {totals} {mode} {setOwned} {t}
                  userCount={usersByResource[item.key]?.length ?? 0}
                  inlineAmount={inlineAmount(item.key)}
                  showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
              {/each}
            </div>
          </section>
        {/each}
      </div>
      {#if gear && mode === 'needed'}
        <GearFarming {dataset} {totals} {metadata} {savedServer} {setServer} bind:multiplier={campaignMultiplier}
          bind:excludeOwnedChoiceBlueprints bind:excludeOwnedGeneralBlueprints
          bind:sortByStageNumber={sortGearFarmingStagesByNumber} styleActive={gearFarmingStyleActive}
          onStyleTilePointerDown={openGearFarmingStylePanel}
          result={gearFarmResult} busy={gearFarmBusy} {t} />
      {/if}
    </div>
  </div>
  {#if gear && mode === 'needed' && gearFarmResult}
    <GearBlueprintUsage data={dataset.context.data} {metadata} result={gearFarmResult} {t} />
  {/if}

  {#if panels.length === 0 && summaryTiles.length === 0 && extras.length === 0}<p>{t('ui-no-resource-rows')}</p>{/if}
  {#if gearEnterDebugEnabled}
    <aside class="gear-enter-debug" aria-label="Gear input event debug log">
      <header>
        <strong>Gear input events</strong>
        <button type="button" onclick={() => gearEnterDebugEvents = []}>Clear</button>
      </header>
      <pre>{gearEnterDebugEvents.length ? gearEnterDebugEvents.join('\n') : 'Tap a gear input, press Enter, and inspect the event log.'}</pre>
    </aside>
  {/if}
</PlannerDialog>

{#if selectedResource}
  <ResourceUsersDialog item={selectedResource} users={selectedUsers} close={() => selectedResource = null} {t} />
{/if}

<style>
  .gear-enter-debug {
    position: fixed; z-index: 10000; inset: 4rem 0.5rem auto; display: flex; flex-direction: column;
    width: min(36rem, calc(100vw - 1rem)); max-height: 34vh; margin-inline: auto;
    overflow: hidden; border: 1px solid #7c5b7d; border-radius: 0.4rem;
    background: var(--background); color: var(--text); box-shadow: 0 0.2rem 1rem #0008;
  }
  .gear-enter-debug header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.3rem 0.5rem; }
  .gear-enter-debug pre {
    min-height: 2.5rem; max-height: 30vh; margin: 0; padding: 0.4rem 0.5rem; overflow: auto;
    border-top: 1px solid #7c5b7d66; font: 0.68rem/1.3 monospace; white-space: pre-wrap; overflow-wrap: anywhere;
    user-select: text; -webkit-user-select: text; touch-action: pan-y; -webkit-overflow-scrolling: touch;
  }
  .controls { display: flex; flex-wrap: wrap; align-items: end; gap: 0.4rem 0.75rem; margin-bottom: 0.2rem; align-items: center; }
  .controls-summary { flex-wrap: nowrap !important; }
  .controls-summary.gear-controls-summary { flex: 1 1 36rem; flex-wrap: wrap !important; }
  .gear-balance-summary-slot { display: contents; }
  .controls label[hidden] { display: none; }
  .resource-table-style-toggle { display: grid; width: 2rem; height: 2rem; padding: 0.35rem; place-items: center; border: 1px solid #7c5b7d66; border-radius: 0.35rem; background: transparent; color: var(--text); cursor: pointer; }
  .resource-table-style-toggle:hover, .resource-table-style-toggle[aria-pressed="true"] { border-color: #82dafb; background: #82dafb4d; }
  .resource-table-style-icon { display: block; width: 100%; height: 100%; background: currentColor; -webkit-mask: url('/planner/icons/UI/brush-solid-full.svg') center / contain no-repeat; mask: url('/planner/icons/UI/brush-solid-full.svg') center / contain no-repeat; }
  .display-modes { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .display-modes button { color: #252530; padding: 0.45rem 0.6rem; border: 2px solid transparent; }
  .display-modes button[aria-pressed="true"] { background-color: color-mix(in srgb, var(--mode-color) 20%, white); box-shadow: 0 0 0 3px var(--mode-color); }
  .selected-mode-chip {
    flex: 0 0 auto; color: #252530; padding: 0.35rem 0.5rem;
    border-radius: 0.35rem; font-size: 0.8rem;
    font-weight: bold; line-height: 1.1; white-space: nowrap;
  }
  .needed { --mode-color: #f5c8dd; background: var(--mode-color); } .owned { --mode-color: #c8e6f5; background: var(--mode-color); } .required { --mode-color: #c8f5e0; background: var(--mode-color); } .leftover { --mode-color: #f5efc8; background: var(--mode-color); }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; }
  input { padding: 0.35rem; min-width: 0; } input[type="number"] { width: 80px; }
  .matrices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 285px), 1fr)); align-items: start; gap: 0.75rem; }
  .matrices.gear { display: block; }
  .matrices.table-style-editable, .resource-zero-group.zero-visibility-editable { position: relative; isolation: isolate; }
  .matrix-currency-section { margin-bottom: 0.2rem; }
  .matrices.table-style-editable::before, .matrices.table-style-editable::after,
  .resource-zero-group.zero-visibility-editable::before, .resource-zero-group.zero-visibility-editable::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
  }
  .matrices.table-style-editable::after, .resource-zero-group.zero-visibility-editable::after {
    z-index: 20; background: #82dafb4d; pointer-events: auto; cursor: crosshair;
  }
  .matrices.table-style-editable::before, .resource-zero-group.zero-visibility-editable::before {
    z-index: 21; background: linear-gradient(135deg, transparent 43%, #bfeaff9c 50%, transparent 57%);
    background-size: 300% 300%; background-repeat: no-repeat; animation: resource-table-style-shine 2.8s ease-in-out infinite;
  }
  @keyframes resource-table-style-shine { 0% { background-position: 140% 140%; } 24% { background-position: -140% -140%; } 24.01%, 100% { background-position: 140% 140%; } }
  @media (prefers-reduced-motion: reduce) {
    .matrices.table-style-editable::before, .resource-zero-group.zero-visibility-editable::before { animation: none; }
  }
  .resource-table-style-panel { position: fixed; z-index: 30; width: max-content; max-width: min(260px, calc(100vw - 1rem)); padding: 0.55rem 0.7rem; border: 1px solid #82dafb; border-radius: 0.45rem; background: var(--surface); color: var(--text); box-shadow: 0 3px 14px #0008; }
  .resource-table-style-panel label { display: flex; flex-direction: row; align-items: center; gap: 0.45rem; margin: 0; font-size: 0.8rem; white-space: normal; }
  .resource-table-style-panel label.large-layout-only { display: none; }
  .resource-table-style-panel input { flex: 0 0 auto; width: 1rem; height: 1rem; margin: 0; accent-color: #82dafb; }
  .matrices:not(.gear) { display: flex; flex-direction: column; gap: 0.75rem; }
  .inventory-sections { min-width: 0; }
  .inventory-sections:not(.gear-layout) { min-width: 800px; }
  .inventory-side { min-width: 0; }
  h3 { font-size: 0.9rem; margin: 0.2rem 0 0.2rem; }
  .table-scroll { overflow-x: auto; }
  table { border-spacing: 0; width: 100%; font-size: 0.75rem; }
  th, td { padding: 0.1rem; border: none; }
  thead th { padding: 0.25rem; }
  tbody th { text-align: left; font-size: 0.75rem; font-weight: normal; width: 22%; overflow-wrap: anywhere; }
  .gear .table-scroll { overflow-x: hidden; }
  .gear table { table-layout: fixed; max-width: var(--gear-table-max-width); margin-inline: auto; }
  .gear:not(.show-universal):not(.show-universal-placeholders) .gear-special-header,
  .gear:not(.show-universal):not(.show-universal-placeholders) .gear-special-cell { visibility: hidden; }
  .gear:not(.show-universal):not(.show-universal-placeholders) .gear-special-row,
  .gear.needed-mode .gear-special-row { display: none; }
  .gear tbody tr:nth-child(even) > th,
  .gear tbody tr:nth-child(even) > td { background-color: #84848436; }
  .gear thead th:first-child, .gear tbody th { width: 40px; }
  .gear thead th:not(:first-child) { overflow-wrap: anywhere; line-height: 1.1; }
  .gear-transpose-button { display: grid; width: 1.5rem; height: 1.5rem; margin: auto; padding: 0.2rem; place-items: center; border: 0; border-radius: 0.25rem; background: transparent; color: inherit; cursor: pointer; }
  .gear-transpose-button:hover { background: color-mix(in srgb, currentColor 12%, transparent); }
  .gear-transpose-button:focus-visible { outline: 2px solid #ab65ad; outline-offset: 1px; }
  .gear-transpose-icon { display: block; width: 100%; height: 100%; background: currentColor; -webkit-mask: url('/planner/icons/UI/transpose.svg') center / contain no-repeat; mask: url('/planner/icons/UI/transpose.svg') center / contain no-repeat; }
  .gear-transposed-header { display: block; white-space: nowrap; text-align: center; }
  .gear-row-image { display: block; width: 2rem; height: 2rem; margin: auto; object-fit: contain; }
  .gear-header-image { display: none; width: 100%; height: 2.25rem; object-fit: contain; }
  .gear-special-name { display: block; font-size: 0.58rem; line-height: 1; overflow-wrap: anywhere; }
  .gear tbody th { text-align: center; }
  .gear td { min-width: 0; padding: 0; }
  .gear td :global(.resource-cell) { min-width: 0; min-height: 0; aspect-ratio: 1; }
  .gear-cell { position: relative; width: 100%; aspect-ratio: 1; container-type: inline-size; }
  .gear-cell :global(.resource-cell) { position: absolute; inset: 0; width: 100%; height: 100%; }
  .gear-use-indicator {
    position: absolute; z-index: 3; display: flex; align-items: center;
    gap: clamp(0.04rem, 2cqi, 0.2rem); max-width: calc(100% - 0.12rem);
    padding: clamp(0.01rem, 0.8cqi, 0.04rem) clamp(0.02rem, 1.6cqi, 0.08rem); border: 1px solid #7c5b7d66;
    border-radius: 0.2rem; background: color-mix(in srgb, var(--background) 82%, transparent);
    color: var(--text); font: 700 0.65rem/1 sans-serif; font-size: clamp(0.34rem, 12cqi, 0.65rem); font-variant-numeric: tabular-nums;
    white-space: nowrap; pointer-events: none;
  }
  .gear-use-indicator img { display: block; flex: 0 0 clamp(0.4rem, 20cqi, 1.05rem); width: clamp(0.4rem, 20cqi, 1.05rem); height: clamp(0.4rem, 20cqi, 1.05rem); object-fit: contain; }
  .gear-use-indicator.top-right { top: 0.04rem; right: 0.04rem; }
  .gear-use-indicator.bottom-left { bottom: 0.04rem; left: 0.04rem; }
  .matrices:not(.gear) .table-scroll { overflow: hidden; }
  .matrices:not(.gear).artifacts-first > .artifact-matrices { order: -1; }
  .matrices:not(.gear) table { width: max-content; table-layout: auto; }
  .school-matrices table, .artifact-pair table { max-width: var(--matrix-max-width); margin-inline: auto; }
  .artifact-pair { --artifact-name-cell-size: clamp(40px, calc(var(--inventory-cell-size, 75px) * 0.66), 50px); min-width: 0; }
  .artifact-pair th:first-child { width: var(--artifact-name-cell-size); }
  .artifact-pair tbody th:first-child { box-sizing: border-box; width: var(--artifact-name-cell-size); min-width: 0; white-space: nowrap; }
  .school-matrices tbody th, .artifact-pair tbody th { overflow: hidden; font-size: 0.7rem; white-space: nowrap; }
  .school-pair { display: grid; width: 100%; max-width: var(--matrix-max-width); margin-inline: auto; grid-template-columns: minmax(0, 5fr) minmax(0, 4fr); gap: 0; }
  .school-pair > .table-scroll { min-width: 0; overflow: hidden; }
  .matrices:not(.gear) .school-pair table { width: 100%; max-width: 100%; table-layout: fixed; margin: 0; }
  .school-row-header { box-sizing: border-box; width: auto; min-width: 0; max-width: none; padding: 0 !important; }
  .school-row-icon { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; padding: 0.45rem; box-sizing: border-box; }
  .row-name { display: block; width: 100%; min-width: 0; overflow: hidden; white-space: nowrap; text-align: center; }
  .matrices:not(.gear) td { width: 75px; min-width: 0; padding: 0; }
  .matrices:not(.gear) td :global(.resource-cell) { min-width: 0; min-height: 0; aspect-ratio: 1; }
  .artifact-pair { display: grid; width: 100%; max-width: 800px; margin-inline: auto; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0; }
  .matrices:not(.gear) .artifact-pair table { width: 100%; max-width: 100%; table-layout: fixed; margin: 0; }
  .artifact-pair > .table-scroll { min-width: 0; }
  .extra-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); align-items: start; gap: 0.5rem 1rem; }
  .xp-book-groups { display: flex; flex-wrap: wrap; width: 100%; align-items: start; gap: 0 1rem; margin-bottom: 0.5rem; margin-top: 0.5rem}
  .xp-book-groups > section { width: fit-content; max-width: 100%; min-width: 0; }
  .tiles { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .tiles :global(.resource-cell) { flex: 0 0 68px; width: 68px; min-width: 68px; min-height: 68px; border: 1px solid #7c5b7d44; border-radius: 0.4rem; background-color: var(--background); }
  .weapon-material-grid { display: grid; width: 100%; max-width: 284px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .weapon-material-grid :global(.resource-cell) { flex: initial; width: 100%; min-width: 0; min-height: 0; aspect-ratio: 1; }
  .summary-tiles { display: flex; flex-wrap: wrap; gap: 0.5rem; overflow: visible; }
  .summary-tiles :global(.resource-cell) { flex: 0 0 180px; width: 180px; min-width: 120px; min-height: 44px; height: 44px; border: 1px solid #7c5b7d66; border-radius: 0.4rem; background: var(--background); padding-right: 0.3rem; }
  .summary-tiles :global(.resource-cell.zero .resource-image) { opacity: 1; }
  .summary-tiles :global(.resource-cell.zero .amount) { visibility: visible; }
  .weapon-xp-summary-section { margin-top: 0.65rem; }
  .weapon-xp-summary-section .note { margin-bottom: 0; }
  .weapon-xp-displays { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.35rem; width: 100%; max-width: 36rem; }
  .weapon-xp-display { --overlay-number-fit-ratio: 1; display: flex; align-items: center; justify-content: center; gap: 0.12rem; min-width: 0; height: 44px; padding: 0.2rem 0.15rem; overflow: hidden; border: 1px solid #7c5b7d66; border-radius: 0.4rem; background: var(--background); }
  .weapon-xp-display img { display: block; flex: 0 0 1.5rem; width: 1.5rem; height: 1.5rem; object-fit: contain; }
  .weapon-xp-display-amount { flex: 1; min-width: 0; overflow: hidden; color: var(--text); font-size: 1.1rem; font-weight: 700; font-variant-numeric: tabular-nums; text-align: center; white-space: nowrap; }

  .note { font-size: 0.8rem; line-height: 1.4; opacity: 0.85; }
  .error { color: var(--error); }
  @media (max-width: 800px) {
    .gear td :global(.amount) { font-size: 0.9rem; }
    .gear:not(.show-universal):not(.show-universal-placeholders) .gear-special-header,
    .gear:not(.show-universal):not(.show-universal-placeholders) .gear-special-cell { display: none; }
    .gear-general-header, .gear-special-name { visibility: hidden; }
    .matrices:not(.gear) td :global(.amount) { font-size: 0.9rem; }
    .gear-header-name { display: none; }
    .gear-header-image { display: block; }
    .inventory-sections:not(.gear-layout) { min-width: 0; width: 100%; }
    .matrices:not(.gear) { width: 100%; }
    .matrices:not(.gear) table { width: 100%; max-width: 100%; table-layout: fixed; }
    .matrices:not(.gear) td { width: auto; }
    .school-matrices tbody th, .artifact-pair tbody th { font-size: 0.55rem; line-height: 1.05; }
    .summary-tiles { gap: 0.1rem;}
    .tiles :global(.resource-cell) { flex: 0 0 58px; width: 58px; min-width: 58px; min-height: 58px;}
  }
  @media (min-width: 801px) {
    .gear thead th { padding-block: 0.45rem; }
    .gear-transpose-button { width: 2rem; height: 2rem; }
  }
  @media (max-width: 600px) {
    .inventory-sections:not(.gear-layout) { width: 100%; }
    .display-modes { width: 100%; flex-wrap: nowrap; gap: 0.15rem; }
    .controls-summary { flex: 0 0 100%; width: 100%; }
    .selected-mode-chip { padding: 0.25rem 0.35rem; font-size: 0.7rem; }
    .display-modes button {
      flex: 1 1 0; min-width: 0; padding: 0.3rem 0.15rem; font-size: clamp(0.58rem, 2.4vw, 0.75rem);
      line-height: 1.1; white-space: normal; overflow-wrap: anywhere;
    }
    .matrices:not(.gear), .inventory-sections.gear-layout > .matrices {
      --section-inline-bleed: clamp(0.6rem, calc(-1rem + 5.333vw), 1rem);
      width: calc(100% + var(--section-inline-bleed) + var(--section-inline-bleed));
      margin-inline: calc(0rem - var(--section-inline-bleed));
    }
    .summary-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); overflow: visible; }
    .summary-tiles :global(.resource-cell) { flex: initial; width: 100%; min-width: 0; min-height: 34px; height: 34px; }
    .controls-summary :global(.resource-cell.inline-amount) {
      gap: 0.1rem; padding: 0 0.1rem;
    }
    .controls-summary :global(.inline-amount .resource-image) {
      position: static; flex: 0 0 1.25rem; width: 1.25rem; height: 1.25rem; transform: none;
    }
    .controls-summary :global(.inline-amount .amount) { width: auto; font-size: 0.85rem; }
    .matrix-currencies :global(.inline-amount .resource-image) {
      position: static; flex: 0 0 1.25rem; width: 1.25rem; height: 1.25rem; transform: none;
    }
    .matrix-currencies :global(.inline-amount .resource-input) { max-width: calc(100% - 1.5rem); }
    .tiles :global(.resource-cell) { flex: 0 0 48px; width: 48px; min-width: 48px; min-height: 48px;}
  }
  @media (min-width: 601px) and (max-width: 1200px) {
    .inventory-sections { display: flex; flex-direction: column; align-items: center; width: fit-content; max-width: calc(100vw - 3rem); margin-inline: auto; }
    .controls.resource-controls { width: fit-content; max-width: 100%; flex-direction: column; align-items: center; margin-inline: auto; }
    .controls.resource-controls .display-modes, .controls.resource-controls .controls-summary { justify-content: center; }
    .inventory-sections:not(.gear-layout) { min-width: 0; width: fit-content; }
    .inventory-sections > .matrices { width: fit-content; max-width: 100%; margin-inline: auto; }
    .inventory-sections > .inventory-side { width: fit-content; max-width: min(100%, 42rem); margin-inline: auto; }
    .matrix-currencies { width: fit-content; max-width: calc(100vw - 3rem); margin-inline: auto; }
    .resource-currency-title { width: fit-content; margin-inline: auto; }
  }
  @media (min-width: 601px) {
    .inventory-sections:not(.gear-layout) {
      --inventory-cell-size: clamp(var(--inventory-cell-min-size, 40px), min(calc((88dvh - 13rem) / var(--matrix-row-count)), calc((min(1300px, calc(100vw - 1rem)) - 14.5rem) / 8)), 75px);
    }
    .inventory-sections.gear-layout {
      --inventory-cell-size: clamp(40px, min(calc((122dvh - 13rem) / var(--matrix-row-count)), calc((min(1300px, calc(100vw - 1rem)) - 4.5rem) / var(--matrix-column-count))), 75px);
    }
    .inventory-sections.stacked-materials {
      --inventory-cell-size: clamp(var(--inventory-cell-min-size, 40px), min(calc((88dvh - 13rem) / var(--matrix-row-count)), calc((min(1300px, calc(100vw - 1rem)) - 14.5rem) / 8)), 75px);
    }
    .matrices:not(.gear) .school-pair { display: flex; width: max-content; max-width: 100%; margin-inline: auto; gap: 0; }
    .matrices:not(.gear) .school-pair table.school-blu-ray-table {
      width: calc(var(--inventory-cell-size) + var(--inventory-cell-size) + var(--inventory-cell-size) + var(--inventory-cell-size) + var(--inventory-cell-size));
      max-width: 100%; table-layout: fixed; margin: 0;
    }
    .matrices:not(.gear) .school-pair table.school-tech-note-table {
      width: calc(var(--inventory-cell-size) + var(--inventory-cell-size) + var(--inventory-cell-size) + var(--inventory-cell-size));
      max-width: 100%; table-layout: fixed; margin: 0;
    }
    .matrices:not(.gear) .school-pair td { width: var(--inventory-cell-size); }
    .school-row-header { width: var(--inventory-cell-size); }
    .artifact-pair { display: grid; width: max-content; max-width: 100%; margin-inline: auto; grid-template-columns: repeat(2, max-content); gap: 0; }
    .matrices:not(.gear) .artifact-pair table {
      width: calc(var(--artifact-name-cell-size) + var(--inventory-cell-size) + var(--inventory-cell-size) + var(--inventory-cell-size) + var(--inventory-cell-size));
      max-width: 100%; table-layout: fixed; margin: 0;
    }
    .matrices:not(.gear) .artifact-pair td { width: var(--inventory-cell-size); }
  }
  @media (min-width: 1201px) {
    .resource-table-style-panel label.large-layout-only { display: flex; }
    .inventory-sections.large-icons { --inventory-cell-min-size: 60px; }
    .inventory-sections:not(.gear-layout):not(.stacked-materials) {
      --inventory-cell-size: clamp(var(--inventory-cell-min-size, 40px), min(calc((88dvh - 13rem) / var(--matrix-row-count)), calc((min(1300px, calc(100vw - 1rem)) - 200px - 0.75rem - 2rem) / 17)), 75px);
    }
    .matrices:not(.gear) {
      display: grid; grid-template-columns: max-content max-content; justify-content: center;
      align-items: start; gap: 0.75rem;
    }
    .matrices:not(.gear).force-stacked-materials { grid-template-columns: max-content; }
    .matrices:not(.gear) > section { min-width: 0; }

    .inventory-sections.gear-layout {
      display: grid;
      grid-template-columns: minmax(0, var(--gear-table-max-width)) minmax(0, 1fr);
      grid-template-areas: "gear side";
      align-items: start;
      gap: 0 1rem;
    }
    :global(dialog:has(.inventory-sections.gear-layout)) {
      width: min(var(--dialog-width), calc(100vw - 1rem));
      height: 88dvh; box-sizing: border-box; inset-block: 0; margin-block: auto;
    }
    .gear-balance-summary-slot { display: block; box-sizing: border-box; flex: 0 0 180px; width: 180px; min-height: 44px; }
    .gear-layout > .matrices { grid-area: gear; }
    .gear-layout > .inventory-side { grid-area: side; display: flex; flex-direction: column; gap: 0.5rem; }
    .gear-layout .xp-book-groups { flex-direction: column; margin-bottom: 0; }
    .gear-layout .extra-groups { grid-template-columns: minmax(0, 1fr); }
  }
</style>
