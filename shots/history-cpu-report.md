# Whole-world history at full population

All five numerical targets pass for seed 13. New-game CPU is 251.886 seconds. Heap after collection is 238.87 MB.
History ends with 570 living people, 1,483 births and 576 marriages. The affected gate and production build pass.

Runtime commit: `5a75b620b4c45ac03ee297f493492aaa1fe57540`. Starting commit: `76bdf9411e611834fb1fe36461ab25e6a43224c6`.
Worktree: `/home/cp/code/tinyking-world`. Branch: `feat/one-world`. No push.

## Controls and inherited population fix

Every complete measurement uses seed 13, all 180 seasons, 40 land communities and four detailed maps.
`scripts/local-population-measure.js` uses the previous job's Babel function timers and export boundary.
Timing covers `generateWorldGame` and `startGame` with the intro skipped. It excludes module loading, diagnostic exports and forced collection.
The final run also records a V8 sampling profile. Node runs include no renderer or IndexedDB.
CPU includes all process threads, so it can exceed elapsed time. Heap values use decimal MB.
These are observations on a shared host, not a statistical speed guarantee.
Baseline starting load was `[1.15, 1.63, 1.88]`. Final starting load was `[2.43, 3.08, 2.99]`.
Dependencies were already installed. There was no dependency change or setup cost.

The inherited population fix (`76bdf94`) restored opportunities to meet partners after locality removed worldwide social connections.
It added nearby courtship, age-sensitive partner preferences and village eligibility buckets.
Compact families can fund cottages with twelve timber, within the existing eight-house village limit.
Couples prefer a less crowded family home. Detailed maps survey sites for the actual grown village.
Historical proposals require that season's completed meeting. Consent, close-kin exclusions, ownership and separate news scopes remain in force.

| Seed-13 result | Before locality | Population fix | Now | Required |
| --- | ---: | ---: | ---: | --- |
| Retained people | 1,879 | 1,769 | 1,723 | Full history |
| Living people | 658 | 613 | 570 | 560–757 |
| Births | 1,639 | 1,529 | 1,483 | 1,393–1,885 |
| Marriages | 508 | 783 | 576 | 432–584 |
| Deaths | 1,221 | 1,156 | 1,153 | Shared death rules |
| CPU seconds | 680.891 | 801.968 | 251.886 | At most 309 |
| Elapsed seconds | 776.606 | 879.825 | 246.115 | Reported |
| Heap after GC, MB | 519.34 | 235.73 | 238.87 | Under 250 |

Before-locality evidence: [previous report](query-memory-report.md) and `regress-profile-query-before.json`.
Population-fix evidence: [profile](regress-profile-local-population-delivery.json) and [state](local-population-delivery-state.json).
Final evidence: [profile](regress-profile-history-cpu-family-window.json), [state](history-cpu-family-window-state.json) and [acceptance summary](history-cpu-evidence.json).
History counts exclude the player and sealed starting backstory added after history. The complete new-game export retains those records.

## Performance changes and equality

News choice and listener scoring both use `unheardNews`. It previously scanned every private story group for each listener.
The new reverse index groups each teller's stories by affected people, villages and hexes. Kin queries use the same subject buckets.
Learning adds new groups. Promotion removes covered groups. Death removes the person's query index.
Queries retain the original relevance filter, disclosure policy, newest-unheard grouping, ranking and tie rules.
Compact arrays hold audience buckets. Each story signature shares immutable routing metadata. Runtime indexes never enter saves.

Courtship now builds candidate pools once per village per seasonal boundary.
The pass shares ancestry results and computes each seeded order hash once.
Both endpoints still pass current single-status checks before selection. The query reads only this hex and adjacent village buckets.
Caller-controlled queries do not keep ancestry caches across edits. An existing test caught that mistake during development.
No source change was needed in `news.js` or `social_actions.js`. Their measured costs include their indexed callees and process collection work.

| Complete seed-13 run | CPU seconds | Heap after GC, MB | Living | Births | Marriages |
| --- | ---: | ---: | ---: | ---: | ---: |
| Starting population fix | 801.968 | 235.73 | 613 | 1,529 | 783 |
| First indexes, same history | 272.909 | 296.25 | 613 | 1,529 | 783 |
| Compact indexes, same history | 290.141 | 262.28 | 613 | 1,529 | 783 |
| Rejected three-meeting rule | 265.200 | 249.60 | 536 | 1,433 | 723 |
| Final family-seeking rule | 251.886 | 238.87 | 570 | 1,483 | 576 |

