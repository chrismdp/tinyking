The under-three-second target is not met. Final desktop hops took 4.97, 3.39 and 5.60 seconds. The phone hop took 3.68 seconds. These are measurements on this shared four-CPU server with software graphics. They do not establish ordinary-laptop or physical-phone performance.

Five performance changes delay neighbour work until the arrival is saved, reduce save packets, defer hidden props, close a preparation scheduling race, and remove repeated news checks. The final affected gate passed 140/140 suites and 1,366/1,366 tests. The production build passed. Complete seed-13 history stayed byte-identical. Six restored fixture arrivals also stayed identical after normalising storage record keys.

Work stops at the remaining design choices. The checkpoint still sends and writes the complete mutable world directory. Removing that cost safely requires a defined change-tracking and storage scheme. Delaying neighbour work also exposes destination terrain generation on the third immediate hop. Moving that work off the main thread, or preparing a larger area before play, needs a scheduling or loading-policy decision. The nearest-only people requirement also remains unmet.

All times below are milliseconds. Each row measures consecutive intervals. The checkpoint column includes submission, transport, worker work, scheduling and acknowledgement.

| Cumulative version | Hop | Away season | Arrival detail | Installation and first frame | Checkpoint and scheduling | End to end |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Baseline a7cb4bd | Desktop 1 | 695.8 | 426.4 | 645.7 | 2442.4 | 4210.3 |
| Baseline a7cb4bd | Desktop 2 | 797.1 | 756.9 | 551.8 | 2343.0 | 4448.8 |
| Baseline a7cb4bd | Desktop 3 | 1166.1 | 20.6 | 1019.7 | 5987.4 | 8193.8 |
| Baseline a7cb4bd | Phone 1 | 1943.8 | 670.0 | 1660.6 | 4575.9 | 8850.3 |
| Checkpoint scheduling b6dcdb9 | Desktop 1 | 671.1 | 317.0 | 615.2 | 1967.3 | 3570.6 |
| Checkpoint scheduling b6dcdb9 | Desktop 2 | 573.5 | 240.1 | 501.9 | 2283.4 | 3598.9 |
| Checkpoint scheduling b6dcdb9 | Desktop 3 | 1276.0 | 600.5 | 563.5 | 1976.6 | 4416.6 |
| Checkpoint scheduling b6dcdb9 | Phone 1 | 753.2 | 349.6 | 960.5 | 2204.5 | 4267.8 |
| Save packet c74d94a | Desktop 1 | 659.0 | 385.8 | 601.7 | 2189.3 | 3835.8 |
| Save packet c74d94a | Desktop 2 | 608.8 | 275.7 | 575.3 | 2026.5 | 3486.3 |
| Save packet c74d94a | Desktop 3 | 3238.1 | 32.7 | 842.2 | 3270.3 | 7383.3 |
| Save packet c74d94a | Phone 1 | 735.8 | 366.8 | 954.8 | 2654.3 | 4711.7 |
| Visible props 57d401d | Desktop 1 | 653.6 | 306.4 | 589.5 | 2091.4 | 3640.9 |
| Visible props 57d401d | Desktop 2 | 590.6 | 137.9 | 404.4 | 2000.1 | 3133.0 |
| Visible props 57d401d | Desktop 3 | 1833.4 | 24.7 | 475.6 | 2475.7 | 4809.4 |
| Visible props 57d401d | Phone 1 | 698.2 | 288.6 | 529.7 | 1955.8 | 3472.3 |
| Yield priority 10a0e6b | Desktop 1 | 733.1 | 371.6 | 636.5 | 2042.3 | 3783.5 |
| Yield priority 10a0e6b | Desktop 2 | 637.6 | 140.2 | 442.8 | 1517.7 | 2738.3 |
| Yield priority 10a0e6b | Desktop 3 | 627.4 | 1304.1 | 503.6 | 1723.1 | 4158.2 |
| Yield priority 10a0e6b | Phone 1 | 627.3 | 314.7 | 500.8 | 2023.3 | 3466.1 |
| Seasonal news 7198d94 | Desktop 1 | 850.7 | 463.2 | 859.3 | 2799.6 | 4972.8 |
| Seasonal news 7198d94 | Desktop 2 | 674.9 | 171.1 | 523.7 | 2021.8 | 3391.5 |
| Seasonal news 7198d94 | Desktop 3 | 1200.6 | 1397.9 | 610.9 | 2385.8 | 5595.2 |
| Seasonal news 7198d94 | Phone 1 | 560.8 | 299.6 | 670.7 | 2152.4 | 3683.5 |

