<script lang="ts">
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import CharacterPortrait from '$lib/components/planner/CharacterPortrait.svelte';
  import { formatAmount } from '$lib/domain/planner/catalog';
  import type { EventEnergySettings } from '$lib/domain/events/types';
  import type { EventMode, EventSettingsProps } from '$lib/domain/events/standard-types';

  let { tab, event, plan, budget, bonuses, materials, students, plannerUnlockedIds, names, metadata, actions, t }: EventSettingsProps = $props();

  const modeLabels: Record<Exclude<EventMode, ''>, string> = {
    Shop: 'label-optishop',
    Materials: 'label-optimaterials',
    Currency: 'label-opticurrency',
    Manual: 'label-optimanual'
  };
  const cafeRanks = Array.from({ length: 10 }, (_, index) => index + 1);
  const pyroRefreshOptions = Array.from({ length: 21 }, (_, index) => index);
  const pvpPurchaseOptions = Array.from({ length: 5 }, (_, index) => index);
  const energySourceIcons = {
    natural: 'EnergyNatural.png',
    cafe: 'Common_Icon_Cafe.png',
    daily: 'EnergyDailyTask.png',
    club: 'EnergyClub.png',
    pyro: 'EnergyPyro.png',
    pvp: 'EnergyPvp.png',
    pack: 'Goods_Icon_Biweekly_0.png',
    carryover: 'EnergyCarryover.png',
    weekly: 'EnergyWeeklyTask.png',
    arona: 'Loading_Arona.png'
  } as const;

  function isBooleanRecord(value: unknown): value is Record<string, boolean> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
      Object.values(value).every((item) => typeof item === 'boolean');
  }

  let selectedMaterials = $derived(
    isBooleanRecord(plan.optimisation_options) ? plan.optimisation_options : {}
  );
  let currencies = $derived(Object.entries(event.currencies));
  let stageCurrencies = $derived(currencies.filter(([id, currency]) => currency.source === 'StageDrop' ||
    ((event.lessons || event.invasion) && id === 'Event_Point')));
  let bonusIds = $derived([...new Set(currencies.flatMap(([, currency]) => currency.bonus_units.map(({ id }) => id)))]);
  let bonusSortCurrency = $state('');
  let activeBonusSortCurrency = $derived(
    stageCurrencies.some(([id]) => id === bonusSortCurrency)
      ? bonusSortCurrency
      : stageCurrencies[0]?.[0] ?? ''
  );
  let displayedBonusIds = $derived.by(() => {
    const currency = event.currencies[activeBonusSortCurrency];
    if (!currency) return bonusIds;
    const originalOrder = new Map(bonusIds.map((id, index) => [id, index]));
    const rate = (id: string) => currency.bonus_units.find((unit) => unit.id === id)?.bonus ?? 0;
    return [...bonusIds].sort((a, b) => rate(b) - rate(a) || originalOrder.get(a)! - originalOrder.get(b)!);
  });
  let materialIds = $derived(new Map(Object.entries(metadata.materialNames).map(([id, name]) => [name, id])));
  let materialGroups = $derived.by(() => {
    const groups = new Map<string, string[]>();
    for (const material of materials) {
      const id = Number(materialIds.get(material));
      let type = material;
      if (Number.isFinite(id) && id < 1000) type = material.replace(/_[1-4]$/, '');
      else if (/^(?:BD|TN)_\d+_/.test(material)) type = material.replace(/^(BD|TN)_\d+_/, '$1_');
      else if (/^T\d+_/.test(material)) type = material.replace(/^T\d+_/, '');
      else type = material.replace(/_\d+$/, '');
      const group = groups.get(type) ?? [];
      group.push(material);
      groups.set(type, group);
    }
    return [...groups.values()];
  });

  function materialImage(material: string): string | undefined {
    const id = materialIds.get(material) ?? (metadata.materialNames[material] ? material : undefined);
    return id ? metadata.images[id] : undefined;
  }

  function materialLabel(material: string): string {
    const id = materialIds.get(material) ?? material;
    return (metadata.materialNames[id] ?? material).replaceAll('_', ' ');
  }

  function updateEnergyOption(key: 'cafe_rank' | 'pyro_refreshes' | 'pvp_refreshes', select: HTMLSelectElement): void {
    actions.setEnergy(key, Number(select.value));
  }

  function updateEnergyNumber(key: Exclude<keyof EventEnergySettings, 'energy_pack'>, input: HTMLInputElement): void {
    actions.setEnergy(key, input.valueAsNumber);
  }

  function energySourceIcon(key: string): string {
    const filename = energySourceIcons[key as keyof typeof energySourceIcons];
    return `/planner/icons/EventIcon/EnergyIcon/${filename ?? 'Energy.png'}`;
  }

  function updateOwnedCurrency(currency: string, input: HTMLInputElement): void {
    actions.setOwnedCurrency(currency, input.valueAsNumber);
  }

  function enablePlannerCharacters(): void {
    const unlocked = new Set(plannerUnlockedIds);
    actions.setBonusIds(bonusIds.filter((id) => unlocked.has(id)));
  }
