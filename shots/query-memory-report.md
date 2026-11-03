# Local people, queries and memory

Completed 2026-11-03T00:41:20.960Z. Worktree /home/cp/code/tinyking-world, branch feat/one-world. Final commit: `eca6699c2176618cd5663e60c0951ce07c0a574a`. No push.

The measured seed-13 candidate meets both numerical targets: 138.17 MB heap after collection and 248.622 CPU seconds for a new game. The requested limits are 250 MB and 309 seconds. The demographic change is substantial: living people fall from 658 to 93. Memory savings include that population effect as well as the storage and query changes. Some local planner scans remain; the scan rewrite is not a literal removal of every matched loop.

## Measurement controls

The baseline is this branch's initial HEAD, 90c059e, archived inside this worktree. It already includes the preceding builder's shared construction recipes. Its workspace size therefore differs from the older d74d9a4 measurements in the brief. No other branch's source was read.

Standalone Node runs use seed 13, all 180 shared seasons, all 40 land communities and four detailed maps. The existing Babel stage profiler was reused. Timing includes generateWorldGame and startGame with the intro skipped. It excludes module loading, diagnostic V8 exports and forced collection. Node does not include a renderer or IndexedDB. Full worlds run only in measurement scripts, never in Jest.

These are observations on a shared host, not a quiet-host speed guarantee. Baseline starting load: [3.39,6.3,9.78]. Final starting load: [2.03,3.15,3.67]. Contention changed during the work. A quieter pre-checkpoint run used 87.551 CPU seconds. The final table uses the checkpoint fix. Earlier complete runs of the same demographic rules used 292.052, 283.871 and 252.897 CPU seconds, all below 309. Their histories compare exactly. Checkpoint representation and redraw queues are normalised where needed, as described below. The final run is not substituted for any failed or partial run.

| Measure | Initial HEAD | Final |
| --- | ---: | ---: |
| New-game CPU | 680.891 s | 248.622 s |
| New-game wall | 776.606 s | 328.404 s |
| Raw heap after generation | 552.33 MB | 275.06 MB |
| Heap after GC | 519.34 MB | 138.17 MB |
| RSS after GC | 1646.18 MB | 479.32 MB |
| Peak Node RSS before game export | 1828.53 MB | 486.43 MB |
| First prepared-neighbour hop wall | 7.187 s | 1.301 s |
| First hop CPU | 14.766 s | 1.388 s |
| Second hop wall | 3.916 s | 0.709 s |
| Second hop CPU | 4.990 s | 1.247 s |

Heap falls 73.4%. RSS falls 70.9%. CPU falls 63.5% in these observations, with the contention qualification above. Peak RSS includes the diagnostic history export and Babel. It is not a phone browser heap peak.

Receipts: regress-profile-query-before.json, regress-profile-query-final5.json and query-final5-run.exit. The final source matches shots/query-final5-source/src and is hashed in query-final-source.json.

## Locality and simulation changes

The old reference closure followed residents' acquaintances, learned names and two further family generations. It imported every selected person's full relationship component into the hex. Learning effects could introduce remote subjects as acquaintances, and remote kin could hear occurrences through the family audience. This is why 9,2 held 976 person entries. It is now a local ECS view over the directory. Remote ancestry and ownership remain readable without importing their relationship tables.

Summary audiences use local villagers and local kin. Live hearing uses the spatial index within 300 units. Romance and affair witnesses use 85 units, wakefulness, interior and wall checks. Actual event participants retain their facts, including remote heirs. Remote anonymous regard does not introduce a stranger. Cross-hex gossip still requires a real conversation with someone carrying the event.

Each generated person has a fixed, seeded 5% chance of willingness to seek company abroad. This is a probability, not an exact population quota. Willing travellers still need no viable local romantic prospect and use the existing roads, visit duration, consent and return rules. Existing visitors can return. Birth, ageing, kin exclusion and consent rates retain their existing rules.

