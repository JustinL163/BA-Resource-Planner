<script lang="ts">
  import { onMount, tick } from 'svelte';
  import strings from '$content/strings.json';
  import PlannerDialog from '$lib/components/planner/PlannerDialog.svelte';
  import { getLanguageString } from '$lib/domain/localisation';
  import {
    allowedAnswer, answerFor, calculateScore, createChoices, createQuestionPool, defaultGuesserSettings,
    evaluateAnswer, formatNumber, formatTime, guesserCategories, imageFor, recordHash, recordIsValid,
    scoreTitle, shuffleQuestions, type GuesserCategory, type GuesserData, type GuesserQuestion,
    type GuesserSettings, type GuessRecord, type GuessRecords
  } from '$lib/domain/guesser';
  import { preferences } from '$lib/stores/preferences';

  const t = (id: string) => getLanguageString(strings, id, $preferences.language);
  const categoryTitles: Record<GuesserCategory, string> = {
    Halos: "Who's that Halo?", Weapons: "Who's that Weapon?", Chocolates: "Who's that Chocolate?",
    Silhouettes: "Who's that Student?", Surnames: "Who's that Surname?", Ages: "Who's that Age?",
    Birthdays: "Who's that Birthday?", Heights: "Who's that Height?"
  };

  let data = $state<GuesserData | null>(null);
  let loadError = $state('');
  let loadingData = $state(true);
  let records = $state<GuessRecords>({});
  let recordsReady = $state(false);
  let recordsWritable = $state(true);
  let recordsMessage = $state('');
  let settings = $state<GuesserSettings>({ ...defaultGuesserSettings });

  let active = $state(false);
  let result = $state<{
    correct: number; wrong: number; elapsed: string; score: number | null; title: string; hash: number | null;
  } | null>(null);
  let retrying = $state(false);
  let roundItems = $state<GuesserQuestion[]>([]);
  let failedItems = $state<GuesserQuestion[]>([]);
  let questionIndex = $state(0);
  let currentQuestion = $state<GuesserQuestion | null>(null);
  let choices = $state<Array<string | number>>([]);
  let correct = $state(0);
  let wrong = $state(0);
  let currentGuesses = $state(0);
  let answerInput = $state('');
  let revealedAnswer = $state('');
  let revealKind = $state<'wrong' | 'half-correct' | ''>('');
  let selectedWrongChoice = $state<string | number | null>(null);
  let showingAnswer = $state(false);
  let deadline = 0;
  let timerText = $state('');
  let startTime = 0;
  let failureTimeBonus = false;
  let revealTimeout: number | undefined;
  let confirmQuit = $state(false);
  let confirmPreload = $state(false);
  let preloading = $state(false);
  let preloadProgress = $state({ loaded: 0, total: 0, failed: 0 });
  let preloadMessage = $state('');

  const title = $derived(categoryTitles[settings.category]);
  const currentImage = $derived(currentQuestion ? imageFor(currentQuestion, settings) : '/game/guesser/BA_halo.webp');
  const validRecords = $derived(guesserCategories.flatMap((category) => {
    const record = records[category];
    return recordIsValid(record) ? [{ category, record }] : [];
  }));

  onMount(() => {
    loadStoredRecords();
    void loadData();
    const timer = window.setInterval(updateTimer, 30);
    return () => {
      window.clearInterval(timer);
      if (revealTimeout !== undefined) window.clearTimeout(revealTimeout);
    };
  });

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function loadStoredRecords() {
    try {
      const raw = localStorage.getItem('records');
      if (raw === null) records = {};
      else {
        const value: unknown = JSON.parse(raw);
        if (!isRecord(value)) throw new Error('Saved guessing-game records have an invalid format.');
        records = value;
        let cleaned = false;
        for (const category of guesserCategories) {
          const record = records[category];
          if (record && !recordIsValid(record)) {
            records[category] = '';
            cleaned = true;
          }
        }
        if (cleaned) {
          try { localStorage.setItem('records', JSON.stringify(records)); }
          catch (error) {
            recordsWritable = false;
            recordsMessage = error instanceof Error ? error.message : 'Invalid saved records could not be cleaned.';
          }
        }
      }
    } catch (error) {
      records = {};
      recordsWritable = false;
      recordsMessage = error instanceof Error ? error.message : 'Saved records could not be read.';
    } finally {
      recordsReady = true;
    }
  }

  async function loadData() {
    loadingData = true;
    loadError = '';
    try {
      const response = await fetch('/game/guesser/data.json?3');
      if (!response.ok) throw new Error(`Character data request failed (${response.status}).`);
      const value: unknown = await response.json();
      if (!isRecord(value) || !isRecord(value.halos)) throw new Error('Character data has an invalid format.');
      data = value as unknown as GuesserData;
    } catch (error) {
      loadError = error instanceof Error ? error.message : 'Character data could not be loaded.';
    } finally {
      loadingData = false;
    }
  }

  function setInputType(input: GuesserSettings['input']) {
    if (input === 'MultiChoice') {
      settings = { ...settings, input, maxGuesses: 1 };
    } else {
      settings = { ...settings, input, timeLimit: settings.timeLimit === 1.5 ? 3 : settings.timeLimit };
    }
  }

  function allowKey(event: KeyboardEvent): boolean {
    if (showingAnswer) return false;
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.key.length > 1) return true;
    if (['Halos', 'Weapons', 'Chocolates', 'Silhouettes', 'Surnames'].includes(settings.category)) return /[a-z]/i.test(event.key);
    if (settings.category === 'Ages') return /[a-z\d? ]/i.test(event.key);
    if (settings.category === 'Heights') return /\d/.test(event.key);
    return true;
  }

  async function startGame(retry: boolean) {
    if (!data) return;
    if (revealTimeout !== undefined) window.clearTimeout(revealTimeout);
    result = null;
    showingAnswer = false;
    revealedAnswer = '';
    revealKind = '';
    selectedWrongChoice = null;
    correct = 0;
    wrong = 0;
    currentGuesses = 0;
    answerInput = '';
    retrying = retry;
    const source = retry ? failedItems : createQuestionPool(data, settings.category);
    roundItems = shuffleQuestions(source);
    failedItems = [];
    questionIndex = 0;
    if (!roundItems.length) {
      loadError = `No questions are available for ${settings.category}.`;
      return;
    }
    active = true;
    startTime = Date.now();
    loadQuestion();
    await tick();
    if (settings.input === 'Freeform') document.querySelector<HTMLInputElement>('#guesser-answer')?.focus();
  }

  function loadQuestion() {
    if (questionIndex >= roundItems.length) {
      finish(!retrying);
      return;
    }
    currentQuestion = roundItems[questionIndex];
    currentGuesses = 0;
    answerInput = '';
    revealedAnswer = '';
    revealKind = '';
    selectedWrongChoice = null;
    showingAnswer = false;
    choices = settings.input === 'MultiChoice' ? createChoices(currentQuestion, roundItems, settings) : [];
    if (settings.timeLimit) {
      deadline = Date.now() + settings.timeLimit * 1000 + (questionIndex === 0 ? 1000 : 0);
      if (failureTimeBonus) {
        deadline += 500;
        failureTimeBonus = false;
      }
      timerText = Math.max(0, (deadline - Date.now()) / 1000).toFixed(1);
    } else {
      deadline = 0;
      timerText = '';
    }
  }

  function updateTimer() {
    if (!active || !settings.timeLimit || !deadline || showingAnswer) return;
    const remaining = deadline - Date.now();
    timerText = Math.max(0, remaining / 1000).toFixed(1);
    if (remaining <= 0) {
      if (settings.input === 'Freeform') {
        const result = submitAnswer();
        if (result === 'invalid') failQuestion();
      } else failQuestion();
    }
  }

  function submitAnswer(choice?: string | number): 'invalid' | 'accepted' | 'failed' {
    if (!active || !currentQuestion || showingAnswer) return 'invalid';
    const isChoice = choice !== undefined;
    const raw = isChoice ? String(choice) : answerInput;
    if (!isChoice && !allowedAnswer(raw, roundItems, settings)) return 'invalid';
    const answer = isChoice ? raw.toLowerCase() : /^\d*$/i.test(raw) ? Number.parseInt(raw, 10) : raw.toLowerCase();
    if (!isChoice) answerInput = '';
    currentGuesses++;
    const outcome = evaluateAnswer(currentQuestion, String(answer), settings);
    if (outcome === 'correct') {
      correct++;
      questionIndex++;
      loadQuestion();
      return 'accepted';
    }
    if (outcome === 'half-correct') {
      correct++;
      void revealQuestion(String(answerFor(currentQuestion, settings)), choice ?? null, 'half-correct');
      return 'accepted';
    }
    if (isChoice) selectedWrongChoice = choice ?? null;
    if (currentGuesses >= (settings.input === 'MultiChoice' ? 1 : settings.maxGuesses)) {
      failQuestion(isChoice ? choice : null);
      return 'failed';
    }
    return 'accepted';
  }

  async function revealQuestion(answer: string, wrongChoice: string | number | null, kind: 'wrong' | 'half-correct') {
    if (!currentQuestion) return;
    if (kind === 'wrong') {
      wrong++;
      failedItems.push(currentQuestion);
      failureTimeBonus = true;
      if (settings.input === 'Freeform') answerInput = answer;
    }
    revealedAnswer = answer;
    revealKind = kind;
    selectedWrongChoice = wrongChoice;
    questionIndex++;
    showingAnswer = true;
    if (kind === 'wrong' && settings.input === 'Freeform') {
      await tick();
      document.querySelector<HTMLInputElement>('#guesser-answer')?.focus({ preventScroll: true });
    }
    window.clearTimeout(revealTimeout);
    revealTimeout = window.setTimeout(() => {
      revealTimeout = undefined;
      if (!active) return;
      showingAnswer = false;
      if (questionIndex >= roundItems.length) finish(!retrying);
      else loadQuestion();
    }, 2000);
  }

  function failQuestion(choice: string | number | null = null) {
    if (!currentQuestion || showingAnswer) return;
    const answer = String(answerFor(currentQuestion, settings));
    void revealQuestion(answer, choice, 'wrong');
  }

  function finish(completed: boolean) {
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const elapsed = formatTime(elapsedSeconds);
    active = false;
    showingAnswer = false;
    timerText = '';
    let score: number | null = null;
    let title = '';
    let hash: number | null = null;
    if (completed) {
      score = calculateScore(correct, roundItems.length, elapsedSeconds, settings);
      title = scoreTitle(settings);
      const values = { score, time: elapsed, correct, wrong, title };
      hash = recordHash(values);
      if (!retrying) storeHighScore({ ...values, string: hash });
    }
    result = { correct, wrong, elapsed, score, title, hash };
  }

  function storeHighScore(record: GuessRecord) {
    const old = records[settings.category];
    const oldScore = isRecord(old) ? Number.parseInt(String(old.score), 10) : Number.NaN;
    if (old && !(record.score > oldScore)) return;
    records = { ...records, [settings.category]: record };
    if (!recordsWritable) return;
    try {
      localStorage.setItem('records', JSON.stringify(records));
      recordsMessage = '';
    } catch (error) {
      recordsWritable = false;
      recordsMessage = error instanceof Error ? error.message : 'The best score could not be saved.';
    }
  }

  function returnToMenu() {
    if (revealTimeout !== undefined) window.clearTimeout(revealTimeout);
    active = false;
    showingAnswer = false;
    currentQuestion = null;
    choices = [];
    result = null;
    answerInput = '';
    timerText = '';
  }

  async function preloadImages() {
    if (!data) return;
    const urls = [...new Set(createQuestionPool(data, settings.category).map((question) => imageFor(question, settings)))];
    preloading = true;
    preloadProgress = { loaded: 0, total: urls.length, failed: 0 };
    preloadMessage = '';
    await Promise.all(urls.map((url) => new Promise<void>((resolve) => {
      const image = new Image();
      let settled = false;
      const settle = (failed: boolean) => {
        if (settled) return;
        settled = true;
        preloadProgress = {
          ...preloadProgress, loaded: preloadProgress.loaded + 1,
          failed: preloadProgress.failed + (failed ? 1 : 0)
        };
        resolve();
      };
      image.onload = () => settle(false);
      image.onerror = () => settle(true);
      image.src = url;
      if (image.complete) settle(image.naturalWidth === 0);
    })));
    preloading = false;
    preloadMessage = preloadProgress.failed
      ? `Loaded ${preloadProgress.loaded - preloadProgress.failed} of ${preloadProgress.total} images; ${preloadProgress.failed} could not be loaded.`
      : `Loaded all ${preloadProgress.total} images.`;
    confirmPreload = false;
  }
