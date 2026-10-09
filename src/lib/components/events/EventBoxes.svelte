<script lang="ts">
  import type { BoxCycle, EventReward } from '$lib/domain/events/standard-types';

  let { boxes, item, t }: {
    boxes: BoxCycle[];
    item: (reward: EventReward) => { name: string; image?: string };
    t: (id: string) => string;
  } = $props();

  let selectedIndex = $state(0);
  let activeIndex = $derived(selectedIndex >= 0 && selectedIndex < boxes.length ? selectedIndex : 0);
  let selectedBox = $derived(boxes[activeIndex]);

  function cycleLabel(cycle: string[]): string {
    return cycle.length > 1 ? cycle.join('/') : `${cycle[0] ?? ''}+`;
  }
</script>

<section class="boxes">
  <p class="help">{t('ui-event-box-help')}</p>
  <div class="cycle-tabs" role="group" aria-label={t('label-tabboxes')}>
    {#each boxes as box, index (index)}
      <button type="button" class="cycle-tab" data-event-box-cycle={index}
        aria-pressed={activeIndex === index} onclick={() => selectedIndex = index}>
        {cycleLabel(box.cycle)}
      </button>
    {/each}
  </div>
  {#if selectedBox}
    <div class="reward-grid">
      {#each selectedBox.rewards as reward, index (index)}
        {@const product = item(reward)}
        <article class="reward" data-event-box-reward={String(reward.id)}
          data-event-box-stock={reward.count} data-event-box-amount={reward.amount} title={product.name}>
          {#if product.image}<img src={product.image} alt="" />{/if}
          <span class="reward-name">{product.name}</span>
          <span class="quantity"><span>{t('ui-event-box-amount')}</span><strong>{reward.amount}</strong></span>
          <span class="quantity"><span>{t('ui-event-box-count')}</span><strong>{reward.count}</strong></span>
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .boxes { min-width: 0; color: var(--text); }
  .help { margin: 0 0 0.4rem; font-size: 0.78rem; }
  .cycle-tabs { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.5rem; }
  button { padding: 0.25rem 0.45rem; color: inherit; background: var(--surface); border: 1px solid #7c5b7d66; border-radius: 0.35rem; cursor: pointer; }
  button:focus-visible { outline: 2px solid #7c5b7d; outline-offset: 2px; }
  .cycle-tab[aria-pressed="true"] { border-color: #7c5b7d; background: #7c5b7d22; }
  .reward-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 6rem), 1fr)); gap: 0.35rem; }
  .reward { box-sizing: border-box; display: flex; flex-direction: column; gap: 0.18rem; min-width: 0; max-width: 7.5rem; padding: 0.3rem; border: 1px solid #7c5b7d44; border-radius: 0.35rem; }
  .reward img { align-self: center; width: 44px; height: 44px; object-fit: contain; }
  .reward-name { overflow: hidden; font-size: 0.75rem; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
  .quantity { display: flex; justify-content: space-between; gap: 0.2rem; min-width: 0; font-size: 0.68rem; line-height: 1.2; }
  .quantity span { min-width: 0; overflow-wrap: anywhere; }
  .quantity strong { white-space: nowrap; }
</style>
