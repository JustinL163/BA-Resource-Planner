<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { afterNavigate } from '$app/navigation';
  import type { Snippet } from 'svelte';
  import { languageOptions, getLanguageString } from '$lib/domain/localisation';
  import { preferences } from '$lib/stores/preferences';
  import { saveChangedEvent } from '$lib/services/save-events';
  import strings from '$content/strings.json';
  import './site.css';

  let { children }: { children: Snippet } = $props();
  let menuOpen = $state(false);
  const standaloneGame = $derived(page.url.pathname === '/game/');
  const links = [
    { href: '/planner/index.html', label: 'page-resource-planner', legacy: true },
    { href: '/planner/resources/', label: 'page-modernplanner', legacy: false },
    { href: '/planner/events.html', label: 'page-event-planner', legacy: true },
    { href: '/planner/event-planner/', label: 'page-modernevents', legacy: false },
    { href: '/planner/raids/', label: 'page-raids', legacy: false },
    { href: '/planner/tournaments/', label: 'page-tournaments', legacy: false },
    { href: '/game/', label: 'page-guesser', legacy: false },
    { href: '/planner/changelog/', label: 'page-changelog', legacy: false },
    { href: '/planner/privacy/', label: 'page-privacy', legacy: false },
    { href: '/planner/credit/', label: 'page-credit', legacy: false }
  ];

  onMount(() => {
    preferences.initialise();
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

  afterNavigate(() => { menuOpen = false; });

  $effect(() => {
    const path = page.url.pathname;
    if (window.dataLayer) window.dataLayer.push(['config', 'G-3XZ18739WF', { page_path: path }]);
  });
</script>

<svelte:head>
  <link rel="manifest" href={standaloneGame ? '/game/manifest.json' : '/planner/manifest.json'} />
  <meta name="theme-color" content="#7c5b7d" />
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-3XZ18739WF"></script>
</svelte:head>

<div class="site" class:game-shell={standaloneGame} data-theme={$preferences.theme}>
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
    <a class="logo" href="/planner/index.html" data-sveltekit-reload>Justin163</a>
    <nav id="site-navigation" aria-label="Main navigation" class:open={menuOpen}>
      {#each links as link}
        <a
          href={link.href}
          data-sveltekit-reload={link.legacy}
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
