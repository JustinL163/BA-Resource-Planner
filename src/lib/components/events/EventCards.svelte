<script lang="ts">
  import type { CardDraw, EventReward } from '$lib/domain/events/standard-types';
  import { formatAmount } from '$lib/domain/planner/catalog';

  let {
    draws, currency, currencyName, standardDeviation, processing, ready, sampleCount,
    canSimulate, simulate, cancel, setDeviation, item, t
  }: {
    draws: CardDraw[];
    currency: number;
    currencyName: string;
    standardDeviation: number;
    processing: boolean;
    ready: boolean;
    sampleCount: number | null;
    canSimulate: boolean;
    simulate: () => void;
    cancel: () => void;
    setDeviation: (value: number) => boolean;
    item: (reward: EventReward) => { name: string; image?: string };
    t: (key: string) => string;
  } = $props();

  const rarities = ['UR', 'SR', 'R', 'N'] as const;
  const deviationPercent: Record<string, string> = {
    '-2': '2.3', '-1.5': '6.7', '-1': '15.9', '-0.5': '30.9',
    '0.5': '30.9', '1': '15.9'
  };
  let selected = $state('UR');
  let hideCards = $state(false);
  let visibleDraws = $derived(draws.filter((draw) =>
    draw.icon.slice(0, 2) === (selected.length === 1 ? `${selected}_` : selected)));
  let deviationInfo = $derived(standardDeviation === 0
    ? t('label-stdinfo')
    : `${standardDeviation}σ ${t(standardDeviation < 0 ? 'label-bottom' : 'label-top')} ${deviationPercent[String(standardDeviation)]}%`);
</script>

<section class="cards">
  <p class="strategy">{t('ui-event-card-strategy')}</p>
  <p class="currency" data-event-card-currency={currency}>{formatAmount(currency)} {currencyName}</p>
  <p class="cost">{t('ui-event-card-cost')}: 200 {currencyName}</p>

  <div class="simulation">
    <button type="button" data-event-card-simulate disabled={processing || ready || !canSimulate} onclick={simulate}>
      {t('button-simulategacha')}
    </button>
    {#if processing}
      <button type="button" onclick={cancel}>{t('label-cancel')}</button>
    {/if}
    <label class="rng">
      <span>{t('label-rngadjust')}</span>
      <input type="range" min="-2" max="1" step="0.5" value={standardDeviation}
        aria-label={t('label-rngadjust')} data-event-card-sd
        onchange={(event) => setDeviation(event.currentTarget.valueAsNumber)} />
    </label>
    <p class="deviation-info">{deviationInfo}</p>
  </div>

  <p class="status" aria-live="polite">
    {#if processing}
      {t('ui-event-card-running')}
    {:else if ready}
      {t('ui-event-card-ready')}
      {#if sampleCount !== null} · {t('ui-event-card-attempts')}: {formatAmount(sampleCount)}{/if}
    {:else if !canSimulate}
      {t('ui-event-card-plan-first')}
    {/if}
  </p>

  <div class="rarities" role="group" aria-label={t('label-tabcards')}>
    {#each rarities as rarity (rarity)}
      <button type="button" class="rarity" aria-pressed={selected === rarity && !hideCards}
        data-event-card-rarity={rarity} onclick={() => { selected = rarity; hideCards = false; }}>{rarity}</button>
    {/each}
    <button type="button" class="hide" aria-pressed={hideCards}
      onclick={() => hideCards = !hideCards}>{t('label-hidecards')}</button>
  </div>

  {#if !hideCards}
    <table class="card-table" aria-label={t('label-tabcards')}>
      <thead>
        <tr>
          <th scope="col">{t('label-card')}</th>
          <th scope="col">{t('label-chance')}</th>
          <th scope="col">{t('label-drops')}</th>
        </tr>
      </thead>
      <tbody>
        {#each visibleDraws as draw, index (index)}
          {@const chance = (draw.chance * 100).toFixed(2)}
          <tr data-event-card={draw.icon} data-event-card-chance={chance}>
            <td class="card-icon">
              <img src={`/planner/icons/EventIcon/CardIcon/${draw.icon}.png`} alt={draw.icon} />
            </td>
            <td class="chance">{chance}%</td>
            <td class="reward-cell">
              <div class="drops">
                {#each Object.entries(draw.drops) as [id, amount] (id)}
                  {@const reward = item({ id, count: amount, type: 'StageDrop' })}
                  <span class="drop" title={reward.name} aria-label={`${reward.name}: ${formatAmount(amount)}`}
                    data-event-card-drop={id}>
                    {#if reward.image}
                      <img src={reward.image} alt="" />
                    {:else}
                      <span class="fallback" aria-hidden="true">{reward.name.slice(0, 1)}</span>
                    {/if}
                    <strong>{formatAmount(amount)}</strong>
                  </span>
                {/each}
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
  .cards { min-width: 0; color: var(--text); }
  p { margin: 0 0 0.35rem; font-size: 0.78rem; }
  .strategy { margin-bottom: 0.2rem; }
  .currency { font-weight: 700; }
  .cost { color: var(--text); opacity: 0.78; }
  .simulation { display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem 0.55rem; }
  button { padding: 0.25rem 0.45rem; color: inherit; background: var(--surface); border: 1px solid #7c5b7d66; border-radius: 0.35rem; cursor: pointer; }
  button:focus-visible, input:focus-visible { outline: 2px solid #7c5b7d; outline-offset: 2px; }
  button:disabled { cursor: not-allowed; opacity: 0.55; }
  .rng { display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; }
  .rng input { width: min(10rem, 32vw); accent-color: #7c5b7d; }
  .deviation-info { flex-basis: 100%; margin: 0; }
  .status { min-height: 1em; margin: 0.35rem 0; }
  .rarities { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0.45rem 0; }
  .rarity[aria-pressed="true"] { border-color: #7c5b7d; background: #7c5b7d22; }
  .hide { margin-left: auto; }
  .card-table { width: 100%; table-layout: fixed; border-collapse: collapse; }
  .card-table tr { border-top: 1px solid #7c5b7d44; }
  .card-table th { padding: 0.2rem; text-align: left; font-size: 0.68rem; overflow-wrap: anywhere; }
  .card-table td { padding: 0.25rem; vertical-align: middle; }
  .card-table th:first-child, .card-icon { width: 64px; }
  .card-table th:nth-child(2), .chance { width: 4.5rem; }
  .card-icon img { display: block; width: 56px; height: 56px; object-fit: contain; }
  .chance { text-align: right; white-space: nowrap; font-size: 0.78rem; }
  .reward-cell { min-width: 0; }
  .drops { display: flex; flex-wrap: wrap; gap: 0.25rem 0.4rem; }
  .drop { display: inline-flex; align-items: center; gap: 0.15rem; min-width: 0; max-width: 100%; font-size: 0.72rem; }
  .drop img, .fallback { width: 24px; height: 24px; object-fit: contain; }
  .fallback { display: grid; place-items: center; border-radius: 50%; background: #7c5b7d22; }
  .drop strong { white-space: nowrap; }
</style>
