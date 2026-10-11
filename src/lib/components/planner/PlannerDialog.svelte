<script lang="ts">
  import type { Snippet } from 'svelte';
  import { modal } from './dialog';
  let { title, close, children, width = '1300px', busy = false, t }: {
    title: string; close: () => void; children: Snippet; width?: string; busy?: boolean; t: (id: string) => string;
  } = $props();
</script>

<dialog use:modal aria-label={title} aria-busy={busy} style:--dialog-width={width} oncancel={(event) => { event.preventDefault(); if (!busy) close(); }}
  onclick={(event) => {
    if (busy || event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  }}>
  <header><h2>{title}</h2><button disabled={busy} onclick={close} aria-label={`${t('ui-close')} ${title}`}>{t('ui-close')}</button></header>
  <div class="content">{@render children()}</div>
</dialog>

<style>
  dialog { width: fit-content; max-width: min(var(--dialog-width), calc(100vw - 1rem)); max-height: 88dvh; padding: 0; background: var(--surface); color: var(--text); border: 1px solid #7c5b7d; border-radius: 1.1rem; overflow-y: auto; overscroll-behavior: contain; }
  dialog::backdrop { background: #000a; }
  header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.7rem 1rem; background: var(--surface); border-bottom: 1px solid #7c5b7d66; }
  h2 { margin: 0; font-size: 1.25rem; }
  .content { padding: 0.75rem 1rem 1rem; }
  @media (max-width: 480px) { .content { padding: 0.6rem; } header { padding: 0.6rem; } }
  @media (max-width: 600px) { dialog { width: 100vw; max-width: 100vw; margin-inline: 0; } }
</style>
