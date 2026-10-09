<script lang="ts">
  import type { ResourceItem } from '$lib/domain/planner/catalog';
  import { formatAmount } from '$lib/domain/planner/catalog';
  import type { ResourceTotals } from '$lib/domain/planner/types';
  export type ResourceMode = 'needed' | 'required' | 'leftover' | 'owned';

  let { item, totals, mode, setOwned, t }: {
    item: ResourceItem; totals: ResourceTotals; mode: ResourceMode;
    setOwned: (key: string, amount: number) => boolean; t: (id: string) => string;
  } = $props();
  let amount = $derived(totals[mode][item.key] ?? 0);
  let editable = $derived(mode === 'owned' && !['Xp', 'GearXp', 'Eleph', 'ShopResets'].includes(item.key) && !item.key.endsWith('Cost'));
  const label = () => t({ needed: 'label-remainingneeded', required: 'label-totalneeded', leftover: 'label-leftover', owned: 'label-owned' }[mode]);
</script>

<div class="resource-cell" data-resource={item.key} title={`${item.name}: ${formatAmount(amount)}`}>
  {#if item.image}<img src={item.image} alt={item.name} loading="lazy" draggable="false" width="40" height="40" />
  {:else}<span class="resource-name">{item.name}</span>{/if}
  {#if editable}
    <input type="number" aria-label={`${t('label-owned')} ${item.name}`} min="0" step="1"
      value={amount}
      onchange={(event) => {
        const input = event.currentTarget;
        if (!setOwned(item.key, input.valueAsNumber)) input.value = String(totals.owned[item.key] ?? 0);
      }} />
  {:else}
    <span class="amount" data-value={mode} aria-label={`${item.name}, ${label()}: ${formatAmount(amount)}`}>{formatAmount(amount)}</span>
  {/if}
</div>

<style>
  .resource-cell { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; min-height: 54px; padding: 0.12rem; }
  img { width: 36px; height: 36px; object-fit: contain; }
  .amount { font: 600 0.85rem/1.3 monospace; white-space: nowrap; }
  .resource-name { font-size: 0.8rem; text-align: center; overflow-wrap: anywhere; max-width: 115px; }
  input { width: 100%; min-width: 46px; max-width: 105px; padding: 0.15rem 0.05rem; text-align: center; font: 0.85rem monospace; }
</style>