The lossless compact checkpoint uses 63.8% less CPU than the supplied population-fix run, with exactly the same history.
The first index representation exceeded the heap limit. Compact buckets removed 33.97 MB of that overhead.
The final behaviour change also changes event and relationship counts. Its 68.6% overall CPU reduction is not attributed solely to indexing.

`shots/regress-equality.cjs` compares complete V8 exports with `util.isDeepStrictEqual`.
Both index checkpoints compare equal to `local-population-delivery`, for complete history and complete new-game state. All four commands exit 0.
No state field is omitted or normalised. History has 1,769 people and 45,628 events on both sides.
New-game state has 1,774 directory people and 45,635 events on both sides.
Proofs: [first history](history-cpu-indexed-history-equality.json), [first game](history-cpu-indexed-game-equality.json),
[compact history](history-cpu-compact-history-equality.json), [compact game](history-cpu-compact-game-equality.json).
The final extra seeker-status check repeats the caller's existing precondition. A small regression also covers direct callers.
The later family-seeking rule deliberately changes history. Its result is reported separately.

## Marriage cause and behaviour change

The population fix increased first marriages and remarriages. It did not repeat weddings for the same pair or marry someone with a living spouse.
Automatic family seeking had no upper age boundary, although births already stopped after age 55.
Older adults therefore kept competing for eligible younger partners and repeatedly forming new households after bereavement.
The audit finds 175 remarriages with at least one partner over displayed age 55.
The displayed-age audit below counts age 56 and above.

| Marriage audit | Before locality | Population fix | Now |
| --- | ---: | ---: | ---: |
| First marriage for both people | 403 | 559 | 560 |
| At least one previously married person | 105 | 224 | 16 |
| At least one partner over displayed age 55 | 135 | 208 | 0 |
| Remarriage with a partner over displayed age 55 | 94 | 175 | 0 |
| Both partners over displayed age 55 | 30 | 54 | 0 |
| Repeated wedding for the same pair | 0 | 0 | 0 |
| Previous partner still alive | 0 | 0 | 0 |

`scripts/history-marriage-audit.js` reconstructs ages and prior weddings from the saved history, without generating a new world.
Raw audits: `history-marriage-audit-query-before.json`, `history-marriage-audit-local-population-delivery.json`,
and `history-marriage-audit-history-cpu-family-window.json`.

The new rule uses the existing parenting window, ages 18 through 55, for automatic family seeking.
It applies to local seasonal selection, nearby village buckets and live automatic eligibility.
Younger widowed adults can still remarry. Older adults still chat, retain relationships and can marry through deliberate courtship.
This is an intentional gameplay policy. It is not a claim that older people cannot form relationships.
Birth probability, birth spacing, ageing, death, population scale, housing limits and the two-season courtship wait do not change.
The shared `courtTogether` entry point now also requires recent contact. Historical contact must be current that day.
Existing callers already required this. The direct entry point now enforces the same rule.

The small-world age-window regression failed before implementation. Both age-56 endpoint cases failed as expected.
It now passes with tests for the inclusive age-55 boundary, younger widowhood, older deliberate marriage and current contact.
An earlier trial required three actual courtship meetings. It reduced living population to 536 and still produced 723 weddings.
That trial was rejected and removed. The final source has no meeting counter or extra waiting period.
The original live spaced-visit wedding assertions remain unchanged.

| Wedding origin | Population fix | Now |
| --- | ---: | ---: |
| Same village | 383 | 293 |
| Other village in same hex | 375 | 260 |
| Adjacent hex | 25 | 23 |
| Distant hex | 0 | 0 |

## Stage and function timers

The stage table gives elapsed intervals between progress labels. The JSON profiles retain every survey and history-year timestamp.
The function table gives process CPU time. Inclusive values overlap. Timer self time excludes only other instrumented functions.
Uninstrumented callees remain part of self time. Do not add inclusive rows.

| Elapsed stage, seconds | Population fix | Compact lossless | Now |
| --- | ---: | ---: | ---: |
| Survey and founding setup | 36.804 | 7.394 | 11.653 |
| All 180 history seasons | 816.120 | 254.899 | 221.729 |
| Starting detailed map | 14.568 | 5.688 | 5.252 |
| Three prepared neighbouring maps and finalisation | 12.333 | 8.953 | 7.481 |

