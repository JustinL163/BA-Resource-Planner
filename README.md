# Blue Archive Resource Planner

A Blue Archive resource/event planner, raid-video browser, tournament tracker, and
guessing game. The site is being migrated incrementally to Svelte 5 and SvelteKit
with `adapter-static`; deployment requires only static files.

## Development

Use Node.js 20.19+ or 22.12+ and npm:

```text
npm install
npm run dev
npm run check
npm test
npm run build
npm run preview
```

On Windows PowerShell installations that disable `.ps1` scripts, use `npm.cmd`.
The production output is `build`. Deploy that directory to Cloudflare Pages or
another static host; `_redirects` preserves the root and migrated `.html` URLs.
`preview` is a local static-file server, not a deployment backend.

Browser checks run against an already built site:

```text
npx playwright install chromium
npm run test:browser
```

Development-server module loading is checked separately with `npm run test:dev`.
It starts and stops its own Vite server on port 5174.

## Source layout

- `src`: prerendered Svelte routes, shared layout, typed preferences/localisation,
  browser-independent resource calculations, and simulation coordination.
- `planner` and `game`: original feature sources, datasets, assets, and reference
  implementations. Resource/event planners and Raid Videos have Svelte screens;
  their legacy sources remain available as references or fallbacks. The
  tournament tracker also has a Svelte screen with its old HTML page retained as
  a fallback. The Guessing Game has a Svelte screen at `/game/`, and its original
  HTML page remains available. Resource calculations and normal event simulation
  coordination delegate to shared TypeScript modules.
- `scripts/prepare-site.mjs`: copies unmigrated features and assets without
  changing their paths; converts static document content to typed nodes for
  declarative Svelte rendering; builds the temporary legacy bridges under
  `planner/js/shared`. Original documentation remains its source of truth.
  Svelte imports localization JSON from the private generated-content directory,
  while legacy pages keep fetching `/planner/json/strings.json`. Keeping these
  paths distinct prevents static JSON assets from shadowing Vite's JavaScript
  module transforms in development.
- `tests/unit`: legacy calculation/worker characterization and shared-service checks.
- `tests/browser`: static deployment and browser workflow checks.

Credits, privacy, changelog, and translation tools are Svelte routes. Their old
`.html` addresses redirect to the new routes, with query strings preserved.
The new core resource planner is available at `/planner/resources/` through the
**Svelte Planner** navigation link. It supports character selection/editing,
inclusion filters, custom ordering, inventory, aggregate totals, weapon XP,
team/group editing, bulk investment changes, team text/PNG exports,
and local JSON backup/import. It uses the same `save-data` as the legacy planner.
The compact character cards retain the original shorthand overlays (`M` for
maximum skills, `X` for T10 equipment), stars, bond and current/target colouring.
Drag cards to reorder them; use Move Mode for touch dragging, or Alt+arrow keys
for keyboard reordering. Ctrl/Cmd+click or right-click toggles inclusion, and
Disable Mode provides the same operation by tapping. Shift+drag remains available.
These shortcuts are displayed beside the explicit mode controls.

Resources, gear and local transfers open from the floating tool bar in separate
dialogs. Resource matrices retain tier/category alignment and show only the
selected Owned/Remaining/Total/Leftover quantity; Owned mode edits inventory.
Card size uses the existing `character_box_size` preference.

The standard Svelte event planner is available at `/planner/event-planner/`
through **Svelte Events**. Its compact Targets, Energy, Bonus, Shop, Stages,
Points and Owned tabs support the current Lore Pursuit (Season 2) event.
Box Shadow Looming rerun and the original BOX Shadow Looming event are supported
as separate event IDs; the original's point-to-Eleph rule is characterized
against the legacy page. Secret Midnight Party and its rerun are also supported;
their BOOM Classic Collection shop requirement converts to a Youkai MAX Umeboshi
Flavor stage target at 270:1 and retains both values in saved event data.
Fair and Square Aquatic Showdown converts its Wooden Doll (Renge) shop cost to
the farmable Wooden Doll (Yukari) target at 270:1; the source shop value and
derived stage target are both retained in saved event data.
The Serenade Promenade rerun is also in the reviewed archive: its capped Event
Point overflow purchase converts leftover points into Mine (Pop Idol) Eleph,
and shop 10058 Eleph is combined with 16016 point and overflow rewards.
Unreviewed special events are explicitly gated to the legacy planner until their
complete mechanics are migrated;
`standardEventIds`,
`boxEventIds`, `cardEventIds`, `diceEventIds`, `omikujiEventIds`,
`lessonEventIds`, and `invasionEventIds` are reviewed allowlists rather than
assuming an unfamiliar event is generic. The four reviewed archived Lessons
events and the reviewed Invasion event are loaded from a generated, bounded
archive bundle rather than fetching the full older-event catalog.

