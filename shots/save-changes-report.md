# Arrival checkpoints and onward travel

The arrival checkpoint runs after the destination is installed, while the player can act. Departed terrain remains resident until acknowledgement. Onward travel now waits for an earlier arrival checkpoint before changing the world. Failed saves retain the terrain, show the existing save error and release the terrain after a successful retry. Autosaves, including page-exit requests, queue behind a pending arrival checkpoint.

There is an important baseline correction: `f15ec9c` already defers the first arrival checkpoint. The previous reports' end-to-end number includes the checkpoint acknowledgement. This job separates playable arrival from durable completion and closes the onward-travel, retry-eviction and page-exit queue gaps. It does not claim a new first-arrival speedup from code that was already present.

All eight after-change hops are below three seconds to playable arrival: desktop 1.18–2.56 s and phone emulation 1.55–1.61 s. Their checkpoints finish 2.93–4.53 s after hop submission. All eight corrected baseline hops also fit the playable target. The affected gate passes 139/139 suites and 1,359/1,359 tests; the production build passes. These shared-server observations do not establish physical-phone or ordinary-laptop performance. The remaining large save-copy cost is documented as a change-tracking design, with no storage redesign implemented.

## Round-trip trace

Both page and worker use `performance.mark`, with epoch timestamps (`performance.timeOrigin + performance.now()`) in the save receipt. Marks retain only the latest entry of each name. The complete timestamps remain in each measured save's `result.trace` and `lastSave.trace`.

The packet marks bracket `worldSaveData`. Post marks bracket the actual `ServiceWorker.postMessage`, including its synchronous structured clone. The worker marks entry before accessing `event.data`, then marks completion of its data reads. It marks entry to the serialized work queue, each detailed hex's JSON, hash, existing-record read and gzip, the synchronous IndexedDB puts, transaction completion, and acknowledgement posting. The page marks acknowledgement receipt. Packet construction is outside the message round trip. JSON/hash/read/gzip columns sum the changed hex stages; the world manifest is stored through native structured clone.

The formerly unexplained second is in materialising `MessageEvent.data` in the worker. In baseline b1, this synchronous interval takes 769–1298 ms on desktop and 1168 ms on phone, after the page has already spent 247–298 ms posting. Worker work was previously timed only after this access, so its reported duration excluded the decode. The same trace separates another 418–511 ms in IndexedDB from 292–440 ms in hex encoding. Delivery and acknowledgement do not explain the missing second.

| Run | Hop | Packet | Post clone | Delivery | Worker decode | Worker queue | JSON | Hash | Reads | Gzip | IDB put | IDB completion | Ack | Round trip |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| b1 desktop | 1 | 23.6 | 264.5 | 86.8 | 1297.9 | 13.3 | 122.5 | 60.6 | 8.9 | 148.8 | 233.3 | 237.9 | 0.4 | 2475.2 |
| b1 desktop | 2 | 16.0 | 273.4 | 93.2 | 769.3 | 0.0 | 98.7 | 50.2 | 14.8 | 128.3 | 270.2 | 241.1 | 1.1 | 1940.4 |
| b1 desktop | 3 | 23.9 | 298.3 | 91.1 | 1020.4 | 6.6 | 169.2 | 74.1 | 3.3 | 193.1 | 245.5 | 172.0 | 0.4 | 2274.3 |
| b1 mobile | 1 | 22.7 | 246.8 | 77.8 | 1168.3 | 11.2 | 116.6 | 50.6 | 9.2 | 128.8 | 248.5 | 222.7 | 0.5 | 2281.2 |
| b2 desktop | 1 | 32.5 | 253.2 | 100.8 | 1809.1 | 19.8 | 161.8 | 59.5 | 11.8 | 195.1 | 311.1 | 216.7 | 0.4 | 3139.6 |
| b2 desktop | 2 | 16.1 | 244.0 | 94.4 | 722.3 | 0.0 | 89.3 | 44.7 | 10.4 | 127.7 | 244.9 | 159.5 | 0.7 | 1738.1 |
| b2 desktop | 3 | 22.0 | 287.0 | 93.6 | 1023.0 | 0.1 | 216.9 | 85.5 | 3.8 | 194.8 | 213.4 | 164.7 | 0.4 | 2283.4 |
| b2 mobile | 1 | 25.8 | 263.3 | 162.2 | 1199.4 | 11.6 | 116.7 | 51.6 | 7.6 | 135.9 | 207.6 | 216.8 | 0.3 | 2373.6 |
| a1 desktop | 1 | 22.8 | 268.1 | 78.6 | 1293.4 | 12.4 | 100.5 | 55.8 | 7.3 | 133.3 | 246.9 | 207.9 | 0.4 | 2404.8 |
| a1 desktop | 2 | 16.8 | 265.5 | 92.8 | 696.5 | 0.1 | 88.1 | 46.8 | 10.3 | 120.1 | 246.7 | 154.1 | 0.4 | 1721.4 |
| a1 desktop | 3 | 23.7 | 283.1 | 84.3 | 680.1 | 0.2 | 138.8 | 54.8 | 3.5 | 144.4 | 230.2 | 230.5 | 0.3 | 1850.4 |
| a1 mobile | 1 | 26.6 | 236.9 | 70.5 | 1174.9 | 10.0 | 95.9 | 51.3 | 8.1 | 130.2 | 220.6 | 204.2 | 0.4 | 2203.3 |
| a2 desktop | 1 | 28.5 | 269.5 | 77.2 | 1215.9 | 10.2 | 87.0 | 47.8 | 8.2 | 133.2 | 213.5 | 255.2 | 0.2 | 2318.1 |
| a2 desktop | 2 | 19.8 | 288.8 | 110.0 | 801.3 | 0.0 | 100.9 | 50.9 | 13.2 | 125.9 | 214.4 | 157.8 | 0.1 | 1863.4 |
| a2 desktop | 3 | 24.3 | 264.4 | 84.3 | 820.3 | 0.0 | 253.9 | 86.2 | 3.5 | 244.6 | 232.7 | 150.0 | 0.1 | 2140.2 |
| a2 mobile | 1 | 127.9 | 246.2 | 87.3 | 1115.2 | 9.1 | 76.2 | 48.6 | 9.5 | 116.9 | 186.6 | 202.0 | 0.5 | 2098.2 |

