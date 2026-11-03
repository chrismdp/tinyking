# Step 8: measure, then remove unreachable code

The cleanup removes four unreachable modules, one compatibility wrapper, 59 unused translation values, obsolete helpers and 14 tests that only guarded deleted code. Existing files lose 473 net lines. Two mechanical consolidations preserve the same implementations and timing values. Seed-13 history stays byte-identical. All 145 affected suites pass, with 1,388 tests and exit code 0.

The hop target remains unmet. Final desktop hops take 3.71, 5.37, 4.64 seconds, including their seasonal work and saved arrival. Live social selection still compares whole candidate lists. No performance tuning was applied. The timings below describe individual runs on a shared machine, not a statistically established improvement.

## Measurements

Before: supplied main commit `ce4a44fe1aad610ec6857dca70dff5da48c9a9dc`. After: cleanup commit `55dba9c`. Both use seed 13 and production builds. Times are milliseconds unless stated otherwise. Median / p95 means the middle sample / 95th percentile.

| Measurement | Before | After | Target and result |
| --- | ---: | ---: | --- |
| Desktop new game → playable, including opening | 47.12 s | 48.50 s | No budget specified |
| Desktop history phase, elapsed | 31.86 s | 33.49 s | No budget specified |
| Desktop history phase, renderer process CPU | 40.1 CPU s | 41.4 CPU s | No budget specified |
| Desktop history heap after forced GC | 63.3 MiB | 63.0 MiB | No budget specified |
| Desktop frame interval, median / p95 | 83.3 / 116.7 | 66.6 / 83.4 | No budget specified. Both exceed a 16.7 ms reference |
| Desktop simulation tick, median / p95 | 1.1 / 5.2 | 0.9 / 3.6 | No budget specified. Both p95 values fit that reference |
| Desktop render callback, median / p95 | 5.8 / 10.1 | 5.1 / 7.7 | Additional diagnostic |
| Desktop full save, four initial hex records | 3531.0 | 3125.8 | No budget specified |
| Desktop incremental hop checkpoints, range | 1833.5–2316.6 | 2076.3–2686.9 | Included in hop target |
| Desktop hop 1 | 3796.5 | 3708.7 | Under 3,000: miss / miss |
| Desktop hop 2 | 3991.7 | 5373.1 | Under 3,000: miss / miss |
| Desktop hop 3 | 4071.2 | 4635.5 | Under 3,000: miss / miss |
| Phone new game → playable | 53.29 s | 46.51 s | No budget specified |
| Phone history phase, elapsed / renderer CPU | 36.56 s / 45.8 CPU s | 31.52 s / 40.3 CPU s | No budget specified |
| Phone history heap after forced GC | 63.2 MiB | 63.2 MiB | No budget specified |
| Phone full save | 3789.1 | 4076.7 | No budget specified |
| Phone incremental hop checkpoint | 3817.0 | 2342.3 | Included in hop target |
| Phone hop 1 | 6320.8 | 4157.8 | Under 3,000 reference: miss / miss |
| Phone peak page JS heap | 285.9 MiB | 280.9 MiB | No budget specified |
| Phone peak save-worker JS heap | 352.6 MiB | 354.3 MiB | No budget specified |
| Phone peak sum of paired JS heap samples | 476.4 MiB | 464.8 MiB | No budget specified |
| Phone peak browser process tree, summed RSS | 1883.0 MiB | 1915.8 MiB | No budget specified |
| People checks restricted to nearest candidates | Whole-list comparisons remain | Whole-list comparisons remain | Nearest only: miss / miss |
| Complete seed-13 history JSON | 199,928,327 bytes | Identical bytes | Byte identity: met |

The desktop observations cover 31.79 and 31.66 seconds, with 385 and 470 frames. Villagers run normally while the player watches the live starting hex at normal speed. The simulation samples exclude synchronous autosave flushing. Frame intervals include browser scheduling and rendering, rather than just JavaScript callback time.

### Hop stages