Box-draw events also support a compact **Boxes** tab and a session-only **Box
Rewards** display toggle. **Show earlier supported events** reveals the reviewed
earlier events without changing the current event list: Moonlight Dream,
Pandemic Hazard, 0068 Opera with Love rerun, Say-Bing rerun, Kivotos Unsolved
Mysteries, both BOX Shadow Looming IDs, Secret Midnight Party with its rerun,
Fair and Square Aquatic Showdown, and the Serenade Promenade rerun.
Cycle tabs retain the original
alternating sets and repeating final set, with per-draw amount and stock shown
separately. Box-shop currency targets convert to the exact required whole-box
draw currency, including legacy Owned/first-clear subtraction conventions.

Only fully cleared boxes contribute rewards; the rounded partial-box percentage
is shown separately (even a rounded 100% does not promote it to a full clear).
XP and material totals preserve the legacy count-only rule, while Credit, Eleph
and box currencies use amount times count. Pyroxene/Misc entries remain visible
in the Boxes tab but are omitted from the reward summary as before. Large repeat
tails are calculated without per-box loops; malformed/unreachable targets and
unsafe totals fail explicitly. `tests/fixtures/boxes.legacy.js` and frozen reward
snapshots characterize these boundaries. Other special mechanics remain gated.
On small screens the event list collapses after selection; **Event List** reopens
it so the archived catalog does not push the event controls below a long list.

Card-draw events **Get Hyped and March On rerun** and **Art for Whom** are available
in the same earlier-event list. The compact **Cards** tab browses UR/SR/R/N rewards
and runs the unchanged first-card-then-reset strategy at 200 draw currency per
pull. Each simulation uses the existing four workers and trial/time budgets.
Bundled math.js sample standard deviation, mean and rounding run in a separate
cancellable worker; large result arrays and RNG adjustments have no synchronous
main-thread fallback.

**Card Rewards** is session-only. Mean/std results, their draw-currency amount,
and the -2 to +1 sigma adjustment use the original `card_pull_rewards`,
`card_pull_currency_owned`, and `standard_deviation` save fields. Matching saved
statistics can be reused after reload; changing the farming plan invalidates
their display unless the currency still matches. RNG-only changes reuse the
statistics without repeating simulations and may be made during a running job.
Changed inputs, event switches and Cancel terminate pending work; conflicting
asynchronous results never overwrite a newer event save. Failures remain visible
and allow retry without saving partial or fabricated statistics. Other simulation
mechanics remain in the legacy planner.

**Occult Research Society** is available through the earlier-event list with a
compact **Dice** tab. Its simulation retains the original 18-tile race,
empty target lists and one initial fixed ticket for each die face. Remaining
tickets are spent using the original worker strategy; no new path optimizer or
main-thread fallback is introduced. Zero roll currency still runs the ticket
simulation. Expand **Race tiles and lap rewards** to inspect all configured
rewards, including ones the legacy summary intentionally omits.