The synchronous data-read interval can include runtime allocation/GC work. These are wall-time observations around the browser's data materialisation, not a claim that all native time is one JavaScript function. The directory, relationships, knowledge and events still cross the worker boundary and the native IndexedDB boundary on every checkpoint. No evidence identifies a small redundant packet copy that can safely eliminate that cost. Step 3 therefore ends at the change-tracking design below.

## Changes and safety

`completeTravel` waits at its entry boundary for an earlier arrival save. The controller can submit a deferred arrival at this boundary even though the simulation has already set `worldBusy`. No departure, aging, world-clock advance or destination mutation happens until that checkpoint succeeds. If it fails while an onward hop is waiting, that hop stays at its current arrival with the existing save error; it does not set a travel error. A later save can retry.

`createAutosave` keeps the keys of retained departed maps per world, outside saved state. Each submitted save captures the current detailed map objects for those keys. A successful acknowledgement installs record pointers and compacts only those same objects that are still away. A failed transaction leaves them resident. An ordinary subsequent save includes them and performs the same acknowledgement/eviction path. This fixes the former one-shot eviction callback, which was lost on failure. World and object identity checks prevent late acknowledgements from affecting a replacement world or map. The compatibility checkpoint path now also waits for acknowledgement before eviction.

The worker still writes the world manifest, new hex records and obsolete-record deletion in one IndexedDB transaction. The durable format, graph encoding, compression, seasonal order, terrain generation and gameplay rules are unchanged. Before that transaction completes, reload reads the complete previous manifest and its records. After it completes, reload reads the complete arrival. The page can disappear after submission because the service worker owns its detached snapshot and extends its lifetime with `event.waitUntil`.

Save requests queue while an arrival checkpoint is pending. The existing ability to submit an ordinary final page snapshot while another ordinary save is pending is retained, as required by the unchanged autosave test. A checkpoint waiting behind an older ordinary save also waits for that save's pointers before submission. Neighbour preparation continues to wait for the arrival acknowledgement.

The source changes are `autosave.js`, `travel.js`, `save_worker.js`, `hex_storage.js` and the new `save_trace.js`. The measurement driver changes its time boundary and adds separate checkpoint completion. The only test-file change is the new `background_checkpoint.test.js`; all pre-existing save-safety tests are unchanged.

## Before and after

Before is supplied base `f15ec9c` plus trace-only commit `78edeaf`. After is source commit `69a4939`. Both use the same updated `scripts/step8-measure.cjs`, production bundles, seed 13, initial real save, natural autosaves and neighbour preparation. Desktop makes three hops, phone one, in each of two batches per version. No timed run is selected or replaced.

