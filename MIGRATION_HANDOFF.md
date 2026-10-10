# Blue Archive Planner migration handoff

Updated 2026-10-11. Read this with `README.md`, then inspect `git status` and
`git log -1` before continuing. This handoff intentionally avoids pinning a
commit hash so it stays current after routine commits.

## Goal and guardrails

Continue the incremental migration to SvelteKit with `adapter-static`, preserving
legacy behavior and URLs while each replacement is verified. Keep old pages and
workers available as fallbacks until parity is established.

- Preserve `save-data`, feature-specific localStorage keys, unknown save fields,
  exports, and existing client-side cloud/API contracts.
- Treat legacy calculations, solver ordering, rounding, and worker payloads as
  compatibility requirements. Use characterization fixtures and browser checks
  before replacing behavior; keep heavy simulations in workers.
- Use `npm.cmd`/`npx.cmd` in Windows PowerShell when `.ps1` shims are blocked.
- An existing untracked file named `=` is unrelated to the migration; leave it
  untouched.

## Current migration map

- Resources: `/planner/resources/`; legacy planner remains available.
- Events: `/planner/event-planner/`; reviewed allowlists cover standard, box,
  card, dice, Omikuji, Lessons, and Invasion flows. Keep
  `/planner/events.html` available.
- Raid Videos: `/planner/raids/`; `/planner/raids.html` remains available.
- Tournament Tracker: `/planner/tournaments/`; `/planner/tournaments.html`
  remains available.
- Guessing Game: `/game/`; `/game/guesser.html`, assets, and existing worker/cache
  lifecycle remain available.
- Shared/supporting content routes have Svelte equivalents. See `README.md` for
  the user-facing feature summary.

The latest committed event slices include I’ve aLIVE rerun, Summer Sky’s Promise,
and Sheside Outside rerun. Their edge behavior should remain explicit:

- I’ve aLIVE derives summary points from Countdown Calendar after first clears
  and Owned balances; its legacy point target does not constrain the solver.
  Invalid uncapped Eleph overflow is normalized, while explicit purchases remain
  bounded.
- Summer Sky’s Promise applies the 2,000-Armband milestones after first clears
  and Owned balances. Fine Tea's source-less farming target retains legacy NaN
  behavior and stays outside solver/Owned controls; its shop remains editable.
- Sheside Outside uses Game Corner Ticket as its only stage target. Tournament
  Water Gun remains an unconstrained `MinigameDrop` with the legacy NaN
  requirement, no Owned control, and an editable shop. No minigame transform is
  inferred.

## Next work

1. Audit the archived `lore-pursuit` definition against the legacy planner before
   allowlisting it. The current event catalog has 28 definitions: 26 are
   allowlisted and two remain gated. Keep
   `game-dev-department-cleanup-mission` gated because its uncapped Credit
   overflow can produce invalid legacy totals. `old_events.json` currently
   contributes the four reviewed Lessons entries and Valentine Patrol Invasion.
2. Compare remaining controls and dialogs in `planner/index.html` with
   `/planner/resources/`; note any intentional omissions before retiring the
   legacy planner.
3. Finish the route/PWA transition only after parity review. `_redirects` still
   sends the root to the legacy resource planner. `planner/sw.js` and
   `game/sw-game.js` use separate cache names but their activation handlers can
   delete other origin caches. Namespace and stage cache cleanup, then verify
   offline, install, and upgrade behavior without breaking installed clients.

## Latest verification

Verified 2026-10-11 on the current migration changes:

- `npm.cmd test`: 1,483 tests passed.
- `npm.cmd run check`: 0 errors and 0 warnings.
- `npm.cmd run build`: static `adapter-static` build succeeded.
- `npm.cmd run test:browser -- --reporter=dot`: 136 production-preview tests
  passed.
- `npm.cmd run test:dev`: 13 tests passed.
- Targeted `npm.cmd test -- tests/unit/standard-event.test.ts`: 219 tests passed.
- `git diff --check`: clean.

Browser tests use mocked/intercepted remote APIs; do not use real credentials or
call user accounts during verification. The test/build commands regenerate
ignored directories as needed.