| Run and adjacent destination | Away-place season | Arrival detail | Arrival installation and first frame | Checkpoint, scheduling and acknowledgement | End to end | Under 3 s |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Before desktop 1: 5,3 → 6,3 | 658.7 | 277.0 | 633.0 | 2227.8 | 3796.5 | Miss |
| Before desktop 2: 6,3 → 6,2 | 931.8 | 637.6 | 528.4 | 1893.9 | 3991.7 | Miss |
| Before desktop 3: 6,2 → 6,1 | 687.8 | 26.2 | 610.6 | 2746.6 | 4071.2 | Miss |
| After desktop 1: 5,3 → 6,3 | 680.9 | 286.3 | 656.0 | 2085.5 | 3708.7 | Miss |
| After desktop 2: 6,3 → 6,2 | 865.1 | 1004.9 | 1078.1 | 2425.0 | 5373.1 | Miss |
| After desktop 3: 6,2 → 6,1 | 746.2 | 17.8 | 730.1 | 3141.4 | 4635.5 | Miss |
| Before phone 1: 5,3 → 6,3 | 1030.1 | 454.3 | 1000.8 | 3835.6 | 6320.8 | Miss |
| After phone 1: 5,3 → 6,3 | 780.8 | 271.8 | 754.3 | 2350.9 | 4157.8 | Miss |

The stages form consecutive intervals. The first progress callback marks departure. Opening the destination marks the end of seasonal work. The arrival-edge callback marks the end of detail preparation. The last interval ends after the atomic checkpoint acknowledgement. Natural neighbour preparation and autosaves remain enabled. Some background saves overlap these checkpoints, as recorded in each trace.

The hop probe submits the same pending travel order that the simulation consumes after walking. It uses the actual journey planner to select adjacent destinations. It runs the real seasonal transition, terrain/household installation, renderer and IndexedDB save worker. Walking time and the optional arrival animation are outside the hop interval. Positions, food, energy, residents, calendar outcomes and save results are not fabricated.

### Controls and limits

The machine exposes four CPUs, model AMD EPYC 9354P 32-Core Processor. Chromium is 156.0.8078.4. Desktop viewport is 1440 × 900. Phone emulation is 390 × 844, DPR 3, touch and mobile enabled, with the application's existing pixel-ratio limit. Chromium uses the existing probes' SwiftShader flags. This is a shared server with software graphics, not an ordinary laptop or a physical phone. The laptop acceptance target therefore remains unproved even if a run falls below it.

The driver is `scripts/step8-measure.cjs`. It adapts the React-state inspection and worker transport from `mobile-crash-measure.js`, the hop boundary from `one-world-measure.js`, and journey selection from `one-world-browser.js`. It uses `playwright-core`, the installed Chromium, and `scripts/serve-frozen.py` on port 8194. It injects observation wrappers through Playwright without modifying the compiled game. The Node history proof reuses `scripts/game-register.js` and the real `generateWorldHistory({}, 13)`.

CPU profiles sample at 1 ms. Process RSS samples run every 100 ms, including while V8 is busy. Page and worker heap requests start together, but replies arrive when those targets can respond. These are observed peaks, not guaranteed allocation maxima. Summed RSS includes shared pages and every process in this browser's tree. The profile's allocated-byte totals include collected objects and must not be confused with retained heap.

The history checkpoint pauses at the final historical season's progress yield, before detailed terrain generation. Its CPU figure is the change in cumulative renderer-process CPU from launch to that boundary, including bootstrap and renderer threads. The forced-GC hold is subtracted from playable time. CPU profiling, memory polling and that GC affect absolute timings equally in both versions. Load averages and raw sample timestamps remain in the receipts. Only one final controlled observation per viewport/version is reported. No causal speedup or regression is claimed from these noisy runs.

The supplied `docs/design.md` has no step 8 or Simulation heading. I read the complete file, `CLAUDE.md`, `docs/verification.md`, travel/energy documentation and simulation code. The quoted step 8 direction in the brief supplies the missing instruction.

## Deleted paths and reachability evidence

The audit walks static imports, dynamic imports and re-exports from `src/index.js` and `src/game/save_worker.js`. Grep then checks callers, script consumers, string dispatch, data readers and CSS selectors. An absent imported name alone is not enough: internal calls and HTN string dispatch remain live.