The playable interval starts before submitting the real pending travel order, so an onward-checkpoint wait belongs to that hop. It ends after destination installation, a renderer frame and the player's ordinary skip-intro action, when `worldBusy`, `transition` and the arrival intro are all clear. Walking and the optional arrival animation are excluded, as in the supplied driver. Checkpoint completion is reported separately from the same start. The driver waits for each checkpoint to record it before the next timed route selection; the small fixtures cover immediate onward hops with an actual pending checkpoint, both before and after its deferred frame.

All values below are milliseconds. “Wait before departure” includes initial scheduling plus any prior-checkpoint barrier. Arrival includes installation, rendering and skip-intro. The first four stage columns sum to playable time. “Checkpoint complete” is elapsed time from hop submission, not extra player wait.

| Run | Hop | Wait before departure | Away | Detail | Arrival | Playable | Checkpoint complete | Checkpoint round trip |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| b1 desktop | 1: 5,3 → 6,3 | 0.3 | 627.3 | 390.1 | 743.5 | 1761.2 | 4271.5 | 2475.2 |
| b1 desktop | 2: 6,3 → 6,2 | 0.7 | 516.1 | 200.0 | 471.5 | 1188.3 | 3534.8 | 1940.4 |
| b1 desktop | 3: 6,2 → 6,1 | 0.7 | 1264.9 | 632.9 | 502.3 | 2400.8 | 4710.8 | 2274.3 |
| b1 mobile | 1: 5,3 → 6,3 | 0.3 | 691.9 | 330.3 | 619.3 | 1641.8 | 3960.1 | 2281.2 |
| b2 desktop | 1: 5,3 → 6,3 | 0.3 | 958.5 | 496.9 | 1129.7 | 2585.4 | 5767.9 | 3139.6 |
| b2 desktop | 2: 6,3 → 6,2 | 0.9 | 773.1 | 220.6 | 464.4 | 1459.0 | 3514.2 | 1738.1 |
| b2 desktop | 3: 6,2 → 6,1 | 0.3 | 1231.4 | 653.2 | 517.0 | 2401.9 | 4720.8 | 2283.4 |
| b2 mobile | 1: 5,3 → 6,3 | 0.4 | 590.3 | 340.8 | 567.5 | 1499.0 | 3911.7 | 2373.6 |
| a1 desktop | 1: 5,3 → 6,3 | 0.7 | 633.5 | 334.5 | 668.4 | 1637.1 | 4082.6 | 2404.8 |
| a1 desktop | 2: 6,3 → 6,2 | 1.5 | 553.2 | 155.9 | 469.1 | 1179.7 | 2927.5 | 1721.4 |
| a1 desktop | 3: 6,2 → 6,1 | 2.1 | 575.5 | 1380.4 | 597.7 | 2555.7 | 4487.4 | 1850.4 |
| a1 mobile | 1: 5,3 → 6,3 | 0.5 | 685.0 | 370.5 | 552.3 | 1608.3 | 3850.3 | 2203.3 |
| a2 desktop | 1: 5,3 → 6,3 | 0.5 | 625.3 | 339.3 | 573.0 | 1538.1 | 3897.4 | 2318.1 |
| a2 desktop | 2: 6,3 → 6,2 | 1.0 | 689.7 | 335.0 | 531.7 | 1557.4 | 3727.3 | 1863.4 |
| a2 desktop | 3: 6,2 → 6,1 | 0.2 | 1817.9 | 44.5 | 490.4 | 2353.0 | 4531.8 | 2140.2 |
| a2 mobile | 1: 5,3 → 6,3 | 0.4 | 642.1 | 337.7 | 571.4 | 1551.6 | 3791.0 | 2098.2 |

Every desktop route is 5,3 → 6,3 → 6,2 → 6,1, arriving on days 7.25, 14.25 and 21.25. Both phone versions take the same first hop and arrive on day 7.25. All 16 checkpoints succeed, all eight processes exit 0, and there are zero page errors. `browser-validation.json` independently checks those route, side, calendar, acknowledgement and result fields.

The host exposes 4 CPUs (AMD EPYC 9354P 32-Core Processor); Chromium is 156.0.8078.4. Desktop uses 1440 × 900. Phone uses 390 × 844, DPR 3, touch/mobile emulation and the existing application pixel-ratio cap. Both use SwiftShader and the driver's existing CPU profiling, memory polling and history-GC hold. Ports are 8236 and 8237. Each version is served from its own frozen bundle. Shared-machine load varies; no causal speedup is claimed from the timing differences.