| Seed-13 history measure | Before | After |
| --- | ---: | ---: |
| People retained | 1879 | 852 |
| Living people | 658 | 93 |
| Marriages | 508 | 356 |
| Local household moves | 510 | 271 |
| Permanent moves between hexes | 202 | 5 |
| Quarrels | 3149 | 2872 |
| Romances | 864 | 195 |
| Affairs | 7 | 8 |
| Births | 1639 | 612 |
| Deaths | 1221 | 759 |
| Local visits | 5185 | 6952 |
| Departures | 9640 | 476 |
| Distinct travellers | 1546 | 30 |
| Directional bonds | 79211 | 22058 |
| Bonds between current hexes | 9995 | 1092 |
| Cross-hex bonds with neither person ever travelling | 158 | 0 |
| Known observer/event associations | 769491 | 656100 |

The final history retains 120 houses and 40 land communities. Only 30 of 852 retained people travelled, versus 1,546 of 1,879 before. The remaining cross-hex bonds involve actual travellers. The measured count with neither endpoint ever travelling is zero. Moved kin and genuine old relationships remain readable.

This changes the game materially. Local kin saturation and fewer incoming partners produce far fewer births and a much smaller living population. The result is not a population-preserving performance optimisation. It was not tuned across other seeds or given extra births to offset the loss. Counts come from complete end-of-history exports; new-game UI/backstory records are reported separately by the state reports.

Receipts: query-history-before.json, query-history-after.json and their exit files. Full new-game directories contain 1,884 people before and 857 after, including the player and backstory references. The final checkpoint directory also contains seven sealed backstory events recorded after history. They are excluded from the history count table.

## Private, generally known and public information

Every new-world event begins private with explicit knowers. A village promotes it when half of its living residents know it, with a minimum of three. A village with fewer than three needs everyone. Promotion removes individual entries covered by that scope. Public status covers a hex after two villages are informed and at least 60% of its living residents, with at least four people, are covered. Public status does not broadcast to another hex.

Each event definition declares relevance to affected people, kin, its village or its hex. Work and harvest normally stay in their village. Travel and major community events can matter throughout a hex. A traveller remembers scope exposure up to departure, without learning later news from a place they left. Explicit exceptions preserve already learned facts outside a promoted scope.

canDiscloseEvent remains the final disclosure policy for trust, kin, friends, secrets and relevance. News selection, NPC speech, player Tell and hearing reach that gate. The live world-catalogue lookup also resolves carried accounts without importing their event bodies. Existing affair discovery effects and witness provenance remain. Covered NPC reaction/source rows are released; player sources and private discovery evidence remain. Earlier saves retain their original knowledge policy.

| End-of-history event state | Events |
| --- | ---: |
| Private | 1745 |
| Generally known in villages | 18600 |
| Public in hexes | 1540 |
| Total | 21885 |

There are 46,600 explicit knower entries, including exceptions, versus 769,491 per-person learned IDs before. New worlds store zero per-person event IDs. Expanding the scoped query gives 656,100 observer/event associations at the end of history. This count includes retained ancestors and implicit scope knowledge, so it is not a count of spoken transmissions. The smaller population and broader implicit local knowledge both affect it.

| New-game news CPU | Before | Final |
| --- | ---: | ---: |
| Exchange, including choice and learning | 192.606 s | 68.308 s |
| Choosing the story, included above | 173.614 s | 55.411 s |
| Companion news scoring | 10.995 s | 33.053 s |

The query skips scopes already shared by teller and listener. Unshared information is intersected with the listener's village, hex and affected kin. Private story groups are maintained on learning and promotion. They supply the newest relevant unheard account about the same people and place. Village, household, occupancy and spatial indexes are maintained on writes. Scope and index data used only at runtime do not enter saves.

News exchange saves 124.297 CPU seconds in the final observation. This includes changed population, encounters and relevance, not only faster lookup. Earlier busy-host candidates spent 72–89 seconds exchanging news. The original private lists alone encoded to 40.53 MB; the entire final knowledge directory encodes to 1.23 MB.

## Storage, workspace and saves

