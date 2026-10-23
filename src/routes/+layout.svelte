<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { afterNavigate } from '$app/navigation';
  import type { Snippet } from 'svelte';
  import { languageOptions, getLanguageString } from '$lib/domain/localisation';
  import { preferences } from '$lib/stores/preferences';
  import { styleEditorActive, styleEditorAvailable } from '$lib/stores/style-editor';
  import { saveChangedEvent } from '$lib/services/save-events';
  import SavedToast from '$lib/components/planner/SavedToast.svelte';
  import strings from '$content/strings.json';
  import './site.css';

  let { children }: { children: Snippet } = $props();
  let menuOpen = $state(false);
  const standaloneGame = $derived(page.url.pathname.startsWith('/game/'));
  const canStyleCharacterCards = $derived(page.url.pathname.startsWith('/planner/resources') && $styleEditorAvailable);
  const links = [
    { href: '/planner/resources/', label: 'page-resource-planner' },
    { href: '/planner/event-planner/', label: 'page-event-planner' },
    { href: '/planner/raids/', label: 'page-raids' },
    { href: '/game/', label: 'page-guesser' },
    { href: '/planner/changelog/', label: 'page-changelog' },
    { href: '/planner/privacy/', label: 'page-privacy' },
    { href: '/planner/credit/', label: 'page-credit' }
  ];

  function registerPageServiceWorker(pathname = page.url.pathname) {
    if (!('serviceWorker' in navigator)) return;
    const scriptUrl = pathname.startsWith('/game/') ? '/game/sw-game.js' : '/planner/sw.js';
    void navigator.serviceWorker.register(scriptUrl).catch((error: unknown) => {
      console.warn('Service worker registration failed.', error);
    });
  }

  onMount(() => {
    preferences.initialise();
    registerPageServiceWorker();
    const refreshPreferences = (event: StorageEvent) => {
      if (event.key === 'save-data' || event.key === null) preferences.initialise();
    };
    window.addEventListener('storage', refreshPreferences);
    const refreshLocalPreferences = () => preferences.initialise();
    window.addEventListener(saveChangedEvent, refreshLocalPreferences);
    window.dataLayer ??= [];
    window.dataLayer.push(['js', new Date()]);
    return () => {
      window.removeEventListener('storage', refreshPreferences);
      window.removeEventListener(saveChangedEvent, refreshLocalPreferences);
    };
  });

  afterNavigate(() => {
    menuOpen = false;
    if (!page.url.pathname.startsWith('/planner/resources')) {
      styleEditorActive.set(false);
      styleEditorAvailable.set(false);
    }
    registerPageServiceWorker();
  });

  $effect(() => {
    const path = page.url.pathname;
    if (window.dataLayer) window.dataLayer.push(['config', 'G-3XZ18739WF', { page_path: path }]);
  });
</script>

<svelte:head>
  <link rel="manifest" href={standaloneGame ? '/game/manifest.json' : '/planner/manifest.json'} />
  <meta name="theme-color" content="#7c5b7d" />
  <script src="/planner/js/no-image-drag.js" defer></script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-3XZ18739WF"></script>
</svelte:head>

<div class="site" class:game-shell={standaloneGame} data-theme={$preferences.theme}>
  {#if !standaloneGame}<SavedToast message={getLanguageString(strings, 'ui-saved-locally', $preferences.language)} />{/if}
  {#if !standaloneGame}
    <a class="skip-link" href="#main-content">Skip to content</a>
  {/if}
  {#if !standaloneGame}
  <header class="site-header" class:enhanced={$preferences.ready}>
    <button
      class="menu-button"
      aria-label="Toggle navigation"
      title="Toggle navigation"
      aria-expanded={menuOpen}
      aria-controls="site-navigation"
      onclick={() => menuOpen = !menuOpen}
    ><img src="/planner/icons/UI/hamburger.svg" alt="" /></button>
    <a class="logo" href="/planner/resources/">Justin163</a>
    <nav id="site-navigation" aria-label="Main navigation" class:open={menuOpen}>
      {#each links as link}
        <a
          href={link.href}
          aria-current={page.url.pathname === link.href ? 'page' : undefined}
        >{getLanguageString(strings, link.label, $preferences.language)}</a>
      {/each}
    </nav>
    <div class="preferences">
      <label>
        <span class="visually-hidden">Language</span>
        <select
          aria-label="Language"
          value={$preferences.language}
          disabled={!$preferences.ready}
          onchange={(event) => {
            const option = languageOptions.find((item) => item.value === event.currentTarget.value);
            if (option) preferences.update({ language: option.value });
          }}
        >
          {#each languageOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      {#if canStyleCharacterCards}
        <button
          class="style-button"
          data-style-editor-toggle
          disabled={!$preferences.ready}
          aria-label={getLanguageString(strings, 'ui-customize-character-cards', $preferences.language)}
          title={getLanguageString(strings, 'ui-customize-character-cards', $preferences.language)}
          aria-pressed={$styleEditorActive}
          onclick={() => styleEditorActive.update((active) => !active)}
        ><img src="/planner/icons/UI/brush-solid-full.svg" alt="" draggable="false" /></button>
      {/if}
      <button
        class="theme-button"
        disabled={!$preferences.ready}
        aria-label={$preferences.theme === 'dark' ? 'Light theme' : 'Dark theme'}
        title={$preferences.theme === 'dark' ? 'Light theme' : 'Dark theme'}
        onclick={() => preferences.update({
          theme: $preferences.theme === 'dark' ? 'light' : 'dark'
        })}
      ><img src={$preferences.theme === 'dark' ? '/planner/icons/UI/sun.svg' : '/planner/icons/UI/moon-black.svg'} alt="" /></button>
    </div>
  </header>
  {/if}
  {#if $preferences.error && !standaloneGame}
    <p class="error-banner" role="alert">{$preferences.error}</p>
  {/if}
  <main id="main-content" class:game-main={standaloneGame} tabindex="-1">
    {@render children()}
  </main>
</div>