Every desktop run used 5,3 → 6,3 → 6,2 → 6,1. Every phone run used 5,3 → 6,3. All 24 hops reached their destinations and received successful arrival checkpoint acknowledgements. Only the yield-priority version's second desktop hop fell below three seconds. No retry selected a faster sample.

Each version used a frozen production bundle and `scripts/step8-measure.cjs` under `flock -w 7200 /tmp/27agents-gate.lock`. Timing ports were 8197–8202. The deletion fixture used port 8203. Later runs used a cached copy of that driver with visibility assertions after all timed hops. The timed sequence stayed unchanged. Chromium used SwiftShader. Desktop used 1440 × 900. Phone used 390 × 844, DPR 3, touch and mobile emulation.

Load varied substantially. Final desktop load averages changed from 2.00/2.78/2.97 to 7.71/4.96/3.76. Final phone started at those latter values. Builds and affected tests used the separate second heavy slot. Some verification overlapped earlier probes. These individual observations do not establish causal speedup. The final news change has no demonstrated end-to-end gain over the preceding sample.

| Commit | Change | Evidence and result |
| --- | --- | --- |
| `b6dcdb9` | Added an arrival-checkpoint barrier to neighbour preparation. Existing background builds pause through the write. New preparation starts after acknowledgement and a further frame. | Baseline traces contained background save submissions during hops. Later timed hops contained one checkpoint each. Desktop checkpoint stages changed from 2442/2343/5987 to 1967/2283/1977 ms in the next sample. |
| `c74d94a` | Projected the durable packet before `postMessage`. It contains the manifest and changed detailed hexes. The manifest omits duplicate active terrain, local identity/knowledge copies and away terrain. | The worker accepts old full snapshots and projected packets. The durable format and compressed records remain compatible. The next sample does not establish an end-to-end gain. The mutable world directory remains in every packet. |
| `57d401d` | Deferred undiscovered static props until discovery. People and animals continue updating every frame. | Final desktop deferred 1,877 of 1,912 tree/building meshes. All 35 known props existed. Revealing the map built every deferred prop. Phone deferred 1,145 props and built all of them on reveal. Installation improved in the first view-change sample, but the final sample varied. |
| `10a0e6b` | Rechecked preparation priority after its asynchronous progress yield. A hop can start during that yield. | The regression failed before the fix and passed afterwards. Third-hop away work changed from 1833 to 627 ms in the next sample. Arrival detail rose from 25 to 1304 ms. Unfinished terrain work moves to the destination that needs it. |
| `7198d94` | Streamed news candidate unions, checked indexed audience membership before scope work, and removed repeated relevance/knowledge checks. | Candidate order and results remain unchanged. Complete history matches. Final phone seasonal work measured 561 ms, against 627 ms previously. Shared load prevents a causal timing claim. |

The view smoke observations ran after timed hops. They asserted that known trees and buildings had meshes, that hidden props were deferred, and that full reveal built all eligible props. Desktop and phone passed for the view, priority and final versions. Screenshots remain under `.cache/step8/hop-*/`. The final desktop arrival screenshot was inspected. This was a builder smoke observation, not a duplicate full acceptance pass.

Save safety was tested before changing save timing or packet contents. The fixtures cover closing before the deferred callback, closing during a write, checkpoint failure, an old world's late acknowledgement, and reload after a hop. The closing-during-write test runs with both legacy and local-directory identities. It checks arrival, age, journey, departed details and unique player residence. Failed writes retain departed details. Acknowledgements still precede eviction. The worker still commits the manifest and hex records in one IndexedDB transaction.

