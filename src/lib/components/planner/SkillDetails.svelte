<script lang="ts">
  import haloCharacterMapping from '$lib/domain/planner/halo-character-map.json';
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import type { FormattedSkill, SkillKey } from '$lib/domain/planner/skills';
  import type { CharacterInfo, InvestmentKey, PlannerCharacter, PlannerMetadata } from '$lib/domain/planner/types';
  import CharacterCard from './CharacterCard.svelte';

  type StarAction = { type: 'star' | 'ue'; side: 'current' | 'target'; position: number };
  type StarState = { currentStar: number; targetStar: number; currentUe: number; targetUe: number };

  const equipmentKeys = ['gear1', 'gear2', 'gear3'] as const;
  const starPositions = [1, 2, 3, 4, 5] as const;
  const uePositions = [1, 2, 3, 4] as const;
  const starSides = ['current', 'target'] as const;
  type EquipmentInvestmentKey = (typeof equipmentKeys)[number];
  const limitBreaks = [
    { key: 'book_hp', label: 'label-bookhp', image: 'Book_HP' },
    { key: 'book_atk', label: 'label-bookatk', image: 'Book_ATK' },
    { key: 'book_heal', label: 'label-bookheal', image: 'Book_Heal' }
  ] as const;
  const terrainDefinitions = [
    { key: 'urban', label: 'terrain-urban', adaptationKey: 'StreetBattleAdaptation', weaponTerrain: 'Street', icon: 'Terrain_Street.png' },
    { key: 'outdoors', label: 'terrain-outdoors', adaptationKey: 'OutdoorBattleAdaptation', weaponTerrain: 'Outdoor', icon: 'Terrain_Outdoor.png' },
    { key: 'indoors', label: 'terrain-indoors', adaptationKey: 'IndoorBattleAdaptation', weaponTerrain: 'Indoor', icon: 'Terrain_Indoor.png' }
  ] as const;
  const moodGrades = ['D', 'C', 'B', 'A', 'S', 'SS'] as const;

  let { skills, character, info, name, metadata, scribble, included, t, onInvestmentChange }: {
    skills: Array<{ key: SkillKey; label: string; description: FormattedSkill; fallback: boolean }>;
    character: PlannerCharacter;
    info: CharacterInfo;
    name: string;
    metadata: PlannerMetadata;
    scribble: boolean;
    included: boolean;
    t: (id: string) => string;
    onInvestmentChange: (key: InvestmentKey, side: 'current' | 'target', value: string) => void;
  } = $props();

  let terrainMoods = $derived.by(() => terrainDefinitions.flatMap((terrain) => {
    const baseMood = info[terrain.adaptationKey];
    if (typeof baseMood !== 'number' || !Number.isFinite(baseMood)) return [];
    const weapon = info.Weapon;
    const weaponBoost = Number(character.current.ue) >= 3 && weapon?.AdaptationType === terrain.weaponTerrain &&
      typeof weapon.AdaptationValue === 'number' && Number.isFinite(weapon.AdaptationValue)
      ? weapon.AdaptationValue : 0;
    const moodIndex = Math.max(0, Math.min(moodGrades.length - 1, Math.trunc(baseMood + weaponBoost)));
    const mood = moodGrades[moodIndex] ?? moodGrades[0];
    return [{
      key: terrain.key,
      label: t(terrain.label),
      mood,
      terrainImage: `/planner/icons/Mood/${terrain.icon}`,
      moodImage: `/planner/icons/Mood/Mood_${mood}.png`
    }];
  }));
  let squadLabel = $derived(info.SquadType === 'Main' ? t('type-striker') : info.SquadType === 'Support' ? t('type-special') : '');
  let roleLabel = $derived(info.TacticRole ? t(`role-${info.TacticRole.toLowerCase()}`) : '');
  let roleImage = $derived(info.TacticRole ? metadata.roleImages?.[info.TacticRole] : undefined);
  let attackLabel = $derived(t(`atktype-${info.BulletType.toLowerCase()}`));
  let defenseLabel = $derived(t(`deftype-${info.ArmorType.toLowerCase()}`));
  let weaponLabel = $derived([
    info.WeaponType ? t(`gun-${info.WeaponType.toLowerCase()}`) : '',
    info.Position ? t(`position-${info.Position.toLowerCase()}`) : ''
  ].filter(Boolean).join(' / '));
  let weaponImage = $derived(metadata.weaponImages?.[String(info.Id)]);
  let squadColor = $derived(metadata.colours[info.SquadType === 'Main' ? 'Striker' : 'Special']);

  let pointerKey = $state<SkillKey | null>(null);
  let focusKey = $state<SkillKey | null>(null);
  let pinnedKey = $state<SkillKey | null>(null);
  let suppressedFocusKey: SkillKey | null = null;
  let touchPinnedKey: SkillKey | null = null;
  let skillButtons: Partial<Record<SkillKey, HTMLButtonElement | undefined>> = {};
  let bondGearRule = $derived(metadata.fields.find((field) => field.key === 'bond_gear'));
  let bondRule = $derived(metadata.fields.find((field) => field.key === 'bond') ?? null);
  let levelRule = $derived(metadata.fields.find((field) => field.key === 'level') ?? null);
  let ueLevelRule = $derived(metadata.fields.find((field) => field.key === 'ue_level') ?? null);
  let hoveredStarAction = $state<StarAction | null>(null);
  let starState = $derived.by(() => {
    const currentStar = Math.max(info.StarGrade, Number(character.current.star) || info.StarGrade);
    const currentUe = Math.max(0, Math.min(4, Number(character.current.ue) || 0));
    const targetUe = Math.max(currentUe, Math.min(4, Number(character.target.ue) || 0));
    const targetStar = Math.max(currentStar, targetUe > 0 ? 5 : Number(character.target.star) || currentStar);
    return {
      currentStar: currentUe > 0 ? 5 : currentStar,
      targetStar: targetUe > 0 ? 5 : targetStar,
      currentUe,
      targetUe
    };
  });
  let previewStarState = $derived.by(() => {
    if (!hoveredStarAction) return starState;
    const next = nextStarState(starState, hoveredStarAction);
    return hoveredStarAction.side === 'target'
      ? { ...starState, targetStar: next.targetStar, targetUe: next.targetUe }
      : next;
  });
  const haloIdsByCharacter = haloCharacterMapping.characterToHalo as Record<string, number>;
  const haloIdsWithoutArtwork = new Set<number>(haloCharacterMapping.haloIdsWithoutArtwork);
  const fallbackHaloId = haloCharacterMapping.fallbackHaloId;
  let haloId = $derived.by(() => {
    const mappedHaloId = haloIdsByCharacter[character.id];
    return mappedHaloId !== undefined && !haloIdsWithoutArtwork.has(mappedHaloId) ? mappedHaloId : fallbackHaloId;
  });
  let levelRevealAngles = $derived.by(() => {
    const maxLevel = Math.max(1, Number(metadata.maxLevel) || 1);
    const angleFor = (value: unknown) => {
      const level = Number(value);
      const progress = Number.isFinite(level) ? Math.max(0, Math.min(maxLevel, level)) / maxLevel : 0;
      return `${progress * 360}deg`;
    };
    return {
      current: angleFor(character.current.level),
      target: angleFor(character.target.level)
    };
  });
  let bondReveal = $derived.by(() => {
    const bond = Math.max(0, Math.min(100, Number(character.current.bond) || 0));
    const revealForBand = (value: number, start: number, end: number) =>
      `${Math.max(0, Math.min(1, (value - start) / (end - start))) * 360}deg`;
    return {
      bond,
      pinkReveal: revealForBand(bond, 0, 20),
      purpleReveal: revealForBand(bond, 20, 50),
      goldReveal: revealForBand(bond, 50, 100)
    };
  });

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

  function clearHoverPreview() {
    pointerKey = null;
    if (pinnedKey === null) focusKey = null;
  }

  function ueLevelMaximum(ue: number): number {
    return [0, 30, 40, 50, 60][Math.max(0, Math.min(4, Math.floor(ue)))] ?? 0;
  }

  function clampUeLevel(value: unknown, maximum: number, minimum = 0): number {
    const number = Number(value);
    const integer = Number.isFinite(number) ? Math.trunc(number) : 0;
    return Math.max(minimum, Math.min(maximum, integer));
  }

  function nextStarState(state: StarState, action: StarAction): StarState {
    const next = { ...state };
    const position = action.position;

    if (action.side === 'current' && action.type === 'star') {
      if (position < info.StarGrade || position > 5 || (position === state.currentStar && (position !== 5 || state.currentUe === 1))) return state;
      next.currentStar = position;
      if (position > next.targetStar) next.targetStar = position;
      next.currentUe = position === 5 ? 1 : 0;
      if (next.currentUe > next.targetUe) next.targetUe = next.currentUe;
    } else if (action.side === 'current' && action.type === 'ue') {
      if (position < 1 || position > 4) return state;
      next.currentUe = position === 1 && state.currentUe === 1 ? 0 : position;
      if (next.currentUe > next.targetUe) next.targetUe = next.currentUe;
      next.currentStar = 5;
      next.targetStar = 5;
    } else if (action.side === 'target' && action.type === 'star') {
      if (position < Math.max(info.StarGrade, state.currentStar) || position > 5 ||
        (position === state.targetStar && (position !== 5 || state.targetUe === Math.max(state.currentUe, 1)))) return state;
      next.targetStar = position;
      if (position === 5) {
        next.targetUe = Math.max(state.currentUe, 1);
      } else {
        next.currentUe = 0;
        next.targetUe = 0;
      }
    } else if (action.side === 'target' && action.type === 'ue') {
      if (position < state.currentUe || position < 1 || position > 4) return state;
      if (position === 1 && state.targetUe === 1 && state.currentUe === 0) next.targetUe = 0;
      else next.targetUe = position;
      if (next.targetUe > 0) next.targetStar = 5;
    }

    next.targetStar = Math.max(next.currentStar, next.targetStar);
    next.targetUe = Math.max(next.currentUe, next.targetUe);
    return next;
  }

  function canSelectStar(action: StarAction): boolean {
    if (action.side === 'current' && !character.eleph.unlocked) return false;
    const next = nextStarState(starState, action);
    return next.currentStar !== starState.currentStar || next.targetStar !== starState.targetStar ||
      next.currentUe !== starState.currentUe || next.targetUe !== starState.targetUe;
  }

  function previewStar(action: StarAction) {
    hoveredStarAction = canSelectStar(action) ? action : null;
  }

  function starAction(type: StarAction['type'], side: StarAction['side'], position: number): StarAction {
    return { type, side, position };
  }

  function starImage(type: StarAction['type']): string {
    const base = type === 'star' ? 'mysticstar' : 'mysticstar-blue';
    return `/planner/icons/Misc/${base}.png`;
  }

  function starIsSelected(type: StarAction['type'], side: StarAction['side'], position: number, state: StarState): boolean {
    const count = type === 'star'
      ? (side === 'current' ? state.currentStar : state.targetStar)
      : (side === 'current' ? state.currentUe : state.targetUe);
    return position <= count;
  }

  function starPreviewStyle(type: StarAction['type'], side: StarAction['side'], position: number): 'preview-increase' | 'preview-decrease' | '' {
    if (!hoveredStarAction) return '';
    const actual = type === 'star'
      ? (side === 'current' ? starState.currentStar : starState.targetStar)
      : (side === 'current' ? starState.currentUe : starState.targetUe);
    const preview = type === 'star'
      ? (side === 'current' ? previewStarState.currentStar : previewStarState.targetStar)
      : (side === 'current' ? previewStarState.currentUe : previewStarState.targetUe);
    if (preview > actual && position > actual && position <= preview) return 'preview-increase';
    if (preview < actual && position > preview && position <= actual) return 'preview-decrease';
    return '';
  }

  function selectStar(action: StarAction) {
    if (!canSelectStar(action)) return;
    const next = nextStarState(starState, action);
    const currentUeLevel = clampUeLevel(character.current.ue_level, ueLevelMaximum(next.currentUe));
    const targetUeLevel = clampUeLevel(character.target.ue_level, ueLevelMaximum(next.targetUe), currentUeLevel);
    hoveredStarAction = null;

    const updates: Array<[InvestmentKey, 'current' | 'target', number]> = [
      ['star', 'current', next.currentStar], ['star', 'target', next.targetStar],
      ['ue', 'current', next.currentUe], ['ue', 'target', next.targetUe],
      ['ue_level', 'current', currentUeLevel], ['ue_level', 'target', targetUeLevel]
    ];
    if (next.currentUe === 0) {
      for (const limitBreak of limitBreaks) updates.push([limitBreak.key, 'current', 0]);
    }
    if (next.targetUe === 0) {
      for (const limitBreak of limitBreaks) updates.push([limitBreak.key, 'target', 0]);
    }
    for (const [key, side, value] of updates) {
      if (String(character[side][key] ?? '') !== String(value)) onInvestmentChange(key, side, String(value));
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

  function equipmentLabel(equipment: string): string {
    const translated = t(`gear-${equipment.toLowerCase()}`);
    return translated === 'Undefined' ? equipment : translated;
  }

  function equipmentTier(key: EquipmentInvestmentKey): number {
    const max = metadata.fields.find((field) => field.key === key)?.max ?? 10;
    const value = Number(character.current[key]);
    return Number.isInteger(value) ? Math.max(1, Math.min(max, value)) : 1;
  }
</script>

<div
  class="skill-details"
  role="group"
  aria-label={t('ui-skill-details')}
  onpointerleave={clearHoverPreview}
  onfocusout={(event) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !event.currentTarget.contains(next)) focusKey = null;
  }}