The directory owns each current personal component once. Runtime local entries point at those same objects. A remote component resolves through the directory view. Saved hexes contain person IDs and event references. Knowledge is one shared directory, and prepared maps contain no person component records. Departures remove owned identity entries immediately. Restore reconnects views after the worker's structured clone. Component replacements update the canonical heads on write. A checkpoint also publishes current active heads and pending events before writing ID references.

Construction plans contain house assignments, adult/deceased/guest roles and controller references as IDs. They contain no personal component or knowledge copies. Compressed plans occupy 0.11 MB and the content rolls occupy 0.01 MB. The raw worldHistory workspace is released. Active redraw requests reach the live renderer and are removed from snapshots; away arrivals retain no redraw queue.

These are decimal MB from V8 compact encoding, not allocated heap. Fields overlap through shared references and must not be added.

| Part | Before | Final |
| --- | ---: | ---: |
| `travel.maps` | 88.26 MB | 14.87 MB |
| `travel.knowledge` | 40.53 MB | 1.23 MB |
| `worldHistory` | 9.28 MB | 0.00 MB |
| `travel.events` | 8.57 MB | 8.51 MB |
| `travel.people` | 8.47 MB | 2.79 MB |
| `travel.preparedMaps` | 6.42 MB | 4.86 MB |
| `Active hex ECS` | 4.56 MB | 2.03 MB |
| `Complete game encoding` | 106.38 MB | 20.95 MB |

The largest old snapshot was 9,2: 4.65 MB ECS, 4.69 MB knowledge and 1.68 MB events. The final largest snapshot is the active 5,3, with 2.03 MB ECS. Maximum owned person entries per hex fall from 976 to 82, including deceased local ancestors. Maximum retained snapshot redraw requests fall from 18,286 to zero.

The first audit found a stale player household head, which could restore an old home when saving between hours. The new regression reproduced that lost-home save before the fix. The checkpoint fix now retains the new home and pending event immediately. Its red and green logs are query-checkpoint-red.log and query-checkpoint-green2.log. The failed initial audit is preserved as query-single-person-check-before-checkpoint.json.

The final-state audit finds zero foreign owned person entries, zero duplicate hex owners, zero mismatched canonical component aliases, zero person components in prepared maps, zero per-person event IDs and zero snapshot redraw queues. Every map's knowledge pointer is the one directory. Receipt: query-single-person-check.json.

| Save measure | Before | Final |
| --- | ---: | ---: |
| Native manifest, V8 size estimate | 95.28 MB | 14.02 MB |
| Compressed hex records | 2.88 MB | 1.46 MB |
| Manifest estimate plus hex records | 98.16 MB | 15.47 MB |
| Complete supported graph gzip | 19.53 MB | 3.82 MB |

The manifest estimate is an encoding comparison, not an exact IndexedDB disk byte count. The browser's actual post-hop IndexedDB storage estimate was 4.35 MB. Full graph gzip is an exact alternative payload size, not the native manifest format. Both full-world save round trips compare complete people, events and knowledge dictionaries with util.isDeepStrictEqual, exit 0. Small tests also check identity sharing, ownership/storage rules, real transfer and reload.

The supplied memory script was copied to scripts/mem-breakdown.js. scripts/query-state-report.js reads saved diagnostic states and reports sizes, counts and save round trips without generating another world.

## Equality and determinism

The earlier builder's V8 export and util.isDeepStrictEqual method was retained.

- Initial HEAD versus query-only stage: complete history equal and complete new-game state equal, both exit 0. Counts on both sides: 1,879 history people, 1,884 new-game directory people and 41,433 events. Logs: query-lossless-history-equality.log and query-lossless-game-equality.log.
- Repeated changed-world runs across the final arrival-index update: complete raw history and complete raw game equal, both exit 0. Counts on both sides: 852 history people, 857 new-game directory people and 21,885 events. Logs: query-final-history-equality.log and query-final-game-equality.log.
- Final render-queue removal versus that state: complete history and complete game equal after deleting only root and hex redraw fields on both sides, both exit 0. No event, component, ownership, household, knowledge, season or planner field is omitted. Raw equality is deliberately false because the queues were removed. Logs: query-final-cleanup-history-equality.log and query-final-cleanup-game-equality.log.
- The final checkpoint fix preserves complete raw history, exit 0. Complete game values also compare equal after synchronising active component heads and publishing already-recorded pending events on both sides. No field is omitted. Raw game equality is false because the old directory held the stale home and omitted seven events already present in the active event list. Logs: query-checkpoint-history-equality.log and query-checkpoint-game-equality.log.
- Canonical save records compare exactly after encode/decode. Receipt: query-state-final5.json, save.historyEqual=true.