</script>

<svelte:head>
  <title>Who's that Halo? · Blue Archive</title>
  <meta name="description" content="Guess Blue Archive students from their halos, weapons, chocolates, silhouettes and more." />
</svelte:head>

<section class="guesser-page">
  <div class="background" aria-hidden="true"></div>
  <div class="game-layout">
    <div class="game-column">
      <a class="back-link" href="/planner/resources/">← Resource Planner</a>
      <section class="game-card" aria-label="Who's that Halo? guessing game">
        <h1>{title}</h1>

        {#if loadError}<p class="message error" role="alert">{loadError}<button type="button" onclick={() => { void loadData(); }}>Retry loading</button></p>{/if}
        {#if recordsMessage}<p class="message warning" role="status">Records: {recordsMessage}</p>{/if}

        {#if loadingData}
          <p class="loading" role="status">Loading character data…</p>
        {:else if !active && !result}
          <div class="menu-image"><img src="/game/guesser/BA_halo.webp" alt="Blue Archive halo" /></div>
          <div class="settings" aria-label="Game settings">
            <fieldset>
              <legend>Content type</legend>
              <div class="setting-grid category-grid">
                {#each guesserCategories as category}
                  <button type="button" class:selected={settings.category === category} aria-pressed={settings.category === category}
                    onclick={() => settings = { ...settings, category }}>{category}</button>
                {/each}
              </div>
            </fieldset>
            <fieldset>
              <legend>Input type</legend>
              <div class="setting-grid two-columns">
                {#each ['Freeform', 'MultiChoice'] as inputType}
                  <button type="button" class:selected={settings.input === inputType} aria-pressed={settings.input === inputType}
                    onclick={() => setInputType(inputType as GuesserSettings['input'])}>{inputType === 'MultiChoice' ? 'Multiple choice' : inputType}</button>
                {/each}
              </div>
            </fieldset>
            <fieldset>
              <legend>Time limit</legend>
              <div class="setting-grid time-grid">
                {#if settings.input === 'MultiChoice'}
                  <button type="button" class:selected={settings.timeLimit === 1.5} aria-pressed={settings.timeLimit === 1.5} onclick={() => settings = { ...settings, timeLimit: 1.5 }}>1.5s</button>
                {/if}
                {#each [3, 10] as seconds}
                  <button type="button" class:selected={settings.timeLimit === seconds} aria-pressed={settings.timeLimit === seconds} onclick={() => settings = { ...settings, timeLimit: seconds }}>{seconds}s</button>
                {/each}
                <button type="button" class:selected={settings.timeLimit === null} aria-pressed={settings.timeLimit === null} onclick={() => settings = { ...settings, timeLimit: null }}>No limit</button>
              </div>
            </fieldset>
            {#if settings.input === 'Freeform'}
              <fieldset>
                <legend>Maximum guesses</legend>
                <div class="setting-grid three-columns">
                  {#each [1, 2, 3] as count}
                    <button type="button" class:selected={settings.maxGuesses === count} aria-pressed={settings.maxGuesses === count} onclick={() => settings = { ...settings, maxGuesses: count }}>{count}</button>
                  {/each}
                </div>
              </fieldset>
            {/if}
            {#if ['Halos', 'Weapons', 'Chocolates'].includes(settings.category)}
              <fieldset>
                <legend>Colour</legend>
                <div class="setting-grid two-columns">
                  {#each ['Colour', 'Grayscale'] as colour}
                    <button type="button" class:selected={settings.colour === colour} aria-pressed={settings.colour === colour}
                      onclick={() => settings = { ...settings, colour: colour as GuesserSettings['colour'] }}>{colour}</button>
                  {/each}
                </div>
              </fieldset>
            {/if}
            {#if settings.category === 'Heights' && settings.input === 'Freeform'}
              <fieldset>
                <legend>Height lenience</legend>
                <div class="setting-grid three-columns">
                  {#each [0, 1, 3] as amount}
                    <button type="button" class:selected={settings.lenience === amount} aria-pressed={settings.lenience === amount}
                      onclick={() => settings = { ...settings, lenience: amount as GuesserSettings['lenience'] }}>{amount} cm</button>
                  {/each}
                </div>
              </fieldset>
            {/if}
            {#if settings.category === 'Birthdays'}
              <fieldset>
                <legend>Date mode</legend>
                <div class="setting-grid two-columns">
                  {#each ['Month', 'Date'] as mode}
                    <button type="button" class:selected={settings.dateMode === mode} aria-pressed={settings.dateMode === mode}
                      onclick={() => settings = { ...settings, dateMode: mode as GuesserSettings['dateMode'] }}>{mode === 'Date' ? 'Full date' : mode}</button>
                  {/each}
                </div>
              </fieldset>
            {/if}
            {#if settings.category === 'Silhouettes'}
              <fieldset>
                <legend>Conscious state</legend>
                <div class="setting-grid two-columns">
                  {#each ['Awake', 'Sleeping'] as state}
                    <button type="button" class:selected={settings.conscious === state} aria-pressed={settings.conscious === state}
                      onclick={() => settings = { ...settings, conscious: state as GuesserSettings['conscious'] }}>{state}</button>
                  {/each}
                </div>
              </fieldset>
            {/if}
          </div>
          <div class="menu-actions">
            <button type="button" class="primary" onclick={() => { void startGame(false); }} disabled={!data || loadingData}>Start guessing</button>
            <button type="button" onclick={() => { confirmPreload = true; preloadMessage = ''; }} disabled={!data || loadingData}>Preload images</button>
          </div>
          {#if preloadMessage}<p class="preload-status" role="status">{preloadMessage}</p>{/if}
        {:else if active && currentQuestion}
          <div class="play-topline">
            <div class="guess-counts" aria-label="Round score">
              <span class="correct-count" aria-label="Correct answers">{correct}</span>
              <span class="wrong-count" aria-label="Failed questions">{wrong}</span>
              <span class="remaining-count" aria-label="Questions remaining">{roundItems.length - questionIndex}</span>
            </div>
            {#if settings.timeLimit}<div class="timer" role="timer" aria-label="Time remaining">{showingAnswer ? '—' : timerText}s</div>{/if}
          </div>
          <p class="question-position">Question {Math.min(questionIndex + (showingAnswer ? 0 : 1), roundItems.length)} of {roundItems.length}</p>
          <div class="question-image" class:weapon={settings.category === 'Weapons'} class:splashart={['Silhouettes', 'Surnames', 'Ages', 'Birthdays', 'Heights'].includes(settings.category)}>
            <img src={currentImage} alt="Guess the character" class:silhouette={settings.category === 'Silhouettes' && !showingAnswer}
              class:grayscale={settings.colour === 'Grayscale' && ['Halos', 'Weapons', 'Chocolates'].includes(settings.category)} />
          </div>
          {#if settings.input === 'Freeform'}
            <form class="answer-form" onsubmit={(event) => { event.preventDefault(); submitAnswer(); }}>
              <label for="guesser-answer">Your guess</label>
              <input id="guesser-answer" type="text" autocomplete="off" spellcheck="false" bind:value={answerInput}
                class:failed={showingAnswer && revealKind === 'wrong'} class:halfcorrect={showingAnswer && revealKind === 'half-correct'}
                readonly={showingAnswer && revealKind === 'wrong'} disabled={showingAnswer && revealKind !== 'wrong'}
                onkeydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submitAnswer(); } else if (!allowKey(event)) event.preventDefault(); }} />
              <button class="primary" type="submit" disabled={showingAnswer}>Submit</button>
            </form>
          {:else}
            <div class="choices" aria-label="Answer choices">
              {#each choices as choice, index}
                {@const isCorrectChoice = showingAnswer && String(choice).toLowerCase() === revealedAnswer.toLowerCase()}
                {@const isWrongChoice = showingAnswer && selectedWrongChoice !== null && String(choice).toLowerCase() === String(selectedWrongChoice).toLowerCase()}
                <button type="button" class:correct-choice={isCorrectChoice} class:wrong-choice={isWrongChoice} disabled={showingAnswer}
                  onclick={() => submitAnswer(choice)}>{choice}</button>
              {/each}
            </div>
          {/if}
          {#if showingAnswer && revealKind !== 'wrong'}<p class="answer-reveal" class:half={revealKind === 'half-correct'} role="status">Close! {revealedAnswer}</p>{/if}
          {#if !showingAnswer && settings.input === 'Freeform'}<p class="attempts">Guesses: {currentGuesses} / {settings.maxGuesses}</p>{/if}
          <button type="button" class="restart-button" aria-label="Return to menu" onclick={() => confirmQuit = true}><img src="/planner/icons/UI/rotate-left-solid.svg" alt="" /> Return to menu</button>
        {:else if result}
          <div class="result-summary">
            <div class="final-counts"><span class="correct-count">{result.correct}</span><span class="wrong-count">{result.wrong}</span></div>
            <p class="elapsed">Time: {result.elapsed}</p>
            {#if result.score !== null}
              <code class="result-score-code">{result.hash}</code>
              <p class="final-score">Score: {formatNumber(result.score)}</p>
              <p class="modifier-title">{result.title}</p>
            {:else}<p class="retry-note">Retry round complete. Retry rounds do not affect saved records.</p>{/if}
          </div>
          <div class="result-actions">
            <button type="button" class="primary" onclick={returnToMenu}>Return</button>
            {#if failedItems.length}<button type="button" onclick={() => { void startGame(true); }}>Retry failed questions ({failedItems.length})</button>{/if}
          </div>
        {/if}
      </section>
    </div>

    <aside class="records-panel" aria-label="Best scores">
      <h2>Best scores</h2>
      {#if recordsReady && validRecords.length}
        {#each validRecords as entry}
          <article class="record-card">
            <h3>{entry.record.title || entry.category}</h3>
            <div class="record-stats">
              <span class="record-score"><strong>{formatNumber(Number(entry.record.score))}</strong><code>{entry.record.string}</code></span>
              <span>{entry.record.time}</span>
            </div>
            <p><span class="correct-count">{entry.record.correct}</span> correct · <span class="wrong-count">{entry.record.wrong}</span> failed</p>
          </article>
        {/each}
      {:else if recordsReady}<p class="empty-records">Your best scores will appear here.</p>{/if}
    </aside>
  </div>
</section>

{#if confirmQuit}
  <PlannerDialog title="Return to menu?" close={() => confirmQuit = false} width="420px" {t}>
    <p>Your current round will end without saving a score.</p>
    <div class="dialog-actions">
      <button type="button" onclick={() => confirmQuit = false}>Keep playing</button>
      <button type="button" class="primary" onclick={() => { confirmQuit = false; returnToMenu(); }}>Return</button>
    </div>
  </PlannerDialog>
{/if}

{#if confirmPreload}
  <PlannerDialog title="Preload game images?" close={() => { if (!preloading) confirmPreload = false; }} width="480px" busy={preloading} {t}>
    {#if preloading}
      <p>Loading {preloadProgress.loaded} of {preloadProgress.total} images…</p>
      <progress value={preloadProgress.loaded} max={preloadProgress.total || 1}></progress>
    {:else}
      <p>Load the images for {settings.category} now so they are ready during the game?</p>
      <div class="dialog-actions">
        <button type="button" onclick={() => confirmPreload = false}>Cancel</button>
        <button type="button" class="primary" onclick={() => { void preloadImages(); }}>Load images</button>
      </div>
    {/if}
  </PlannerDialog>
{/if}

<style>
  .guesser-page { min-height: 100vh; position: relative; isolation: isolate; padding: clamp(1rem, 3vw, 2.5rem); background: #f7f7f7; color: #1e2024; }
  .background { position: fixed; inset: -2rem; z-index: -1; background: url('/game/guesser/BG_ReceptionRoom.jpg') center / cover; filter: blur(24px); opacity: 0.82; }
  .game-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, 26rem); gap: clamp(1rem, 3vw, 2.5rem); align-items: start; max-width: 1440px; margin: auto; }
  .game-column { min-width: 0; }
  .back-link { display: inline-block; margin: 0 0 0.8rem 0.2rem; padding: 0.45rem 0.75rem; border-radius: 999px; background: #ffffffd6; color: #282a35; text-decoration: none; font-weight: 700; }
  .game-card { position: relative; min-height: min(840px, calc(100vh - 5rem)); padding: clamp(1rem, 2.5vw, 2rem); border: 1px solid #ffffffbd; border-radius: 1.2rem; background: #f7f7f7ed; box-shadow: 0 12px 38px #14172540; }
  h1 { margin: 0 0 1rem; text-align: center; font-size: clamp(1.65rem, 4vw, 2.2rem); }
  h2 { margin: 0 0 1rem; }
  .menu-image { display: grid; place-items: center; margin: 0.5rem 0 1rem; }
  .menu-image img { width: min(12rem, 45vw); height: auto; }
  .settings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.7rem 1rem; }
  fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
  legend { margin-bottom: 0.35rem; font-weight: 700; }
  .setting-grid { display: grid; gap: 0.3rem; }
  .category-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .two-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .three-columns { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .time-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .setting-grid button { min-width: 0; padding: 0.4rem 0.25rem; border: 1px solid #555b68; background: #fff; color: #20212a; font-size: 0.84rem; }
  .setting-grid button.selected { background: #282a35; color: #fff; border-color: #282a35; }
  .menu-actions, .result-actions, .dialog-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.55rem; margin-top: 1rem; }
  button { border: 1px solid #565b68; background: #fff; color: #20212a; }
  button.primary { background: #7c5b7d; border-color: #68496a; color: white; font-weight: 700; }
  button:hover:not(:disabled) { filter: brightness(0.94); }
  .loading, .message, .preload-status { padding: 0.7rem; border-radius: 0.6rem; text-align: center; }
  .message button { display: block; margin: 0.5rem auto 0; }
  .error { background: #ffe4e7; color: #7d1e2d; }
  .warning { background: #fff2ca; color: #5d4a11; }
  .preload-status { margin: 0.65rem 0 0; background: #e6f4e5; }
  .play-topline { display: flex; justify-content: space-between; align-items: flex-start; min-height: 2.5rem; }
  .guess-counts { display: flex; gap: 0.75rem; font: 700 1.8rem monospace; }
  .correct-count { color: #5c9c00; }
  .wrong-count { color: #bd1e2a; }
  .remaining-count { color: #222; }
  .timer { color: #bd1e2a; font-size: 1.4rem; font-weight: 700; }
  .question-position { margin: 0 0 0.5rem; text-align: center; color: #555b68; }
  .question-image { display: grid; min-width: 0; place-items: center; width: min(20rem, 72vw); height: min(20rem, 48vh); margin: 0 auto 1rem; }
  .question-image.weapon { width: 100%; max-width: 58rem; height: min(20rem, 48vh); min-height: 0; }
  .question-image.splashart { width: auto; max-width: 100%; height: min(30rem, 48vh); }
  .question-image img { display: block; min-width: 0; min-height: 0; width: 100%; height: 100%; object-fit: contain; }
  .question-image img.silhouette { filter: brightness(0); }
  .question-image img.grayscale { filter: grayscale(1); }
  .question-image img.silhouette.grayscale { filter: brightness(0); }
  .answer-form { display: flex; flex-wrap: wrap; align-items: end; justify-content: center; gap: 0.45rem; max-width: 32rem; margin: auto; }
  .answer-form label { width: 100%; font-weight: 700; }
  .answer-form input { flex: 1; min-width: 9rem; padding: 0.6rem; border: 1px solid #777; border-radius: 0.45rem; background: white; color: #1e2024; font-size: 1.15rem; text-align: center; }
  .answer-form input.failed { color: #bd1e2a; }
  .answer-form input.halfcorrect { color: #cf7a00; }
  .choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.4rem; max-width: 32rem; margin: 1rem auto 0; }
  .choices button { min-height: 3.2rem; padding: 0.5rem; background: #e9e9ed; font-size: 1rem; }
  .choices button.correct-choice { background: #b9efbb; }
  .choices button.wrong-choice { background: #f5b6ba; }
  .attempts { margin: 0.55rem 0 0; text-align: center; font-size: 0.85rem; color: #555b68; }
  .answer-reveal { margin: 0.6rem 0; text-align: center; color: #bd1e2a; font-weight: 700; }
  .answer-reveal.half { color: #cf7a00; }
  .restart-button { display: flex; align-items: center; gap: 0.4rem; margin: 1.3rem auto 0; background: transparent; border: 0; }
  .restart-button img { width: 1.2rem; height: 1.2rem; filter: brightness(0.2); }
  .result-summary { padding: 1.3rem; border-radius: 0.9rem; background: #ffffff; text-align: center; }
  .final-counts { display: flex; justify-content: center; gap: 2rem; font: 700 2.5rem monospace; }
  .elapsed { margin: 0.3rem 0; }
  .final-score { margin: 0.7rem 0 0; font-size: 1.8rem; font-weight: 700; }
  .modifier-title { margin: 0.4rem 0; }
  .retry-note { max-width: 26rem; margin: 1rem auto 0; }
  .records-panel { display: grid; gap: 0.6rem; }
  .records-panel h2 { padding: 0.65rem 0.85rem; margin: 0; border-radius: 0.7rem; background: #ffffffdf; }
  .record-card { padding: 0.75rem; border-radius: 0.8rem; background: #ffffff; box-shadow: 0 4px 14px #1417251c; }
  .record-card h3 { margin: 0 0 0.4rem; font-size: 0.95rem; }
  .record-stats { display: flex; justify-content: space-between; gap: 0.6rem; }
  .record-score { display: flex; min-width: 0; align-items: baseline; gap: 0.3rem; }
  .record-stats strong { font-size: 1.25rem; }
  .record-score code, .result-score-code { color: rgb(253 253 253); font-size: 0.62rem; white-space: nowrap; }
  .result-score-code { display: block; margin-top: 0.3rem; }
  .record-card p { margin: 0.4rem 0; font-size: 0.88rem; }
  .empty-records { padding: 0.75rem; border-radius: 0.7rem; background: #ffffffc7; }
  progress { width: 100%; }
  @media (max-width: 1200px) {
    .game-layout { max-width: 46rem; grid-template-columns: minmax(0, 1fr); }
    .game-card { min-height: auto; }
    .records-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .records-panel h2, .empty-records { grid-column: 1 / -1; }
  }
  @media (max-width: 600px) {
    .guesser-page { padding: 0.7rem; }
    .game-layout { gap: 0.75rem; }
    .game-card { padding: 0.8rem; }
    .settings { grid-template-columns: minmax(0, 1fr); }
    .category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .question-image { height: min(19rem, 40vh); }
    .question-image.splashart { height: min(26rem, 43vh); }
    .records-panel { grid-template-columns: minmax(0, 1fr); }
    .records-panel h2, .empty-records { grid-column: auto; }
  }
</style>