The equivalence probe materialised only this branch's `a7cb4bd` ancestor inside `.cache/hop-time/baseline-source/`. It drove the fixture route 5,5 → 6,5 → 6,4 → 5,4 on ancestor and final source. It used real travel, autosave, compression and reload code. All six restored game-data captures matched byte for byte after replacing time-dependent record keys with their hex keys. No gameplay fields were removed or rounded. Their comparison SHA-256 is `104c0d87ef0d716e37f8b3797213b9478b08bf6a85331fc19759ed1c661a0263`. The browser probes reached the same route and calendar outcomes. A complete cross-run byte comparison of live browser worlds is not claimed because their live samples advance on wall time.

The history probe passed a fresh object to the real `generateWorldHistory(state, 13)` and compared the complete resulting JSON strings. Both contain 199,928,327 bytes. Their SHA-256 is `5c22e0dcd4489c73646701b29ed3823e7d5e35097a95e6a4e30bf63621d7f5e2`, matching the supplied baseline. `cmp` exited 0. History received no sorting, projection, filtering or rounding.

Exact test results follow. Receipt paths are relative to `.cache/hop-time/`.

| Check | Passed suites / total | Passed tests / total | Failed tests | Exit | Receipt |
| --- | ---: | ---: | ---: | ---: | --- |
| Scheduling regression, before | 1/2 | 6/7 | 1 | 1 | `scheduling-red.json` |
| Scheduling fixtures, after | 3/3 | 19/19 | 0 | 0 | `scheduling-green.json` |
| Scheduling affected gate | 139/139 | 1358/1358 | 0 | 0 | `scheduling-affected-tests.json` |
| Packet regression, before | 0/1 | 6/7 | 1 | 1 | `projection-red.json` |
| Packet fixtures, after | 4/4 | 26/26 | 0 | 0 | `projection-green.json` |
| Packet and identity fixtures, after | 5/5 | 32/32 | 0 | 0 | `projection-green-local.json` |
| Yield regression, before | 0/1 | 5/6 | 1 | 1 | `priority-red.json` |
| Yield fixtures, after | 2/2 | 9/9 | 0 | 0 | `priority-green.json` |
| News focused gate, corrected | 3/3 | 49/49 | 0 | 0 | `news-focused-green.json` |
| Final affected gate | 140/140 | 1366/1366 | 0 | 0 | `affected-affected-tests.json` |

The final affected gate reused `scripts/history-cpu-gate.cjs` with base `a7cb4bd`. A cached adaptation changed only the base and receipt paths. It ran `npx jest --runTestsByPath <140 selected files> --maxWorkers=2 --workerIdleMemoryLimit=1GB --json` under `/tmp/27agents-gate-2.lock`. It took 92.832 seconds including runner overhead and exited 0. There were zero failures, skipped tests, todo tests or snapshots. No full-suite gate or import-graph exception was used. This JavaScript repository has no TypeScript configuration or typecheck command. ESLint and the production compiler covered the changed source.

| Other evidence | Result | Exit | Receipt under `.cache/hop-time/` |
| --- | --- | ---: | --- |
| Production builds | Seven of seven passed. Each app build reported the same three bundle-size warnings. Save workers compiled. | 0 each | `baseline-build.*`, `scheduling-build.*`, `projection-build.*`, `visible-build.*`, `priority-build.*`, `news-build.*`, `deleted-prop-build.*` |
| Source ESLint | All five changed source files passed without warnings. | 0 | `final-source-lint.*` |
| Browser probes | Twelve of twelve processes passed, with 24 saved hops and zero page errors. | 0 each | `<phase>-desktop.*`, `<phase>-mobile.*`; raw reports under `.cache/step8/hop-<phase>-<device>/` |
| History captures | Before and final complete JSON matched the supplied hash. | 0 each | `baseline-history.*`, `final-history.*` |
| History comparison | Complete files matched. | 0 | `history-comparison.exit` |
| Arrival comparisons | Six ancestor/final captures matched. | 0 | `baseline-arrivals.*`, `final-arrivals.*`, `final-arrivals-comparison.*` |
| Diff whitespace | `git diff --check` passed. | 0 | Command result in the session |

