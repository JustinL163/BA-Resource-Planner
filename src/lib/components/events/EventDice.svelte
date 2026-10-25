<script lang="ts">
  import type { DiceRace, DiceReward, EventReward } from '$lib/domain/events/standard-types';
  import { formatAmount } from '$lib/domain/planner/catalog';

  let {
    race, currency, currencyName, standardDeviation, processing, ready, sampleCount,
    canSimulate, simulate, cancel, setDeviation, item, t
  }: {
    race: DiceRace;
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
    : `${standardDeviation}σ ${t(standardDeviation < 0 ? 'label-bottom' : 'label-top')} ${deviationPercent[String(standardDeviation)]}%`);
</script>

{#snippet diceReward(reward: DiceReward)}
  {@const id = reward.id ?? reward.type}
  {@const amount = reward.amount ?? 1}
  {#if reward.type === 'FixedDice'}
    <span class="special" title={t('ui-event-dice-fixed')} aria-label={`${t('ui-event-dice-fixed')}: 1 ${t('ui-event-dice-ticket')}`}
      data-event-dice-reward={id}>
      <span>{t('ui-event-dice-fixed')}</span>
      <strong>1 {t('ui-event-dice-ticket')}</strong>
    </span>
  {:else if reward.type === 'MoveBonus'}
    <span class="special" title={t('ui-event-dice-move')} aria-label={`${t('ui-event-dice-move')}: ${formatAmount(amount)}`}
      data-event-dice-reward={id}>
      <span>{t('ui-event-dice-move')}</span>
      <strong>+{formatAmount(amount)}</strong>
    </span>
  {:else}
    {@const info = item({ type: reward.type, id: reward.id ?? reward.type, count: reward.amount ?? 1 })}
    <span class="reward" title={info.name} aria-label={`${info.name}: ${formatAmount(amount)}`}
      data-event-dice-reward={id}>
      {#if info.image}
        <img src={info.image} alt={info.name} />
      {:else}
        <span class="fallback" aria-hidden="true">{info.name.slice(0, 1)}</span>
      {/if}
      <strong>{formatAmount(amount)}</strong>
    </span>
  {/if}
{/snippet}

<section class="dice">
  <p class="strategy">{t('ui-event-dice-strategy')}</p>
  <p class="currency" data-event-dice-currency={currency}>{formatAmount(currency)} {currencyName}</p>
  <p class="cost">{t('ui-event-dice-cost')}: {formatAmount(race.roll_cost)} {currencyName}</p>

  <div class="simulation">
    <button type="button" data-event-dice-simulate disabled={processing || ready || !canSimulate} onclick={simulate}>
      {t('button-simulategacha')}
    </button>
    {#if processing}
      <button type="button" onclick={cancel}>{t('label-cancel')}</button>
    {/if}
    <label class="rng">
      <span>{t('label-rngadjust')}</span>
      <input type="range" min="-2" max="1" step="0.5" value={standardDeviation}
        aria-label={t('label-rngadjust')} data-event-dice-sd
        onchange={(event) => setDeviation(event.currentTarget.valueAsNumber)} />
    </label>
    <p class="deviation-info">{deviationInfo}</p>
  </div>

  <p class="status" aria-live="polite">
    {#if processing}
      {t('ui-event-dice-running')}
    {:else if ready}
      {t('ui-event-dice-ready')}
      {#if sampleCount !== null} · {t('ui-event-card-attempts')}: {formatAmount(sampleCount)}{/if}
    {:else if !canSimulate}
      {t('ui-event-dice-plan-first')}
    {/if}
  </p>

  <details class="reference" data-event-dice-reference>
    <summary>{t('ui-event-dice-reference')}</summary>
    <p class="legacy">{t('ui-event-dice-legacy-summary')}</p>
    <div class="tiles" role="list" aria-label={t('ui-event-dice-reference')}>
      {#each race.tiles as reward, index}
        <div class="tile" role="listitem" data-event-dice-tile={index}>
          <span class="tile-label">{t('ui-event-dice-tile')} {index}</span>
          <div class="tile-reward">{@render diceReward(reward)}</div>
        </div>
      {/each}
    </div>
    <div class="laps" role="list">
      {#each race.lap_rewards as rewards, index}
        {@const threshold = race.lap_reward_tiers[index]}
        <div class="lap" role="listitem" data-event-dice-lap={threshold}>
          <strong class="threshold">{t('ui-event-dice-lap')} {threshold}</strong>
          <div class="lap-rewards">
            {#each rewards as reward}
              {@render diceReward(reward)}
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </details>
</section>

<style>
  .dice { min-width: 0; max-width: 100%; color: var(--text); }
  p { margin: 0 0 0.35rem; font-size: 0.78rem; overflow-wrap: anywhere; }
  .strategy { margin-bottom: 0.2rem; }
  .currency { font-weight: 700; }
  .cost { opacity: 0.78; }
  .simulation { display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem 0.55rem; }
  button { padding: 0.25rem 0.45rem; color: inherit; background: var(--surface); border: 1px solid #7c5b7d66; border-radius: 0.35rem; cursor: pointer; }
  button:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid #7c5b7d; outline-offset: 2px; }
  button:disabled { cursor: not-allowed; opacity: 0.55; }
  .rng { display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; }
  .rng input { width: min(10rem, 32vw); accent-color: #7c5b7d; }
  .deviation-info { flex-basis: 100%; margin: 0; }
  .status { min-height: 1em; margin: 0.35rem 0; }
  .reference { min-width: 0; margin-top: 0.45rem; }
  summary { width: fit-content; color: inherit; cursor: pointer; }
  .legacy { margin: 0.35rem 0; font-size: 0.7rem; opacity: 0.8; }
  .tiles { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.25rem; }
  .tile { display: flex; min-width: 0; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.25rem 0.1rem; text-align: center; background: var(--surface); border: 1px solid #7c5b7d44; border-radius: 0.35rem; }
  .tile-label { font-size: 0.62rem; line-height: 1.2; overflow-wrap: anywhere; }
  .tile-reward { display: flex; min-width: 0; max-width: 100%; justify-content: center; }
  .tile-reward .reward { flex-wrap: wrap; min-width: 0; }
  .tile-reward .reward strong { white-space: normal; overflow-wrap: anywhere; }
  .tile-reward .special { justify-content: center; }
  .laps { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); gap: 0.25rem; margin-top: 0.35rem; }
  .lap { display: flex; min-width: 0; align-items: flex-start; gap: 0.35rem; padding: 0.3rem; background: var(--surface); border: 1px solid #7c5b7d44; border-radius: 0.35rem; }
  .threshold { flex: 0 0 auto; font-size: 0.7rem; }
  .lap-rewards { display: flex; min-width: 0; flex-wrap: wrap; gap: 0.25rem; }
  .reward, .special { display: inline-flex; min-width: 0; max-width: 100%; align-items: center; justify-content: center; gap: 0.15rem; font-size: 0.68rem; }
  .reward img, .fallback { width: 24px; height: 24px; object-fit: contain; }
  .fallback { display: grid; flex: 0 0 24px; place-items: center; border-radius: 50%; background: #7c5b7d22; }
  .reward strong, .special strong { white-space: nowrap; }
  .special { flex-wrap: wrap; justify-content: flex-start; overflow-wrap: anywhere; }
  @media (max-width: 600px) {
    .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
</style>
