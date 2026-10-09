<script lang="ts">
  import ContentNode from './ContentNode.svelte';
  import type { ContentNode as Node } from '$lib/types/content';

  let { node }: { node: Node } = $props();
</script>

{#if node.type === 'text'}
  {node.text}
{:else if node.tag === 'br'}
  <br />
{:else}
  <svelte:element this={node.tag} {...node.attributes}>
    {#each node.children as child}
      <ContentNode node={child} />
    {/each}
  </svelte:element>
{/if}
