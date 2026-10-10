# Blue Archive Planner migration handoff

As of 2026-10-10. This file is intended to let a fresh Codex app session resume
the migration without relying on chat history. Read it together with `README.md`
and inspect the worktree before making changes.

## Current repository state

- Repository: `JustinL163/BA-Resource-Planner`.
- Current branch/worktree: `justinl163-didactic-telegram`.
- Latest commit: `61bb34b` (`Migrate guessing game to Svelte`).
- The Lessons and Valentine Patrol rerun Invasion migrations are already in
  history; do not cherry-pick or reapply them.
- The Raid Videos migration and UI refinement are committed in `6e98c73`.
- The Tournament Tracker migration is committed in `f3126b9`.
- The Guessing Game migration is committed in `61bb34b`; push status is not
  checked.

## User goal and constraints

The goal is a complete conversion of the Blue Archive helper site to modular
SvelteKit while preserving calculations, saves, compact UI conventions and
worker performance. Heavy simulations must continue to run in Web Workers.

- Keep `adapter-static`: no server routes/actions or runtime server dependencies.
  Data loads from static assets or client-side APIs.
- Preserve existing `save-data` and feature-specific localStorage keys, unknown
  fields, export compatibility, existing cloud/API contracts and old URLs.
- Treat legacy formulas, LP solver output/order, math.js rounding and worker
  payloads as compatibility contracts. Characterize against independent legacy
  fixtures before replacing them.
- Do not remove the old pages or workers as part of a UI migration; keep working
  fallbacks until the replacement is verified.
- On Windows use `npm.cmd`/`npx.cmd` if PowerShell blocks `.ps1` shims.
- The user previously requested bounded work delegated to GPT-6 Luna xhigh
  subagents when appropriate. Review any delegated output independently.

## What is already migrated

**Svelte foundation:** static SvelteKit build, shared layout/preferences,
credits/privacy/changelog/debug routes and compatibility redirects.

**Resource planner** at `/planner/resources/`: character editing, inventory and
resource totals, compact character cards, drag/touch/keyboard ordering,
inclusion controls, team/group editing, bulk editing, selector/search aliases,
gear-farming recommendations in a worker, skill details, local backup/import,
and compatible cloud transfers.

**Event calculations:** extracted AP/bonus/first-clear/model calculations, with
the existing LP solver in a worker. `/planner/event-planner/` currently supports
the allowlisted standard, box, card, dice, Omikuji, Lessons, and Invasion flows.
Normal simulation workers, solver, statistics and math.js remain unchanged.
Invasion uses a pure typed rules module; it is not a simulation.

**Raid Videos** at `/planner/raids/`: static Svelte route with JP/Global/CN raid
timelines, boss/terrain/difficulty filters, student include/exclude filters,
video lists, and a submission/editor flow. The existing `/planner/raids.html`
page and its source files remain available. Catalog JSON stays at
`planner/json/raids.json`; video feeds still load from the existing raw GitHub
URL. The `local-submissions` lifecycle, `default-raids-server` preference,
client-side `submitraid`/`editraid` APIs, and shared search/credential helpers are
preserved. Legacy video entries are clickable links; the old embed helper had no
active call sites.

**Tournament Tracker** at `/planner/tournaments/`: static Svelte editor with the
active S7 Wakamo controls, player-order-insensitive record lookup, force pick,
five bans per side, two ordered 4-Striker/2-Special team lists, borrowed student
markers, scores, and CSV export. It keeps the existing client-side
`GET /loadtourneydata` and `POST /settourneydata` contract, stores the password
under `TournamentPassword`, and sends it only in that request header. The
original `/planner/tournaments.html` page remains available.

**Supporting pages:** legacy content pages have static Svelte equivalents.

**Guessing Game** at `/game/`: Svelte implementation of all eight quiz types,
freeform/multiple-choice answers, settings, score and failed-question retry
flow, compatible `records` storage, and category image preloading. The static
dataset and old asset URLs are reused. The existing `/game/guesser.html` page
and its assets remain available and unchanged as a fallback.

## Continuation progress (2026-10-10)

The Raid Videos route was committed in `6e98c73`. The shared navigation points
to `/planner/raids/`; development and production static preview serve the Svelte
route there, while `/planner/raids.html` still serves the legacy page.

The Tournament Tracker is implemented at `/planner/tournaments/`; the
development and production static routes use Svelte while
`/planner/tournaments.html` remains the legacy fallback. Its client API uses the
existing `TournamentPassword` header and exact record payload. It is committed
in `f3126b9`.

The Guessing Game now uses the Svelte route `/game/`, matching the existing game
manifest start URL. Its legacy URL `/game/guesser.html` remains available and
byte-identical, and legacy image URLs and `localStorage["records"]` are
preserved. The implementation does not register a new service worker; the
existing game worker/cache lifecycle remains for the legacy page and is part of
the final PWA transition. See verification results below. This slice is committed
in `61bb34b`.

## Recent completed stage

Commit `50f62cf` adds the archived **Schale's Happy Valentine Patrol rerun**
Invasion schedule to the Svelte event planner. It preserves the original attempt
and reset formulas, requirement deductions, capped Eleph shop row, and
session-only optional reward display. It is covered by the same legacy-parity,
production-browser, and dev-browser baselines below; do not reimplement it.

