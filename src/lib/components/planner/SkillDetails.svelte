<script lang="ts">
  import type { FormattedSkill, SkillKey } from '$lib/domain/planner/skills';
  import type { CharacterInfo, PlannerCharacter, PlannerMetadata } from '$lib/domain/planner/types';
  import CharacterCard from './CharacterCard.svelte';

  let { skills, character, info, name, metadata, scribble, included, t, onInvestmentChange }: {
    skills: Array<{ key: SkillKey; label: string; description: FormattedSkill; fallback: boolean }>;
    character: PlannerCharacter;
    info: CharacterInfo;
    name: string;
    metadata: PlannerMetadata;
    scribble: boolean;
    included: boolean;
    t: (id: string) => string;
    onInvestmentChange: (key: SkillKey, side: 'current' | 'target', value: string) => void;
  } = $props();

  let pointerKey = $state<SkillKey | null>(null);
  let focusKey = $state<SkillKey | null>(null);
  let pinnedKey = $state<SkillKey | null>(null);
  let suppressedFocusKey: SkillKey | null = null;
  let touchPinnedKey: SkillKey | null = null;
  let skillButtons: Partial<Record<SkillKey, HTMLButtonElement | undefined>> = {};

  let selected = $derived.by(() => {
    const key = pinnedKey ?? pointerKey ?? focusKey;
    return key ? skills.find((skill) => skill.key === key) ?? null : null;
  });

  function togglePinned(key: SkillKey) {
    if (pinnedKey === key) {
      pinnedKey = null;
      pointerKey = null;
      focusKey = null;
    } else {
      pinnedKey = key;
    }
  }

  function previewOnFocus(key: SkillKey) {
    if (suppressedFocusKey === key) {
      suppressedFocusKey = null;
      return;
    }
    focusKey = key;
  }

  function previewFromInput(key: SkillKey) {
    if (touchPinnedKey === key) return;
    touchPinnedKey = null;
    pinnedKey = null;
    pointerKey = key;
    focusKey = key;
  }

  function activateInput(key: SkillKey, event: PointerEvent) {
    if (event.pointerType === 'touch') {
      touchPinnedKey = key;
      pinnedKey = key;
      pointerKey = null;
      focusKey = null;
    } else {
      touchPinnedKey = null;
    }
  }

  function clickInput(key: SkillKey) {
    if (touchPinnedKey === key) {
      touchPinnedKey = null;
      return;
    }
    previewFromInput(key);
  }

  function closeDescription(key: SkillKey) {
    suppressedFocusKey = key;
    skillButtons[key]?.focus();
    suppressedFocusKey = null;
    pinnedKey = null;
    pointerKey = null;
    focusKey = null;
  }
</script>

<div
  class="skill-details"
  role="group"
  aria-label={t('ui-skill-details')}
  onpointerleave={() => pointerKey = null}
  onfocusout={(event) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !event.currentTarget.contains(next)) focusKey = null;
  }}
