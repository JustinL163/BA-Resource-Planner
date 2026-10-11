<script lang="ts">
  import { sanitizeIntegerInput } from '$lib/actions/sanitize-integer-input';
  import { formatAmount } from '$lib/domain/planner/catalog';
  import { lessonProgress } from '$lib/domain/events/lessons';
  import type { EventActions, EventPlan, EventReward, LessonDefinition } from '$lib/domain/events/standard-types';

  let {
    lessons, plan, pointsAvailable, actions, item, t
  }: {
    lessons: LessonDefinition;
    plan: EventPlan;
    pointsAvailable: number;
    actions: Pick<EventActions, 'setLessonPreRuns' | 'setLessonPostRuns' | 'resetLessons'>;
    item: (reward: EventReward) => { name: string; image?: string };
    t: (key: string) => string;
  } = $props();

  let progress = $derived(lessonProgress(
    lessons,
    plan.lesson_pre_runs ?? [],
    plan.lesson_post_runs ?? {},
    pointsAvailable
  ));
  let maxAdditionalRuns = $derived.by(() => {
    const preRuns = plan.lesson_pre_runs ?? [];
    const maxPreRuns = Math.floor(lessons.rank_upgrades[lessons.rank_upgrades.length - 1] / lessons.lesson_cost);
    let count = 0;
    while (preRuns.length + count < maxPreRuns &&
      progress.pointsRemaining > (count + 1) * lessons.lesson_cost) {
      count++;
    }
    return count;
  });

  function addOne(index: number): void {
    if (progress.pointsRemaining <= lessons.lesson_cost || maxAdditionalRuns < 1) return;
    actions.setLessonPreRuns([...(plan.lesson_pre_runs ?? []), index]);
  }

  function addMax(index: number): void {
    if (maxAdditionalRuns < 1) return;
    const runs = [...(plan.lesson_pre_runs ?? [])];
    for (let count = 0; count < maxAdditionalRuns; count++) runs.push(index);
    actions.setLessonPreRuns(runs);
  }

  function postRunCount(index: number): number {
    const count = Number(plan.lesson_post_runs?.[String(index)] ?? 0);
    return Number.isFinite(count) ? Math.max(0, count) : 0;
  }

  function setPostRuns(index: number, value: number): void {
    const runs = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    actions.setLessonPostRuns({ ...(plan.lesson_post_runs ?? {}), [String(index)]: runs });
  }
</script>

