<script lang="ts">
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
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

  function dropRarityClass(id: string): string {
    const rarity = id.match(/^(?:BD|TN)_([1-4])(?:_|$)/)?.[1] ?? id.match(/_([1-4])$/)?.[1];
    return rarity ? `rarity-${rarity}` : '';
  }

  function formatStageDrop(amount: number): string {
    return Number.isInteger(amount) ? formatAmount(amount) : `${Number((amount * 100).toFixed(2))}%`;
  }

  function amountFontSize(amount: number): string {
    const length = `×${formatAmount(amount)}`.length;
    return `${Math.max(0.7, Math.min(1.1, 8 / length))}rem`;
  }

  function fitOverlayAmount(node: HTMLElement, _amount: string) {
    const container = node.parentElement;
    const range = document.createRange();
    let frame = 0;
    let observer: ResizeObserver | undefined;

    function fit() {
      if (!container) return;
      node.style.removeProperty('font-size');
      const style = getComputedStyle(container);
      const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      const configuredRatio = Number.parseFloat(style.getPropertyValue('--overlay-number-fit-ratio'));
      const fitRatio = Number.isFinite(configuredRatio) ? Math.min(1, Math.max(0, configuredRatio)) : 1;
      const availableWidth = Math.max(0, (container.clientWidth - padding - 2) * fitRatio);
      range.selectNodeContents(node);
      const fits = () => range.getBoundingClientRect().width <= availableWidth;
      if (fits()) return;

      let low = 0;
      let high = Number.parseFloat(getComputedStyle(node).fontSize) || 18;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const size = (low + high) / 2;
        node.style.fontSize = `${size}px`;
        if (fits()) low = size;
        else high = size;
      }
      node.style.fontSize = `${low}px`;
    }

    function scheduleFit() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    }

    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(scheduleFit);
      observer.observe(container);
    }
    scheduleFit();
    return {
      update: scheduleFit,
      destroy() {
        observer?.disconnect();
        cancelAnimationFrame(frame);
        node.style.removeProperty('font-size');
      }
    };
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
        {@const amount = formatAmount(plan.currency_needed[currency])}
        {@const label = `${info?.shortname ?? currency}: ${amount}`}
        <button type="button" class="currency-tab" data-event-shop-tab={currency}
          aria-label={label} title={label} aria-pressed={activeCurrency === currency} onclick={() => selectedCurrency = currency}>
          <img src={currencyImage(currency)} alt="" />
          <strong use:fitOverlayAmount={amount}>{amount}</strong>
        </button>
      {/each}
    </div>
    {#if activeCurrency}
      <div class="shop-grid">
        {#each shopItems as purchase (String(purchase.id))}
          {@const product = item(purchase)}
          <article class="shop-item" data-event-purchase={String(purchase.id)} data-event-shop={activeCurrency}>
            <div class="product-visual">
              {#if product.image}<img class="product-image" src={product.image} alt="" />{/if}
              {#if purchase.amount !== undefined}<strong class="amount-multiplier" style:font-size={amountFontSize(purchase.amount)}>×{formatAmount(purchase.amount)}</strong>{/if}
            </div>
            <div class="shop-details">
              <label class="quantity">
                <input use:sanitizeIntegerInput type="number" min="0" max={purchase.overflow
                  ? purchase.overflow_cap ?? (event.eventId === 'ive-alive-rerun' ? 200000 : undefined)
                  : purchase.count} step="1"
                  value={purchase.overflow && plan.optimisation_type === 'Currency'
                    ? overflowPurchases[activeCurrency]?.[String(purchase.id)] ?? 0
                    : plan.shop_purchases[activeCurrency]?.[String(purchase.id)] ?? 0}
                  aria-label={`${t('ui-event-purchase')} ${product.name}`}
                  disabled={Boolean(purchase.locked && !midEvent) || Boolean(purchase.overflow && plan.optimisation_type === 'Currency')}
                  onchange={(event) => actions.setPurchase(activeCurrency, String(purchase.id), event.currentTarget.valueAsNumber)} />
                <span>/{purchase.overflow ? '∞' : formatAmount(purchase.count)}</span>
              </label>
              <span class="price"><img src={currencyImage(activeCurrency)} alt="" />{formatAmount(purchase.cost)}</span>
            </div>
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
          <th scope="col" aria-label={t('label-headerquest')}></th>
          <th scope="col">{t('label-headerenergy')}</th>
          <th scope="col">{t('label-headerruns')}</th>
          <th scope="col">{t('label-headerdrops')}</th>
        </tr></thead>
        <tbody>
          {#each questStages as stage, index (stage.number)}
            <tr class:alternate-row={index % 2 === 1} data-event-stage={stage.number}>
              <th scope="row">{stage.label ?? `Q${stage.number}`}</th>
              <td><span class="stage-energy" title={`${t('label-headerenergy')} ${formatAmount(stage.cost)}`}>
                <img src="/planner/icons/Misc/Energy.png" alt="" /><strong>{formatAmount(stage.cost)}</strong>
              </span></td>
              <td><input use:sanitizeIntegerInput type="number" min="0" max="2000" step="1"
                value={stageRun(stage.number) ?? ''}
                aria-label={`${t('label-headerruns')} Q${stage.number}`}
                disabled={plan.optimisation_type !== 'Manual'}
                onchange={(event) => actions.setManualRuns(stage.number, event.currentTarget.valueAsNumber)} /></td>
              <td><div class="drops">
                {#each Object.entries(stage.drops ?? {}) as [drop, rawAmount] (drop)}
                  {@const currency = event.currencies[drop]}
                  {@const resource = currency ? null : item({ id: drop, type: 'StageDrop', count: rawAmount })}
                  {@const label = currency?.shortname ?? resource?.name ?? drop}
                  {@const amount = formatStageDrop(dropAmount(stage.number, drop, rawAmount))}
                  <span class={`drop ${dropRarityClass(drop)}`} title={label} aria-label={`${label}: ${amount}`}>
                    {#if currency}<img src={currencyImage(drop)} alt="" />
                    {:else if resource?.image}<img src={resource.image} alt="" />{/if}
                    <strong use:fitOverlayAmount={amount}>{amount}</strong>
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
          <span class="drop" title={`${t('label-headerenergy')} ${formatAmount(initial.cost)}`} aria-label={`${t('label-headerenergy')}: ${formatAmount(initial.cost)}`}>
            <img src="/planner/icons/EventIcon/EnergyIcon/EnergyPadded.png" alt="" />
            <strong use:fitOverlayAmount={formatAmount(initial.cost)}>{formatAmount(initial.cost)}</strong>
          </span>
          {#each Object.entries(initial.rewards) as [rewardId, amount] (rewardId)}
            {@const currency = event.currencies[rewardId]}
            {@const resource = currency ? null : item({ id: rewardId, type: 'StageDrop', count: amount })}
            {@const label = currency?.shortname ?? resource?.name ?? rewardId}
            {@const formattedAmount = formatAmount(amount)}
            <span class={`drop ${dropRarityClass(rewardId)}`} title={label} aria-label={`${label}: ${formattedAmount}`}>
              {#if currency}<img src={currencyImage(rewardId)} alt="" />
              {:else if resource?.image}<img src={resource.image} alt="" />{/if}
              <strong use:fitOverlayAmount={formattedAmount}>{formattedAmount}</strong>
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
        {@const product = reward.type !== undefined && reward.id !== undefined ? item(reward as EventReward) : null}
        {@const quantity = `×${formatAmount(reward.count)}`}
        <button type="button" class="point-tier"
          class:untyped={product === null}
          class:with-image={Boolean(product?.image)}
          class:selected={reward.points <= selectedPointTarget}
          class:obtained={reward.points > selectedPointTarget && reward.points <= pointsObtained}
          data-event-point={reward.points} aria-pressed={reward.points <= selectedPointTarget}
          aria-label={product
            ? `${formatAmount(reward.points)} ${t('label-points')}: ${product.name} ×${formatAmount(reward.count)}`
            : `${formatAmount(reward.points)} ${t('label-points')}: ${t('label-rewards')} ×${formatAmount(reward.count)}`}
          onclick={() => actions.setPointTarget(reward.points)}>
          <strong class="threshold">{formatAmount(reward.points)}</strong>
          {#if product?.image}<img src={product.image} alt="" />{/if}
          {#if product}<span>{product.name}</span>{/if}
          <span class="point-quantity-cell"><strong class="point-quantity" use:fitOverlayAmount={quantity}>{quantity}</strong></span>
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
  .currency-tab { --overlay-number-fit-ratio: 0.9; position: relative; display: grid; flex: 0 0 4.8rem; width: 4.8rem; height: 4.8rem; place-items: center; padding: 0; overflow: hidden; }
  .currency-tab[aria-pressed="true"] { border-color: #7c5b7d; background: #7c5b7d22; }
  .currency-tab img { width: 4.4rem; height: 4.4rem; object-fit: contain; }
  .currency-tab strong { position: absolute; top: 50%; left: 50%; max-width: calc(100% - 0.2rem); transform: translate(-50%, -50%); color: #111; font-size: 1.2rem; font-weight: 800; line-height: 1; text-align: center; white-space: nowrap; text-shadow: -1px -1px 0 #fff, 0 -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 0 1px 0 #fff, 1px 1px 0 #fff; }
  .price img { width: 22px; height: 22px; object-fit: contain; }
  .shop-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: center; }
  .shop-item { box-sizing: border-box; display: flex; width: 100%; min-width: 0; max-width: fit-content; align-items: center; gap: 0.2rem; padding: 0.35rem; border: 1px solid #7c5b7d44; border-radius: 0.35rem; }
  .product-visual { position: relative; display: grid; place-items: center; width: 4.5rem; height: 4.5rem; }
  .product-image { width: 4.5rem; height: 4.5rem; object-fit: contain; }
  .amount-multiplier { position: absolute; right: 0.2rem; bottom: 0.2rem; max-width: 100%; color: #111; font-weight: 800; line-height: 1; text-align: right; white-space: nowrap; text-shadow: -1px -1px 0 #fff, 0 -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 0 1px 0 #fff, 1px 1px 0 #fff; }
  .shop-details { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; align-items: center; gap: 0.35rem; min-width: 0; }
  .quantity { display: grid; justify-items: end; gap: 0.05rem; min-width: 0; font-size: 0.88rem; }
  .price { display: flex; align-items: center; justify-content: flex-start; min-width: 0; font-size: 0.75rem; white-space: nowrap; }
  input[type="number"] { width: 4.2rem; min-width: 0; padding: 0.2rem; color: inherit; background: var(--surface); border: 1px solid #7c5b7d66; border-radius: 0.25rem; }
  .quantity input[type="number"] { box-sizing: border-box; width: 4.5ch; min-width: 0; padding: 0.12rem 0.1rem; font-size: 1.3rem; text-align: center; }
  .quantity input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
  .quantity input[type="number"]::-webkit-inner-spin-button,
  .quantity input[type="number"]::-webkit-outer-spin-button { margin: 0; -webkit-appearance: none; }
  .price img { width: 18px; height: 18px; }
  .stage-groups { display: flex; flex-wrap: wrap; gap: 0.35rem 0.75rem; margin-bottom: 0.5rem; font-size: 0.8rem; }
  .table-scroll { width: fit-content; max-width: calc(100% + 1.5rem); margin-inline: -0.75rem; overflow-x: auto; }
  @media (min-width: 801px) {
    .table-scroll { max-width: 100%; margin-inline: 0; }
  }
  table { width: fit-content; border-collapse: collapse; font-size: 0.76rem; }
  th, td { padding: 0.25rem; border: 0; text-align: left; }
  thead th { font-weight: 700; text-align: center; }
  tbody tr.alternate-row { background-color: #74749347; }
  tbody th { font-weight: 700; text-align: center; white-space: nowrap; }
  td input:disabled { opacity: 0.75; }
  .table-scroll td input[type="number"] { box-sizing: border-box; width: 6ch; text-align: center; -moz-appearance: textfield; appearance: textfield; }
  .table-scroll td input[type="number"]::-webkit-inner-spin-button,
  .table-scroll td input[type="number"]::-webkit-outer-spin-button { margin: 0; -webkit-appearance: none; }
  .stage-energy { display: inline-flex; align-items: center; gap: 0.2rem; white-space: nowrap; }
  .stage-energy img { width: 1.6rem; height: 1.6rem; object-fit: contain; }
  .drops { display: flex; flex-wrap: wrap; align-items: center; min-width: 160px; }
  .drop { --overlay-number-fit-ratio: 0.9; position: relative; display: inline-grid; flex: 0 0 3.5rem; place-items: center; width: 3.5rem; height: 3.5rem; background-position: center; background-size: contain; background-repeat: no-repeat; }
  .drop.rarity-1 { background-image: url('/planner/icons/Misc/background_n.png'); }
  .drop.rarity-2 { background-image: url('/planner/icons/Misc/background_r.png'); }
  .drop.rarity-3 { background-image: url('/planner/icons/Misc/background_sr.png'); }
  .drop.rarity-4 { background-image: url('/planner/icons/Misc/background_ssr.png'); }
  .drop img { display: block; max-width: 70px; width: 74%; aspect-ratio: 1 / 1; object-fit: contain; }
  .drop strong { position: absolute; top: 50%; left: 50%; max-width: 100%; transform: translate(-50%, -50%); color: #111; font-size: 1.15rem; line-height: 1; text-align: center; white-space: nowrap; text-shadow: -1px -1px 0 #fff, 0 -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 0 1px 0 #fff, 1px 1px 0 #fff; pointer-events: none; }
  .initial-clear { margin-top: 0.5rem; padding: 0.35rem; border: 1px solid #7c5b7d44; border-radius: 0.35rem; }
  .initial-clear h3 { margin: 0 0 0.25rem; font-size: 0.82rem; }
  .initial-clear .drops { min-width: 0; }
  .initial-clear .drop { min-width: 0; white-space: normal; overflow-wrap: anywhere; }
  .point-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.35rem; }
  .point-tier { display: grid; grid-template-columns: auto 30px minmax(0, 1fr) minmax(0, 1fr); align-items: center; gap: 0.35rem; min-width: 0; padding: 0.4rem; text-align: left; font-size: 0.75rem; }
  .point-tier:not(.with-image):not(.untyped) { grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr); }
  .point-tier.untyped { grid-template-columns: auto minmax(0, 1fr); justify-content: start; }
  .point-tier img { width: 30px; height: 30px; object-fit: contain; }
  .point-quantity-cell { display: block; width: 100%; min-width: 0; }
  .point-quantity { display: block; box-sizing: border-box; width: 100%; min-width: 0; font-size: 0.75rem; text-align: right; white-space: nowrap; }
  .point-tier span { min-width: 0; overflow-wrap: anywhere; }
  .point-tier.selected { background: #7c5b7d44; border-color: #7c5b7d; }
  .point-tier.obtained { background: #00c9ff35; border-color: #00a6d2; }
  @media (max-width: 1199px) {
    .point-tier > span:not(.point-quantity-cell) { display: none; }
    .point-tier.with-image { grid-template-columns: 6ch 30px minmax(0, 1fr); }
    .point-tier:not(.with-image):not(.untyped) { grid-template-columns: auto minmax(0, 1fr); }
  }
  @media (max-width: 600px) {
    .currency-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .currency-tab { width: 100%; height: auto; aspect-ratio: 1; }
    .currency-tab img { width: 90%; height: auto; aspect-ratio: 1; }
    .point-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .drop img { max-width: 50px; }
    .product-visual { width: 3rem; height: 3rem; }
    .product-image { width: 3rem; height: 3rem; }
    .quantity input[type="number"] { font-size: 0.9rem }
    .quantity { font-size: 0.68rem; }
    .price { font-size: 0.65rem; }
    .price img { width: 15px; height: 15px; }
    .point-tier { padding: 0.2rem; font-size: 0.45rem; gap: 0; }
    .point-tier img { width: 25px; height: 25px; }
  }
</style>
