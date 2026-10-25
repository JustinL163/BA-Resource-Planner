<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { localSaveEvent, localSavePendingEvent } from '$lib/services/save-events';

  let { message }: { message: string } = $props();
  let visible = $state(false);
  let toastElement: HTMLDivElement | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    const showToast = async () => {
      visible = true;
      await tick();
      if (toastElement && typeof toastElement.showPopover === 'function' && !toastElement.matches(':popover-open')) {
        toastElement.showPopover();
      }
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (toastElement && typeof toastElement.hidePopover === 'function' && toastElement.matches(':popover-open')) {
          toastElement.hidePopover();
        }
        visible = false;
        timeout = undefined;
      }, 1500);
    };

    const hideToast = () => {
      if (timeout) clearTimeout(timeout);
      timeout = undefined;
      if (toastElement && typeof toastElement.hidePopover === 'function' && toastElement.matches(':popover-open')) {
        toastElement.hidePopover();
      }
      visible = false;
    };

    const onSave = () => { void showToast(); };
    window.addEventListener(localSavePendingEvent, hideToast);
    window.addEventListener(localSaveEvent, onSave);
    return () => {
      window.removeEventListener(localSavePendingEvent, hideToast);
      window.removeEventListener(localSaveEvent, onSave);
      if (timeout) clearTimeout(timeout);
    };
  });
</script>

{#if visible}
  <div bind:this={toastElement} class="saved-toast" popover="manual" role="status" aria-live="polite" aria-atomic="true">{message}</div>
{/if}

<style>
  .saved-toast {
    position: fixed;
    z-index: 1000;
    pointer-events: none;
    margin: 0;
    inset: auto;
    top: max(0.75rem, env(safe-area-inset-top));
    left: max(0.75rem, env(safe-area-inset-left));
    max-width: min(24rem, calc(100vw - 1.5rem));
    padding: 0.65rem 1rem;
    border: 1px solid #7c5b7d66;
    border-radius: 0.45rem;
    background: var(--background);
    color: var(--text);
    box-shadow: 0 2px 12px #0005;
    animation: toast-in 160ms ease-out;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateY(-0.35rem); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .saved-toast { animation: none; }
  }
</style>