**Dice Rewards** is session-only. Results persist under `dice_roll_rewards` and
`dice_roll_currency_owned`, with the existing shared `standard_deviation` field.
Card and dice screens share cancellation, statistics-worker processing, RNG
adjustment and conflict protection. RNG-only changes reuse results without
resimulating; currency changes invalidate their display and pending farming-input
changes cancel the pool. Dice XP, Credit, Eligma, Secret Tech, Eleph and equipment
box totals retain legacy classification and signed rounding; dice materials and
miscellaneous rewards remain excluded from the summary as before. Original
simulation files, including the eight-worker developer dice-path workflow, are
unchanged. The five reviewed Omikuji events are available in the same earlier-
event list with a compact **Omikuji** tab. Event Point overflow tickets are
calculated at 300 points per pull, up to the event's cap. The unchanged four-
worker Omikuji simulation preserves each event's slip order, cumulative
probability thresholds and legacy pity/reset behavior; its math.js statistics
and sigma adjustment run in the shared statistics worker. Rewards remain a
session-only display option and use the existing `omikuji_pull_rewards`,
`omikuji_pull_currency_owned` and `standard_deviation` save fields. Changing
farming inputs cancels pending work, while RNG-only changes reuse saved
statistics. Unreviewed special mechanics remain legacy-only.

The reviewed **Lessons** tab is also available for On Your Mark, Hot Springs
Resort Daily Logs, Restoration Project, and the On Your Mark rerun. Pre-rank
location choices and post-rank runs retain the existing `lesson_pre_runs` and
`lesson_post_runs` save fields. The tab preserves rank/level thresholds, strict
Event Point add/max limits, per-location material substitutions, and the
legacy expected-reward classification. **Lesson Rewards** is a session-only
summary toggle; over-spending farmed Event Points keeps the plan infeasible.
Only those four curated lesson definitions are loaded from `old_events.json`;
other special event definitions remain on the legacy planner.

The archived **Schale's Happy Valentine Patrol rerun** includes its fixed
Invasion schedule. The original maximum-stage first-day attempt rule,
remaining-reset daily attempts, and first-clear rewards are preserved. Invasion
currencies always count toward the stage plan and reduce needed farm currencies;
**Invasion Rewards** is a session-only toggle for its Eleph, XP, and Credit
summary. The original event, solver, and simulation files remain untouched.

Shop, currency and material optimization uses the original bundled LP solver
in a cancellable worker, never a blocking main-thread fallback. Manual runs,
character bonuses, AP settings, shop counts, stage groups and point targets use
the existing `events_data` fields. Writes reread the root save and change only
the selected event, preserving characters, inventory, other events and unknown
fields. A competing edit to that event blocks further writes until explicit
reload. Worker errors offer retry and invalid inputs/storage failures remain
visible without replacing the saved plan. Shop/point reward display toggles
remain session-only; rewards retain the original classification and shop-Credit
guard behavior. Frozen legacy reward snapshots pin these compatibility quirks.

**Teams Editor** switches the main view to the existing six-slot team format:
four Strikers and two Specials. Regular picks are unique per group, with one
borrowed pick per group, matching the original editor. Slots can be swapped by
dragging, touch Move slots, or keyboard shortcuts. Groups can be created, renamed,
reordered and deleted, and teams can be reordered or removed. Unsupported group
values remain untouched and are reported rather than replaced. Team edits reread
the latest save and reject conflicting changes to the same group.

Group filters include regular members only and support the original Up to Group
range. Include/exclude actions apply to the visible cards. **Bulk Mode** selects
cards independently of inclusion; blank fields preserve existing investments
and `0` explicitly changes a value. The modal previews changes and requires
confirmation. Bulk patches preserve the original clamping/rarity rules and reject
stale selections atomically. Frozen references in `tests/fixtures` pin those rules.

Team image export lazily loads the existing bundled html2canvas library and
downloads a PNG without any server or third-party request. Text export aligns
each character's own investment shorthand and marks borrowed picks.

## Tournament tracker

The Svelte tournament tracker is available at `/planner/tournaments/` through
the **Tournaments** navigation link. It retains the active S7 Wakamo match
controls, player-order-insensitive record lookup, force pick, five bans per side,
two ordered team lists, borrowed student markers, scores, CSV export, and the
original confirmation and cooldown behavior. Team submissions keep the legacy
four-Striker/two-Special slot order and `[studentId]` encoding for borrowed picks.

Tournament records still load from `GET /loadtourneydata` and save to
`POST /settourneydata` on the existing API host. The existing
`TournamentPassword` localStorage key is sent only in the request header. The
legacy `/planner/tournaments.html` page remains available as a fallback; CSV
export uses English student names and the legacy column layout.