Aliasing changes are allowed by value comparison. The final-state alias audit separately checks that canonical objects are actually shared. The seven starting household owners also remain unchanged by detailed construction (query-starting-estates-check.json). These proofs do not claim equality between the deliberately different local/private simulation and the old globally connected simulation.

## Browser checks

Port 8180, Chromium at 1440×900 with SwiftShader, seed 13. The final browser pass started a real new game, saved and reloaded an actual walking journey, then crossed through the native Travel planner. An earlier focused pass continued the first saved life, repeated save/reload and returned through the native planner after the departure-storage fix. Each pass held its source frozen. The final browser pass uses the final checkpoint source on the development server. The production build was checked separately. It also asserts canonical home sharing before and after reload. The complete final history equality is above.

| Browser operation | Final browser pass | Earlier focused return pass |
| --- | ---: | ---: |
| New game including page load and Start | 83.019 s | Continued saved life |
| Hop processing | 5.695 s | 3.321 s |
| Walk plus hop | 5.976 s | 3.481 s |
| Mid-journey save and reload | 17.699 s | 31.493 s |

The collected browser heap after startup was 116.42 MB. The raw history workspace was absent. Both restores retained the same player, position and route, with exactly one resident/transit copy. The focused return found no stale owned player records in departed maps. Both successful passes had zero page errors. The first focused attempt failed in its driver because the naturally completed intro removed Skip between locating and clicking it. That failed receipt is preserved as query-browser-final2-attempt1.json; the retry performs the optional DOM click synchronously. No application assertion or timeout was weakened.

Screenshots query-final-start.png and query-final-arrival.png were visually inspected. They show the camp, village, fields, woodland and player, then the actual arrival. Receipts: query-browser-final.json, the earlier query-browser.json, query-browser-final2.json and query-return-final2.png. Only owned development and production servers were stopped. Port 8180 is free. Ports 8080–8082 were untouched. This was a builder smoke check, not a phone benchmark or independent play review. A separate production-build probe could not use the simulation bridge, which world.js deliberately excludes in production. It timed out while waiting for that bridge and had no page errors. Its failed receipt is query-browser-production.json. The mechanical seed-13 check uses the existing development bridge; no application assertion was removed.

## Affected gate and build

125 of 146 test files have passing evidence from the transitive import graph. Every Jest batch has at most three files and runs env -u NODE_OPTIONS npx jest --runTestsByPath with --maxWorkers=2 --workerIdleMemoryLimit=1GB under one supplied flock lock, with -w 10800. No whole suite ran. No test generates the production whole world. This JavaScript project has no TypeScript/typecheck command.

Every final batch exits 0. Exact final commands and exits are in query-checkpoint-gate-receipts.json. The earlier full pass is retained separately in query-final-gate-receipts.json: batches 01–18 exited 0, batch 19 exited 1, and batches 20–41 exited 0. That batch 19's only failure was the newly added NPC-arrival test expecting a boolean from a function whose successful return is undefined. It now asserts the actual transit entry, household, village, proximity and renderer request. The failed suite passed on its focused rerun and again in the final transient batch. The other two suites in batch 19 passed in that batch. Final receipts contain exact file lists, commands and exits: query-checkpoint-gate-receipts.json. Coverage is query-final-gate-complete.json.