| Function CPU, seconds | Before calls | Before self | Before inclusive | Now calls | Now self | Now inclusive |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `news.js:chooseNews` | 181,506 | 246.224 | 246.224 | 174,162 | 75.739 | 75.739 |
| `news.js:listenerNewsScore` | 247,643 | 151.342 | 151.342 | 235,950 | 42.337 | 42.337 |
| `nearby_courtship.js:runNearbyCourtships` | 180 | 121.867 | 260.188 | 180 | 27.685 | 68.117 |
| `social_actions.js:runSocialActions` | 440,488 | 70.376 | 70.376 | 431,704 | 24.574 | 24.574 |
| `travel.js:advanceWorldClock` | 181 | 29.759 | 740.144 | 181 | 14.915 | 226.378 |
| `news.js:exchangeNews` | 90,753 | 35.370 | 281.594 | 87,081 | 13.379 | 89.118 |
| `social.js:advanceSeasonRules` | 7,649 | 37.894 | 436.759 | 7,828 | 12.244 | 137.827 |
| `travel.js:publish` | 37,891 | 37.753 | 37.753 | 34,316 | 11.886 | 11.886 |
| `world_history.js:generateWorldHistory` | 1 | 25.771 | 765.913 | 1 | 8.356 | 234.733 |
| `geography.js:gradeRoads` | 61 | 10.431 | 10.431 | 56 | 3.918 | 3.918 |
| `geography.js:buildGeography` | 4 | 5.814 | 16.245 | 4 | 3.426 | 7.344 |
| `map.js:surveyTrees` | 7 | 2.445 | 2.445 | 7 | 2.131 | 2.131 |
| `travel.js:reconcileEstates` | 7,744 | 3.834 | 3.843 | 7,749 | 1.574 | 1.593 |
| `villages.js:generateVillageLife` | 4 | 3.177 | 3.177 | 4 | 1.500 | 1.500 |
| `map.js:generateMap` | 4 | 2.222 | 31.055 | 4 | 1.246 | 15.189 |
| `map.js:generateSettlements` | 4 | 2.458 | 2.458 | 4 | 0.976 | 0.976 |
| `social_actions.js:runSeasonSocialActions` | 7,649 | 2.822 | 25.342 | 7,828 | 0.966 | 9.325 |
| `world_history.js:installStoredHistory` | 4 | 2.477 | 2.477 | 4 | 0.964 | 0.964 |
| `travel.js:references` | 15,532 | 1.896 | 1.896 | 15,877 | 0.849 | 0.849 |
| `map.js:generateTrees` | 12 | 0.644 | 2.110 | 12 | 0.404 | 2.029 |
| `map.js:generateEconomicValue` | 2 | 0.970 | 0.970 | 2 | 0.358 | 0.358 |
| `nearby_courtship.js:createCourtshipIndex` | 180 | 1.033 | 1.033 | 180 | 0.255 | 0.255 |
| `ecology.js:initializeEcology` | 4 | 0.105 | 0.105 | 4 | 0.113 | 0.113 |
| `map.js:generateTerrain` | 4 | 0.149 | 0.149 | 4 | 0.109 | 0.109 |
| `ecology.js:generateForage` | 12 | 0.162 | 0.162 | 12 | 0.043 | 0.043 |
| `world_history.js:buildHistoryMap` | 4 | 0.003 | 31.058 | 4 | 0.003 | 15.192 |

News choice averages 0.435 ms per call, versus 1.357 ms before. Listener scoring averages 0.179 ms, versus 0.611 ms before.
Nearby courtship self time averages 0.154 seconds per season, versus 0.677 seconds before.
CPU is 57.114 seconds below the limit. No additional performance work is needed for this ticket.
V8 samples are retained in `history-cpu-compact.cpuprofile` and `history-cpu-family-window.cpuprofile`.
A focused saved-state news probe also identified scope intersection and knowledge checks as remaining query costs.
Its output is `history-news-probe.log` and `history-news-probe.cpuprofile`. It did not change state or replace a full measurement.

## Memory and state integrity