Failed attempts remain separate from application results. The first history driver treated the mutating generator's return value as the state and exited 1. The first equivalence fixture chose unsupported fixture coordinates and exited 1. Its next version omitted the client's hex-read operation. Both ancestor and candidate failed with exit 1. Corrected deterministic fixtures passed without changing game assertions. Those logs include `driver-error` in their names. One focused Jest command named absent `test/news.test.js`: two suites and 39 tests passed, one suite failed to load, and the command exited 1. The corrected explicit file list passed three suites and 49 tests. Deliberate red regressions are listed above. All logs and exits remain in `.cache/`.

| Remaining issue | Evidence | Decision needed |
| --- | --- | --- |
| Full mutable world checkpoint | Final desktop message round trips were 2754/1988/2318 ms. Input copies were 275/277/369 ms. Worker work was 829/816/873 ms. Phone round trip was 2124 ms, with a 262 ms input copy and 689 ms worker work. | Define durable deltas or separate records for people, relationships and events, with explicit mutation tracking and migration. Object identity cannot detect in-place mutations. Retain atomic arrival saves. The unaccounted round-trip gap also needs worker/IPC tracing before attributing all of it to copying. |
| Destination terrain | Final desktop hop 3 spent 1398 ms preparing detail. Its profile sampled 1339 ms in `generateMap`. Pausing neighbours protects the checkpoint but leaves unfinished terrain for immediate onward travel. | Choose worker-based generation or broader preparation before play. Main-thread neighbour generation must continue to yield to the arrival checkpoint. |
| Seasonal and rendering work | Final desktop hop 3 spent 1201 ms on away seasons and 611 ms on installation/frame. Its profile sampled 1119 ms in `advanceWorldClock` and 402 ms in the frame call tree. Samples overlap and are not additive. | Retain deterministic community order. Further structural changes need the same history and reload proofs. Terrain and the known view of each new hex still require installation. |
| Nearest-only people checks | `social_visits.js` still scans adults for partner interest and visits, and children for play. Campfire and commons-witness paths retain wider scans. These paths were not changed. | Choose a spatial limit and the treatment of existing distant relatives, friends and romantic prospects. Restricting existing travel motives changes behaviour. This job introduced no arbitrary radius or candidate cap. |

A final renderer review found that a deleted hidden prop can leave a stale deferred ID before discovery refresh. Commit `4a0a864` removes those IDs before reading their positions. The focused browser fixture deleted a hidden tree, refreshed visibility and rendered the revealed map. The removed tree stayed absent, another hidden tree appeared, and no page error occurred. The fixture and final build exited 0. Receipts are `deleted-prop-smoke.*` and `deleted-prop-build.*`. The import-graph selector found zero test files reachable from this renderer-only diff against `7198d94`. The 140-suite result remains the evidence for the unchanged game and save modules. Timed paths contained no deleted deferred props, so the performance observations were retained. No further timing run was used to seek a passing target.

Source changes are limited to five modules. Three edited tests contain save and scheduling regressions. No test configuration, shared harness or generated types changed. Final source commit: `4a0a864`. The last timed performance candidate was `7198d94`. This report is committed separately. Dependencies were installed already, so setup cost was zero.

All generated bundles, raw JSON, profiles, screenshots, logs, PID records and receipts are under `.cache/`. Servers used saved PIDs and were stopped only after verifying their commands. Browser handles closed their own processes. Cleanup is recorded in `.cache/hop-time/process-cleanup.json`. No push, stash, delegation, other-branch comparison, vault write, delegation-log write or bench-ledger write occurred.