</script>

<div class="settings">
  {#if tab === 'Targets'}
    <section class="targets">
      <div class="mode-grid">
        {#each event.available_targets as mode (mode)}
          <button
            type="button"
            class="mode-button"
            aria-pressed={plan.optimisation_type === mode}
            data-event-mode={mode}
            onclick={() => actions.setMode(mode)}
          >{t(modeLabels[mode])}</button>
        {/each}
      </div>

      {#if plan.optimisation_type === 'Materials'}
        <div class="material-groups">
          {#each materialGroups as group (group[0])}
            <div class="material-row">
              {#each group as material (material)}
                {@const label = materialLabel(material)}
                {@const image = materialImage(material)}
                <button
                  type="button"
                  class="material-button"
                  aria-label={label}
                  aria-pressed={selectedMaterials[material] === true}
                  data-event-material={material}
                  onclick={() => actions.setMaterials({ ...selectedMaterials, [material]: !selectedMaterials[material] })}
                >
                  {#if image}<img src={image} alt="" loading="lazy" draggable="false" />{:else}<span>{label}</span>{/if}
                </button>
              {/each}
            </div>
          {/each}
        </div>
      {:else if plan.optimisation_type === 'Currency'}
        <div class="currency-grid">
          {#each event.currency_targets as currencyId (currencyId)}
            {@const currency = event.currencies[currencyId]}
            <button
              type="button"
              class="currency-button"
              aria-label={currency.shortname}
              aria-pressed={plan.optimisation_options === currencyId}
              data-event-currency={currencyId}
              onclick={() => actions.setCurrency(currencyId)}
            >
              <img src={`/planner/icons/EventIcon/CurrencyIcon/${currency.icon}`} alt="" draggable="false" />
              <span>{currency.shortname}</span>
            </button>
          {/each}
        </div>
      {:else if plan.optimisation_type === 'Manual'}
        <p class="help">{t('ui-event-manual-help')}</p>
      {/if}
    </section>
  {:else if tab === 'Energy'}
    <section class="energy">
      <div class="energy-inputs">
        <label>
          <span>{t('ui-event-cafe')}</span>
          <select value={plan.cafe_rank ?? 10} data-event-energy="cafe_rank"
            onchange={(event) => updateEnergyOption('cafe_rank', event.currentTarget)}>
            {#each cafeRanks as rank}<option value={rank}>Lvl {rank}</option>{/each}
          </select>
        </label>
        <label>
          <span>{t('ui-event-pyro')}</span>
          <select value={plan.pyro_refreshes ?? 0} data-event-energy="pyro_refreshes"
            onchange={(event) => updateEnergyOption('pyro_refreshes', event.currentTarget)}>
            {#each pyroRefreshOptions as refreshes}<option value={refreshes}>{refreshes}x</option>{/each}
          </select>
        </label>
        <label>
          <span>{t('ui-event-pvp')}</span>
          <select value={plan.pvp_refreshes ?? 0} data-event-energy="pvp_refreshes"
            onchange={(event) => updateEnergyOption('pvp_refreshes', event.currentTarget)}>
            {#each pvpPurchaseOptions as purchases}<option value={purchases}>{purchases}x</option>{/each}
          </select>
        </label>
        <label>
          <span>{t('ui-event-carryover')}</span>
          <input use:sanitizeIntegerInput type="number" min="0" max="3000" step="1" value={plan.energy_carryover ?? 0} data-event-energy="energy_carryover"
            onchange={(event) => updateEnergyNumber('energy_carryover', event.currentTarget)} />
        </label>
        <label>
          <span>{t('ui-event-pack')}</span>
          <select value={plan.energy_pack ? 'true' : 'false'} data-event-energy="energy_pack"
            onchange={(event) => actions.setEnergy('energy_pack', event.currentTarget.value === 'true')}>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </label>
      </div>
      {#if budget}
        <div class="source-grid">
          {#each Object.entries(budget.sources) as [key, amount] (key)}
            <div class="source">
              <img src={energySourceIcon(key)} alt="" draggable="false" />
              <span>{t(`ui-event-source-${key}`)}</span>
              <strong>{formatAmount(amount)}</strong>
            </div>
          {/each}
          <div class="source total-source">
            <img src={energySourceIcon('total')} alt="" draggable="false" />
            <span>{t('ui-event-total-ap')}</span>
            <strong>{formatAmount(budget.total)}</strong>
          </div>
        </div>
      {/if}
    </section>
  {:else if tab === 'Bonus'}
    <section class="bonus">
      <div class="bonus-actions">
        <button type="button" onclick={enablePlannerCharacters}>{t('ui-event-from-planner')}</button>
        <button type="button" onclick={() => actions.setBonusIds(bonusIds)}>{t('button-enableall')}</button>
        <button type="button" onclick={() => actions.setBonusIds([])}>{t('ui-clear-selection')}</button>
      </div>
      <div class="bonus-totals">
        {#each stageCurrencies as [currencyId, currency] (currencyId)}
          <button type="button" class="bonus-total" aria-pressed={activeBonusSortCurrency === currencyId}
            aria-label={`${currency.shortname} +${Math.round((bonuses[currencyId] ?? 0) * 100)}%`}
            title={`${currency.shortname} +${Math.round((bonuses[currencyId] ?? 0) * 100)}%`}
            data-event-currency={currencyId} onclick={() => bonusSortCurrency = currencyId}>
            <img src={`/planner/icons/EventIcon/CurrencyIcon/${currency.icon}`} alt="" draggable="false" />
            <strong>+{Math.round((bonuses[currencyId] ?? 0) * 100)}%</strong>
          </button>
        {/each}
      </div>
      <div class="bonus-grid">
        {#each displayedBonusIds as id (id)}
          {@const selected = plan.enabled_bonus_units.includes(id)}
          {@const name = names[id] ?? students[id]?.Name ?? id}
          <button
            type="button"
            class="bonus-card"
            aria-label={`${t('ui-event-bonus')} ${name}`}
            aria-pressed={selected}
            data-event-bonus={id}
            onclick={() => actions.setBonusIds(selected
              ? plan.enabled_bonus_units.filter((enabledId) => enabledId !== id)
              : [...plan.enabled_bonus_units, id])}
          >
            <CharacterPortrait id={id} name={name} metadata={metadata} scribble={false} excluded={!selected} />
            <span class="bonus-overlays" aria-hidden="true">
              {#each stageCurrencies as [currencyId, currency], index (currencyId)}
                {@const unit = currency.bonus_units.find((bonusUnit) => bonusUnit.id === id)}
                {#if unit}
                  <span class="bonus-pill" class:top-left={index === 0} class:top-right={index === 1}
                    class:bottom-left={index === 2} class:bottom-right={index === 3}
                    title={`${currency.shortname} ${Math.round(unit.bonus * 100)}%`}>
                    <img src={`/planner/icons/EventIcon/CurrencyIcon/${currency.icon}`} alt="" draggable="false" />
                    <span>{Math.round(unit.bonus * 100)}%</span>
                  </span>
                {/if}
              {/each}
            </span>
          </button>
        {/each}
      </div>
    </section>
  {:else if tab === 'Owned'}
    <section class="owned">
      <div class="owned-grid">
        {#each currencies.filter(([id, currency]) => currency.source === 'StageDrop' || id === 'Event_Point') as [currencyId, currency] (currencyId)}
          <label>
            <span class="owned-label">
              <img src={`/planner/icons/EventIcon/CurrencyIcon/${currency.icon}`} alt="" draggable="false" />
              <span>{t('label-tabowned')} {currency.shortname}</span>
            </span>
            <input
              use:sanitizeIntegerInput
              type="number"
              min="0"
              max="200000"
              step="1"
              value={plan.currency_owned[currencyId] ?? 0}
              aria-label={`${t('label-tabowned')} ${currency.shortname}`}
              data-event-currency={currencyId}
              onchange={(event) => updateOwnedCurrency(currencyId, event.currentTarget)}
            />
          </label>
        {/each}
      </div>
      <p class="help">{t('ui-event-owned-help')}</p>
    </section>
  {/if}
</div>

<style>
  .settings { box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0; color: var(--text); }
  .settings * { box-sizing: border-box; }
  section { display: grid; gap: 0.65rem; min-width: 0; }
  button { color: inherit; font: inherit; }
  .mode-grid, .bonus-actions { display: flex; gap: 0.4rem; max-width: 800px; white-space: nowrap;}
  .mode-button, .bonus-actions button, .currency-button, .material-button {
    border: 1px solid var(--surface); border-radius: 0.45rem; background: var(--surface); cursor: pointer;
  }
  .mode-button { flex: 1 1 5.5rem; min-width: 0; padding: 0.42rem 0.55rem; }
  button[aria-pressed="true"] { border-color: #7c5b7d; box-shadow: inset 0 0 0 1px #7c5b7d; }
  .material-groups { display: grid; gap: 0.4rem; }
  .material-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .currency-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .material-button { width: 3.6rem; min-width: 0; min-height: 3.25rem; padding: 0.3rem; }
  .currency-button { width: 3.6rem; min-width: 0; min-height: 2rem; padding: 0.3rem; }
  .material-button { display: grid; place-items: center; overflow-wrap: anywhere; font-size: 0.78rem; }
  .material-button img { width: 2.3rem; height: 2.3rem; max-width: 100%; object-fit: contain; }
  .currency-button { display: flex; flex-direction: row; align-items: center; justify-content: flex-start; width: auto; min-width: 7rem; font-size: 0.78rem; white-space: nowrap; padding-right: 1rem }
  .currency-button img { width: 2.1rem; height: 2.1rem; flex: 0 0 auto; object-fit: contain; }
  .help { margin: 0; padding: 0.55rem 0.7rem; border-left: 3px solid #7c5b7d; background: var(--surface); overflow-wrap: anywhere; }
  .energy-inputs, .owned-grid { display: grid; gap: 0.5rem; }
  .energy-inputs { grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr)); }
  .owned-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr)); }
  .energy-inputs label, .owned-grid label { display: grid; gap: 0.25rem; min-width: 0; font-size: 0.88rem; }
  .energy-inputs label { display: flex; flex-direction: column; }
  .energy-inputs label > span { margin-top: auto; }
  .owned-label { display: flex; align-items: center; gap: 0.35rem; min-width: 0; }
  .owned-label img { width: 1.35rem; height: 1.35rem; flex: 0 0 auto; object-fit: contain; }
  .owned-label > span { overflow-wrap: anywhere; }
  input[type="number"] { width: 100%; min-width: 0; padding: 0.38rem 0.45rem; border: 1px solid var(--surface); border-radius: 0.35rem; background: var(--surface); color: var(--text); }
  input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button { margin: 0; -webkit-appearance: none; }
  .energy-inputs select, .energy-inputs input[type="number"] { flex: 0 0 2.35rem; width: 100%; min-width: 0; height: 2.35rem; padding: 0.38rem 0.45rem; border: 1px solid var(--surface); border-radius: 0.35rem; background: var(--surface); color: var(--text); }
  .source-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 7rem), 1fr)); gap: 0.5rem; }
  .source { display: grid; grid-template-columns: 2.35rem minmax(0, 1fr); grid-template-rows: auto auto; align-items: center; column-gap: 0.45rem; row-gap: 0.2rem; min-width: 0; min-height: 4rem; padding: 0.5rem 0.6rem; border-radius: 0.35rem; background: var(--surface); font-size: 0.82rem; }
  .source img { grid-row: 1 / 3; width: 2.35rem; height: 2.35rem; object-fit: contain; }
  .source span { overflow-wrap: anywhere; line-height: 1.1; }
  .source strong { white-space: nowrap; font-size: 1.05rem; }
  .source.total-source { grid-column: span 2; grid-template-columns: 2.35rem max-content; justify-content: center; }
  .source.total-source img { transform: translate(-0.5rem, 0); }
  .source.total-source strong { font-size: 1.3rem; }
  .bonus-actions button { padding: 0.4rem 0.6rem; }
  .bonus-totals { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .bonus-total { position: relative; display: grid; width: 4.8rem; height: 4.8rem; place-items: center; padding: 0; border: 1px solid transparent; border-radius: 0.35rem; background: var(--surface); color: inherit; cursor: pointer; }
  .bonus-total[aria-pressed="true"] { border-color: #7c5b7d; box-shadow: inset 0 0 0 1px #7c5b7d; }
  .bonus-total img { width: 4.4rem; height: 4.4rem; object-fit: contain; }
  .bonus-total strong { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: black; font-size: 1.4rem; line-height: 1; text-shadow: -1px -1px 0 #fff, 0 -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 0 1px 0 #fff, 1px 1px 0 #fff; white-space: nowrap; }
  .bonus-grid { display: grid; grid-template-columns: repeat(auto-fill, 5rem); justify-content: center; gap: 0.45rem; min-width: 0; }
  .bonus-card { position: relative; width: 5rem; min-width: 0; padding: 0; border: 0; border-radius: 0.45rem; background: transparent; cursor: pointer; --card-size: 80px; }
  .bonus-card :global(.portrait) { width: 100%; }
  .bonus-overlays { position: absolute; inset: 0; pointer-events: none; }
  .bonus-pill {
    position: absolute; display: grid; width: 1.75rem; height: 1.75rem; place-items: center; padding: 0; color: black; white-space: nowrap;
    filter: drop-shadow(1px 0px 0px #ffffff) drop-shadow(-1px 0px 0px #FFFFFF)
    drop-shadow(0px 1px 0px #FFFFFF) drop-shadow(0px -1px 0px #ffffff)
    drop-shadow(1px 0px 0px #000) drop-shadow(-1px 0px 0px #000)
    drop-shadow(0px 1px 0px #000) drop-shadow(0px -1px 0px #000);
  }
  .bonus-pill.top-left { top: 0.1rem; left: 0.1rem; }
  .bonus-pill.top-right { top: 0.1rem; right: 0.1rem; }
  .bonus-pill.bottom-left { bottom: 22%; left: 0.1rem; }
  .bonus-pill.bottom-right { right: 0.1rem; bottom: 22%; }
  .bonus-pill img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
  .bonus-pill > span { position: relative; z-index: 1; font: 700 0.68rem/1 sans-serif; text-shadow: -1px -1px 0 #fff, 0 -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 0 1px 0 #fff, 1px 1px 0 #fff; }
  @media (max-width: 600px) {
    .mode-grid { width: 100%; flex-wrap: nowrap; gap: 0.25rem; }
    .mode-button { flex: 1 1 0; padding: 0.35rem 0.2rem; font-size: 0.75rem; line-height: 1.15; white-space: normal; text-align: center; }
    .bonus-actions { gap: 0.25rem; }
    .bonus-actions button { flex: 1 1 0; min-width: 0; padding: 0.35rem 0.2rem; font-size: 0.75rem; line-height: 1.15; white-space: normal; text-align: center; }
    .bonus-totals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .bonus-total { width: 100%; height: auto; aspect-ratio: 1; }
    .bonus-total img { width: 90%; height: auto; aspect-ratio: 1; }
    .bonus-grid { grid-template-columns: repeat(auto-fill, 4.5rem); }
    .bonus-card { width: 4.5rem; }
    .bonus-pill { width: 1.45rem; height: 1.45rem; }
    .source.total-source { grid-column: 1 / -1; }
  }
</style>