Final raw heap is 524.22 MB. Collected heap is 238.87 MB.
Collected RSS is 1,058.80 MB. Peak Node RSS is 1,070.25 MB.
RSS and peak memory remain much larger than the collected heap target. These are Node observations, not physical-phone measurements.
Full game encoding falls from 56.13 MB to 50.59 MB. The history construction workspace remains absent.
The final state audit finds zero foreign owned people, duplicate residents, canonical alias mismatches, per-person event lists, redraw queues or prepared person records.
Every map shares the directory knowledge object. Those checks pass in `history-cpu-family-window-state.json`.
No distant wedding occurs. Three actual travellers end up beyond one hex from their birth origin through travel. That count was zero in the supplied history.
The wedding and travel rules still use adjacent steps. This job does not impose a lifetime distance limit.

## Tests, build and receipts

This is a JavaScript/Jest repository. It has no TypeScript area or typecheck command.
`scripts/history-cpu-gate.cjs` selects the transitive import graph from base `76bdf94` and uses an explicit file list.
It runs Jest under the shared lock with `--maxWorkers=2 --workerIdleMemoryLimit=1GB`.
The final affected gate passes 127 files and 1,124 tests, with zero failures. No whole suite ran.
Command, source commit and file list: [gate receipt](history-cpu-affected-receipt.json). Raw Jest output: `history-cpu-affected-tests.json`.
The population fix's saved affected gate passes 132 files and 1,151 tests.
Its receipt is `local-population-final-gate.receipt.json` and raw output is `local-population-final-jest.json`.
No production build receipt from that job was found. This job builds the complete resulting candidate.

The final production build exits 0 under `/tmp/27agents-gate-2.lock`. The app compiles in 21.262 seconds and the save worker in 0.632 seconds.
The build reports three bundle-size recommendations. This job ran one production build.
Receipts: [build](history-cpu-build-receipt.json), `history-cpu-build.log`.
ESLint passes on all changed source, scripts and tests. Two harmless unused-directive warnings arise from CLI test globals.
The first combined lint command omitted the test `require` global and failed. The corrected command exits 0.
Logs: `history-cpu-final-lint.log` and `history-cpu-final-lint2.log`.

| Focus gate | Files passed / total | Tests passed / total | Result |
| --- | ---: | ---: | --- |
| `history-cpu-news-tests` | 2 / 2 | 37 / 37 | Pass |
| `history-cpu-indexed-tests` | 3 / 4 | 63 / 64 | Fail, retained |
| `history-cpu-indexed-tests2` | 4 / 4 | 64 / 64 | Pass |
| `history-cpu-compact-tests` | 4 / 4 | 64 / 64 | Pass |
| `history-cpu-contact-red` | 0 / 1 | 0 / 4 | Fail, retained |
| `history-cpu-contact-green1` | 2 / 4 | 62 / 67 | Fail, retained |
| `history-cpu-contact-green2` | 3 / 4 | 66 / 67 | Fail, retained |
| `history-cpu-contact-green3` | 4 / 4 | 67 / 67 | Pass |
| `history-cpu-family-window-red` | 0 / 1 | 3 / 6 | Fail, retained |
| `history-cpu-family-window-green` | 3 / 4 | 68 / 71 | Fail, retained |
| `history-cpu-family-window-green2` | 4 / 4 | 71 / 71 | Pass |
| `history-cpu-family-window-green3` | 4 / 4 | 71 / 71 | Pass |

The first indexed failure caught stale ancestry after caller edits. The cache now exists only inside the owned pass.
The contact trial initially failed older live and housing fixtures. Its final focused pass was green, but its full population result rejected the rule.
The age-window red run also retained a contact-case failure from the rejected meeting-counter trial.
Removing that counter restored the intended two-season proposal after fresh contact.
The final contact guard requires housing fixtures to supply the current conversation they previously implied. All existing assertions remain.
`test/nearby_courtship.test.js` adds three checks: no unrelated private-story scan, current seeker eligibility and the automatic age window.
`test/courtship_contact.test.js` adds six cases for the changed rule. `test/social_mobility.test.js` has no final diff.
No timeout or existing assertion was weakened. No test generates the production world.
No UI source changed, so there was no visual preview or duplicate browser acceptance pass. This report does not claim phone or independent play acceptance.

### Affected files and passing case counts

The table covers the union of the inherited population gate and this job's affected gate. A dash means that gate did not select the file.
Every numbered count is passing evidence. The final gate selects only files reachable from this job's runtime and test changes.

