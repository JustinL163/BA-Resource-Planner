<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import type { PlannerCharacter, PlannerMetadata, ResourceTotals } from '$lib/domain/planner/types';
  import { formatAmount, type ResourceItem } from '$lib/domain/planner/catalog';
  import { inventoryLayout, type MaterialPanel } from '$lib/domain/planner/inventory-layout';
  import { localizedSchoolName } from '$lib/domain/planner/localized-labels';
  import { weaponXpSummary } from '$lib/domain/planner/aggregates';
  import ResourceCell, { type ResourceMode } from './ResourceCell.svelte';
  import PlannerDialog from './PlannerDialog.svelte';
  import KeyboardShortcutLabel from './KeyboardShortcutLabel.svelte';
  import GearFarming from './GearFarming.svelte';
  import GearBlueprintUsage from './GearBlueprintUsage.svelte';
  import type { PlannerDataset } from '$lib/domain/planner/types';
  import { farmServer, type FarmServer, type GearFarmPlan } from '$lib/domain/planner/gear-farm';
  import { recommendGear } from '$lib/services/gear-farm';
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
  let capError = $state('');
  let selectedResource = $state<ResourceItem | null>(null);
  let transposeGearTable = $state(true);
  let gearEnterDebugEnabled = $state(false);
  let gearEnterDebugEvents = $state<string[]>([]);
  let lastGearFocusedInput: HTMLInputElement | null = null;
  let pendingGearPointerKey = '';
  let pendingGearPointerAt = 0;
  let lastGearPointerType = '';
  let gearFocusRedirectToken = 0;
  let redirectingGearFocus = false;
  let layout = $derived(inventoryLayout(metadata, totals, gear));
  let gearFarmCompleted = $state<{ key: string; plan: GearFarmPlan } | null>(null);
  let gearFarmFailure = $state<{ key: string; message: string } | null>(null);
  let gearFarmBusy = $state(false);
  let gearFarmRetry = $state(0);
  let gearFarmNeeded = $derived(Object.fromEntries<number>(metadata.equipment.flatMap((key) => (totals.needed[key] ?? 0) > 0 ? [[key, totals.needed[key]]] : [])));
  let gearFarmOwned = $derived(Object.fromEntries<number>(Object.entries(totals.owned)
    .filter(([key]) => key.startsWith('G_') || key.startsWith('Choice_T')).map(([key, amount]) => [key, Number(amount)])));
  let gearFarmKey = $derived(gear ? JSON.stringify([
    savedServer, campaignMultiplier, gearFarmNeeded, gearFarmOwned,
    dataset.context.data.gear_rates, dataset.context.data.gear_drops, dataset.context.data.universal_bp_cost, metadata.worldCaps
  ]) : '');
  let gearFarmResult = $derived(gearFarmCompleted?.key === gearFarmKey ? gearFarmCompleted.plan : null);
  let gearFarmError = $derived(gearFarmFailure?.key === gearFarmKey ? gearFarmFailure.message : '');
  $effect(() => {
    const key = gearFarmKey;
    gearFarmRetry;
    if (!key) return;
    const input = untrack(() => ({
      data: dataset.context.data, needed: gearFarmNeeded, owned: gearFarmOwned,
      server: savedServer, multiplier: campaignMultiplier, caps: metadata.worldCaps
    }));
    const controller = new AbortController();
    gearFarmCompleted = null;
    gearFarmFailure = null;
    gearFarmBusy = true;
    try {
      const server = farmServer(input.server);
      void recommendGear(input.data, input.needed, input.owned, server, input.multiplier, input.caps, { signal: controller.signal })
        .then((plan) => { if (!controller.signal.aborted) gearFarmCompleted = { key, plan }; })
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
  const inlineAmountKeys = new Set(['9999', 'Xp', 'GearXp', 'Credit', 'Eligma']);
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
  let showUniversalInventory = $derived(mode === 'owned' || mode === 'leftover');
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
  let summaryTiles = $derived(layout.extra.filter((item) => inlineAmount(item.key)));
  const leadingSummaryKeys = ['Credit', 'Xp', '9999'];
  let leadingSummaryTiles = $derived(leadingSummaryKeys.flatMap((key) => summaryTiles.filter((item) => item.key === key)));
  let remainingSummaryTiles = $derived(summaryTiles.filter((item) =>
    !leadingSummaryKeys.includes(item.key) && (
      item.key === 'GearXp' ||
      (mode === 'owned' && !['Xp', 'GearXp', 'Eleph', 'ShopResets'].includes(item.key) && !item.key.endsWith('Cost')) ||
      Number(totals[mode][item.key] ?? 0) !== 0
    )));
  let gearXpSummaryItem: ResourceItem = $derived(
    remainingSummaryTiles.find((item) => item.key === 'GearXp') ?? layout.extra.find((item) => item.key === 'GearXp')!
  );
  let remainingCurrencyTiles = $derived(remainingSummaryTiles.filter((item) => item.key !== 'GearXp'));
  let allExtras = $derived(layout.extra.filter((item) => !inlineAmount(item.key)));
  let extras = $derived(allExtras.filter((item) => {
    if (mode === 'owned') return true;
    if (item.group === 'XP items' || item.group === 'Weapon items') return false;
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
    if (!gear) return;
    try {
      const savedPreference = localStorage.getItem(gearTransposePreferenceKey);
      if (savedPreference !== null) transposeGearTable = savedPreference === 'true';
    }
    catch { /* Keep the default orientation if storage is unavailable. */ }

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

  function openUsers(item: ResourceItem) {
    if (mode !== 'owned' && usersByResource[item.key]?.length) selectedResource = item;
  }

  function handleMatrixKeydown(event: KeyboardEvent) {
    const isEnterNavigation = event.key === 'Enter' || ['Go', 'Next', 'Done'].includes(event.key) || event.keyCode === 13;
    if (gearEnterDebugEnabled && event.target instanceof HTMLInputElement) {
      addGearEnterDebugEvent(`matrix keydown key=${JSON.stringify(event.key)} target=${describeInput(event.target)} recognized=${isEnterNavigation || event.key === 'Tab'}`);
    }
    if (
      (!isEnterNavigation && event.key !== 'Tab') || !(event.target instanceof HTMLInputElement) || !event.target.matches('.resource-input')
    ) return;

    const matrixRoot = event.currentTarget as HTMLElement;
    const isGearMatrix = matrixRoot.classList.contains('gear');
    if (event.key === 'Tab' && !isGearMatrix) return;
    const mobileEnterUsesTabOrder = isEnterNavigation && isGearMatrix &&
      (event.location === KeyboardEvent.DOM_KEY_LOCATION_MOBILE || navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches);
    const rowMajorOrder = event.key === 'Tab' || mobileEnterUsesTabOrder;
    const inputs = matrixInputOrder(matrixRoot, rowMajorOrder, isGearMatrix);

    const currentIndex = inputs.findIndex((input) => input === event.target);
    if (currentIndex < 0) return;

    const nextInput = inputs[currentIndex + (event.shiftKey ? -1 : 1)];
    if (gearEnterDebugEnabled && isGearMatrix && isEnterNavigation) {
      addGearEnterDebugEvent(`navigation order=${rowMajorOrder ? 'row' : 'column'} from=${describeInput(event.target)} to=${describeInput(nextInput ?? null)}`);
    }
    if (isEnterNavigation) {
      event.preventDefault();
      if (nextInput) focusMatrixInput(nextInput);
      return;
    }
    if (!nextInput) {
      if (event.key === 'Tab' && isGearMatrix && focusOutsideMatrix(matrixRoot, event.target, event.shiftKey ? -1 : 1)) {
        event.preventDefault();
      }
      return;
    }
    event.preventDefault();
    focusMatrixInput(nextInput);
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
  {/snippet}
  <div class="controls">
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
  <div class="inventory-sections" class:gear-layout={gear}
    style={gear ? `--gear-table-max-width: ${40 + (panels[0]?.columns.length ?? 0) * 75}px` : undefined}>
  <div class="matrices" class:gear class:show-universal={gear && showUniversalInventory} role="group" aria-label={t(gear ? 'footer-gear' : 'footer-resources')}
    aria-busy={gear && gearFarmBusy} onkeydown={handleMatrixKeydown}>
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
                      <div class="gear-cell">
                        {#if showUniversalInventory || !isUniversalGearItem(item)}
                          <ResourceCell {item} totals={gearDisplayTotals} {mode} {setOwned} {t}
                            userCount={usersByResource[item.key]?.length ?? 0}
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
    {#if gear && remainingCurrencyTiles.length}
      <div class="summary-tiles" role="group" aria-label={t('ui-group-currencies')}>
        {#each remainingCurrencyTiles as item (item.key)}
          <ResourceCell {item} {totals} {mode} {setOwned} {t}
            userCount={usersByResource[item.key]?.length ?? 0}
            inlineAmount={inlineAmount(item.key)}
            showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
        {/each}
      </div>
    {/if}
  </div>
    <div class="inventory-side">
      {#if pairedGroups.length}
        <div class="xp-book-groups">
          {#each pairedGroups as group}
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
          result={gearFarmResult} busy={gearFarmBusy} {t} />
      {/if}
    </div>
  </div>
  {#if gear && mode === 'needed' && gearFarmResult}
    <GearBlueprintUsage data={dataset.context.data} {metadata} result={gearFarmResult} {t} />
  {/if}
  {#if gear}
    <details>
      <summary>{t('ui-weapon-xp')}</summary>
      <div class="table-scroll"><table class="weapon-table">
        <thead><tr><th scope="col" aria-label={t('ui-weapon-xp')}></th><th scope="col">{t('label-owned')}</th><th scope="col">{t('label-totalneeded')}</th><th scope="col">{t('label-remainingneeded')}</th></tr></thead>
        <tbody>{#each weapons.rows as row}
          <tr><th scope="row"><img class="weapon-xp-icon" src={`/planner/icons/LevelPart/${row.type}_All.png`} alt={row.type} draggable="false" /></th>
            <td>{formatAmount(row.owned)}</td><td>{formatAmount(row.required)}</td><td>{formatAmount(row.remaining)}</td></tr>
        {/each}
        </tbody>
      </table></div>
      <p class="note">{t('ui-weapon-xp-help')}</p>
    </details>
  {/if}
  {#if !gear && remainingSummaryTiles.length}
    <h3>{t('ui-group-currencies')}</h3>
    <div class="summary-tiles" role="group" aria-label={t('ui-group-currencies')}>
      {#each remainingSummaryTiles as item (item.key)}
        <ResourceCell {item} {totals} {mode} {setOwned} {t}
          userCount={usersByResource[item.key]?.length ?? 0}
          inlineAmount={inlineAmount(item.key)}
          showUsers={mode === 'owned' ? undefined : () => openUsers(item)} />
      {/each}
    </div>
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
  .display-modes { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .display-modes button { color: #252530; padding: 0.45rem 0.6rem; border: 2px solid transparent; }
  .display-modes button[aria-pressed="true"] { border-color: #7c5b7d; box-shadow: 0 0 0 1px var(--text); font-weight: bold; }
  .selected-mode-chip {
    flex: 0 0 auto; color: #252530; padding: 0.35rem 0.5rem;
    border-radius: 0.35rem; font-size: 0.8rem;
    font-weight: bold; line-height: 1.1; white-space: nowrap;
  }
  .needed { background: #f5c8dd; } .owned { background: #c8e6f5; } .required { background: #c8f5e0; } .leftover { background: #f5efc8; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; }
  input { padding: 0.35rem; min-width: 0; } input[type="number"] { width: 80px; }
  .matrices { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 285px), 1fr)); align-items: start; gap: 0.75rem; }
  .matrices.gear { display: block; }
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
  .gear:not(.show-universal) .gear-special-header,
  .gear:not(.show-universal) .gear-special-cell { visibility: hidden; }
  .gear:not(.show-universal) .gear-special-row { display: none; }
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
  .gear-cell { position: relative; width: 100%; aspect-ratio: 1; }
  .gear-cell :global(.resource-cell) { position: absolute; inset: 0; width: 100%; height: 100%; }
  .gear-use-indicator {
    position: absolute; z-index: 3; display: flex; align-items: center; gap: 0.08rem;
    max-width: calc(100% - 0.12rem); padding: 0.04rem 0.08rem; border: 1px solid #7c5b7d66;
    border-radius: 0.2rem; background: color-mix(in srgb, var(--background) 82%, transparent);
    color: var(--text); font: 700 0.65rem/1 sans-serif; font-variant-numeric: tabular-nums;
    white-space: nowrap; pointer-events: none;
  }
  .gear-use-indicator img { display: block; flex: 0 0 1.05rem; width: 1.05rem; height: 1.05rem; object-fit: contain; }
  .gear-use-indicator.top-right { top: 0.04rem; right: 0.04rem; }
  .gear-use-indicator.bottom-left { bottom: 0.04rem; left: 0.04rem; }
  .matrices:not(.gear) .table-scroll { overflow: hidden; }
  .matrices:not(.gear) table { width: max-content; table-layout: auto; }
  .school-matrices table, .artifact-pair table { max-width: var(--matrix-max-width); margin-inline: auto; }
  .artifact-pair tbody th:first-child { width: max-content; white-space: nowrap; }
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
  .weapon-table { width: fit-content; max-width: 100%; table-layout: auto; }
  .weapon-table th, .weapon-table td { padding: 0.4rem; text-align: right; }
  .weapon-table th:first-child { width: 2.75rem; text-align: center; }
  .weapon-xp-icon { display: block; width: 2.4rem; height: 2.4rem; margin: auto; object-fit: contain; }
  details { margin-top: 1rem; } summary { cursor: pointer; }
  .note { font-size: 0.8rem; line-height: 1.4; opacity: 0.85; }
  .error { color: var(--error); }
  @media (max-width: 800px) {
    .gear td :global(.amount) { font-size: 0.9rem; }
    .gear-use-indicator { gap: 0.04rem; padding: 0.02rem 0.04rem; font-size: 0.42rem; }
    .gear-use-indicator img { flex-basis: 0.48rem; width: 0.48rem; height: 0.48rem; }
    .gear:not(.show-universal) .gear-special-header,
    .gear:not(.show-universal) .gear-special-cell { display: none; }
    .gear-general-header, .gear-special-name { visibility: hidden; }
    .matrices:not(.gear) td :global(.amount) { font-size: 0.9rem; }
    .gear-header-name { display: none; }
    .gear-header-image { display: block; }
    .inventory-sections:not(.gear-layout) { min-width: 0; width: 100%; }
    .matrices:not(.gear) { width: 100%; }
    .matrices:not(.gear) table { width: 100%; max-width: 100%; table-layout: fixed; }
    .matrices:not(.gear) td { width: auto; }
    .artifact-pair th:first-child { width: clamp(90px, 45%, 120px); }
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
    .tiles :global(.resource-cell) { flex: 0 0 48px; width: 48px; min-width: 48px; min-height: 48px;}
  }
  @media (min-width: 1201px) {
    .matrices:not(.gear) {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
      gap: 0.75rem;
    }
    .matrices:not(.gear) > section { min-width: 0; }
    .matrices:not(.gear) .school-matrices table {
      width: 100%; max-width: 100%; table-layout: fixed; margin: 0;
    }
    .matrices:not(.gear) .artifact-matrices .artifact-pair { max-width: none; }
    .artifact-pair th:first-child { width: clamp(90px, 35%, 120px); }
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
