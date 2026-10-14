<script lang="ts">
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

  let orderedUsers = $derived(
    [...users]
      .filter((user) => user.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  );
</script>

<PlannerDialog title={`${t('ui-resource-users')}: ${item.name}`} {close} {t} width="1100px">
  {#snippet titleContent()}
    <span class="resource-header-title">
      <span class="resource-header-context">{t('ui-resource-users')}:</span>
      {#if item.image}<img src={item.image} alt="" width="32" height="32" />{/if}
      <span class="resource-header-name">{item.name}</span>
    </span>
  {/snippet}
  <section aria-label={item.name}>
    {#if orderedUsers.length}
      <ol class="users" aria-label={t('ui-resource-users')}>
        {#each orderedUsers as user (user.id)}
          <li aria-label={user.name}>
            {#if user.portrait}<img class="character-image" src={user.portrait} alt="" width="60" height="60" loading="lazy" />{/if}
            <span class="name">{user.name}</span>
            <strong class="amount">{formatAmount(user.amount)}</strong>
          </li>
        {/each}
      </ol>
    {:else}
      <p class="empty" role="status">{t('ui-no-resource-users')}</p>
    {/if}
  </section>
</PlannerDialog>

<style>
  .resource-header-title { display: flex; min-width: 0; align-items: center; gap: 0.5rem; }
  .resource-header-title img { flex: 0 0 auto; width: 2rem; height: 2rem; object-fit: contain; }
  .resource-header-context { flex: 0 0 auto; font-size: 0.75em; opacity: 0.8; }
  .resource-header-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .users { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
  li { display: grid; grid-template-columns: 3.75rem minmax(0, 1fr) auto; align-items: center; gap: 0.65rem; padding: 0.4rem 0.55rem; border: 1px solid #7c5b7d44; border-radius: 0.55rem; background-color: var(--background); }
  li img { width: 3.75rem; height: 3.75rem; object-fit: cover; border-radius: 50%; }
  .name { min-width: 0; overflow-wrap: anywhere; }
  .amount { font: 600 0.95rem/1.2 monospace; font-variant-numeric: tabular-nums; }
  .empty { margin: 0; padding: 1rem 0.5rem; text-align: center; line-height: 1.5; }
  @media (max-width: 1200px) {
    .users { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 800px) {
    .users { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    li { grid-template-columns: minmax(0, 1fr); justify-items: center; gap: 0.25rem; padding: 0.35rem 0.2rem; }
    .name { display: none; }
    .amount { min-width: 0; max-width: 100%; overflow: hidden; font-size: clamp(0.55rem, 2.5vw, 0.75rem); white-space: nowrap; }
  }
  @media (max-width: 600px) {
    .resource-header-title { gap: 0.35rem; font-size: 0.8em; }
    .resource-header-title img { width: 1.6rem; height: 1.6rem; }
    .resource-header-context { display: none; }
    .users { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
</style>
