<script lang="ts">
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import type { ResourceItem } from '$lib/domain/planner/catalog';
  import { formatAmount } from '$lib/domain/planner/catalog';
  import type { ResourceTotals } from '$lib/domain/planner/types';
  export type ResourceMode = 'needed' | 'required' | 'leftover' | 'owned';

  let { item, totals, mode, setOwned, t, userCount = 0, showUsers, inlineAmount = false }: {
    item: ResourceItem; totals: ResourceTotals; mode: ResourceMode;
    setOwned: (key: string, amount: number) => boolean; t: (id: string) => string;
    userCount?: number; showUsers?: () => void; inlineAmount?: boolean;
  } = $props();
  let amount = $derived(totals[mode][item.key] ?? 0);
  let amountLabel = $derived(formatAmount(amount));
  let editable = $derived(mode === 'owned' && !['Xp', 'GearXp', 'Eleph', 'ShopResets'].includes(item.key) && !item.key.endsWith('Cost'));
  let hasUsers = $derived(mode !== 'owned' && userCount > 0 && showUsers !== undefined);
  const label = () => t({ needed: 'label-remainingneeded', required: 'label-totalneeded', leftover: 'label-leftover', owned: 'label-owned' }[mode]);

  type FitLayout = 'inline-amount' | 'cell-amount' | 'name';
  type FitArgument = { text: string; layout: FitLayout };

  function fitResourceText(node: HTMLElement, initialValue: FitArgument | undefined) {
    if (initialValue === undefined) return {};

    let value: string | undefined = initialValue.text;
    let layout = initialValue.layout;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    const container = node.parentElement;
    const baseFontSize = Number.parseFloat(getComputedStyle(node).fontSize) || 24;
    const range = document.createRange();

    function fit() {
      if (value === undefined || !container) return;
      const siblings = [...container.children].filter((child) => {
        if (child === node || layout !== 'inline-amount') return false;
        const position = getComputedStyle(child).position;
        return position !== 'absolute' && position !== 'fixed';
      });
      const style = getComputedStyle(container);
      const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      const gap = Number.parseFloat(style.columnGap) || Number.parseFloat(style.gap) || 0;
      const occupied = siblings.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) + gap * siblings.length;
      const availableWidth = Math.max(0, (layout === 'name' ? node.clientWidth : container.clientWidth) - padding - occupied - 2);
      const availableHeight = layout === 'name' ? Math.max(0, container.clientHeight * 0.4) : Number.POSITIVE_INFINITY;
      node.style.removeProperty('font-size');
      range.selectNodeContents(node);
      const fits = () => {
        const bounds = range.getBoundingClientRect();
        return bounds.width <= availableWidth && bounds.height <= availableHeight;
      };
      if (fits()) return;

      let low = 0;
      let high = baseFontSize;
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

    function observe() {
      if (value !== undefined && container && !observer && typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(scheduleFit);
        observer.observe(container);
      }
      scheduleFit();
    }

    observe();
    return {
      update(nextValue: FitArgument | undefined) {
        value = nextValue?.text;
        if (nextValue === undefined) {
          observer?.disconnect();
          observer = undefined;
          node.style.removeProperty('font-size');
        } else {
          layout = nextValue.layout;
          observe();
        }
      },
      destroy() {
        observer?.disconnect();
        cancelAnimationFrame(frame);
        node.style.removeProperty('font-size');
      }
    };
  }
</script>

