<script lang="ts">
  import ContentNode from '$lib/components/ContentNode.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.title}</title>
</svelte:head>

<h1>{data.title}</h1>
<div class="document">
  {#each data.content as node}
    <ContentNode {node} />
  {/each}
</div>
