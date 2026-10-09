<script lang="ts">
  import { formatAmount } from '$lib/domain/planner/catalog';
  import { isRecord } from '$lib/domain/planner/save';
  import type { EventAmounts } from '$lib/domain/events/types';
  import type { EventActions, EventPlan, EventReward, EventTab, StandardEvent } from '$lib/domain/events/standard-types';

  let { tab, event, plan, runs, variables, initial, midEvent, pointsObtained, overflowPurchases = {}, actions, item, t }: {
    tab: EventTab; event: StandardEvent; plan: EventPlan; runs: EventAmounts;
    variables: Record<string, EventAmounts>; initial: { rewards: EventAmounts; cost: number };
    midEvent: boolean; pointsObtained: number; actions: EventActions;
    overflowPurchases?: Record<string, Record<string, number>>;
    item: (reward: EventReward) => { name: string; image?: string }; t: (key: string) => string;
  } = $props();

  const stageGroupIndexes = [0, 1, 2] as const;
  let selectedCurrency = $state('');
  let shopCurrencies = $derived(Object.keys(event.shops));
  let activeCurrency = $derived(shopCurrencies.includes(selectedCurrency) ? selectedCurrency : shopCurrencies[0] ?? '');
  let shopItems = $derived(event.shops[activeCurrency] ?? []);
  let questStages = $derived(event.stages.filter(isQuestWithNumber));
  let selectedPointTarget = $derived(Number(plan.point_target || event.event_point_target || 0));

  function isQuestWithNumber(stage: StandardEvent['stages'][number]): stage is StandardEvent['stages'][number] & { number: number } {
    return stage.type === 'Quest' && stage.visible !== false &&
      typeof stage.number === 'number' && Number.isFinite(stage.number);
  }

  function currencyImage(currency: string): string {
    return `/planner/icons/EventIcon/CurrencyIcon/${event.currencies[currency]?.icon ?? `${currency}.png`}`;
  }

  function stageRun(stage: number): number | undefined {
    if (plan.optimisation_type === 'Manual' && isRecord(plan.optimisation_options)) {
      const manual = plan.optimisation_options[String(stage)];
      if (typeof manual === 'number' && Number.isFinite(manual)) return manual;
      if (typeof manual === 'string' && manual.trim() !== '') {
        const parsed = Number(manual);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    const solved = runs[String(stage)];
    return Number.isFinite(solved) ? solved : undefined;
  }

  function dropAmount(stage: number, key: string, raw: number): number {
    if (event.currencies[key]) {
      const modeled = variables[String(stage)]?.[key];
      if (typeof modeled === 'number' && Number.isFinite(modeled)) return modeled;
    }
    return raw;
  }

  function updateStageGroup(index: (typeof stageGroupIndexes)[number], enabled: boolean): void {
    const groups: [boolean, boolean, boolean] = [
      plan.enabled_stage_groups[0], plan.enabled_stage_groups[1], plan.enabled_stage_groups[2]
    ];
    groups[index] = enabled;
    actions.setGroups(groups);
  }
</script>

{#if tab === 'Shop'}
  <section class="market" aria-label={t('ui-event-purchase')}>
    <div class="currency-tabs" role="group" aria-label={t('ui-event-purchase')}>
      {#each shopCurrencies as currency (currency)}
        {@const info = event.currencies[currency]}
        <button type="button" class="currency-tab" data-event-shop-tab={currency}
          aria-pressed={activeCurrency === currency} onclick={() => selectedCurrency = currency}>
          <img src={currencyImage(currency)} alt="" />
          <span>{info?.shortname ?? currency}</span>
          <strong>{formatAmount(plan.currency_needed[currency])}</strong>
        </button>
      {/each}
    </div>
    {#if activeCurrency}
      <div class="shop-grid">
        {#each shopItems as purchase (String(purchase.id))}
          {@const product = item(purchase)}
          <article class="shop-item" data-event-purchase={String(purchase.id)} data-event-shop={activeCurrency}>
            {#if product.image}<img class="product-image" src={product.image} alt="" />{/if}
            <span class="product-name">{product.name}</span>
            {#if purchase.amount !== undefined}<span class="amount-multiplier">×{formatAmount(purchase.amount)}</span>{/if}
            <label class="quantity">
              <input type="number" min="0" max={purchase.overflow ? purchase.overflow_cap : purchase.count} step="1"
                value={purchase.overflow && plan.optimisation_type === 'Currency'
                  ? overflowPurchases[activeCurrency]?.[String(purchase.id)] ?? 0
                  : plan.shop_purchases[activeCurrency]?.[String(purchase.id)] ?? 0}
                aria-label={`${t('ui-event-purchase')} ${product.name}`}
                disabled={Boolean(purchase.locked && !midEvent) || Boolean(purchase.overflow && plan.optimisation_type === 'Currency')}
                onchange={(event) => actions.setPurchase(activeCurrency, String(purchase.id), event.currentTarget.valueAsNumber)} />
              <span>/{purchase.overflow ? '∞' : formatAmount(purchase.count)}</span>
            </label>
            <span class="price"><img src={currencyImage(activeCurrency)} alt="" />{formatAmount(purchase.cost)}</span>
          </article>
        {/each}
      </div>
    {/if}
  </section>
{:else if tab === 'Stages'}
  <section class="market">
    {#if event.stage_groups.some(Boolean)}
      <div class="stage-groups" role="group" aria-label={t('label-tabstages')}>
      {#each stageGroupIndexes as index}
        <label><input type="checkbox" checked={plan.enabled_stage_groups[index]}
          onchange={(event) => updateStageGroup(index, event.currentTarget.checked)} />
          {t('label-tabstages')} {event.stage_groups[index]}</label>
      {/each}
      </div>
    {/if}
    <div class="table-scroll">
      <table>
        <thead><tr>
          <th scope="col">{t('label-headerquest')}</th>
          <th scope="col">{t('label-headerenergy')}</th>
          <th scope="col">{t('label-headerruns')}</th>
          <th scope="col">{t('label-headerdrops')}</th>
        </tr></thead>
        <tbody>
          {#each questStages as stage (stage.number)}
            <tr data-event-stage={stage.number}>
              <th scope="row">{stage.label ?? `Q${stage.number}`}</th>
              <td>{formatAmount(stage.cost)} AP</td>
              <td><input type="number" min="0" max="2000" step="1"
                value={stageRun(stage.number) ?? ''}
                aria-label={`${t('label-headerruns')} Q${stage.number}`}
                disabled={plan.optimisation_type !== 'Manual'}
                onchange={(event) => actions.setManualRuns(stage.number, event.currentTarget.valueAsNumber)} /></td>
              <td><div class="drops">
                {#each Object.entries(stage.drops ?? {}) as [drop, rawAmount] (drop)}
                  {@const currency = event.currencies[drop]}
                  <span class="drop" title={currency?.shortname ?? item({ id: drop, type: 'StageDrop', count: rawAmount }).name}>
                    {#if currency}
                      <img src={currencyImage(drop)} alt="" />
                      <span>{currency.shortname}</span>
                      <strong>{formatAmount(dropAmount(stage.number, drop, rawAmount))}</strong>
                    {:else}
                      {@const resource = item({ id: drop, type: 'StageDrop', count: rawAmount })}
                      {#if resource.image}<img src={resource.image} alt="" />{/if}
                      <span>{resource.name}</span>
                      <strong>{formatAmount(rawAmount)}</strong>
                    {/if}
                  </span>
                {/each}
              </div></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if !midEvent}
      <section class="initial-clear">
        <h3>{t('label-initialclearinfo')}</h3>
        <div class="drops">
          <span class="drop"><strong>{formatAmount(initial.cost)} AP</strong></span>
          {#each Object.entries(initial.rewards) as [rewardId, amount] (rewardId)}
            {@const currency = event.currencies[rewardId]}
            <span class="drop" title={currency?.shortname ?? item({ id: rewardId, type: 'StageDrop', count: amount }).name}>
              {#if currency}
                <img src={currencyImage(rewardId)} alt="" /><span>{currency.shortname}</span>
              {:else}
                {@const resource = item({ id: rewardId, type: 'StageDrop', count: amount })}
                {#if resource.image}<img src={resource.image} alt="" />{/if}
                <span>{resource.name}</span>
              {/if}
              <strong>{formatAmount(amount)}</strong>
            </span>
          {/each}
        </div>
      </section>
    {/if}
  </section>
{:else if tab === 'Points'}
  <section class="market">
    <div class="point-grid">
      {#each event.point_rewards ?? [] as reward, index (`${reward.points}:${reward.id}:${index}`)}
        {@const product = item(reward)}
        <button type="button" class="point-tier"
          class:selected={reward.points <= selectedPointTarget}
          class:obtained={reward.points > selectedPointTarget && reward.points <= pointsObtained}
          data-event-point={reward.points} aria-pressed={reward.points <= selectedPointTarget}
          onclick={() => actions.setPointTarget(reward.points)}>
          <strong class="threshold">{formatAmount(reward.points)}</strong>
          {#if product.image}<img src={product.image} alt="" />{/if}
          <span>{product.name}</span>
          <strong>×{formatAmount(reward.count)}</strong>
        </button>
      {/each}
    </div>
  </section>
{/if}

<style>
  .market { min-width: 0; color: var(--text); }
  .currency-tabs { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.5rem; }
  button { color: inherit; background: var(--surface); border: 1px solid #7c5b7d66; border-radius: 0.35rem; cursor: pointer; }
  button:focus-visible, input:focus-visible { outline: 2px solid #7c5b7d; outline-offset: 2px; }
  .currency-tab { display: flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.4rem; font-size: 0.8rem; }
  .currency-tab[aria-pressed="true"] { border-color: #7c5b7d; background: #7c5b7d22; }
  .currency-tab img, .price img { width: 22px; height: 22px; object-fit: contain; }
  .shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 145px), 1fr)); gap: 0.4rem; }
  .shop-item { display: grid; grid-template-columns: 40px minmax(0, 1fr); align-items: center; gap: 0.2rem 0.4rem; padding: 0.35rem; border: 1px solid #7c5b7d44; border-radius: 0.35rem; }
  .product-image { grid-row: span 3; width: 40px; height: 40px; object-fit: contain; }
  .product-name { min-width: 0; font-size: 0.78rem; overflow-wrap: anywhere; }
  .amount-multiplier { font-size: 0.72rem; }
  .quantity, .price { display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; }
  input[type="number"] { width: 4.2rem; min-width: 0; padding: 0.2rem; color: inherit; background: var(--surface); border: 1px solid #7c5b7d66; border-radius: 0.25rem; }
  .price img { width: 18px; height: 18px; }
  .stage-groups { display: flex; flex-wrap: wrap; gap: 0.35rem 0.75rem; margin-bottom: 0.5rem; font-size: 0.8rem; }
  .table-scroll { max-width: 100%; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.76rem; }
  th, td { padding: 0.25rem; border: 1px solid #7c5b7d44; text-align: left; }
  tbody th { font-weight: 600; white-space: nowrap; }
  td input:disabled { opacity: 0.75; }
  .drops { display: flex; flex-wrap: wrap; gap: 0.2rem 0.4rem; min-width: 160px; }
  .drop { display: inline-flex; align-items: center; gap: 0.2rem; white-space: nowrap; font-size: 0.72rem; }
  .drop img + span { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  .drop img { width: 24px; height: 24px; object-fit: contain; }
  .initial-clear { margin-top: 0.5rem; padding: 0.35rem; border: 1px solid #7c5b7d44; border-radius: 0.35rem; }
  .initial-clear h3 { margin: 0 0 0.25rem; font-size: 0.82rem; }
  .initial-clear .drops { min-width: 0; }
  .initial-clear .drop { min-width: 0; white-space: normal; overflow-wrap: anywhere; }
  .point-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.35rem; }
  .point-tier { display: grid; grid-template-columns: auto 30px minmax(0, 1fr) auto; align-items: center; gap: 0.35rem; min-width: 0; padding: 0.4rem; text-align: left; font-size: 0.75rem; }
  .point-tier img { width: 30px; height: 30px; object-fit: contain; }
  .point-tier span { min-width: 0; overflow-wrap: anywhere; }
  .point-tier.selected { background: #7c5b7d44; border-color: #7c5b7d; }
  .point-tier.obtained { background: #00c9ff35; border-color: #00a6d2; }
  @media (max-width: 560px) { .point-grid { grid-template-columns: 1fr; } }
</style>