| Batch | Files in test/ (.test.js) | Final exit |
| --- | --- | ---: |
| 01 | `acceptance_selection`, `arrival`, `arrival_tasks` | 0 |
| 02 | `autosave`, `biography`, `campfire_visits` | 0 |
| 03 | `chat`, `chat_acceptance`, `chat_answers` | 0 |
| 04 | `chat_guidance`, `chat_row_rules`, `chat_tell` | 0 |
| 05 | `chat_travel`, `chat_visits`, `core_loop` | 0 |
| 06 | `designation_selection`, `ecology`, `ecology_habitat` | 0 |
| 07 | `entities`, `event_index`, `event_knowledge` | 0 |
| 08 | `family_history_integration`, `favours`, `field_designation` | 0 |
| 09 | `fireside`, `first_run`, `food_economy` | 0 |
| 10 | `food_routes`, `food_variety`, `forage_designation` | 0 |
| 11 | `friend_help`, `gathering`, `geography_foundations` | 0 |
| 12 | `geography_placement`, `geography_refinement`, `gift_choices` | 0 |
| 13 | `gossip`, `gossip_bubbles`, `happy_paths` | 0 |
| 14 | `height`, `hex_detail`, `hex_eviction` | 0 |
| 15 | `hex_storage`, `history`, `history_items` | 0 |
| 16 | `history_reference_index`, `history_scope`, `hop_checkpoint` | 0 |
| 17 | `household_routines`, `htn`, `info_ownership` | 0 |
| 18 | `integration_food`, `intro`, `journey_memory` | 0 |
| 19 | `leaks_regressions`, `local_queries`, `local_world` | 0 |
| 20 | `manager`, `map`, `mother_family` | 0 |
| 21 | `one_world`, `pathfinding`, `people` | 0 |
| 22 | `people_feedback`, `people_goals`, `people_interactions` | 0 |
| 23 | `people_orders`, `people_panel`, `person_activity` | 0 |
| 24 | `person_storage`, `play_session_feedback`, `player_day` | 0 |
| 25 | `player_farming`, `player_household`, `possession_disclosure` | 0 |
| 26 | `realm_map`, `reference_views`, `relationship_index` | 0 |
| 27 | `relationships`, `remote_family_review`, `replay2_findings` | 0 |
| 28 | `replay2_warning_care`, `replay_findings`, `roads_tracks` | 0 |
| 29 | `save_client`, `save_game`, `scoped_news` | 0 |
| 30 | `season_polish`, `seasons`, `settlement_access` | 0 |
| 31 | `settlement_details`, `settlement_growth`, `settlement_history` | 0 |
| 32 | `settlement_woodland`, `shelter_placement`, `simulation` | 0 |
| 33 | `social`, `social_events`, `social_gifts` | 0 |
| 34 | `social_mobility`, `succession`, `succession_controls` | 0 |
| 35 | `succession_customs`, `succession_knowledge`, `survival` | 0 |
| 36 | `tasks`, `tiredness`, `travel` | 0 |
| 37 | `travel_generation_review`, `travel_review`, `travel_transfer` | 0 |
| 38 | `tree_clearance`, `village_customs`, `village_customs_favours` | 0 |
| 39 | `village_customs_readiness`, `village_customs_travel`, `village_generation` | 0 |
| 40 | `village_hauling`, `villages`, `wood_task_estimates` | 0 |
| 41 | `woodland_generation`, `work_visit_wear`, `world_journeys` | 0 |
| 42 | `world_map_routes`, `world_travel` | 0 |

The two files first added to the affected selection, save_client and save_game, passed together with exit 0 and are included again in the final 125-file gate. Their first wrapper ended with 143 despite passing Jest output; no termination reason was returned. It was rerun under the lock. Receipts: query-extra-gate-first.receipt.json and query-extra-gate2.receipt.json.

