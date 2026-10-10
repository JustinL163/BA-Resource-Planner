# Blue Archive Planner migration handoff

As of 2026-10-10. This file is intended to let a fresh Codex app session resume
the migration without relying on chat history. Read it together with `README.md`
and inspect the worktree before making changes.

## Current repository state

- Repository: `JustinL163/BA-Resource-Planner`.
- Current branch/worktree: `justinl163-didactic-telegram`.
- Latest commit: `50f62cf` (`Migrated invasion event type`).
- The Valentine Patrol rerun Invasion migration is committed in `50f62cf`,
  together with the prior uncommitted Lessons migration. Do not cherry-pick or
  reapply those changes.
- The worktree was clean after `50f62cf`; this post-commit handoff refresh is the
  only intended uncommitted change. Push status was not checked.

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

**Supporting pages:** legacy content pages have static Svelte equivalents.
The tournament editor and guessing game are still legacy.

## Continuation progress (2026-10-10)

The Raid Videos route is implemented and verified in the current worktree. The
shared navigation now points to `/planner/raids/`; development and production
static preview serve the Svelte route there, while `/planner/raids.html` still
serves the legacy page. No commit or push was made.

## Recent completed stage

Commit `50f62cf` adds the archived **Schale's Happy Valentine Patrol rerun**
Invasion schedule to the Svelte event planner. It preserves the original attempt
and reset formulas, requirement deductions, capped Eleph shop row, and
session-only optional reward display. It is covered by the same legacy-parity,
production-browser, and dev-browser baselines below; do not reimplement it.

## Remaining migration work, in suggested order

1. **Tournament tracker.** Current entry is `/planner/tournaments.html`
   (`planner/tournaments.html`, `planner/js/tournament.js`). Preserve tournament,
   stage, game, players, armor, force-pick, up to five bans per side, two team
   lists, scores, existing-record lookup, import/export and confirmation/error
   behavior. Current HTML exposes S7 Wakamo. `TournamentPassword` is stored in
   localStorage; `cloudAPI.js` uses `GET /loadtourneydata` and `POST
   /settourneydata` with the `TournamentPassword` header. Keep requests
   client-side; do not expose the password in logs or serialized saves.

2. **Guessing game.** Current entry is `/game/guesser.html` with logic/styles/data
   under `game/guesser/`. Preserve Halos, Weapons, Chocolates, Silhouettes,
   Surnames, Ages, Birthdays and Heights; freeform/multiple-choice input; timer,
   guess-count, colour, lenience, date and conscious-state settings; scoring,
   failed-student retry and records under localStorage key `records`. It fetches
   the static `game/guesser/data.json` and preloads image data. Keep the original
   game and asset paths until the Svelte replacement is verified.

3. **Broader event catalog/mechanics.** The current event file has 28 definitions;
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

4. **Resource-page residuals.** `README.md` notes optional/display controls that
   remain reachable only through the old planner. Before retiring
   `planner/index.html`, compare its remaining controls/modals with
   `/planner/resources/`, and record each omission or explicitly mark obsolete.

5. **Final route/PWA transition.** The root redirect in `_redirects` still opens
   the legacy resource planner; the shared Svelte navigation links modern
   Resources, Events and Raid Videos. Switch remaining defaults only after
   end-to-end parity is accepted, keeping old addresses usable.
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

## Resume prompt

> Read `MIGRATION_HANDOFF.md` and `README.md`, then inspect the current branch and
> `git status` before editing. The Valentine Patrol Invasion, Lessons and Raid
> Videos migrations are already present; do not reapply them. Continue the
> full-site SvelteKit migration with the tournament tracker as the next feature
> slice. First inspect the bounded tournament UI/data/API surfaces and write
> down compatibility requirements, then implement a static-safe Svelte route.
> Keep the legacy page and cloud contract compatible. Add independent tests
> before changing behavior, run targeted plus full checks, and do not commit or
> push unless explicitly asked.