| Run | Load averages at start | Load averages at finish |
| --- | --- | --- |
| b1 desktop | 6.09, 4.50, 3.55 | 5.40, 4.70, 3.73 |
| b1 mobile | 5.40, 4.70, 3.73 | 4.51, 4.55, 3.75 |
| b2 desktop | 4.51, 4.55, 3.75 | 8.95, 6.20, 4.45 |
| b2 mobile | 8.95, 6.20, 4.45 | 5.62, 5.70, 4.39 |
| a1 desktop | 5.62, 5.70, 4.39 | 4.89, 5.33, 4.38 |
| a1 mobile | 4.66, 5.28, 4.37 | 4.11, 5.00, 4.33 |
| a2 desktop | 4.11, 5.00, 4.33 | 4.92, 4.92, 4.36 |
| a2 mobile | 4.69, 4.87, 4.35 | 4.17, 4.66, 4.30 |

Raw browser reports, profiles, memory samples and screenshots are in `.cache/step8/{b1,b2,a1,a2}-{desktop,mobile}/`. Run logs and exit codes are in `.cache/save-changes/`. The arrival terrain screenshots from b1 and a1 desktop were inspected as a builder smoke observation. No full independent acceptance/storyboard pass was duplicated.

## Behaviour proof and checks

Seven new fixture cases prove simulation resumes before acknowledgement, departed details remain until acknowledgement, failed checkpoints retain and retry the details, reload during a held write returns the complete pre-hop state, a second hop waits both before and after submission, a checkpoint failure prevents that second hop changing the world, and autosave/pagehide requests queue behind the arrival write. The fixtures use real community state, travel, encoding, compression and reload code. The unchanged existing tests retain their close-before-callback, close-during-write, local-directory identity, failure and old-world acknowledgement assertions.

| Check | Passed suites / total | Passed tests / total | Failed tests | Exit | Receipt in `.cache/save-changes/` |
| --- | ---: | ---: | ---: | ---: | --- |
| New regression before implementation | 2/3 | 8/12 | 4 | 1 | `trace-red.json` |
| Trace-only existing save fixtures | 4/4 | 27/27 | 0 | 0 | `trace-green.json` |
| First implementation, retained failure | 4/6 | 36/40 | 4 | 1 | `background-green.json` |
| Corrected eviction, incomplete new fixture | 5/6 | 39/40 | 1 | 1 | `background-green-2.json` |
| Final focused fixtures | 6/6 | 42/42 | 0 | 0 | `background-green-3.json` |
| Final affected gate | 139/139 | 1359/1359 | 0 | 0 | `affected-affected-tests.json` |

Both production builds exit 0: `before-build.*` and `after-build.*`. Each app build reports the same three bundle-size warnings; both workers compile successfully. Final source/driver ESLint exits 0 (`final-source-lint.*`), and new-test ESLint exits 0 with the correct Jest/Node globals (`final-test-lint-corrected.*`), with no warnings. The existing safety-test diff check exits 0 (`unchanged-save-tests.exit`).

The affected gate is the import-graph selector in `scripts/history-cpu-gate.cjs`, copied to `.cache/save-changes/affected.cjs` with only base `f15ec9c` and receipt paths changed. It selects 139 test files and runs the explicit Jest list under `/tmp/27agents-gate-2.lock`, with two workers and the existing 1 GB idle limit. There are no failures, skipped tests or todo tests; the one existing snapshot passes. No whole-suite gate or import-graph exception was used. This JavaScript repo has no TypeScript configuration or typecheck script; ESLint and the production compiler cover the changed areas.

The Node history capture calls the real mutating `generateWorldHistory(state, 13)` with a fresh object. Both complete JSON strings contain **199,928,327 bytes**, with SHA-256 **`5c22e0dcd4489c73646701b29ed3823e7d5e35097a95e6a4e30bf63621d7f5e2`**, matching the supplied reports. No filtering, sorting, projection or rounding is applied. Both capture processes and `cmp` exit 0: `before-history.*`, `after-history.*`, `history-comparison.exit`.

The restored-arrival probe follows the equivalence method in `hop-time-report.md`: real fixture travel, autosave, compression and reload, route **5,5 → 6,5 → 6,4 → 5,4**, repeated with legacy and local-directory identities. It compares all six complete restored game-data captures after replacing time-dependent hex-record values with their hex keys. It removes or rounds no gameplay fields. Both outputs contain **861,049 bytes**, SHA-256 **`68c17963280604e5e1d8631004bb8acc5951c1862d2f6763255e4644fcc3a47f`**. Both probe processes and `cmp` exit 0: `before-arrivals.*`, `after-arrivals.*`, `arrivals-comparison.exit`. The reusable scripts are `history.cjs` and `arrivals.cjs` in the same receipt directory. This comparison is of this job's before/after captures; it does not assert the older report's differently constructed fixture capture hash.

