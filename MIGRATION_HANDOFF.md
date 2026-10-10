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
- Keep `game-dev-department-cleanup-mission` legacy-only until its uncapped
  Credit overflow is modeled safely.

## Next work

1. **Resource-page residuals.** `README.md` notes optional/display controls that
   remain reachable only through the old planner. Compare remaining controls and
   dialogs in `planner/index.html` with `/planner/resources/`; note any intentional
   omissions before retiring the legacy planner.
2. **Final route/PWA transition.** The root redirect in `_redirects` still opens
   the legacy resource planner; the shared Svelte navigation links modern
   Resources, Events, Raid Videos and Tournaments. Switch remaining defaults
   only after end-to-end parity is accepted, keeping old addresses usable.
   Keep service-worker caches isolated and stage activation/cleanup for installed
   clients; test offline, install, and upgrade behavior.

## Latest verification

Verified 2026-10-11 for archived Lore Pursuit: 1,514 unit tests, static build,
137 production browser tests, 13 development browser tests, Svelte check with
zero warnings/errors, and `git diff --check` all passed.

Browser tests use mocked remote APIs. Build and verification commands regenerate
ignored directories as needed.