| Removed path | Why nothing in the game reaches it |
| --- | --- |
| `src/game/stationary_care.js` | No source or script import. Explicit energy meals and rest replaced its stationary food/bed sensor. Only two assertion sites in mixed food tests still called it. |
| `src/game/traits.js` | No source or script import. The expired physical-trait sweep has no simulation caller. Its two isolated tests were its only callers. |
| `src/game/i18n.js` | No source or script import. The old event-tree phrase flattener has no caller. The application passes the message object directly to React Polyglot. |
| `src/components/event_list.js` | No import or render site. The old turn-condition/effect list is separate from the live event feed. |
| `manager.pushJob` | No runtime or script call, including namespace calls. The old queue insertion helper survives only in its two direct tests. Current orders use `enqueueTask`; NPC queue consumption and removal remain live. |
| `directlyControlledBy`, `anyControlledAlive` | No runtime or script caller. The second calls only the first. Current death and succession inspect the actual player/person. Removed only their three tests. |
| `overworld.propagateFrom` | No runtime, UI or script call. Its mutable-axis editing operation remains only in four tests. Seeded world generation, `repairRegions`, shared neighbour helpers and climate functions stay live. |
| `people.ADULT_AGE`, `village_customs.COMMONS_RULE` | No internal or external reads, including tests and scripts. Current age rules use `life_stages`; the rule string is never displayed. |
| `population_index.buildingOccupants` and its building buckets | No query caller exists. Only the unused query reads those buckets. Their construction and updates therefore have no observer. Household, village, cell and population ordering indexes remain. |
| Person panel's old Ask-about chooser branch | The local chooser state can only be `null` or `gift`. No setter supplies the old branch's value. The gift chooser keeps the same output and actions. |
| 59 old message values | Removed old flat event/effect phrases, `turn`, `action` and unused `info` values. Translation callers use jobs, tasks, terrain, rooms, tutorial, world and `info.until`. No reader constructs these removed keys. |
| `.level-warning`, `.level-error` CSS and empty media rule | Only the unreachable EventList constructs the level classes. No other source or dynamic class builder emits them. The media rule has no declarations. |

The file counts below are exact diff additions/deletions, including changed import lines. Five source modules and two isolated test files disappear. The other deleted tests are the push-job, controlled-alive and mutable-axis cases. Mixed food-economy tests retain their real meal, inventory and fractional-reserve assertions. The spatial-index test retains its assertions and imports the same implementation directly.

| File | Added lines | Deleted lines |
| --- | ---: | ---: |
| `src/components/event_list.js` | 0 | 32 |
| `src/components/person_panel.js` | 2 | 3 |
| `src/components/status_strip.js` | 2 | 1 |
| `src/data/messages.json` | 0 | 94 |
| `src/game/i18n.js` | 0 | 13 |
| `src/game/manager.js` | 0 | 7 |
| `src/game/overworld.js` | 0 | 28 |
| `src/game/people.js` | 1 | 2 |
| `src/game/people_space.js` | 0 | 3 |
| `src/game/playable.js` | 0 | 10 |
| `src/game/population_index.js` | 4 | 5 |
| `src/game/secret_activities.js` | 1 | 1 |
| `src/game/social_visibility.js` | 1 | 1 |
| `src/game/stationary_care.js` | 0 | 25 |
| `src/game/traits.js` | 0 | 14 |
| `src/game/village_customs.js` | 0 | 1 |
| `src/style.scss` | 0 | 11 |
| `test/food_economy.test.js` | 1 | 4 |
| `test/i18n.test.js` | 0 | 38 |
| `test/manager.test.js` | 0 | 30 |
| `test/overworld_axes.test.js` | 1 | 93 |
| `test/playable.test.js` | 1 | 45 |
| `test/secret_activities.test.js` | 1 | 1 |
| `test/survival.test.js` | 0 | 8 |
| `test/traits.test.js` | 0 | 18 |
| Existing-file total | 15 | 488 |

The separately committed measurement driver adds 274 lines. This report is an additional documentation artifact. Logs, raw history JSON, profiles, screenshots, generated audit files and receipts remain ignored under `.cache/step8/`.