| Focus batch | Files (.test.js) | Exit |
| --- | --- | ---: |
| `index-red` | `local_queries` | 1 |
| `index-green` | `local_queries`, `event_index`, `social` | 1 |
| `index-green2` | `local_queries`, `event_index`, `social` | 0 |
| `news-red` | `scoped_news` | 1 |
| `news-green` | `scoped_news`, `local_queries`, `event_index` | 0 |
| `narrow-green` | `village_customs`, `household_routines`, `simulation` | 1 |
| `storage-red` | `person_storage` | 1 |
| `storage-green` | `person_storage`, `hex_storage`, `village_customs` | 1 |
| `storage-green2` | `person_storage`, `local_queries`, `scoped_news` | 0 |
| `local-green` | `local_world`, `scoped_news`, `person_storage` | 1 |
| `local-green2` | `local_world`, `social`, `event_index` | 0 |
| `recipes-green` | `hex_detail`, `local_world`, `one_world` | 0 |
| `knowledge-green` | `gossip_bubbles`, `chat_facts (nonexistent path)`, `local_world` | 1 |
| `integration-green` | `person_storage`, `local_world`, `villages` | 0 |
| `ready-green` | `scoped_news`, `person_storage`, `local_world` | 0 |
| `frozen-small` | `scoped_news`, `person_storage`, `local_world` | 1 |
| `final-small` | `local_world`, `person_storage`, `scoped_news` | 1 |
| `public-scope-green` | `scoped_news` | 0 |
| `departure-green` | `local_world`, `travel_transfer`, `world_travel` | 0 |
| `remote-news-green` | `gossip_bubbles`, `chat_tell`, `chat_answers` | 0 |
| `arrival-index-green` | `local_world`, `event_index`, `world_travel` | 1 |
| `arrival-index-green2` | `local_world` | 0 |
| `transients-green` | `local_world`, `hex_eviction`, `person_storage` | 0 |
| `checkpoint-red` | `person_storage` | 1 |
| `checkpoint-green` | `person_storage`, `local_world`, `scoped_news` | 0 |
| `checkpoint-green2` | `person_storage`, `local_world`, `save_game` | 0 |

Focus receipts and logs are indexed in query-focus-receipts.json. Expected red cases, new-fixture mistakes and a nonexistent test-path invocation remain recorded. Existing Jest worker-shutdown warnings are retained in passing logs. The only changed old test file, gossip_bubbles.test.js, retains its entire original content as an exact prefix. Four new small-input files were added. Assertion proof: query-assertion-check.json.

Runtime and changed-test ESLint exit 0. The final production build ran 65.008 seconds including any lock wait and exited 0, at `eca6699c2176618cd5663e60c0951ce07c0a574a`. It reported bundle-size recommendations. An earlier build passed before the ownership audit exposed the lost-home checkpoint bug. That build was superseded. Two production builds were therefore run, rather than the requested one. Both receipts are retained. Final logs: query-checkpoint-lint.log, query-checkpoint-test-lint.log, query-build-final.log and query-build-final.receipt.json. Earlier receipt: query-build.receipt.json. Dependencies were already installed; there was no setup or dependency change.

Three exploratory whole-world trials were stopped after their profiles showed unnecessary inherited-directory or unshared-scope scans. Their partial receipts are query-trial-aborted.json, query-scope-trial-aborted.json and query-retained-trial-aborted.json. They are not reported as completed measurements. A queued final2 wrapper was cancelled before its child started to move the run to the other lock; the completed run is query-final2-slot1-run.exit. No running test was deliberately killed.

## Remaining limits

The original literal scan pattern falls from 42 matches to 29. New-world ECS enumeration now contains local residents and assets, so these loops cannot walk a 1,900-person imported world. Remaining matches include renderer rebuilds, legacy history/reference paths, index initialisation, all-local planner updates, seasonal drift and local planner-claim/cleanup checks. The mother-family match reads one person's own bonds. Residual planner claim searches, festival assignment scans and global estate/controller reconciliation can still be narrowed further. This deliverable does not claim that every matched loop was rewritten.

The final simulation has only 93 living history people versus 658 before. That is the largest gameplay tradeoff and needs review before merging. The history still covers all 180 seasons and all communities. Save/reload still takes tens of seconds in the browser. Native manifest cloning and startup remain material phone risks. No physical phone peak or independent acceptance playthrough was measured, and main's 593 MB mobile result is not claimed for this branch.

All project edits, scripts, archives, logs and browser profiles are inside this worktree. There was no delegation, other-arm inspection, vault/ledger write, dependency installation, push, merge or deployment. Docs updated: docs/travel.md, docs/saving.md and docs/social.md. No shots/ file was added or changed in these commits.
