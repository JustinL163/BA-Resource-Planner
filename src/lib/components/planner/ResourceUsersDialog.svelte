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

<PlannerDialog title={t('ui-resource-users')} {close} {t} width="460px">
  <section aria-label={item.name}>
    <div class="resource">
      {#if item.image}<img class="resource-image" src={item.image} alt="" width="40" height="40" />{/if}
      <h3>{item.name}</h3>
    </div>

    {#if orderedUsers.length}
      <ol class="users" aria-label={t('ui-resource-users')}>
        {#each orderedUsers as user (user.id)}
          <li>
            {#if user.portrait}<img class="character-image" src={user.portrait} alt="" width="44" height="44" loading="lazy" />{/if}
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
  .resource { display: flex; align-items: center; gap: 0.55rem; margin-bottom: 0.75rem; }
  .resource-image { width: 2.5rem; height: 2.5rem; object-fit: contain; }
  h3 { margin: 0; font-size: 1rem; }
  .users { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
  li { display: grid; grid-template-columns: 2.75rem minmax(0, 1fr) auto; align-items: center; gap: 0.65rem; padding: 0.4rem 0.55rem; border: 1px solid #7c5b7d44; border-radius: 0.55rem; }
  li img { width: 2.75rem; height: 2.75rem; object-fit: cover; border-radius: 50%; }
  .name { min-width: 0; overflow-wrap: anywhere; }
  .amount { font: 600 0.95rem/1.2 monospace; font-variant-numeric: tabular-nums; }
  .empty { margin: 0; padding: 1rem 0.5rem; text-align: center; line-height: 1.5; }
</style>