## Mechanical consolidations and retained overlaps

`people_space.js` was a three-line compatibility wrapper around the existing population index. Its two runtime callers now import `nearbyPeople` from that index. The existing test imports `rebuildPopulationIndex` under its former local alias. There is still one implementation and the same ordering.

The status strip now reads the seven conversation durations from `player.TALK_MINUTES`. The values match the removed copy exactly. Physical-work estimates retain their existing values.

| Overlap retained | Reason and next suggestion |
| --- | --- |
| Daily patience and paused-chat slots | Timed family actions and the person sheet still use daily patience. Chat uses regenerating slots. Define one consent/patience policy before merging these behaviours. |
| Legacy timed chat and authored chat | Restored orders, disclosure functions, scripts and protected tests still reach timed interaction APIs. Migrate those consumers before removing the old API. |
| Legacy travel/history and compact world history | Earlier save formats still reach detailed away simulation and reference handling. A versioned migration is needed before deleting that branch. |
| Local snapshot assembly in travel and storage | Travel supplies runtime defaults while storage takes the durable projection. Consolidate only after making those differences explicit. |
| Navigation helpers across task, social and campfire modules | Similar tile/path queries have different access and handoff conditions. A shared helper needs those rules preserved in its interface. |
| Guidance dismissal helpers | The UI no longer calls them, but the existing UI test still does. Leave them for the worker converting UI tests rather than editing that test here. |

NPC `find_food`, hunger/sleep factors, the order cancellation machinery, customs visits and customs responses remain reachable. HTN task names are string-dispatched. Old-save food/order cleanup remains necessary. Fast speed already has no control, speed entry or key binding in this baseline. There is no remaining separate customs-dialogue module to merge. The authored chat catalogue remains dynamically selected, so unused-export grep does not establish dead dialogue entries.

The four protected files, and all UI/view/performance tests, are unchanged. No shared harness, configuration or generated types changed.

## Measured costs and suggested next work

### Missed hop target

These are the three largest stage totals across the final desktop hops. They are consecutive timings, so their sums are meaningful. CPU samples below provide possible causes, rather than independent wall-time contributions.

| Rank | Measured cost | Evidence | Suggested fix, not applied |
| --- | --- | --- | --- |
| 1 | Checkpoint and scheduling: 2,085.5 / 2,425.0 / 3,141.4 ms | Actual checkpoint message round trips: 2,076.3 / 2,350.4 / 2,686.9 ms. Input copies: 241.5 / 296.7 / 274.8 ms. Worker-reported work: 798.6 / 762.2 / 955.5 ms. | Send smaller save changes and schedule neighbour generation after the critical arrival checkpoint. |
| 2 | Arrival installation and first frame: 656.0 / 1,078.1 / 730.1 ms | Arrival-edge progress → returned renderer frame. Final hop profiles contain 459.7 / 805.5 / 570.7 ms in the rendering frame call tree. | Separate identity/detail installation from rebuilding the whole view, then measure which renderer resources can be reused. |
| 3 | Away-place season: 680.9 / 865.1 / 746.2 ms | Departure → destination-opening progress. Profiles sample 645.0 / 807.2 / 677.9 ms in `advanceWorldClock`. | Reduce repeated news/relationship candidate work inside the shared seasonal pass while preserving deterministic order. |

Arrival detail separately costs 286.3 / 1,004.9 / 17.8 ms. Neighbour generation continues during later stages. Its `generateMap` call trees contain 1,054.8 / 1,916.2 / 2,692.0 ms of sampled CPU across the three profiles. These call trees overlap the stage work and cannot be added to the table. They support the contention hypothesis, but do not prove how much a scheduling change will save.

On the phone, final checkpoint/scheduling costs 2,350.9 ms, away seasons cost 780.8 ms, and arrival installation/frame costs 754.3 ms. Those are its three largest stages. Its checkpoint copies 232.3 ms synchronously and reports 926.5 ms of worker work. The same proposed fixes apply. The remaining detail stage costs 271.8 ms.

### Missed nearest-only requirement

