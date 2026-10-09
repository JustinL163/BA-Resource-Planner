<script lang="ts">
  import CharacterPortrait from '$lib/components/planner/CharacterPortrait.svelte';
  import { formatAmount } from '$lib/domain/planner/catalog';
  import type { EventEnergySettings } from '$lib/domain/events/types';
  import type { EventMode, EventSettingsProps } from '$lib/domain/events/standard-types';

  let { tab, event, plan, budget, bonuses, materials, students, names, metadata, actions, t }: EventSettingsProps = $props();

  const modeLabels: Record<Exclude<EventMode, ''>, string> = {
    Shop: 'label-optishop',
    Materials: 'label-optimaterials',
    Currency: 'label-opticurrency',
    Manual: 'label-optimanual'
  };

  function isBooleanRecord(value: unknown): value is Record<string, boolean> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
      Object.values(value).every((item) => typeof item === 'boolean');
  }

  let selectedMaterials = $derived(
    isBooleanRecord(plan.optimisation_options) ? plan.optimisation_options : {}
  );
  let currencies = $derived(Object.entries(event.currencies));
  let stageCurrencies = $derived(currencies.filter(([, currency]) => currency.source === 'StageDrop'));
  let bonusIds = $derived([...new Set(currencies.flatMap(([, currency]) => currency.bonus_units.map(({ id }) => id)))]);
  let materialIds = $derived(new Map(Object.entries(metadata.materialNames).map(([id, name]) => [name, id])));

  function materialImage(material: string): string | undefined {
    const id = materialIds.get(material) ?? (metadata.materialNames[material] ? material : undefined);
    return id ? metadata.images[id] : undefined;
  }

  function materialLabel(material: string): string {
    const id = materialIds.get(material) ?? material;
    return (metadata.materialNames[id] ?? material).replaceAll('_', ' ');
  }

  function updateEnergyNumber(key: Exclude<keyof EventEnergySettings, 'energy_pack'>, input: HTMLInputElement): void {
    actions.setEnergy(key, input.valueAsNumber);
  }

  function updateOwnedCurrency(currency: string, input: HTMLInputElement): void {
    actions.setOwnedCurrency(currency, input.valueAsNumber);
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
        <div class="material-grid">
          {#each materials as material (material)}
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
          <input type="number" min="1" max="10" step="1" value={plan.cafe_rank ?? 10} data-event-energy="cafe_rank"
            onchange={(event) => updateEnergyNumber('cafe_rank', event.currentTarget)} />
        </label>
        <label>
          <span>{t('ui-event-pyro')}</span>
          <input type="number" min="0" max="20" step="1" value={plan.pyro_refreshes ?? 0} data-event-energy="pyro_refreshes"
            onchange={(event) => updateEnergyNumber('pyro_refreshes', event.currentTarget)} />
        </label>
        <label>
          <span>{t('ui-event-pvp')}</span>
          <input type="number" min="0" max="4" step="1" value={plan.pvp_refreshes ?? 0} data-event-energy="pvp_refreshes"
            onchange={(event) => updateEnergyNumber('pvp_refreshes', event.currentTarget)} />
        </label>
        <label>
          <span>{t('ui-event-carryover')}</span>
          <input type="number" min="0" max="3000" step="1" value={plan.energy_carryover ?? 0} data-event-energy="energy_carryover"
            onchange={(event) => updateEnergyNumber('energy_carryover', event.currentTarget)} />
        </label>
        <label class="pack">
          <input type="checkbox" checked={plan.energy_pack ?? false} data-event-energy="energy_pack"
            onchange={(event) => actions.setEnergy('energy_pack', event.currentTarget.checked)} />
          <span>{t('ui-event-pack')}</span>
        </label>
      </div>
      {#if budget}
        <div class="source-grid">
          {#each Object.entries(budget.sources) as [key, amount] (key)}
            <div class="source">
              <span>{t(`ui-event-source-${key}`)}</span>
              <strong>{formatAmount(amount)}</strong>
            </div>
          {/each}
        </div>
        <div class="budget-totals">
          <div><span>{t('ui-event-total-ap')}</span><strong>{formatAmount(budget.total)}</strong></div>
          <div><span>{t('ui-event-farm-ap')}</span><strong>{formatAmount(budget.available)}</strong></div>
        </div>
      {/if}
    </section>
  {:else if tab === 'Bonus'}
    <section class="bonus">
      <div class="bonus-actions">
        <button type="button" onclick={() => actions.setBonusIds(bonusIds)}>{t('button-enableall')}</button>
        <button type="button" onclick={() => actions.setBonusIds([])}>{t('ui-clear-selection')}</button>
      </div>
      <div class="bonus-totals">
        {#each stageCurrencies as [currencyId, currency] (currencyId)}
          <div class="bonus-total" data-event-currency={currencyId}>
            <img src={`/planner/icons/EventIcon/CurrencyIcon/${currency.icon}`} alt="" draggable="false" />
            <span>{currency.shortname}</span>
            <strong>+{Math.round((bonuses[currencyId] ?? 0) * 100)}%</strong>
          </div>
        {/each}
      </div>
      <div class="bonus-grid">
        {#each bonusIds as id (id)}
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
              {#each stageCurrencies as [currencyId, currency] (currencyId)}
                {@const unit = currency.bonus_units.find((bonusUnit) => bonusUnit.id === id)}
                {#if unit}
                  <span class="bonus-pill" title={`${currency.shortname} +${Math.round(unit.bonus * 100)}%`}>
                    <img src={`/planner/icons/EventIcon/CurrencyIcon/${currency.icon}`} alt="" draggable="false" />
                    +{Math.round(unit.bonus * 100)}%
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
  .mode-grid, .bonus-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .mode-button, .bonus-actions button, .currency-button, .material-button {
    border: 1px solid var(--surface); border-radius: 0.45rem; background: var(--surface); cursor: pointer;
  }
  .mode-button { flex: 1 1 5.5rem; min-width: 0; padding: 0.42rem 0.55rem; }
  button[aria-pressed="true"] { border-color: #7c5b7d; box-shadow: inset 0 0 0 1px #7c5b7d; }
  .material-grid, .currency-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(3.6rem, 1fr)); gap: 0.4rem; }
  .material-button, .currency-button { min-width: 0; min-height: 3.25rem; padding: 0.3rem; }
  .material-button { display: grid; place-items: center; overflow-wrap: anywhere; font-size: 0.78rem; }
  .material-button img { width: 2.3rem; height: 2.3rem; max-width: 100%; object-fit: contain; }
  .currency-button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.15rem; font-size: 0.78rem; }
  .currency-button img { width: 1.8rem; height: 1.8rem; object-fit: contain; }
  .help { margin: 0; padding: 0.55rem 0.7rem; border-left: 3px solid #7c5b7d; background: var(--surface); overflow-wrap: anywhere; }
  .energy-inputs, .owned-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr)); gap: 0.5rem; }
  .energy-inputs label, .owned-grid label { display: grid; gap: 0.25rem; min-width: 0; font-size: 0.88rem; }
  .owned-label { display: flex; align-items: center; gap: 0.35rem; min-width: 0; }
  .owned-label img { width: 1.35rem; height: 1.35rem; flex: 0 0 auto; object-fit: contain; }
  .owned-label > span { overflow-wrap: anywhere; }
  input[type="number"] { width: 100%; min-width: 0; padding: 0.38rem 0.45rem; border: 1px solid var(--surface); border-radius: 0.35rem; background: var(--surface); color: var(--text); }
  .energy-inputs .pack { display: flex; flex-direction: row; align-items: center; gap: 0.45rem; }
  .pack input { accent-color: #7c5b7d; }
  .source-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 5.5rem), 1fr)); gap: 0.4rem; }
  .source, .budget-totals > div { display: flex; justify-content: space-between; align-items: center; gap: 0.3rem; min-width: 0; padding: 0.4rem 0.5rem; border-radius: 0.35rem; background: var(--surface); font-size: 0.82rem; }
  .source span, .budget-totals span { overflow-wrap: anywhere; }
  .budget-totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr)); gap: 0.4rem; }
  .budget-totals strong, .source strong { white-space: nowrap; }
  .bonus-actions button { padding: 0.4rem 0.6rem; }
  .bonus-totals { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .bonus-total { display: flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.4rem; border-radius: 0.35rem; background: var(--surface); font-size: 0.8rem; }
  .bonus-total img { width: 1.25rem; height: 1.25rem; object-fit: contain; }
  .bonus-grid { display: grid; grid-template-columns: repeat(auto-fill, 5rem); justify-content: center; gap: 0.45rem; min-width: 0; }
  .bonus-card { position: relative; width: 5rem; min-width: 0; padding: 0; border: 0; border-radius: 0.45rem; background: transparent; cursor: pointer; --card-size: 80px; }
  .bonus-card :global(.portrait) { width: 100%; }
  .bonus-overlays { position: absolute; right: 2px; bottom: 22%; left: 2px; display: flex; flex-wrap: wrap; justify-content: center; gap: 1px; pointer-events: none; }
  .bonus-pill { display: inline-flex; align-items: center; gap: 1px; max-width: 100%; padding: 1px 2px; border-radius: 2px; background: #16131ee8; color: white; font: 700 0.55rem/1.1 sans-serif; white-space: nowrap; }
  .bonus-pill img { width: 0.65rem; height: 0.65rem; object-fit: contain; }
</style>