| Test file | Population fix passed | This job passed |
| --- | ---: | ---: |
| `test/acceptance_selection.test.js` | 17 | 17 |
| `test/annual_moisture.test.js` | 5 | — |
| `test/arrival.test.js` | 6 | 6 |
| `test/arrival_tasks.test.js` | 31 | 31 |
| `test/autosave.test.js` | 12 | 12 |
| `test/biography.test.js` | 5 | 5 |
| `test/biome_field.test.js` | 5 | — |
| `test/campfire_visits.test.js` | 14 | 14 |
| `test/chat.test.js` | 37 | 37 |
| `test/chat_acceptance.test.js` | 8 | 8 |
| `test/chat_answers.test.js` | 7 | 7 |
| `test/chat_guidance.test.js` | 6 | 6 |
| `test/chat_row_rules.test.js` | 15 | 15 |
| `test/chat_tell.test.js` | 21 | 21 |
| `test/chat_travel.test.js` | 1 | 1 |
| `test/chat_visits.test.js` | 8 | 8 |
| `test/core_loop.test.js` | 14 | 14 |
| `test/courtship_contact.test.js` | — | 6 |
| `test/designation_selection.test.js` | 5 | 5 |
| `test/ecology.test.js` | 12 | 12 |
| `test/ecology_habitat.test.js` | 1 | 1 |
| `test/entities.test.js` | 1 | 1 |
| `test/event_index.test.js` | 6 | 6 |
| `test/event_knowledge.test.js` | 10 | 10 |
| `test/family_history_integration.test.js` | 3 | 3 |
| `test/favours.test.js` | 49 | 49 |
| `test/field_designation.test.js` | 4 | 4 |
| `test/fireside.test.js` | 9 | 9 |
| `test/first_run.test.js` | 3 | 3 |
| `test/food_economy.test.js` | 16 | 16 |
| `test/food_routes.test.js` | 2 | 2 |
| `test/food_variety.test.js` | 10 | 10 |
| `test/forage_designation.test.js` | 20 | 20 |
| `test/friend_help.test.js` | 15 | 15 |
| `test/gathering.test.js` | 5 | 5 |
| `test/geography_foundations.test.js` | 7 | 7 |
| `test/geography_placement.test.js` | 6 | 6 |
| `test/geography_refinement.test.js` | 9 | 9 |
| `test/geography_surface.test.js` | 3 | — |
| `test/gift_choices.test.js` | 1 | 1 |
| `test/gossip.test.js` | 17 | 17 |
| `test/gossip_bubbles.test.js` | 10 | 10 |
| `test/happy_paths.test.js` | 5 | 5 |
| `test/height.test.js` | 10 | 10 |
| `test/hex_detail.test.js` | 4 | 4 |
| `test/hex_eviction.test.js` | 10 | 10 |
| `test/hex_storage.test.js` | 6 | 6 |
| `test/history.test.js` | 5 | 5 |
| `test/history_items.test.js` | 6 | 6 |
| `test/history_reference_index.test.js` | 2 | 2 |
| `test/history_scope.test.js` | 3 | 3 |
| `test/hop_checkpoint.test.js` | 2 | 2 |
| `test/household_routines.test.js` | 9 | 9 |
| `test/htn.test.js` | 6 | 6 |
| `test/info_ownership.test.js` | 5 | 5 |
| `test/integration_food.test.js` | 2 | 2 |
| `test/intro.test.js` | 4 | 4 |
| `test/journey_memory.test.js` | 2 | 2 |
| `test/leaks_regressions.test.js` | 3 | 3 |
| `test/local_queries.test.js` | 2 | 2 |
| `test/local_world.test.js` | 5 | 5 |
| `test/manager.test.js` | 13 | 13 |
| `test/map.test.js` | 15 | 15 |
| `test/mother_family.test.js` | 9 | 9 |
| `test/nearby_courtship.test.js` | 30 | 33 |
| `test/one_world.test.js` | 7 | 7 |
| `test/overworld.test.js` | 12 | — |
| `test/overworld_axes.test.js` | 8 | — |
| `test/pathfinding.test.js` | 9 | 9 |
| `test/people.test.js` | 7 | 7 |
| `test/people_feedback.test.js` | 7 | 7 |
| `test/people_goals.test.js` | 5 | 5 |
| `test/people_interactions.test.js` | 4 | 4 |
| `test/people_orders.test.js` | 19 | 19 |
| `test/people_panel.test.js` | 1 | 1 |
| `test/person_activity.test.js` | 1 | 1 |
| `test/person_storage.test.js` | 4 | 4 |
| `test/play_session_feedback.test.js` | 13 | 13 |
| `test/player_day.test.js` | 10 | 10 |
| `test/player_farming.test.js` | 6 | 6 |
| `test/player_household.test.js` | 2 | 2 |
| `test/possession_disclosure.test.js` | 3 | 3 |
| `test/realm_map.test.js` | 1 | 1 |
| `test/reference_views.test.js` | 1 | 1 |
| `test/relationship_index.test.js` | 4 | 4 |
| `test/relationships.test.js` | 12 | 12 |
| `test/remote_family_review.test.js` | 3 | 3 |
| `test/replay2_findings.test.js` | 14 | 14 |
| `test/replay2_warning_care.test.js` | 2 | 2 |
| `test/replay_findings.test.js` | 11 | 11 |
| `test/road_wear.test.js` | 3 | — |
| `test/roads_tracks.test.js` | 2 | 2 |
| `test/save_client.test.js` | 4 | 4 |
| `test/save_game.test.js` | 4 | 4 |
| `test/scoped_news.test.js` | 6 | 6 |
| `test/season_polish.test.js` | 8 | 8 |
| `test/seasons.test.js` | 18 | 18 |
| `test/settlement_access.test.js` | 9 | 9 |
| `test/settlement_details.test.js` | 2 | 2 |
| `test/settlement_growth.test.js` | 15 | 15 |
| `test/settlement_history.test.js` | 3 | 3 |
| `test/settlement_woodland.test.js` | 2 | 2 |
| `test/shelter_placement.test.js` | 2 | 2 |
| `test/simulation.test.js` | 6 | 6 |
| `test/social.test.js` | 13 | 13 |
| `test/social_events.test.js` | 29 | 29 |
| `test/social_gifts.test.js` | 13 | 13 |
| `test/social_mobility.test.js` | 19 | 19 |
| `test/succession.test.js` | 18 | 18 |
| `test/succession_controls.test.js` | 9 | 9 |
| `test/succession_customs.test.js` | 3 | 3 |
| `test/succession_knowledge.test.js` | 2 | 2 |
| `test/survival.test.js` | 22 | 22 |
| `test/tasks.test.js` | 11 | 11 |
| `test/tiredness.test.js` | 14 | 14 |
| `test/travel.test.js` | 7 | 7 |
| `test/travel_generation_review.test.js` | 4 | 4 |
| `test/travel_review.test.js` | 8 | 8 |
| `test/travel_transfer.test.js` | 10 | 10 |
| `test/tree_clearance.test.js` | 8 | 8 |
| `test/village_customs.test.js` | 23 | 23 |
| `test/village_customs_favours.test.js` | 2 | 2 |
| `test/village_customs_readiness.test.js` | 13 | 13 |
| `test/village_customs_travel.test.js` | 2 | 2 |
| `test/village_generation.test.js` | 19 | 19 |
| `test/village_hauling.test.js` | 1 | 1 |
| `test/villages.test.js` | 16 | 16 |
| `test/wood_task_estimates.test.js` | 1 | 1 |
| `test/woodland_generation.test.js` | 1 | 1 |
| `test/work_visit_wear.test.js` | 7 | 7 |
| `test/world_journeys.test.js` | 19 | 19 |
| `test/world_map_routes.test.js` | 1 | 1 |
| `test/world_travel.test.js` | 12 | 12 |

## Commits and limits

`575d731` adds the lossless indexes. `856f3e3` compacts their storage.
`bae3f34` records the tested three-meeting trial. `5a75b62` removes that trial and adds the final family-seeking rule.
The final documentation/evidence commit follows those runtime commits.
All measured runtime hashes match the final source. All changes and evidence stay in this worktree.
There was no delegation, other branch inspection, stash, vault/ledger write, push, merge or deployment.
Only seed 13 was measured. Living population is ten people above the lower bound. Marriages are eight below the upper bound.
The age window is a deliberate policy choice and needs normal gameplay review. The numerical result does not establish demographic stability for every seed.
All requested numerical targets, lossless-history proof, small-world behaviour regressions, affected checks, build and report are complete.