## Guessing Game

The Svelte Guessing Game is available at `/game/`. It supports Halos, Weapons,
Chocolates, Silhouettes, Surnames, Ages, Birthdays and Heights, with the legacy
freeform and multiple-choice modes, timer, guess count, colour, lenience, date
and conscious-state settings. Question pools come from the existing static
dataset, and question art keeps its legacy asset URLs. The game preserves the
score format, failed-question retry flow and high scores in
`localStorage["records"]`; unrelated record fields are retained. The image
preload action remains available for the selected category.

The old `/game/guesser.html` page and its assets remain available while the
replacement is reviewed. The Svelte route uses the existing game manifest. The
game service worker is retained for the legacy page; cache namespace and
activation cleanup still need a coordinated PWA migration.

## Character selection and search aliases

The default add-character picker and team slot picker share the raid video's
five-portrait fuzzy search. The search input is focused automatically; `1`-`5`
select a displayed portrait, and Enter/Tab select the first. Escape clears a
non-empty search before closing. Team selection advances to the next empty slot,
including switching from Strikers to Specials. Borrowing can be toggled with
the visible control or Shift; the control disappears after a borrow is assigned.
Clear an existing borrowed slot before changing its borrow mode.

The team picker is a condensed, non-modal overlay above the active slot. It
relocates as slots are filled, follows scrolling/resizing and the mobile visual
viewport, and clamps or flips at screen edges when necessary. The page remains
usable without a backdrop or scroll lock; clicking or focusing outside dismisses the overlay.
Clicking another slot switches its target. The resource add picker remains a modal.

The add-character picker saves each quick choice immediately and stays open for
the next. **Grid picker** switches to the retained multi-select view; its query
and pending selection survive switching back and forth.

Canonical English and localized character names are generated from character
data, so adding a character no longer requires duplicating its name in another
list. Manual nicknames remain editable in `planner/json/student_info.json`:

```json
{
  "10024": {
    "EN": ["cshiroko", "broko", "bshiroko"]
  }
}
```

Add aliases to the appropriate character ID; canonical names are always included
automatically, and duplicate aliases are deduplicated. Existing full-name entries
may remain but are no longer required. English aliases and aliases under the
selected language code (e.g. `KR` or `JP`) are searched alongside canonical names.
Restart `npm run dev` or rebuild after editing the file. Legacy raid/tournament
selectors use the same matching engine and automatic name coverage.
The original `/planner/` and `/planner/index.html` remain available; the modern
page links explicitly to advanced tools that have not yet been converted.
Generated assets/content are ignored and regenerated before development,
type-checking, and builds.

## Compatibility requirements

Keep the existing origin and asset paths when deploying so localStorage and
installed PWA identities remain available. Shared preferences update the existing
`save-data` object without discarding unrelated fields or changing its version.
Unreadable saves are surfaced rather than overwritten.

### Gear farming

The Gear modal's Remaining Needed view includes **Farming recommendations**.
Opening it runs the original bundled LP solver in a dedicated worker. Server and
1x/2x/3x campaign controls preserve the legacy rates (including CN old rates),
world limits, upward run rounding and 10-AP-per-run calculation. World caps are
generated from the legacy planner source. Server selection uses the existing
`server` save field; the campaign multiplier remains a session setting.

Pending calculations are cancelled when inputs change or the modal closes, and
completed results are invalidated when their inputs change.
Unavailable equipment is explicitly listed rather than treated as farmable.
The worker has no blocking main-thread fallback. Leftover blueprint XP uses the
same legacy blueprint values.

### Cloud transfers

The Transfer modal supports existing accounts, new registration, cloud upload,
and cloud load through `https://api.justin163.com`. The existing API bodies and
Username/Auth-Key headers are retained. LZMA level-nine compression/decompression
runs in workers, with the original binary format and existing `username`/`authkey`
storage keys. Auth Keys are masked unless explicitly revealed.
As in the original planner, uploading requires matching remembered credentials;
load an existing account before saving to a different one.