<section class="lessons" aria-labelledby="event-lessons-heading">
  <header class="overview">
    <div>
      <h2 id="event-lessons-heading">{t('label-tablessons')}</h2>
      <p class="rank-level">{t('ui-event-lesson-rank')} {progress.rank} · {t('ui-event-lesson-level')} {progress.level}</p>
    </div>
    <button type="button" class="reset" data-event-lesson-reset
      aria-label={t('label-resetlessons')} onclick={() => actions.resetLessons()}>
      {t('label-resetlessons')}
    </button>
  </header>

  <dl class="points" data-event-lesson-points={pointsAvailable} aria-live="polite">
    <div><dt>{t('ui-event-lesson-points')} · {t('ui-event-lesson-points-available')}</dt><dd>{formatAmount(pointsAvailable)}</dd></div>
    <div><dt>{t('ui-event-lesson-points-spent')}</dt><dd>{formatAmount(progress.pointsUsed)}</dd></div>
    <div>
      <dt>{t('ui-event-lesson-points-remaining')}</dt>
      <dd class:negative={progress.pointsRemaining < 0}>{formatAmount(progress.pointsRemaining)}</dd>
    </div>
  </dl>
  {#if progress.pointsRemaining < 0}<p class="overdrawn" role="alert">{t('ui-event-lesson-points-overdrawn')}</p>{/if}
  {#if progress.rankMaxed}<p class="maxed" role="status">{t('ui-event-lesson-max-rank')}</p>{/if}

  <ul class="lesson-list">
    {#each lessons.locations as location, index (index)}
      <li class="lesson" data-event-lesson-location={index}>
        <div class="lesson-heading">
          <h3>
            {t('label-level')} {progress.level}: {location.name1}
            {#if progress.rank >= location.unlock_2} / {location.name2}{/if}
          </h3>
          <span class="unlock">{t('ui-event-lesson-unlock-rank')} {location.unlock_rank}</span>
        </div>

        <div class="rewards" role="group"
          aria-label={`${t('label-tablessons')} ${t('label-level')} ${progress.level} rewards`}>
          {#each lessons.rewards[progress.level - 1] ?? [] as reward, rewardIndex (rewardIndex)}
            {@const id = reward.id ?? reward.type}
            {@const resolvedId = reward.type === 'Material' && reward.id?.startsWith('swap_')
              ? location.id_swap[reward.id] ?? reward.id
              : id}
            {@const resolvedItem = item({
              id: resolvedId,
              type: reward.type,
              count: reward.count ?? 0
            })}
            <span class="reward" title={resolvedItem.name}
              aria-label={`${resolvedItem.name}: ${reward.count ? formatAmount(reward.count) : `${Math.round((reward.chance ?? 0) * 100)}%`}`}>
              {#if resolvedItem.image}
                <img src={resolvedItem.image} alt="" loading="lazy" />
              {:else}
                <span class="fallback" aria-hidden="true">{resolvedItem.name.slice(0, 1)}</span>
              {/if}
              <span class="reward-name">{resolvedItem.name}</span>
              <strong>{reward.count ? formatAmount(reward.count) : `${Math.round((reward.chance ?? 0) * 100)}%`}</strong>
            </span>
          {/each}
        </div>

        {#if progress.rankMaxed}
          {@const currentRuns = postRunCount(index)}
          <label class="post-runs">
            <span class="sr-only">{location.name1}: {t('ui-event-lesson-runs')}</span>
            <input use:sanitizeIntegerInput type="number" min="0" step="1" value={currentRuns}
              max={progress.remainingRuns + currentRuns}
              aria-label={`${location.name1}: ${t('ui-event-lesson-runs')}`}
              data-event-lesson-post-runs={index}
              onchange={(event) => setPostRuns(index, event.currentTarget.valueAsNumber)} />
          </label>
        {:else if progress.rank >= location.unlock_rank}
          <div class="controls">
            <button type="button" data-event-lesson-add={index} disabled={maxAdditionalRuns < 1}
              aria-label={`${location.name1}: ${t('ui-event-lesson-add')}`} onclick={() => addOne(index)}>+</button>
            <button type="button" data-event-lesson-max={index} disabled={maxAdditionalRuns < 1}
              aria-label={`${location.name1}: ${t('ui-event-lesson-max')}`} onclick={() => addMax(index)}>Max</button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  .lessons { min-width: 0; color: var(--text); }
  .overview { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: .65rem; }
  h2, h3, p { margin: 0; }
  h2 { font-size: 1.1rem; }
  .rank-level { margin-top: .15rem; opacity: .8; }
  .points { display: flex; flex-wrap: wrap; gap: .35rem .85rem; margin: 0 0 .7rem; padding: .55rem .7rem; border-left: 3px solid #7c5b7d; background: var(--surface); }
  .points div { display: flex; gap: .3rem; }
  .points dt, .points dd { margin: 0; }
  .points dd { font-weight: 700; }
  .points .negative { color: #b42318; }
  .overdrawn { margin: 0 0 .5rem; color: #b42318; font-weight: 600; }
  .maxed { margin: 0 0 .5rem; color: var(--text); opacity: .8; }
  .lesson-list { display: grid; gap: .5rem; margin: 0; padding: 0; list-style: none; }
  .lesson { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "heading control" "rewards rewards"; align-items: center; gap: .45rem .6rem; min-width: 0; padding: .6rem; border: 1px solid rgba(124, 91, 125, .35); border-radius: .4rem; background: var(--surface); }
  .lesson-heading { grid-area: heading; display: flex; flex-wrap: wrap; align-items: baseline; gap: .15rem .5rem; min-width: 0; }
  .lesson-heading h3 { min-width: 0; font-size: .95rem; font-weight: 600; overflow-wrap: anywhere; }
  .unlock { flex: 0 0 auto; color: #7c5b7d; font-size: .8rem; font-weight: 600; }
  .rewards { grid-area: rewards; display: flex; flex-wrap: wrap; gap: .35rem; min-width: 0; }
  .reward { display: inline-flex; align-items: center; gap: .3rem; min-width: 0; padding: .2rem .35rem; border-radius: .3rem; background: color-mix(in srgb, #7c5b7d 9%, var(--surface)); font-size: .8rem; }
  .reward img, .fallback { width: 1.5rem; height: 1.5rem; flex: 0 0 1.5rem; object-fit: contain; }
  .fallback { display: grid; place-items: center; border-radius: .2rem; background: #7c5b7d; color: #fff; font-weight: 700; }
  .reward-name { overflow-wrap: anywhere; }
  .reward strong { white-space: nowrap; }
  .controls { grid-area: control; display: flex; gap: .35rem; }
  button, input { font: inherit; color: var(--text); }
  button { min-height: 2rem; padding: .25rem .6rem; border: 1px solid #7c5b7d; border-radius: .3rem; background: var(--surface); cursor: pointer; }
  button:hover:not(:disabled) { background: color-mix(in srgb, #7c5b7d 12%, var(--surface)); }
  button:disabled { cursor: not-allowed; opacity: .55; }
  .reset { flex: 0 0 auto; }
  .post-runs { grid-area: control; }
  input { width: 5rem; min-height: 2rem; padding: .2rem .35rem; border: 1px solid rgba(124, 91, 125, .65); border-radius: .3rem; background: var(--surface); }
  button:focus-visible, input:focus-visible { outline: 3px solid #7c5b7d; outline-offset: 2px; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  @media (max-width: 400px) {
    .overview { align-items: flex-start; }
    .lesson { padding: .5rem; }
    .reward { gap: .2rem; padding: .15rem .25rem; font-size: .75rem; }
  }
</style>