## Remaining migration work, in suggested order

1. **Broader event catalog/mechanics.** The current event file has 28 definitions;
   15 are allowlisted for the Svelte planner and 13 stage/shop-looking definitions
   remain unreviewed: `secret-midnight-party`, `box-shadow-looming`,
   `railroad-runaway`, `ive-alive-rerun`, `honorable-sea-showdown`,
   `summer-sky's-promise`, `sheside-outside-rerun`, `winter-skies-renaissance`,
   `serenade-promenade-rerun`, `descent-of-five-senses-rerun`,
   `game-dev-department-cleanup-mission`, `secret-midnight-party-rerun`, and
   `lore-pursuit`. `old_events.json` has 40 definitions; only its four Lessons
   entries and Valentine Patrol Invasion entry are in the generated archive.
   Audit event-specific branches in `planner/js/eventPlanner.js` before widening
   either allowlist; field shape alone does not prove parity. There are legacy
   event-specific transformations/mini-games beyond the explicitly decoded
   `boxes`, `card_drops`, `dice_race`, `omikuji`, `lessons`, and `invasion`
   properties. In particular, preserve separate mechanics or keep them gated.

2. **Resource-page residuals.** `README.md` notes optional/display controls that
   remain reachable only through the old planner. Before retiring
   `planner/index.html`, compare its remaining controls/modals with
   `/planner/resources/`, and record each omission or explicitly mark obsolete.

3. **Final route/PWA transition.** The root redirect in `_redirects` still opens
   the legacy resource planner; the shared Svelte navigation links modern
   Resources, Events, Raid Videos and Tournaments. Switch remaining defaults
   only after end-to-end parity is accepted, keeping old addresses usable.
   `planner/sw.js` currently uses cache `baplanner-static-v2` and
   `game/sw-game.js` uses `baplanner-static-v1`; both activation handlers
   enumerate origin-wide CacheStorage and delete names outside their own
   in-memory allowlist. Since CacheStorage is shared across the origin, either
   worker can delete the other app's cache. Give caches distinct namespaces and
   stage activation/cleanup for already-installed clients; test
   offline/install/upgrade behavior.

## Verification and commands

At handoff, the verified baseline is:

- `npm.cmd test`: 1,280 tests passed.
- `npm.cmd run check`: 0 Svelte/TypeScript errors and warnings.
- `npm.cmd run build`: static `adapter-static` build succeeds.
- `npm.cmd run test:browser`: 116 production-preview browser tests passed.
- `npm.cmd run test:dev`: 11 Vite development-server tests passed.
- Original `planner/js/eventPlanner.js`, card/dice/Omikuji workers,
  `planner/packages/javascript-lp-solver/solver.js` and
  `planner/packages/mathjs/math.js` were unchanged by the Invasion stage.

Production browser tests launch/stop their own preview server; development tests
launch/stop Vite on port 5174. Tests mock/intercept remote APIs; do not use real
credentials or call user accounts during verification. Generated directories
`.generated-content`, `.generated-static`, `.svelte-kit`, and `build` are ignored
and regenerated by preparation/check/build commands. Remove only generated
`test-results` after testing.

Raid Videos continuation verification (2026-10-10):

- `npm.cmd test`: 1,288 tests passed.
- `npm.cmd run check`: 0 Svelte/TypeScript errors and warnings.
- `npm.cmd run build`: static `adapter-static` build succeeds.
- `npm.cmd run test:browser`: 120 production-preview browser tests passed,
  including Raid Videos and legacy-page preservation.
- `npm.cmd run test:dev`: 12 Vite development-server tests passed.

Tournament Tracker continuation verification (2026-10-10):

- `npm.cmd test`: 1,299 tests passed.
- `npm.cmd run check`: 0 Svelte/TypeScript errors and warnings.
- `npm.cmd run build`: static `adapter-static` build succeeds.
- `npm.cmd run test:browser`: 123 production-preview browser tests passed,
  including Tournament Tracker and legacy-page preservation.
- `npm.cmd run test:dev`: 13 Vite development-server tests passed.

Guessing Game continuation verification (2026-10-10):

- `npm.cmd test`: 1,304 tests passed.
- `npm.cmd run check`: 0 Svelte/TypeScript errors and warnings.
- `npm.cmd run build`: static `adapter-static` build succeeds.
- `npm.cmd run test:browser`: 126 production-preview browser tests passed,
  including game workflows and byte-identity preservation of the legacy page.
- `npm.cmd run test:dev`: 13 Vite development-server tests passed.
- The Svelte game uses `/game/`; `/game/guesser.html` and existing game assets
  remain available. No new service worker registration was added.

## Resume prompt

> Read `MIGRATION_HANDOFF.md` and `README.md`, then inspect the current branch and
> `git status` before editing. The Valentine Patrol Invasion, Lessons, Raid
> Videos, Tournament Tracker, and Guessing Game migrations are already present;
> do not reapply them. Continue with the broader event catalog/mechanics audit:
> review the event-specific
> branches in `planner/js/eventPlanner.js`, characterize candidate events against
> the legacy implementation, and keep unfamiliar mechanics gated until parity is
> established. Preserve the legacy pages, workers and API contracts. Add
> independent tests, run targeted plus full checks, and do not commit or push
> unless explicitly asked.
