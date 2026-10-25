# Blue Archive Planner migration handoff

Updated 2026-10-18. Read this with `README.md`, then inspect `git status` and
`git log -1` before continuing.

## Migration state

The user-facing feature pages now use SvelteKit with `adapter-static`:

- Resource Planner: `/planner/resources/`
- Event Planner: `/planner/event-planner/`
- Raid Videos: `/planner/raids/`
- Tournament Tracker: `/planner/tournaments/`
- Guessing Game: `/game/`
- Credits, privacy, changelog, and translation tools: their Svelte routes under
  `/planner/`

The retired resource, events, raids, tournaments, game, and debug HTML pages have
been removed from the source tree. `_redirects` and the Vite development middleware
send their former entry URLs to the Svelte routes; they do not serve the old pages.
`scripts/prepare-site.mjs` also excludes retired pages while copying static assets.
The documentation HTML files remain as content sources for their Svelte routes.

The event mechanics audit is intentionally deferred. Reviewed event flows remain
enabled through the allowlists in `src/lib/domain/events/`; unreviewed special
mechanics show an unavailable notice in the Svelte event planner. There is no old
event page fallback. Continue the event backlog only when requested.

## Compatibility to preserve

- Keep the deployment origin and existing asset URLs so localStorage, installed
  PWA identities, tournament API calls, and existing save data remain compatible.
- Preserve `save-data`, other feature-specific localStorage keys, unknown save
  fields, exports, and the current authenticated client-side APIs.
- Keep legacy calculations and frozen fixture files as references where they
  protect behavior; do not restore removed HTML pages as a shortcut.
- Use `npm.cmd`/`npx.cmd` in Windows PowerShell if `.ps1` shims are blocked.

## Service workers

The shared layout registers `/planner/sw.js` on planner routes and
`/game/sw-game.js` on game routes. Both workers currently use cache version 3 and
the same cache name, `baplanner-static-v3`. Their activation handlers only delete
older caches in that namespace. The planner worker caches selected icons and
packages; the game worker caches selected game images. The Svelte shell and route
chunks are not precached, so full offline page loading is not provided.

## Deferred work

The remaining migration backlog is the unsupported or unreviewed event mechanics
documented in `README.md` and represented by the event allowlists. The user asked
to leave this backlog for later. Do not add legacy routes back when working on it.

## Verification

The route cutover and worker changes have not been verified by running test or
build commands in this finalization turn. Record results here when verification
is requested or performed later.