{#if editable}
  <div class="resource-cell editable" class:inline-amount={inlineAmount} class:zero={Number(amount) === 0} data-resource={item.key} title={`${item.name}: ${amountLabel}`}>
    {#if item.image}<img class="resource-image" src={item.image} alt="" loading="lazy" draggable="false" />
    {:else}<span class="resource-name" use:fitResourceText={{ text: item.name, layout: 'name' }}>{item.name}</span>{/if}
    <span class="amount" use:fitResourceText={{ text: amountLabel, layout: inlineAmount ? 'inline-amount' : 'cell-amount' }} aria-hidden="true">{amountLabel}</span>
    <input use:sanitizeIntegerInput class="resource-input" type="number" aria-label={`${t('label-owned')} ${item.name}`} min="0" step="1"
      value={amount}
      onchange={(event) => {
        const input = event.currentTarget;
        if (!setOwned(item.key, input.valueAsNumber)) input.value = String(totals.owned[item.key] ?? 0);
      }} />
  </div>
{:else if hasUsers}
  <button class="resource-cell user-breakdown" class:inline-amount={inlineAmount} class:zero={Number(amount) === 0} type="button" data-resource={item.key}
    title={`${item.name}: ${amountLabel}`}
    aria-label={`${t('ui-resource-users')}: ${item.name}. ${label()}: ${amountLabel}. ${userCount}`}
    onclick={() => showUsers?.()}>
    {#if item.image}<img class="resource-image" src={item.image} alt="" loading="lazy" draggable="false" />
    {:else}<span class="resource-name" use:fitResourceText={{ text: item.name, layout: 'name' }}>{item.name}</span>{/if}
    <span class="amount" use:fitResourceText={{ text: amountLabel, layout: inlineAmount ? 'inline-amount' : 'cell-amount' }} data-value={mode}>{amountLabel}</span>
  </button>
{:else}
  <div class="resource-cell" class:inline-amount={inlineAmount} class:zero={Number(amount) === 0} data-resource={item.key} title={`${item.name}: ${amountLabel}`}>
    {#if item.image}<img class="resource-image" src={item.image} alt="" loading="lazy" draggable="false" />
    {:else}<span class="resource-name" use:fitResourceText={{ text: item.name, layout: 'name' }}>{item.name}</span>{/if}
    <span class="amount" use:fitResourceText={{ text: amountLabel, layout: inlineAmount ? 'inline-amount' : 'cell-amount' }} data-value={mode} aria-label={`${item.name}, ${label()}: ${amountLabel}`}>{amountLabel}</span>
  </div>
{/if}

<style>
  .resource-cell { position: relative; display: block; box-sizing: border-box; width: 100%; min-width: 52px; min-height: 54px; padding: 0; overflow: hidden; }
  .resource-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; transition: opacity 120ms ease; }
  .resource-cell.zero .resource-image { opacity: 0.2; }
  .resource-cell.zero .amount { visibility: hidden; }
  .amount { position: absolute; z-index: 1; top: 50%; left: 50%; transform: translate(-50%, -50%); max-width: 100%; color: #17151a; font: 700 1.5rem/1.1 sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; text-align: center; text-shadow: -1px -1px 0 #fff, 0 -1px 0 #fff, 1px -1px 0 #fff, -1px 0 0 #fff, 1px 0 0 #fff, -1px 1px 0 #fff, 0 1px 0 #fff, 1px 1px 0 #fff; pointer-events: none; }
  .resource-name { position: absolute; z-index: 1; inset: 2px 2px auto; overflow: hidden; color: #17151a; font-size: 0.65rem; line-height: 1.05; text-align: center; text-overflow: ellipsis; white-space: nowrap; overflow-wrap: normal; text-shadow: -1px -1px 0 #fff, 0 -1px 0 #fff, 1px -1px 0 #fff, -1px 0 0 #fff, 1px 0 0 #fff, -1px 1px 0 #fff, 0 1px 0 #fff, 1px 1px 0 #fff; pointer-events: none; }
  .resource-input { position: absolute; z-index: 2; top: 50%; left: 50%; width: 82%; min-width: 40px; max-width: calc(100% - 4px); height: 52%; min-height: 1.5rem; box-sizing: border-box; padding: 0.1rem; transform: translate(-50%, -50%); border: 1px solid #5e5263; border-radius: 0.2rem; background: var(--surface); color: var(--text); text-align: center; font: 600 0.85rem/1 monospace; opacity: 0; }
  .resource-input[type="number"] { appearance: textfield; -moz-appearance: textfield; }
  .resource-input::-webkit-inner-spin-button, .resource-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  .editable:hover .resource-input, .editable:focus-within .resource-input { opacity: 1; }
  .editable:hover .amount, .editable:focus-within .amount { visibility: hidden; }
  .resource-input:focus-visible { outline: 2px solid #7c5b7d; outline-offset: 1px; }
  .inline-amount { display: flex; align-items: center; justify-content: center; gap: 0.5rem; aspect-ratio: auto; padding: 0 0.4rem; }
  .inline-amount .resource-image { position: static; flex: 0 0 40px; width: 40px; height: 40px; }
  .inline-amount .resource-name { position: static; flex: 0 1 auto; text-align: left; }
  .inline-amount .amount { position: static; flex: 0 1 auto; min-width: 0; max-width: 100%; margin-left: 0; transform: none; }
  .inline-amount .resource-input { left: auto; right: 0.35rem; width: 58%; max-width: calc(100% - 48px); transform: translateY(-50%); }
  .user-breakdown { appearance: none; border: 0; background: transparent; color: inherit; font: inherit; text-align: center; cursor: pointer; }
  .user-breakdown:hover { outline: 2px solid #7c5b7d88; outline-offset: 1px; }
  .user-breakdown:focus-visible { outline: 3px solid #7c5b7d; outline-offset: 2px; }
  :global(.site[data-theme="dark"]) .resource-image { filter: brightness(0.9); }
</style>