The existing population index already supplies distance-bounded resident cells. Hearing and social visibility use those cells. Seasonal courtship uses this hex and adjacent village buckets. Several live paths still inspect whole candidate lists:

| Path | Evidence and measured cost | Suggested fix, not applied |
| --- | --- | --- |
| Adult seekers and visits, `social_visits.js:43` and `:51` | `adults.some` and `adults.filter` inspect other adults before distance filtering. Baseline daytime `socialHour` call trees contain 33.376 ms. | Build the candidate set from nearby resident cells before testing interest, then retain deterministic choice order. |
| Adult visit ranking, `social_visits.js:62` | The whole surviving list is sorted by social comparison before path selection. Its comparator contains 12.540 ms of sampled CPU. | Rank the bounded nearby candidate set and avoid repeated news scoring for distant people. |
| Child play, `social_visits.js:83` | Each child searches the child list before navigation checks. Its call tree contains 3.290 ms of sampled CPU. | Query nearby children in the same village before relationship and path checks. |

The comparator timing is nested in `socialHour`; these figures are not additive or separate benchmark rankings. Campfire guest selection also scans all planners. Commons witnesses scan an entire village before distance checks. Those last two are code findings, with no daytime CPU-cost claim. The brief forbids tuning these reachable behaviours in this job.

### Other costs worth carrying forward

The baseline history profile attributes 8,522.2 ms of self CPU to `event_knowledge.js`, 4,150.2 ms to Honeycomb coordinate/geometry code, and 2,203.6 ms to nearby courtship. The final values are 8,914.1 / 4,311.7 / 2,276.2 ms. Suggested follow-ups are narrower cached news intersections, fewer repeated coordinate/neighbour constructions, and fewer repeated eligibility/view projections. None was implemented.

The final live profile attributes 455.5 ms of self CPU to activity-label layout and 278.0 ms to synchronous save posting. The full renderer frame call tree totals 2,658.0 ms across the observation. The profile also contains 27,258.2 ms labelled native `(program)`. It cannot explain that time as a particular JavaScript function. A hardware-backed browser trace is needed before claiming that a JavaScript optimisation will achieve 60 Hz. Recompute labels only when their inputs change, reduce snapshot copies, and investigate native rendering/scheduling as separate follow-ups.

Phone allocation sampling attributes about 1.00 GiB of cumulative allocations to the worker message handler in each version. Graph encoding and chunk assembly add further allocations. This supports measuring smaller save packets next. It does not mean 1 GiB remains live: the observed worker peaks are 352.6 and 354.3 MiB. No phone memory budget was specified or invented.

## Behaviour proof and gates

The before and after Node runs call the real `generateWorldHistory({}, 13)`. They compare the complete JSON strings directly, with no sorting, projection, rounding or field filtering. This is stronger than comparing only events and living identities. The complete state contains 199,928,327 bytes in both captures.

SHA-256 of complete history JSON: `5c22e0dcd4489c73646701b29ed3823e7d5e35097a95e6a4e30bf63621d7f5e2`.

SHA-256 of the event dictionary: `98ec0b68eb40d9d27dcbc187da7c7ff8f0e17e567a755abeda136f8e0f05bfcc`. SHA-256 of the ordered living identity list: `166cf6ecd350cd727ca1e2cc8ee3f7d2672c0a695745b68fbbb0ec43837adb61`. Both versions contain 18,103 events and 716 living identities. The event-dictionary hash uses a different JSON container from the older named-lookups report. The direct before/after comparison is exact.

