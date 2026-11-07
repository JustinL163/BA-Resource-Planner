<script lang="ts">
  import { onMount } from 'svelte';
  import type { ResourceItem } from '$lib/domain/planner/catalog';
  import { formatAmount } from '$lib/domain/planner/catalog';
  import PlannerDialog from './PlannerDialog.svelte';

  export type ResourceUserRow = {
    id: string;
    name: string;
    amount: number;
    portrait: string;
  };

  let { item, users, close, t }: {
    item: ResourceItem;
    users: ResourceUserRow[];
    close: () => void;
    t: (id: string) => string;
  } = $props();

  const hideNamesPreferenceKey = 'planner-resource-users-hide-names';
  let hideNames = $state(false);
  let styleMode = $state(false);
  let stylePanelOpen = $state(false);
  let stylePanelElement = $state<HTMLDivElement>();
  let stylePanelPosition = $state({ left: 8, top: 8 });
  let orderedUsers = $derived(
    [...users]
      .filter((user) => user.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  );

  function fitUserAmount(node: HTMLElement, initialValue: string | undefined) {
    let value = initialValue;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    const container = node.parentElement;
    const baseFontSize = Number.parseFloat(getComputedStyle(node).fontSize) || 15;
    const range = document.createRange();

    function fit() {
      if (value === undefined || !container) return;
      node.style.removeProperty('font-size');
      const availableWidth = Math.max(0, node.clientWidth - 2);
      range.selectNodeContents(node);
      if (range.getBoundingClientRect().width <= availableWidth) return;

      let low = 0;
      let high = baseFontSize;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const size = (low + high) / 2;
        node.style.fontSize = `${size}px`;
        if (range.getBoundingClientRect().width <= availableWidth) low = size;
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
      update(nextValue: string | undefined) {
        value = nextValue;
        scheduleFit();
      },
      destroy() {
        observer?.disconnect();
        cancelAnimationFrame(frame);
        node.style.removeProperty('font-size');
      }
    };
  }
  function toggleStyleMode() {
    styleMode = !styleMode;
    if (!styleMode) stylePanelOpen = false;
  }

  function openStylePanel(event: MouseEvent) {
    if (!styleMode) return;
    const card = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const width = Math.min(260, window.innerWidth - 16);
    const height = Math.min(stylePanelElement?.getBoundingClientRect().height ?? 60, window.innerHeight - 16);
    const rightSpace = window.innerWidth - card.right;
    const left = rightSpace >= width + 12 ? card.right + 12 : card.left - width - 12;
    stylePanelPosition = {
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(card.top + card.height / 2 - height / 2, window.innerHeight - height - 8))
    };
    stylePanelOpen = true;
  }

  function closeStyleModeOnOutsidePointer(event: PointerEvent) {
    if (!styleMode) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-resource-users-style-toggle], .resource-users-style-panel, .users')) return;
    styleMode = false;
    stylePanelOpen = false;
  }

  function updateHideNames(value: boolean) {
    hideNames = value;
    try { localStorage.setItem(hideNamesPreferenceKey, String(value)); }
    catch { /* Keep the preference for this session if storage is unavailable. */ }
  }

  onMount(() => {
    try { hideNames = localStorage.getItem(hideNamesPreferenceKey) === 'true'; }
    catch { /* Use the default when storage is unavailable. */ }
    document.addEventListener('pointerdown', closeStyleModeOnOutsidePointer, true);
    const handleResize = () => {
      if (window.innerWidth <= 800) {
        styleMode = false;
        stylePanelOpen = false;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('pointerdown', closeStyleModeOnOutsidePointer, true);
      window.removeEventListener('resize', handleResize);
    };
  });
</script>

<PlannerDialog title={`${t('ui-resource-users')}: ${item.name}`} {close} {t} width="1300px">
  {#snippet titleContent()}
    <span class="resource-header-title">
      <span class="resource-header-context">{t('ui-resource-users')}:</span>
      {#if item.image}<img src={item.image} alt="" width="32" height="32" />{/if}
      <span class="resource-header-name">{item.name}</span>
    </span>
  {/snippet}
  {#snippet headerAccessory()}
    {#if orderedUsers.length}
      <button class="resource-users-style-toggle" data-resource-users-style-toggle type="button"
        aria-label={t('ui-customize-resource-users')} title={t('ui-customize-resource-users')}
        aria-pressed={styleMode} onclick={toggleStyleMode}>
        <span class="resource-users-style-icon" aria-hidden="true"></span>
      </button>
    {/if}
  {/snippet}
  <section class="resource-users-section" aria-label={item.name}>
    {#if orderedUsers.length}
      <ol class="users" class:style-editable={styleMode} class:hide-names={hideNames} aria-label={t('ui-resource-users')}>
        {#each orderedUsers as user (user.id)}
          <li aria-label={user.name}>
            {#if user.portrait}<img class="character-image" src={user.portrait} alt="" width="60" height="60" loading="lazy" draggable="false" />{/if}
            <span class="name">{user.name}</span>
            <strong class="amount" use:fitUserAmount={formatAmount(user.amount)}>{formatAmount(user.amount)}</strong>
            {#if styleMode}
              <button class="tile-style-trigger" type="button" aria-label={t('ui-customize-resource-users')} onclick={openStylePanel}></button>
            {/if}
          </li>
        {/each}
      </ol>
    {:else}
      <p class="empty" role="status">{t('ui-no-resource-users')}</p>
    {/if}
  </section>
  {#if styleMode && stylePanelOpen}
    <div class="resource-users-style-panel" bind:this={stylePanelElement} role="group"
      aria-label={t('ui-customize-resource-users')} style:left={`${stylePanelPosition.left}px`}
      style:top={`${stylePanelPosition.top}px`}>
      <label><input type="checkbox" checked={hideNames} onchange={(event) => updateHideNames(event.currentTarget.checked)} />
        {t('ui-hide-character-names')}</label>
    </div>
  {/if}
</PlannerDialog>

<style>
  .resource-header-title { display: flex; min-width: 0; align-items: center; gap: 0.5rem; }
  .resource-header-title img { flex: 0 0 auto; width: 2rem; height: 2rem; object-fit: contain; }
  .resource-header-context { flex: 0 0 auto; font-size: 0.75em; opacity: 0.8; }
  .resource-header-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .resource-users-section { width: 100%; }
  .users { display: grid; width: min(78rem, calc(100vw - 3.25rem)); max-width: 100%; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
  .users.hide-names { grid-template-columns: repeat(8, minmax(0, 1fr)); }
  li { position: relative; isolation: isolate; display: grid; grid-template-columns: 3.75rem minmax(0, 1fr) auto; align-items: center; gap: 0.65rem; padding: 0.4rem 0.55rem; border: 1px solid #7c5b7d44; border-radius: 0.55rem; background-color: var(--background); }
  li img { width: 3.75rem; height: 3.75rem; object-fit: cover; border-radius: 50%; }
  .name { min-width: 0; overflow-wrap: anywhere; }
  .users.hide-names .name { display: none; }
  .users.hide-names li { grid-template-columns: 3.75rem minmax(0, 1fr); }
  .amount { min-width: 0; max-width: 100%; overflow: hidden; font: 600 0.95rem/1.2 monospace; font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
  .empty { margin: 0; padding: 1rem 0.5rem; text-align: center; line-height: 1.5; }
  .resource-users-style-toggle { display: grid; flex: 0 0 auto; width: 2rem; height: 2rem; padding: 0.35rem; place-items: center; border: 1px solid #7c5b7d66; border-radius: 0.35rem; background: transparent; color: inherit; cursor: pointer; }
  .resource-users-style-toggle:hover, .resource-users-style-toggle[aria-pressed="true"] { border-color: #82dafb; background: #82dafb4d; }
  .resource-users-style-icon { display: block; width: 100%; height: 100%; background: currentColor; -webkit-mask: url('/planner/icons/UI/brush-solid-full.svg') center / contain no-repeat; mask: url('/planner/icons/UI/brush-solid-full.svg') center / contain no-repeat; }
  .users.style-editable li { cursor: pointer; }
  .users.style-editable li::before, .users.style-editable li::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
  .users.style-editable li::before { z-index: 1; background: #82dafb4d; }
  .users.style-editable li::after { z-index: 2; background: linear-gradient(135deg, transparent 43%, #bfeaff9c 50%, transparent 57%); background-size: 300% 300%; animation: resource-user-style-shine 2.8s ease-in-out infinite; }
  .tile-style-trigger { position: absolute; z-index: 3; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; border-radius: inherit; background: transparent; cursor: pointer; }
  .resource-users-style-panel { position: fixed; z-index: 30; width: max-content; max-width: min(260px, calc(100vw - 1rem)); padding: 0.55rem 0.7rem; border: 1px solid #82dafb; border-radius: 0.45rem; background: var(--surface); color: var(--text); box-shadow: 0 3px 14px #0008; }
  .resource-users-style-panel label { display: flex; flex-direction: row; align-items: center; gap: 0.45rem; margin: 0; font-size: 0.8rem; white-space: normal; }
  .resource-users-style-panel input { flex: 0 0 auto; width: 1rem; height: 1rem; margin: 0; accent-color: #82dafb; }
  @keyframes resource-user-style-shine { 0% { background-position: 0% 0%; } 24% { background-position: 100% 100%; } 24.01%, 100% { background-position: 0% 0%; } }
  @media (prefers-reduced-motion: reduce) { .users.style-editable li::after { animation: none; } }
  @media (min-width: 801px) and (max-width: 1200px) {
    .users { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .users.hide-names { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  }
  @media (max-width: 800px) {
    .users { width: 100%; grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .users.hide-names { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .resource-users-style-toggle { display: none; }
    li { grid-template-columns: minmax(0, 1fr); justify-items: center; gap: 0.25rem; padding: 0.35rem 0.2rem; }
    .name { display: none; }
    .amount { min-width: 0; max-width: 100%; overflow: hidden; font-size: clamp(0.55rem, 2.5vw, 0.75rem); white-space: nowrap; }
  }
  @media (max-width: 600px) {
    .resource-header-title { gap: 0.35rem; font-size: 0.8em; }
    .resource-header-title img { width: 1.6rem; height: 1.6rem; }
    .resource-header-context { display: none; }
    .users { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .users.hide-names { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
</style>
