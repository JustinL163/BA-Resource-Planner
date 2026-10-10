# Blue Archive Planner migration handoff

As of 2026-10-09. This file is intended to let a fresh Codex app session resume
the migration without relying on chat history. Read it together with `README.md`
and inspect the worktree before making changes.

## Current repository state

- Repository: `JustinL163/BA-Resource-Planner`.
- Current branch/worktree: `justinl163-didactic-telegram`.
- Latest commit: `0e1758b` (`migrated lesson type events`).
- **The Valentine Patrol rerun Invasion migration is implemented but uncommitted.**
  Preserve the current dirty worktree. It is the active, verified work, not
  disposable generated output. Do not reset/restore it. `MIGRATION_HANDOFF.md`
  and the README status correction are also part of the handoff.
- No changes were pushed. The latest Invasion tests passed; the details are
  under “Verification” below.

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

**Supporting pages:** legacy content pages have static Svelte equivalents.
Raid-video UI, the tournament editor and the guessing game are still legacy.

## Active uncommitted Invasion work

The Svelte event planner now supports the archived **Schale's Happy Valentine
Patrol rerun** Invasion schedule. This work is in the current uncommitted diff:

- `src/lib/domain/events/invasion.ts`: strict decoder, exact full-event/Owned
  attempt arithmetic and pure reward application.
- `src/lib/domain/events/standard-save.ts` and `standard-types.ts`: one-event
  allowlist, decode/save support, legacy `Event_Point` omission handling and
  the capped Eleph overflow shop-row exception.
- `src/lib/domain/events/standard.ts`: invasion currencies reduce remaining
  farm requirements and are always included in totals.
- `src/lib/stores/event-planner.ts`, `src/routes/planner/event-planner/+page.svelte`,
  `EventSettings.svelte`: event calculation and session-only **Invasion Rewards**
  toggle; Event Point bonuses display even though the archived currency omits
  its legacy `source`.
- `scripts/prepare-site.mjs`: generates a bounded archive with four Lessons
  events plus this one Invasion event; the full `old_events.json` is not
  imported by the new route.
- `tests/fixtures/invasion.legacy.js`, `tests/unit/event-invasion.test.ts`,
  `tests/browser/event-invasion.spec.ts`, and `tests/dev/modules.spec.ts`:
  independent parity and integration coverage.

The legacy first-day rule is unusual: all configured stages through
`max_stage - 1` contribute initial rewards and one clear; the maximum stage's
first-day drops are multiplied by `first_day_attempts - max_stage + 1`. The final
stage then contributes `daily_attempts * (resets_total - 1)` in full-event mode,
or `daily_attempts * resets_left` in Owned mode. Keep those conventions exact.

Its capped overflow shop item is an Eleph row with `count: -1`; do not normalize
it as an Omikuji EventCurrency ticket or auto-buy it in Currency mode. Invasion
currencies always count toward stage totals and reduce needed shop currencies.
Eleph/XP/Credit reward display is optional and session-only.

## Remaining migration work, in suggested order

1. **Raid-video page.** Current entry is `/planner/raids.html`
   (`planner/raids.html`, `planner/js/raids.js`). Preserve the raid timeline,
   server selection (JP/Global/CN), boss/difficulty/other filters, video list and
   embeds, local submissions, submission editor, and account-authenticated
   submit/edit. It reads `planner/json/raids.json` and fetches per-raid video JSON
   from `https://raw.githubusercontent.com/JustinL163/ba-planner-data/main/
   shared-videos/{server}/raids/{uid}.json`. It stores local submissions in
   `local-submissions` and the default server in `default-raids-server`.
   Submission APIs are in `planner/js/cloudAPI.js` (`submitraid`, `editraid`);
   reuse the already-migrated `username`/`authkey` client credential handling.
   The canonical-name/fuzzy student-search logic is already shared, but the page
   UI and data lifecycle are not migrated.

2. **Tournament tracker.** Current entry is `/planner/tournaments.html`
   (`planner/tournaments.html`, `planner/js/tournament.js`). Preserve tournament,
   stage, game, players, armor, force-pick, up to five bans per side, two team
   lists, scores, existing-record lookup, import/export and confirmation/error
   behavior. Current HTML exposes S7 Wakamo. `TournamentPassword` is stored in
   localStorage; `cloudAPI.js` uses `GET /loadtourneydata` and `POST
   /settourneydata` with the `TournamentPassword` header. Keep requests
   client-side; do not expose the password in logs or serialized saves.

3. **Guessing game.** Current entry is `/game/guesser.html` with logic/styles/data
   under `game/guesser/`. Preserve Halos, Weapons, Chocolates, Silhouettes,
   Surnames, Ages, Birthdays and Heights; freeform/multiple-choice input; timer,
   guess-count, colour, lenience, date and conscious-state settings; scoring,
   failed-student retry and records under localStorage key `records`. It fetches
   the static `game/guesser/data.json` and preloads image data. Keep the original
   game and asset paths until the Svelte replacement is verified.

4. **Broader event catalog/mechanics.** The current event file has 28 definitions;
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

5. **Resource-page residuals.** `README.md` notes optional/display controls that
   remain reachable only through the old planner. Before retiring
   `planner/index.html`, compare its remaining controls/modals with
   `/planner/resources/`, and record each omission or explicitly mark obsolete.

6. **Final route/PWA transition.** The root redirect in `_redirects` still opens
   the legacy resource planner; the shared Svelte navigation links modern
   Resources and Events but still links legacy Raids. Switch defaults only after
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

## Resume prompt

> Read `MIGRATION_HANDOFF.md` and `README.md`, then inspect the current branch and
> `git status` before editing. Preserve the uncommitted Valentine Patrol Invasion
> migration; do not reset or replace it. Continue the full-site SvelteKit
> migration with the Raid Videos page as the next feature slice. First inspect
> the bounded raid UI/data/API surfaces, write down compatibility requirements,
> then implement a static-safe Svelte route using the existing shared search and
> credentials helpers. Keep `/planner/raids.html`, cloud endpoints, saved local
> submissions and asset URLs compatible. Add frozen/independent tests before
> changing behavior, run targeted plus full checks, and do not commit or push
> unless explicitly asked.