>
  <div class="skill-overview">
    <div class="portrait-frame">
      <CharacterCard {character} {info} {name} {metadata} {scribble} {included}
        edit={() => {}} include={() => {}} mode="edit" dragging={false} keyboard={() => {}} preview={true} {t} />
    </div>
    <div class="skill-strip" data-skill-details>
      {#each skills as skill (skill.key)}
        {@const rule = metadata.fields.find((field) => field.key === skill.key)}
        <div class="skill-tile" class:active={selected?.key === skill.key}>
          {#if rule}
            <input class="skill-level-input current" type="number" min={rule.min} max={rule.max} step="1"
              aria-label={`${skill.label} ${t('label-current')}`} value={String(character.current[skill.key] ?? '')}
              onpointerenter={() => pointerKey = skill.key}
              onpointerdown={(event) => activateInput(skill.key, event)}
              onfocus={() => previewFromInput(skill.key)}
              onclick={() => clickInput(skill.key)}
              oninput={(event) => onInvestmentChange(skill.key, 'current', event.currentTarget.value)} />
          {/if}
          <button
            type="button"
            class="skill-button"
            bind:this={skillButtons[skill.key]}
            data-skill-key={skill.key}
            aria-label={`${skill.label}: ${t('ui-skill-details')}`}
            aria-expanded={selected?.key === skill.key}
            aria-controls="skill-description"
            aria-pressed={pinnedKey === skill.key}
            onpointerenter={() => pointerKey = skill.key}
            onfocus={() => previewOnFocus(skill.key)}
            onclick={() => togglePinned(skill.key)}
          >
            <img src={`/planner/icons/SkillIcon/${skill.description.icon}.webp`} alt="" aria-hidden="true" draggable="false" />
            <span class="skill-label">{skill.label}</span>
          </button>
          {#if rule}
            <input class="skill-level-input target" type="number" min={Math.max(rule.min, Number(character.current[skill.key]) || 0)} max={rule.max} step="1"
              aria-label={`${skill.label} ${t('label-target')}`} value={String(character.target[skill.key] ?? '')}
              onpointerenter={() => pointerKey = skill.key}
              onpointerdown={(event) => activateInput(skill.key, event)}
              onfocus={() => previewFromInput(skill.key)}
              onclick={() => clickInput(skill.key)}
              oninput={(event) => onInvestmentChange(skill.key, 'target', event.currentTarget.value)} />
          {/if}
        </div>
      {/each}
    </div>
  </div>

  {#if selected}
    <section
      id="skill-description"
      class="skill-description"
      class:preview={pinnedKey !== selected.key}
      aria-labelledby="skill-description-heading"
      data-skill-description={selected.key}
      data-skill-variant={selected.description.variant}
    >
      <header class="description-header">
        <div>
          <h3 id="skill-description-heading">{selected.description.name}</h3>
          <div class="skill-levels">
            <span>{t('label-current')}: <strong>{selected.description.level}</strong></span>
            <span>{t('label-target')}: <strong>{selected.description.targetLevel}</strong></span>
          </div>
        </div>
        {#if pinnedKey === selected.key}
          <button type="button" class="close-button" onclick={() => closeDescription(selected.key)}>{t('ui-close')}</button>
        {/if}
      </header>

      {#if selected.description.cost}
        <p class="skill-cost" data-skill-cost>
          <span class="meta-label">{t('ui-skill-cost')}</span>
          <span class="value-current" data-skill-value="current" aria-label={`${t('label-current')}: ${selected.description.cost.current}`}>{selected.description.cost.current}</span>
          {#if selected.description.cost.target !== null}
            <span aria-hidden="true">/</span>
            <span class="value-target" data-skill-value="target" aria-label={`${t('label-target')}: ${selected.description.cost.target}`}>{selected.description.cost.target}</span>
          {/if}
        </p>
      {/if}

      <div class="skill-description-text">
        {#each selected.description.tokens as token}
          {#if token.kind === 'break'}
            <br />
          {:else}
            <span class={`token tone-${token.tone}`} class:token-bold={token.bold}>
              {#if token.kind === 'text'}
                {token.text}
              {:else}
                <span class="value-current" data-skill-value="current" aria-label={`${t('label-current')}: ${token.current}`}>{token.current}</span>
                {#if token.target !== null}
                  <span aria-hidden="true">/</span>
                  <span class="value-target" data-skill-value="target" aria-label={`${t('label-target')}: ${token.target}`}>{token.target}</span>
                {/if}
              {/if}
            </span>
          {/if}
        {/each}
      </div>

      {#if selected.fallback}
        <p class="fallback-message">{t('ui-skill-english-fallback')}</p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .skill-details { min-width: 0; max-width: 100%; display: grid; gap: 0.5rem; }
  .skill-overview { display: grid; grid-template-columns: minmax(6rem, 10rem) minmax(0, 1fr); align-items: start; gap: 0.75rem; }
  .portrait-frame { width: 100%; max-width: 10rem; justify-self: start; container-type: inline-size; }
  .skill-strip { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.4rem; }
  .skill-tile { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 0.2rem; padding: 0.3rem; border: 1px solid #7c5b7d; border-radius: 0.5rem; background: var(--surface); }
  .skill-tile:hover, .skill-tile.active { background: #7c5b7d22; }
  .skill-button { display: flex; min-width: 0; flex-direction: column; align-items: center; justify-content: center; gap: 0.2rem; padding: 0.15rem 0; border: 0; background: transparent; color: var(--text); cursor: pointer; }
  .skill-button:focus-visible, .close-button:focus-visible { outline: 2px solid #7c5b7d; outline-offset: 2px; }
  .skill-button img { width: 2.1rem; height: 2.1rem; object-fit: contain; }
  .skill-label { max-width: 100%; overflow-wrap: anywhere; text-align: center; font-size: 0.7rem; line-height: 1.1; }
  .skill-level-input { width: 2.4ch; min-width: 2.4ch; max-width: 100%; padding: 0.1rem 0; border: 0; border-bottom: 1px solid #7c5b7d66; border-radius: 0; background: transparent; font: 600 0.9rem/1 monospace; text-align: center; }
  .skill-level-input.current { justify-self: start; color: white; }
  .skill-level-input.target { justify-self: end; color: #ffffa6; }
  .skill-level-input[type="number"] { appearance: textfield; -moz-appearance: textfield; }
  .skill-level-input::-webkit-inner-spin-button, .skill-level-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  @media (min-width: 601px) { .skill-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .skill-description { min-width: 0; max-width: 100%; padding: 0.65rem 0.75rem; border: 1px solid #7c5b7d; border-radius: 0.5rem; background: #7c5b7d12; overflow-wrap: anywhere; }
  .skill-description.preview { border-style: dashed; }
  .description-header { display: flex; min-width: 0; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
  h3 { min-width: 0; margin: 0; font-size: 1rem; }
  .skill-levels { display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; margin-top: 0.2rem; font-size: 0.8rem; }
  .close-button { flex: 0 0 auto; padding: 0.25rem 0.5rem; border: 1px solid #7c5b7d; border-radius: 0.35rem; background: var(--surface); color: var(--text); cursor: pointer; }
  .skill-cost { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.3rem; margin: 0.55rem 0 0; }
  .meta-label { margin-right: 0.15rem; font-weight: 600; }
  .skill-description-text { margin-top: 0.5rem; line-height: 1.45; }
  .token-bold { font-weight: 700; }
  .tone-mystic { color: #5797d1; }
  .tone-explosion { color: #db6d79; }
  .tone-pierce { color: #b08b35; }
  .value-current { color: #008c9b; }
  .value-target { color: #588f00; }
  .fallback-message { margin: 0.5rem 0 0; font-size: 0.8rem; }
</style>
