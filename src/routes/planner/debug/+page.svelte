<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getTranslationStrings } from '$lib/domain/localisation';
  import strings from '$content/strings.json';

  let language = $derived(
    browser
      ? page.url.searchParams.get('translated') || page.url.searchParams.get('untranslated')
      : null
  );
  let translated = $derived(browser && Boolean(page.url.searchParams.get('translated')));
  let output = $derived(
    language && language.toLowerCase() !== 'en'
      ? JSON.stringify(getTranslationStrings(strings, language, translated), null, 4)
      : ''
  );
</script>

<svelte:head>
  <title>Translation tools</title>
</svelte:head>

<h1>Translation tools</h1>
{#if !language}
  <p>Use <code>?untranslated=KR</code> or <code>?translated=KR</code> to inspect translations.</p>
{/if}
<pre id="text-body">{output}</pre>

<style>
  pre { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