| Gate or probe | Exact result | Exit code | Receipt under `.cache/step8/` |
| --- | --- | ---: | --- |
| Initial production build | App and save worker compiled. Three bundle-size warnings | 0 | `before-build.log`, `before-build.exit` |
| Baseline history capture | Complete JSON, event dictionary and living list captured | 0 | `before-history-receipt.json`, `before-history.exit` |
| Final affected gate | 145/145 suites, 1,388/1,388 tests passed. Zero failures, skipped tests, todo tests or snapshots | 0 | `affected-tests.json`, `affected-receipt.json`, `affected.exit` |
| Final history comparison | Complete strings and all hashes identical | 0 | `after-history-receipt.json`, `after-history.exit` |
| Source and probe ESLint | No errors or warnings | 0 | `source-lint.log`, `source-lint.exit` |
| Edited tests ESLint | No errors. Three existing unused-variable warnings in survival tests | 0 | `test-lint.log`, `test-lint.exit`, `secret-test-lint.exit` |
| Candidate production build | App and save worker compiled. Three bundle-size warnings | 0 | `after-build.log`, `after-build.exit` |
| Baseline desktop production probe | New game, >30 s live sample, full save, three saved hops. Zero page errors | 0 | `baseline-desktop/report.json`, `baseline-desktop.exit` |
| Baseline phone production probe | New game, full save and one saved hop. Zero page errors | 0 | `baseline-mobile/report.json`, `baseline-mobile.exit` |
| Final desktop production probe | Same sequence and destinations. Zero page errors | 0 | `after-desktop/report.json`, `after-desktop.exit` |
| Final phone production probe | Same sequence and destination. Zero page errors | 0 | `after-mobile/report.json`, `after-mobile.exit` |

The affected runner adapts `scripts/history-cpu-gate.cjs`, sets the base to `ce4a44f`, and keeps its import-graph selector. It invokes `npx jest --runTestsByPath <145 selected files> --maxWorkers=2 --workerIdleMemoryLimit=1GB --json` through `flock -w 7200 /tmp/27agents-gate-2.lock`. Jest reports 95.851 s; the receipt records 96.789 s. The receipt names parent commit `6956a03` because the cleanup was tested before committing. `cleanup.patch` records that exact diff, subsequently committed as `55dba9c`. No source changed between this gate, the build and final probes.

This JavaScript repository defines no TypeScript configuration or typecheck command. Source ESLint and the production compiler cover the changed areas. No whole-suite gate or test-configuration exception was used. Builds use the second shared lock. Browser/history probes use `/tmp/27agents-gate.lock`. Dependencies were already installed, so setup cost was zero.

### Retained failed attempts and limits

The first Node proof driver used an incorrect relative module path and exited 1. Its corrected capture and comparison exit 0. The first lint command lacked Jest globals and reported 144 errors. A second test-lint invocation duplicated three globals already declared by the secret-activity test. Correct commands pass, with the existing survival warnings retained. These were driver/configuration mistakes, not runtime changes.

An initial accelerated walking probe failed at the existing `find_place` fallback in `src/game/tasks.js:744`: it calls `.find` on an absent spatial cell. Its process exited 1. The receipt and source-mapped stack remain under `before-desktop-driver-initial/` and the matching log. This happened before runtime edits. It is evidence from that accelerated driver, not a completed normal-play reproduction. The final hop probe uses the existing standalone probe's transition boundary. The unrelated fallback is unchanged.

Earlier exploratory observations also reached three desktop hops and one phone hop, but had incomplete save acknowledgement observation and an extra explicit save request. They are retained under `before-desktop/` and `before-mobile/`, with exit codes 0. Their numbers are excluded from the controlled before/after table. The final probe fixes save observation and excludes autosave-copy time from simulation samples. It does not retry application assertions to force a green result.

Raw profiles, allocation samples, source maps, all sample timelines and arrival screenshots remain under the four final run folders and `before-bundle/`, `after-bundle/`. Profile summaries name original files and source lines. The separate coordinator acceptance pass remains outside this builder job. No physical-phone crash threshold or ordinary-laptop performance claim is established.

## Delivery

Measurement driver commit: `6956a03`. Green cleanup commit: `55dba9c`. The report commit on top of these two commits completes the deliverable. The server uses saved PID `server.pid`; every browser saves its own root/process PIDs in `pids.json` and closes its own browser handle. Final process cleanup is recorded in `process-cleanup.json`.

No push, stash, delegation, other-branch comparison, vault write, delegation-log write or bench-ledger write occurred. All created files belong to `/home/cp/code/tk-measure`. The unresolved work is the measured hop cost, the remaining whole-list social comparisons, the accelerated-walk fallback, and hardware acceptance. Those are reported for the next authorised job.
