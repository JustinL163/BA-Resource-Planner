<script lang="ts">
  import ContentNode from '$lib/components/ContentNode.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.title}</title>
</svelte:head>

<h1 class:changelog-title={data.title === 'Changelog'} class:credits-title={data.title === 'Credits'}>{data.title}</h1>
<div class="document" class:changelog={data.title === 'Changelog'} class:credits={data.title === 'Credits'}>
  {#each data.content as node}
    <ContentNode {node} />
  {/each}
</div>