>
  <div class="skill-overview">
    <div class="portrait-frame" onpointerenter={clearHoverPreview}>
      <CharacterCard {character} {info} {name} {metadata} {scribble} {included}
        edit={() => {}} include={() => {}} mode="edit" dragging={false} keyboard={() => {}} preview={true} {t} />
    </div>
    <div class="character-info-panel" role="group" aria-label={name}>
      <div class="character-info-top">
        {#if squadLabel}<span class="squad-type" style:background={squadColor ?? 'var(--background)'}>{squadLabel}</span>{/if}
        <div class="terrain-moods">
          {#each terrainMoods as terrain (terrain.key)}
            <div class="terrain-mood" role="img" aria-label={`${terrain.label}: ${terrain.mood}`} title={`${terrain.label}: ${terrain.mood}`}>
              <img src={terrain.terrainImage} alt="" draggable="false" />
              <img src={terrain.moodImage} alt="" draggable="false" />
            </div>
          {/each}
        </div>
      </div>
      <div class="character-info-details">
        <div class="combat-facts">
          <div class="info-chip split-info-chip" title={attackLabel}>
            <span class="info-chip-icon-section" style:background={metadata.colours[info.BulletType] ?? 'var(--background)'}>
              <img src="/planner/icons/Misc/Type_Attack.png" alt="" draggable="false" />
            </span>
            <span class="info-chip-name-section">{attackLabel}</span>
          </div>
          <div class="info-chip split-info-chip" title={defenseLabel}>
            <span class="info-chip-icon-section" style:background={metadata.colours[info.ArmorType] ?? 'var(--background)'}>
              <img src="/planner/icons/Misc/Type_Defense.png" alt="" draggable="false" />
            </span>
            <span class="info-chip-name-section">{defenseLabel}</span>
          </div>
          {#if roleLabel}
            <div class="info-chip split-info-chip" title={roleLabel}>
              <span class="info-chip-icon-section">
                {#if roleImage}<img src={roleImage} alt="" draggable="false" />{/if}
              </span>
              <span class="info-chip-name-section">{roleLabel}</span>
            </div>
          {/if}
        </div>
        <div class="weapon-info">
          {#if weaponLabel}<strong>{weaponLabel}</strong>{/if}
          {#if weaponImage}<img src={weaponImage} alt={info.Weapon?.Name ?? ''} draggable="false" />{/if}
        </div>
      </div>
    </div>
    <div class="level-strip" role="group" aria-label={`${levelRule?.label ?? t('label-level')} ${t('label-stars')}`} onpointerenter={clearHoverPreview}>
      <div class="skill-tile level-tile" style={`--current-reveal: ${levelRevealAngles.current}; --target-reveal: ${levelRevealAngles.target};`}>
        {#if levelRule}
          <input use:sanitizeIntegerInput class="skill-level-input current" type="number" min={levelRule.min} max={metadata.maxLevel} step="1"
            aria-label={`${levelRule.label} ${t('label-current')}`} value={String(character.current.level ?? '')}
            oninput={(event) => onInvestmentChange('level', 'current', event.currentTarget.value)} />
        {/if}
        <span class="halo-image-stack" aria-hidden="true">
          <img class="halo-image halo-image-target" src={`/planner/icons/Halo/${haloId}.webp`} alt="" draggable="false" />
          <img class="halo-image halo-image-current" src={`/planner/icons/Halo/${haloId}.webp`} alt="" draggable="false" />
        </span>
        {#if levelRule}
          <input use:sanitizeIntegerInput class="skill-level-input target" type="number" min={Math.max(levelRule.min, Number(character.current.level) || 0)} max={metadata.maxLevel} step="1"
            aria-label={`${levelRule.label} ${t('label-target')}`} value={String(character.target.level ?? '')}
            oninput={(event) => onInvestmentChange('level', 'target', event.currentTarget.value)} />
          <span class="skill-label level-label">{levelRule.label}</span>
        {/if}
      </div>
      <div class="skill-tile star-ue-tile" role="group" aria-label={t('label-stars')}
        onpointerleave={() => hoveredStarAction = null}>
        {#each starSides as side (side)}
          <div class="star-set" role="group" aria-label={t(side === 'current' ? 'label-current' : 'label-target')}>
            <div class="star-set-content">
              <span class="star-set-label" class:target={side === 'target'}>{t(side === 'current' ? 'label-current' : 'label-target')}</span>
              <div class="star-line" role="group" aria-label={`${t('label-stars')} ${t('label-ue')}`}>
                {#each starPositions as position (position)}
                  {@const action = starAction('star', side, position)}
                  <button type="button" class="star-choice"
                    class:unselected={!starIsSelected('star', side, position, previewStarState)}
                    class:preview-increase={starPreviewStyle('star', side, position) === 'preview-increase'}
                    class:preview-decrease={starPreviewStyle('star', side, position) === 'preview-decrease'}
                    aria-label={`${t('label-stars')} ${position} ${t(side === 'current' ? 'label-current' : 'label-target')}`}
                    aria-pressed={starIsSelected('star', side, position, previewStarState)} disabled={!canSelectStar(action)}
                    onclick={() => selectStar(action)} onpointerenter={() => previewStar(action)} onfocus={() => previewStar(action)}
                    onblur={() => hoveredStarAction = null}>
                    <img src={starImage('star')} alt="" draggable="false" />
                  </button>
                {/each}
                {#each uePositions as position (position)}
                  {@const action = starAction('ue', side, position)}
                  <button type="button" class="star-choice"
                    class:first-ue-star={position === 1}
                    class:unselected={!starIsSelected('ue', side, position, previewStarState)}
                    class:preview-increase={starPreviewStyle('ue', side, position) === 'preview-increase'}
                    class:preview-decrease={starPreviewStyle('ue', side, position) === 'preview-decrease'}
                    aria-label={`${t('label-ue')} ${position} ${t(side === 'current' ? 'label-current' : 'label-target')}`}
                    aria-pressed={starIsSelected('ue', side, position, previewStarState)} disabled={!canSelectStar(action)}
                    onclick={() => selectStar(action)} onpointerenter={() => previewStar(action)} onfocus={() => previewStar(action)}
                    onblur={() => hoveredStarAction = null}>
                    <img src={starImage('ue')} alt="" draggable="false" />
                  </button>
                {/each}
              </div>
            </div>
            {#if ueLevelRule}
              <input use:sanitizeIntegerInput class="skill-level-input ue-level-input" class:current={side === 'current'} class:target={side === 'target'}
                type="number" min={side === 'current' ? ueLevelRule.min : Math.max(ueLevelRule.min, Number(character.current.ue_level) || 0)}
                max={ueLevelMaximum(side === 'current' ? starState.currentUe : starState.targetUe)} step="1"
                aria-label={`${ueLevelRule.label} ${t(side === 'current' ? 'label-current' : 'label-target')}`}
                value={String(character[side].ue_level ?? '')}
                oninput={(event) => onInvestmentChange('ue_level', side, event.currentTarget.value)} />
            {/if}
          </div>
        {/each}
      </div>
    </div>
    <div class="bond-strip" role="group" aria-label={`${bondRule?.label ?? ''} ${t('ui-overlay-books')}`.trim()} onpointerenter={clearHoverPreview}>
      {#if bondRule}
        <div class="skill-tile bond-tile" style={`--pink-reveal: ${bondReveal.pinkReveal}; --purple-reveal: ${bondReveal.purpleReveal}; --gold-reveal: ${bondReveal.goldReveal};`}>
          <input use:sanitizeIntegerInput class="skill-level-input current" type="number" min={bondRule.min} max={bondRule.max} step="1"
            aria-label={`${bondRule.label} ${t('label-current')}`} value={String(character.current.bond ?? '')}
            oninput={(event) => onInvestmentChange('bond', 'current', event.currentTarget.value)} />
          <span class="bond-image-stack" aria-hidden="true">
            <img class="bond-image bond-image-base" src="/planner/icons/Misc/bondheart.png" alt="" draggable="false" />
            {#if bondReveal.bond > 0}
              <img class="bond-image bond-image-pink" src="/planner/icons/Misc/bondheart.png" alt="" draggable="false" />
            {/if}
            {#if bondReveal.bond > 20}
              <img class="bond-image bond-image-purple" src="/planner/icons/Misc/bondheart.png" alt="" draggable="false" />
            {/if}
            {#if bondReveal.bond > 50}
              <img class="bond-image bond-image-gold" src="/planner/icons/Misc/bondheart.png" alt="" draggable="false" />
            {/if}
          </span>
          <input use:sanitizeIntegerInput class="skill-level-input target" type="number" min={Math.max(bondRule.min, Number(character.current.bond) || 0)} max={bondRule.max} step="1"
            aria-label={`${bondRule.label} ${t('label-target')}`} value={String(character.target.bond ?? '')}
            oninput={(event) => onInvestmentChange('bond', 'target', event.currentTarget.value)} />
          <span class="skill-label bond-label">{bondRule.label}</span>
        </div>
      {/if}
      {#each limitBreaks as limitBreak (limitBreak.key)}
        {@const rule = metadata.fields.find((field) => field.key === limitBreak.key)}
        {#if rule}
          <div class="skill-tile limit-break-tile">
            <input use:sanitizeIntegerInput class="skill-level-input current" type="number" min={rule.min} max={Number(character.current.ue) > 0 ? rule.max : 0} step="1"
              aria-label={`${t(limitBreak.label)} ${t('label-current')}`} value={String(character.current[limitBreak.key] ?? '')}
              oninput={(event) => onInvestmentChange(limitBreak.key, 'current', event.currentTarget.value)} />
            <img class="limit-break-image" src={`/planner/icons/Books/${limitBreak.image}.webp`} alt="" aria-hidden="true" draggable="false" />
            <input use:sanitizeIntegerInput class="skill-level-input target" type="number" min={Math.max(rule.min, Number(character.current[limitBreak.key]) || 0)} max={Number(character.target.ue) > 0 ? rule.max : 0} step="1"
              aria-label={`${t(limitBreak.label)} ${t('label-target')}`} value={String(character.target[limitBreak.key] ?? '')}
              oninput={(event) => onInvestmentChange(limitBreak.key, 'target', event.currentTarget.value)} />
            <span class="skill-label limit-break-label">{t(limitBreak.label)}</span>
          </div>
        {/if}
      {/each}
    </div>
    <div class="gear-strip" role="group" aria-label={t('ui-overlay-gear')} onpointerenter={clearHoverPreview}>
      {#each equipmentKeys as key, index (key)}
        {@const equipment = info.Equipment?.[index]}
        {@const rule = metadata.fields.find((field) => field.key === key)}
        {#if equipment && rule}
          <div class="skill-tile gear-tile">
            <input use:sanitizeIntegerInput class="skill-level-input current" type="number" min={rule.min} max={rule.max} step="1"
              aria-label={`${equipmentLabel(equipment)} ${t('label-current')}`} value={String(character.current[key] ?? '')}
              oninput={(event) => onInvestmentChange(key, 'current', event.currentTarget.value)} />
            <img class="gear-image" src={`/planner/icons/Gear/T${equipmentTier(key)}_${equipment}.webp`} alt="" aria-hidden="true" draggable="false" />
            <input use:sanitizeIntegerInput class="skill-level-input target" type="number" min={Math.max(rule.min, Number(character.current[key]) || 0)} max={rule.max} step="1"
              aria-label={`${equipmentLabel(equipment)} ${t('label-target')}`} value={String(character.target[key] ?? '')}
              oninput={(event) => onInvestmentChange(key, 'target', event.currentTarget.value)} />
            <span class="skill-label gear-label">{equipmentLabel(equipment)}</span>
          </div>
        {/if}
      {/each}
      {#if bondGearRule}
        <div class="skill-tile gear-tile" class:hidden={!character.hasBondGear} aria-hidden={!character.hasBondGear}>
          <input use:sanitizeIntegerInput class="skill-level-input current" type="number" min={bondGearRule.min} max={bondGearRule.max} step="1"
            aria-label={`Bond Gear ${t('label-current')}`} value={String(character.current.bond_gear ?? '')}
            disabled={!character.hasBondGear}
            oninput={(event) => onInvestmentChange('bond_gear', 'current', event.currentTarget.value)} />
          {#if character.hasBondGear}
            <img class="gear-image" src={`/planner/icons/BondGear/${info.Id}.webp`} alt="" aria-hidden="true" draggable="false" />
          {/if}
          <input use:sanitizeIntegerInput class="skill-level-input target" type="number" min={Math.max(bondGearRule.min, Number(character.current.bond_gear) || 0)} max={bondGearRule.max} step="1"
            aria-label={`Bond Gear ${t('label-target')}`} value={String(character.target.bond_gear ?? '')}
            disabled={!character.hasBondGear}
            oninput={(event) => onInvestmentChange('bond_gear', 'target', event.currentTarget.value)} />
          <span class="skill-label gear-label">Bond Gear</span>
        </div>
      {/if}
    </div>
    <div class="skill-strip" data-skill-details>
      {#each skills as skill (skill.key)}
        {@const rule = metadata.fields.find((field) => field.key === skill.key)}
        <div class="skill-tile" class:active={selected?.key === skill.key}>
          {#if rule}
            <input use:sanitizeIntegerInput class="skill-level-input current" type="number" min={rule.min} max={rule.max} step="1"
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
            onpointerenter={(event) => { if (event.pointerType !== 'touch') pointerKey = skill.key; }}
            onfocus={() => previewOnFocus(skill.key)}
            onclick={() => togglePinned(skill.key)}
          >
            <img src={`/planner/icons/SkillIcon/${skill.description.icon}.webp`} alt="" aria-hidden="true" draggable="false" />
            <span class="skill-label">{skill.label}</span>
          </button>
          {#if rule}
            <input use:sanitizeIntegerInput class="skill-level-input target" type="number" min={Math.max(rule.min, Number(character.current[skill.key]) || 0)} max={rule.max} step="1"
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
  .character-info-panel { display: flex; min-width: 0; min-height: 0; flex-direction: column; align-self: stretch; gap: 0; padding: 0.35rem; border-radius: 0.6rem; background: var(--surface); color: var(--text); }
  .character-info-top { display: grid; min-width: 0; min-height: 3.5rem; grid-template-columns: auto minmax(0, 1fr); align-items: stretch; gap: 0.3rem; }
  .squad-type { height: fit-content; max-width: 100%; padding: 0.2rem 0.45rem; border: 1px solid #7c5b7d88; border-radius: 999px; background: var(--background); font-size: 0.75rem; font-weight: 750; line-height: 1.1; text-align: center; white-space: nowrap; align-self: anchor-center; }
  .terrain-moods { display: flex; min-width: 0; align-items: stretch; justify-content: flex-end; gap: 0.2rem; }
  .terrain-mood { display: grid; box-sizing: border-box; width: 3.4rem; height: 3rem; flex: 0 0 5.5rem; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: minmax(0, 1fr); place-items: center; gap: 0.05rem; padding: 0.1rem; border: 1px solid #7c5b7d66; border-radius: 0.35rem; background: var(--background); }
  .terrain-mood img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .character-info-details { display: grid; min-width: 0; flex: 1; grid-template-columns: fit-content(52%) minmax(0, 1fr); align-items: stretch; gap: 0.3rem; }
  .combat-facts { display: grid; width: fit-content; max-width: 100%; min-width: 0; align-content: start; gap: 0.25rem; }
  .info-chip { display: flex; box-sizing: border-box; width: fit-content; max-width: 100%; min-width: 0; min-height: 1.65rem; align-items: center; gap: 0.25rem; padding: 0.15rem 0.5rem; border: 1px solid #7c5b7d55; border-radius: 0.4rem; background: var(--background); font-size: 0.68rem; font-weight: 650; line-height: 1.05; }
  .split-info-chip { gap: 0; padding: 0; overflow: hidden; }
  .info-chip > img { display: block; width: 1.15rem; height: 1.15rem; flex: 0 0 1.15rem; object-fit: contain; }
  .info-chip-icon-section { display: grid; box-sizing: border-box; min-height: 1.65rem; flex: 0 0 auto; place-items: center; padding: 0.15rem 0.5rem; }
  .info-chip-icon-section img { display: block; width: 1.15rem; height: 1.15rem; object-fit: contain; }
  .info-chip-name-section { display: flex; min-width: 0; align-items: center; padding: 0.15rem 0.5rem; background: var(--background); overflow-wrap: anywhere; }
  .info-chip span { min-width: 0; overflow-wrap: anywhere; }
  .weapon-info { display: grid; box-sizing: border-box; width: 100%; min-width: 0; min-height: 0; align-self: stretch; grid-template-rows: auto minmax(0, 1fr); justify-items: center; align-items: center; gap: 0.15rem; padding: 0.2rem; border: 1px solid #7c5b7d55; border-radius: 0.4rem; background: var(--background); text-align: center; }
  .weapon-info strong { max-width: 100%; font-size: 0.68rem; line-height: 1.05; overflow-wrap: anywhere; }
  .weapon-info img { display: block; width: 100%; height: auto; object-fit: contain; }
  .level-strip, .bond-strip { grid-column: 1 / -1; display: flex; width: min(100%, 25.2rem); justify-self: center; justify-content: flex-start; gap: 0.4rem; }
  .level-strip { min-width: 0; }
  .skill-strip { grid-column: 1 / -1; display: flex; width: min(100%, 25.2rem); justify-self: center; justify-content: center; gap: 0.4rem; }
  .skill-tile { display: grid; min-width: 0; flex: 0 1 6rem; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 0.2rem; padding: 0.1rem; border: 1px solid #7c5b7d66; border-radius: 0.5rem; background: var(--background); }
  .skill-tile:hover, .skill-tile.active { background: var(--background); }
  .skill-button { display: flex; min-width: 0; flex-direction: column; align-items: center; justify-content: center; gap: 0.2rem; padding: 0.15rem 0; border: 0; background: transparent; color: var(--text); cursor: pointer; }
  .skill-button:focus-visible, .close-button:focus-visible { outline: 2px solid #7c5b7d; outline-offset: 2px; }
  .skill-button img { width: 2.1rem; height: 2.1rem; object-fit: contain; }
  :global(.site[data-theme="light"]) .skill-button img { filter: invert(1); }
  .skill-label { max-width: 100%; overflow-wrap: anywhere; text-align: center; font-size: 0.7rem; line-height: 1.1; }
  .skill-level-input { width: 2.4ch; min-width: 2.4ch; max-width: 100%; padding: 0.1rem 0; border: 0; border-bottom: 1px solid #ab65ad; border-radius: 0; background: transparent; font: 0.9rem/1 monospace; text-align: center; }
  .skill-level-input.current { justify-self: start; color: white; }
  .skill-level-input.target { justify-self: end; color: #ffffa6; }
  :global(.site[data-theme="light"]) .skill-level-input.current { color: black; }
  .skill-level-input[type="number"] { appearance: textfield; -moz-appearance: textfield; }
  .skill-level-input::-webkit-inner-spin-button, .skill-level-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  .level-tile { flex: 0 1 9rem; grid-template-rows: 5rem auto; }
  .halo-image-stack { position: relative; grid-column: 2; justify-self: center; align-self: center; width: 5rem; height: 5rem; }
  .halo-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
  .halo-image-target { opacity: 0.7; filter: grayscale(1); mask-image: conic-gradient(from 0deg, #000 0deg var(--target-reveal), transparent var(--target-reveal) 360deg); -webkit-mask-image: conic-gradient(from 0deg, #000 0deg var(--target-reveal), transparent var(--target-reveal) 360deg); }
  .halo-image-current { mask-image: conic-gradient(from 0deg, #000 0deg var(--current-reveal), transparent var(--current-reveal) 360deg); -webkit-mask-image: conic-gradient(from 0deg, #000 0deg var(--current-reveal), transparent var(--current-reveal) 360deg); }
  .star-ue-tile { flex: 1 1 0; min-width: 0; grid-template-columns: minmax(0, 1fr); grid-template-rows: 1fr 1fr; gap: 0.15rem; padding: 0.25rem clamp(0.2rem, 1vw, 0.35rem); }
  .star-set { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: clamp(0.2rem, calc(0.05rem + 0.667vw), 0.3rem); }
  .star-set-content { display: grid; min-width: 0; gap: 0.05rem; }
  .star-set-label { font-size: 0.55rem; line-height: 1; white-space: nowrap; }
  .star-set-label.target { color: #ffffa6; }
  .star-line { display: flex; min-width: 0; align-items: center; }
  .star-choice { display: grid; flex: 0 0 clamp(0.95rem, calc(0.125rem + 3.67vw), 1.5rem); width: clamp(0.95rem, calc(0.125rem + 3.67vw), 1.5rem); height: clamp(0.9rem, 4vw, 1.5rem); place-items: center; padding: 0; border: 0; background: transparent; cursor: pointer; }
  .first-ue-star { margin-left: 0.3rem; }
  .star-choice:disabled { cursor: default; opacity: 1; }
  .star-choice img { display: block; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
  .star-choice.unselected img { filter: grayscale(1); }
  .star-choice.preview-increase img { filter: grayscale(0.4) brightness(0.7); }
  .star-choice.preview-decrease img { filter: grayscale(1); }
  .ue-level-input { width: clamp(2.4ch, calc(1.95ch + 1.2vw), 2.7ch); min-width: clamp(2.4ch, calc(1.95ch + 1.2vw), 2.7ch); justify-self: center; }
  .bond-tile { grid-template-rows: 2.1rem auto; }
  .bond-tile .skill-level-input.current, .limit-break-tile .skill-level-input.current { grid-column: 1; grid-row: 1 / -1; }
  .bond-tile .skill-level-input.target, .limit-break-tile .skill-level-input.target { grid-column: 3; grid-row: 1 / -1; }
  .bond-tile .skill-level-input { width: 3.2ch; min-width: 3.2ch; }
  .bond-image-stack { position: relative; grid-column: 2; justify-self: center; align-self: center; width: 1.6rem; height: 1.6rem; }
  .bond-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
  .bond-image-base { opacity: 0.25; filter: grayscale(1); }
  .bond-image-pink { mask-image: conic-gradient(from 0deg, #000 0deg var(--pink-reveal), transparent var(--pink-reveal) 360deg); -webkit-mask-image: conic-gradient(from 0deg, #000 0deg var(--pink-reveal), transparent var(--pink-reveal) 360deg); }
  .bond-image-purple { filter: hue-rotate(295deg) saturate(1.6); mask-image: conic-gradient(from 0deg, #000 0deg var(--purple-reveal), transparent var(--purple-reveal) 360deg); -webkit-mask-image: conic-gradient(from 0deg, #000 0deg var(--purple-reveal), transparent var(--purple-reveal) 360deg); }
  .bond-image-gold { filter: hue-rotate(70deg) saturate(1.6); mask-image: conic-gradient(from 0deg, #000 0deg var(--gold-reveal), transparent var(--gold-reveal) 360deg); -webkit-mask-image: conic-gradient(from 0deg, #000 0deg var(--gold-reveal), transparent var(--gold-reveal) 360deg); }
  .level-label, .bond-label { grid-column: 1 / -1; grid-row: 2; }
  .limit-break-tile { grid-template-rows: 2.1rem auto; }
  .limit-break-image { grid-column: 2; justify-self: center; width: 2.1rem; height: 2.1rem; object-fit: contain; }
  .limit-break-label { grid-column: 1 / -1; grid-row: 2; white-space: nowrap; }
  .gear-strip { grid-column: 1 / -1; display: flex; justify-content: center; gap: 0.4rem; }
  .gear-tile { grid-template-columns: minmax(0, 1fr) 2.1rem minmax(0, 1fr); grid-template-rows: auto auto; }
  .gear-tile.hidden { visibility: hidden; }
  .gear-image { grid-column: 2; justify-self: center; width: 2.1rem; height: 2.1rem; margin: 0.15rem 0; object-fit: contain; }
  .gear-label { grid-column: 1 / -1; grid-row: 2; justify-self: stretch; min-width: 0; }
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
  @media (max-width: 600px) {
    .skill-overview { grid-template-columns: minmax(6rem, 7rem) minmax(0, 1fr); }
    .portrait-frame { max-width: 7rem; }
    .character-info-panel { gap: 0; padding: 0.25rem; }
    .character-info-top { min-height: 2.1rem; gap: 0.2rem; }
    .squad-type { padding: 0.15rem 0.35rem; font-size: 0.68rem; }
    .terrain-moods { flex-wrap: wrap; gap: 0.12rem; }
    .terrain-mood { width: 2.7rem; height: 1.95rem; flex-basis: 2.7rem; }
    .character-info-details { grid-template-columns: fit-content(50%) minmax(0, 1fr); gap: 0.2rem; }
    .combat-facts { gap: 0.2rem; }
    .info-chip { min-height: 1.25rem; gap: 0.15rem; font-size: 0.6rem; }
    .info-chip > img { width: 0.8rem; height: 0.8rem; flex-basis: 0.8rem; }
    .info-chip-icon-section { min-height: 1.25rem; padding: 0.08rem 0.35rem; }
    .info-chip-icon-section img { width: 0.8rem; height: 0.8rem; }
    .info-chip-name-section { padding: 0.08rem 0.35rem; }
    .weapon-info { padding: 0.15rem; }
  }
  @media (min-width: 601px) {
    .level-strip, .bond-strip, .gear-strip, .skill-strip { width: min(100%, 38rem); justify-self: start; justify-content: flex-start; }
    .skill-tile { min-height: 4.5rem; flex: 1 1 7.25rem; padding-inline: 1.1rem; }
    .first-ue-star { margin-left: 0.7rem; }
    .level-tile { flex: 0 1 10rem; }
    .star-ue-tile { flex: 0 0 max-content; }
    .gear-strip { margin-inline: 0; }
    .bond-tile { grid-template-rows: 3.5rem auto; }
    .bond-image-stack { grid-column: 2; grid-row: 1; width: 2.5rem; height: 2.5rem; }
    .limit-break-tile { grid-template-rows: 3.5rem auto; }
    .gear-tile { grid-template-columns: minmax(0, 1fr) 3.5rem minmax(0, 1fr); }
    .skill-button img, .limit-break-image, .gear-image { width: 3.5rem; height: 3.5rem; }
    .skill-level-input { font-size: 1rem; }
  }
</style>
