<script lang="ts">
  import type { PlannerCharacter, PlannerMetadata } from '$lib/domain/planner/types';
  import { cardInvestments } from '$lib/domain/planner/card-display';
  type DisplayedInfo = 'all' | 'current' | 'none';
  let { id, name, character, metadata, scribble, borrowed = false, borrowedLabel = 'Borrowed', excluded = false,
    preview = false, radius = '15%', displayedInfo = 'all' }: {
    id: string; name: string; character?: PlannerCharacter; metadata: PlannerMetadata;
    scribble: boolean; borrowed?: boolean; borrowedLabel?: string; excluded?: boolean; preview?: boolean; radius?: string;
    displayedInfo?: DisplayedInfo;
  } = $props();
  let portrait = $derived((scribble && metadata.scribblePortraits[id]) || metadata.portraits[id]);
  let lines = $derived(character && !borrowed && displayedInfo !== 'none' ? cardInvestments(character, preview) : []);
</script>

<span class="portrait" class:excluded style:--portrait-radius={radius}>
  <span class="portrait-content">
    {#if portrait}<img class="portrait-image character-image" src={portrait} alt="" loading="lazy" draggable="false" width="160" height="180" />{/if}
    {#if character && !borrowed && displayedInfo !== 'none'}
    <span class="ue-stars" aria-hidden="true">
      {#each Array(4) as _, index}
        {#if displayedInfo === 'all' ? index < Number(character.target.ue) || index < Number(character.current.ue) : index < Number(character.current.ue)}
          <img src={`/planner/icons/Misc/mysticstar-blue${index < Number(character.current.ue) ? '' : '-greyed'}.png`} alt="" draggable="false" />
        {/if}
      {/each}
    </span>
    <span class="bond" aria-hidden="true">
      <img src="/planner/icons/Misc/bondheart.png" alt="" draggable="false" />
      <span>{character.current.bond}{#if displayedInfo === 'all' && Number(character.target.bond) !== Number(character.current.bond)}<span class="target">{character.target.bond}</span>{/if}</span>
    </span>
    {#each lines as line}
      {#if line.current || (displayedInfo === 'all' && line.target)}
        <span class="investment {line.kind}" data-investment={line.kind} aria-hidden="true">
          <span>{line.current}</span>{#if displayedInfo === 'all' && line.target}<span class="target">{line.target}</span>{/if}
        </span>
      {/if}
    {/each}
  {/if}
  <span class="name" aria-hidden="true">{name}</span>
  {#if borrowed}<span class="borrowed" aria-hidden="true">{borrowedLabel}</span>{/if}
  {#if excluded}<span class="excluded-mark" aria-hidden="true"></span>{/if}
  </span>
  {#if character && !borrowed && displayedInfo !== 'none'}
    <span class="stars" aria-hidden="true">
      {#each Array(5) as _, index}
        {#if displayedInfo === 'all' ? index < Number(character.target.star) || index < Number(character.current.star) : index < Number(character.current.star)}
          <img src={`/planner/icons/Misc/mysticstar${index < Number(character.current.star) ? '' : '-greyed'}.png`} alt="" draggable="false" />
        {/if}
      {/each}
    </span>
  {/if}
</span>

<style>
  .portrait { display: block; position: relative; overflow: visible; border-radius: var(--portrait-radius, 15%); aspect-ratio: 8 / 9; color: white; container-name: character-portrait; container-type: inline-size; }
  .portrait-content { position: absolute; inset: 0; overflow: hidden; border-radius: var(--portrait-radius, 15%); }
  .portrait-image { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: var(--portrait-radius, 15%); pointer-events: none; }
  .name { position: absolute; inset: auto 0 0; border-radius: 0 0 var(--portrait-radius, 15%) var(--portrait-radius, 15%); background: #121625b3; padding: 0.2em; font-size: max(11px, calc(var(--card-size) * 0.086)); line-height: 1.15; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: -1px -1px 0 #000, 0px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0px 1px 0 #000, 1px 1px 0 #000; }
  .borrowed { position: absolute; inset: 0 0 auto; background: #002658ba; padding: 0.15em; font-size: 0.8em; }
  .investment { position: absolute; display: flex; flex-direction: column; background: #16131e85; border-radius: 0.15em; padding: 0.08em 0.15em; font: bold max(10px, calc(var(--card-size) * 0.115))/1.05 monospace; text-shadow: 0 1px 2px black; white-space: pre; }
  .target { color: #ffffa6; display: block; }
  .skills { left: 0; bottom: 12.1%; letter-spacing: 0.02em; }
  .gear { right: 0; bottom: 12.1%; letter-spacing: 0.02em; }
  .books { right: 0; top: 32%; font-size: max(7px, calc(var(--card-size) * 0.088)); }
  .level { right: 0; top: 4%; }
  .stars, .ue-stars { display: flex; position: absolute; left: 3%; top: 1%; width: 70%; }
  .stars { top: -7%; z-index: 1; }
  .ue-stars { top: 6%; }
  .stars img, .ue-stars img { width: 20%; height: auto; object-fit: contain; pointer-events: none; }
  .bond { position: absolute; top: 22%; left: 3%; width: 20%; }
  .bond img { width: 100%; pointer-events: none; }
  .bond > span { position: absolute; inset: 10% 0 auto; font: bold max(8px, calc(var(--card-size) * 0.085))/1.1 monospace; text-shadow: -1px -1px black, 1px 1px black; }
  .excluded { filter: grayscale(0.8) brightness(0.55); }
  .excluded-mark { position: absolute; top: 25%; left: 38%; display: grid; width: 24%; min-width: 0; aspect-ratio: 1; box-sizing: border-box; place-items: center; border: 2px solid white; border-radius: 50%; background: #672b39; }
  .excluded-mark::after { content: ''; width: 55%; height: 2px; border-radius: 999px; background: white; }

  /* The portrait container is 4px narrower than the slider card because of the card's 2px border. */
  @container character-portrait (max-width: 86px) {
    /* Card-size slider: 80px. Add portrait overrides here. */
    .gear, .skills {
      bottom: 20%
    }
  }
  @container character-portrait (min-width: 86.01px) and (max-width: 106px) {
    /* Card-size slider: 100px. Add portrait overrides here. */
    .gear, .skills {
      bottom: 15.8%
    }
  }
  @container character-portrait (min-width: 106.01px) and (max-width: 126px) {
    /* Card-size slider: 120px. Add portrait overrides here. */
    .gear, .skills {
      bottom: 13%
    }
  }
  @container character-portrait (min-width: 126.01px) and (max-width: 146px) {
    /* Card-size slider: 140px. Add portrait overrides here. */
    .gear, .skills {
      bottom: 12.2%
    }
  }
  @container character-portrait (min-width: 146.01px) { /* Card-size slider: 160px. Add portrait overrides here. */ }
</style>