Cloud load requires overwrite confirmation, validates the complete plan before
replacement, and keeps the prior exact source in `data-backup-modern`. A plan
edited during download is not replaced. Credential and plan writes are applied
transactionally; failed writes are rolled back or explicitly reported if storage
cannot be restored. Registration remembers its generated key before initial
upload, so an upload failure does not discard the account details.

Independent 130-second save/load cooldowns match the original planner and survive
closing/reopening the modal. In-progress transfers keep the modal open to avoid
losing registration responses. API, compression and validation failures are
visible; no failed transfer is presented as a completed save/load.

Simulation engines remain Web Workers with their existing trial/time budgets.
Each normal simulation launches four workers, each capped at 100,000 trials or
approximately three seconds. The shared coordinator preserves sample arrival
order and leaves the existing math.js statistics unchanged. Switching events
cancels pending jobs; changed currency inputs invalidate pending results.
Worker failures are visible, release the entire pool, and allow retry. The
developer eight-worker dice-path workflow remains unchanged.

The event planner now delegates core event calculations through
`src/lib/domain/events` and a generated browser bridge. Character bonuses preserve
the original four-Striker/two-Special selection order; AP budgets preserve
maintenance, partial days, cafe rounding, Owned-mode deductions and event-specific
reserves. First-clear rewards and Shop/Currency/Materials LP models use the same
coefficients, constraints, bundled solver and rounding as before. Disabled quest
groups retain the legacy empty model variables. Invalid consumed inputs are
reported explicitly, without writing a replacement save or fabricating a result.
`tests/fixtures/event-core.legacy.js` is the independent frozen reference, covering
the current and archived event definitions.

The original event page remains available with all special-event tabs and
simulation workers. Its core calculations share this verified foundation with
the standard Svelte event interface; the reviewed box, card, dice, Omikuji, and
Lessons flows have also moved. The reviewed Valentine Patrol rerun Invasion
schedule is supported in the Svelte event planner; unreviewed special mechanics
remain legacy-only.

Upgrade-cost formulas live in `src/lib/domain/resources`, without DOM access,
storage, or mutable global state. The legacy planner delegates through a generated
browser bridge, so current editing/aggregation workflows use the extracted engine.
`tests/fixtures/resource-calculations.legacy.js` is a frozen independent reference;
do not regenerate it merely to accept calculation differences.
Aggregate and weapon-XP rules have also been extracted into pure modules and
checked against `tests/fixtures/resource-aggregates.legacy.js`. The XP calculation
cap remains a session-only setting, matching the original planner.

The resource store rereads the latest save before each change, preserving teams,
event settings, preferences and unknown fields. Cross-tab changes are synchronized,
and concurrent character edits are detected instead of overwriting newer data.
Version-1 saves are upgraded only after validation; imports and upgrades retain
the previous exact source in `data-backup-modern`. Unreadable saves and failed
storage writes are surfaced without silently starting over.

Characterization tests pin deterministic calculation outputs and worker results
under controlled randomness. Future feature migrations must match those results
before replacing the reference implementations. Retain existing solver,
statistical, and compression conventions during that work.

Character editing includes a compact four-icon skill strip. Hover or focus a
skill to preview its description, click/tap to pin it, and click again or use
Close to dismiss it. Current/target parameters and EX costs update with the
unsaved draft, including target UE2 passive and T2 bond-gear basic upgrades.
The target-selected variant is used for both parameter columns, matching the
legacy tooltips. Description parameters retain the original teal/green colours.
Localized skill/effect data loads client-side only when opening the editor;
missing descriptions explicitly show an English-fallback notice. Load errors
offer retry without changing the saved plan. Description markup is rendered as
typed text/value tokens, never injected HTML.
`tests/fixtures/skills.legacy.js` is the frozen independent formatter reference.

Remaining resource work includes legacy-only display/optional controls still
reachable through the legacy planner.
The remaining site migrations include the broader event catalog/mechanics audit
and resource-page residuals documented in `MIGRATION_HANDOFF.md`. Raid Videos
now uses `/planner/raids/`; the original `/planner/raids.html` page remains
available as a fallback.
PWA cache replacement must include a deliberate transition for installed clients;
the original service workers are retained in this layer.
