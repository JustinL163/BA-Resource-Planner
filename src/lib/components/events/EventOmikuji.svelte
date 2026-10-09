<script lang="ts">
  import type { EventReward, OmikujiDefinition, OmikujiSlip } from '$lib/domain/events/standard-types';
  import { formatAmount } from '$lib/domain/planner/catalog';

  let {
    omikuji, currency, currencyName, standardDeviation, processing, ready, sampleCount,
    canSimulate, simulate, cancel, setDeviation, item, t
  }: {
    omikuji: OmikujiDefinition;
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

  const deviationPercent: Record<string, string> = {
    '-2': '2.3', '-1.5': '6.7', '-1': '15.9', '-0.5': '30.9',
    '0.5': '30.9', '1': '15.9'
  };
  let deviationInfo = $derived(standardDeviation === 0
    ? t('label-stdinfo')
    : `${standardDeviation > 0 ? '+' : ''}${standardDeviation}σ ${t(standardDeviation < 0 ? 'label-bottom' : 'label-top')} ${deviationPercent[String(standardDeviation)]}%`);

  function adjustedProb(slip: OmikujiSlip, pullIndex: number): number {
    const weight = slip.Prob + Math.max(pullIndex + 1, 0) * slip.ProbModifyValue;
    return slip.ProbModifyLimit === 0
      ? Math.max(weight, 0)
      : Math.min(weight, slip.ProbModifyLimit);
  }
</script>

<section class="omikuji">
  <div class="summary">
    <p class="metric currency" data-event-omikuji-currency={currency}>
      <strong>{formatAmount(currency)} {currencyName}</strong>
    </p>
    <p class="metric"><span>{t('ui-event-omikuji-cost')}:</span> <strong>{formatAmount(omikuji.pull_cost)} {currencyName}</strong></p>
    <p class="metric"><span>{t('ui-event-omikuji-max')}:</span> <strong>{formatAmount(omikuji.MaxPullCount)}</strong></p>
    <p class="metric"><span>{t('ui-event-omikuji-target')}:</span> <strong>{t('label-grade')} {formatAmount(omikuji.TargetGrade)}</strong></p>
    <p class="metric"><span>{t('ui-event-omikuji-pity-start')}:</span> <strong>{formatAmount(omikuji.ProbModifyStartCount)}</strong></p>
  </div>

  <p class="overflow">
    {t('ui-event-omikuji-overflow')}: 300 Event Points = 1 {currencyName} / draw
  </p>

  <div class="simulation">
    <button type="button" data-event-omikuji-simulate disabled={processing || ready || !canSimulate} onclick={simulate}>
      {t('button-simulategacha')}
    </button>
    {#if processing}
      <button type="button" onclick={cancel}>{t('label-cancel')}</button>
    {/if}
    <label class="rng">
      <span>{t('label-rngadjust')}</span>
      <input type="range" min="-2" max="1" step="0.5" value={standardDeviation}
        aria-label={t('label-rngadjust')} data-event-omikuji-sd
        onchange={(event) => setDeviation(event.currentTarget.valueAsNumber)} />
    </label>
    <p class="deviation-info">{deviationInfo}</p>
  </div>

  <p class="status" aria-live="polite">
    {#if processing}
      {t('ui-event-omikuji-running')}
    {:else if ready}
      {t('ui-event-omikuji-ready')}
      {#if sampleCount !== null} · {t('ui-event-omikuji-attempts')}: {formatAmount(sampleCount)}{/if}
    {:else if !canSimulate}
      {t('ui-event-omikuji-plan-first')}
    {/if}
  </p>

  <details data-event-omikuji-reference>
    <summary>{t('ui-event-omikuji-reference')}</summary>
    <div class="reference-grid">
      {#each omikuji.slips as slip, index}
        {@const firstAdjustedWeight = adjustedProb(slip, 0)}
        {@const baseChance = slip.Prob / 10000}
        {@const firstAdjustedChance = firstAdjustedWeight / 10000}
        <article class="slip" data-event-omikuji-slip={index} data-event-omikuji-grade={slip.Grade}
          data-event-omikuji-base-prob={baseChance} data-event-omikuji-adjusted-prob={firstAdjustedChance}>
          <header class="slip-heading">
            <strong>#{formatAmount(index + 1)}</strong>
            <strong>{t('label-grade')} {formatAmount(slip.Grade)}</strong>
          </header>
          <dl class="slip-stats">
            <div>
              <dt>{t('label-chance')} (Prob / 100)</dt>
              <dd>{(baseChance * 100).toFixed(2)}%</dd>
            </div>
            <div>
              <dt>Prob</dt>
              <dd>{formatAmount(slip.Prob)}</dd>
            </div>
            <div>
              <dt>adjustedProb(0)</dt>
              <dd>{(firstAdjustedChance * 100).toFixed(2)}% <small>({firstAdjustedChance.toFixed(4)})</small></dd>
            </div>
          </dl>
          <div class="rewards">
            {#each slip.RewardId as rewardId, rewardIndex (rewardIndex)}
              {@const amount = slip.RewardAmount[rewardIndex] ?? 0}
              {@const reward = item({ id: rewardId, count: amount, type: 'StageDrop' })}
              <span class="reward" title={`${reward.name}: ${formatAmount(amount)}`}
                aria-label={`${reward.name}: ${formatAmount(amount)}`} data-event-omikuji-reward={rewardId}>
                {#if reward.image}
                  <img src={reward.image} alt="" />
                {:else}
                  <span class="fallback" aria-hidden="true">{reward.name.slice(0, 1)}</span>
                {/if}
                <span class="reward-copy">
                  <span class="reward-name">{reward.name}</span>
                  <strong>x{formatAmount(amount)}</strong>
                </span>
              </span>
            {/each}
          </div>
        </article>
      {/each}
    </div>
  </details>
</section>

<style>
  .omikuji { min-width: 0; color: var(--text); overflow-wrap: anywhere; }
  p { margin: 0 0 0.35rem; font-size: 0.78rem; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr)); gap: 0.3rem; }
  .metric { min-width: 0; margin: 0; padding: 0.3rem 0.4rem; border: 1px solid #7c5b7d44; border-radius: 0.35rem; background: var(--surface); }
  .metric strong { margin-left: 0.15rem; }
  .currency { border-color: #7c5b7d88; }
  .overflow { margin: 0.35rem 0; font-size: 0.74rem; }
  .simulation { display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem 0.55rem; }
  button { padding: 0.25rem 0.45rem; color: inherit; background: var(--surface); border: 1px solid #7c5b7d66; border-radius: 0.35rem; cursor: pointer; }
  button:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid #7c5b7d; outline-offset: 2px; }
  button:disabled { cursor: not-allowed; opacity: 0.55; }
  .rng { display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; }
  .rng input { width: min(10rem, 32vw); accent-color: #7c5b7d; }
  .deviation-info { flex-basis: 100%; margin: 0; }
  .status { min-height: 1em; margin: 0.35rem 0; }
  details { min-width: 0; border-top: 1px solid #7c5b7d44; }
  summary { padding: 0.35rem 0; cursor: pointer; font-size: 0.78rem; font-weight: 700; }
  .reference-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 0.4rem; }
  .slip { min-width: 0; padding: 0.4rem; border: 1px solid #7c5b7d44; border-radius: 0.35rem; background: var(--surface); }
  .slip-heading { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.2rem 0.5rem; font-size: 0.78rem; }
  .slip-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.25rem; margin: 0.35rem 0; }
  .slip-stats div { min-width: 0; padding: 0.25rem; background: #7c5b7d0d; border-radius: 0.25rem; }
  dt { font-size: 0.65rem; opacity: 0.78; }
  dd { margin: 0.1rem 0 0; font-size: 0.74rem; font-weight: 700; }
  dd small { font-size: 0.65rem; font-weight: 400; }
  .rewards { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .reward { display: inline-flex; align-items: center; gap: 0.3rem; min-width: 0; max-width: 100%; padding: 0.2rem; border: 1px solid #7c5b7d33; border-radius: 0.3rem; font-size: 0.7rem; }
  .reward img, .fallback { flex: 0 0 32px; width: 32px; height: 32px; object-fit: contain; }
  .fallback { display: grid; place-items: center; border-radius: 50%; background: #7c5b7d22; }
  .reward-copy { display: flex; flex-direction: column; min-width: 0; }
  .reward-name { overflow-wrap: anywhere; }
  .reward-copy strong { white-space: nowrap; }

  @media (max-width: 40rem) {
    .reference-grid { grid-template-columns: minmax(0, 1fr); }
    .slip-stats { grid-template-columns: minmax(0, 1fr); }
  }
</style>