The affected runner records 97.229 seconds including runner/lock overhead, exits 0 and identifies source `69a4939f808dae8a4bd4c895f75b82ce9bc26794`. Its receipt is `affected-affected-receipt.json`. `browser-validation.json` records 8/8 successful runs, 16/16 successful saved arrivals, the exact routes/sides/days and zero page errors; its validation command exits 0. Full browser-world byte identity is not claimed because live sampling advances on wall time.

All test invocations used the second shared lock. Production builds used the same second lock. Browser and history measurements used `/tmp/27agents-gate.lock`. Dependencies were already installed; setup cost was zero.

Retained failures are separate from successful results. The initial new regressions fail on the baseline. The first implementation evicted all detailed away maps after any save, causing two existing fixtures to need unexpected hex reads. That implementation was corrected to evict only explicitly retained departure maps; the existing fixtures were not changed. The new fixture also initially omitted the worker's hex-read operation; adding that operation fixed its second-hop driver failure. Both failed implementation runs and their exact counts remain in the table. The initial new-test ESLint invocation omitted the Node `setImmediate` global and exited 1 with two errors; the corrected invocation exits 0. The trace-only focused Jest run reported a force-exited worker after all 27 tests passed; it exited 0. The final focused and affected runs completed successfully.

## Change-tracking design — not implemented

The next storage format should send explicit dirty records rather than a fresh copy of the entire world directory. Object identity is insufficient: aging, relationship bonds, learned knowledge and inventories are mutated in place. Introduce monotonic revisions and dirty IDs at the real mutation boundaries, including field edits, component replacement, births/deaths, relationship changes, learning, event publication, transfers, estates and community summaries. Retain deletion tombstones. A checkpoint captures a revision and all dirty records through that revision; acknowledgement clears a dirty entry only if its revision still matches. Edits made while a save is running remain dirty for the next write. Failure clears nothing.

Separate immutable world geometry and detail recipes from mutable canonical people, relationships, per-person knowledge, append-only event bodies and compact communities keyed by hex. Keep route, calendar, custody/transit and active-hex metadata in a small root. The worker reconstructs the canonical directory on load, using IDs for shared references and the existing local-person hydration rules. Preserve resident, bond and event insertion order and the existing `eventOrder`, along with undefined and non-finite graph values. Per-record storage must not silently change iteration order, sharing or simulation choices. Record granularity and optional batching need measurement before choosing a layout.

Use a versioned root, for example format 3, pointing to a committed generation of directory records and detailed hex records. Write changed records, tombstones, new directory roots and the new world root in one transaction. An aborted write leaves the old root and everything it references intact. Serialize worker requests as today and build each write on the last acknowledged root. Never publish a new root pointing at uncommitted records. Reclaim obsolete records only after the new root commits; a failed transaction must not delete old dependencies.

Retain the current arrival policy: install and render the destination, retain departed details, submit the immutable revision packet after a frame, and evict only when that generation is acknowledged. Onward travel awaits that generation. Autosaves queue behind it. A tab closing before commit restores the previous generation as a whole. The packet copied on the main thread then contains only dirty records and the small root, reducing both page-side structured clone and worker-side materialisation; storing smaller changed records also addresses the measured native IndexedDB put cost.

Migration must read existing format-2 saves with the current decoder and write a complete format-3 generation atomically before switching roots. Keep the old save loadable until that succeeds. Before rollout, mutation coverage must demonstrate that every durable field edit either creates a dirty record or is deliberately derived. Repeat close/abort/quota-failure fixtures, edits-during-save and delete/recreate cases, seed-13 byte identity and full restored-arrival equivalence. This is a separate change; no tracking, storage migration, gameplay cap or neighbour-generation policy change was built here.

## Delivery

Green commits: `78edeaf` adds the round-trip marks and correct measurement boundaries (27 existing save tests and a production build pass). `69a4939` adds the onward-hop barrier, queue discipline, acknowledgement eviction and seven new fixtures (42 focused tests and the 1,359-test affected gate pass). This report is committed separately. Runtime source is frozen at `69a4939`; the final build and all after measurements use that source.

Both owned servers were stopped by their saved, verified PIDs after the probes. All eight owned browser root PIDs are confirmed no longer running after their browser handles closed. `process-cleanup.json` records the commands, PIDs and successful cleanup; `process-cleanup.exit` is 0. Source and report whitespace checks pass with exit 0 (`diff-check.exit`).

All generated bundles, logs, profiles, JSON histories, fixture captures, screenshots, PID files and exit receipts remain under `.cache/`. Only this report is added under `shots/`. No push, stash, delegation, other-branch comparison, outside-worktree file creation, vault write, delegation-log write or bench-ledger write occurred.
