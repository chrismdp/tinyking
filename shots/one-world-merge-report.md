# One-world merge

Worktree: `/home/cp/code/tinyking-world`. Branch: `feat/one-world`. Starting commit: `83a79ed`.
Merged parent: `68038197da21cf500ef061828ce5df99155f3ed2` from `origin/main`.
Merge commit: `0cd9201`. Carried-account fix: `0961f33`. Bed-placement fix: `34ac065`.
Runtime candidate: `34ac0655c1aaefa5c1e8ef3d3120e401af5ed941`. All requested acceptance evidence passes.
The final evidence commit adds this report and receipts without changing runtime source.

## Changes

The ten conflicts were resolved by preserving the local ECS views and scoped knowledge, then integrating main’s discovery engine.
`population_index.js` owns the only spatial index. `people_space.js` exports compatibility names for that same index.
Hearing queries use 300 units. Witness queries use 85 units plus main’s awake, resident, interior and wall rules.
Births, walking, moves and transfers update the same index. Initial indexing enumerates local residents once.
Witness and hearing queries then visit only nearby cells. They never enumerate the world directory.

Explicit learning and scope promotion use `applyLearning` in `events.js`.
A source event becomes known before the callback runs, so recursive discovery news cannot learn it twice.
Promotion calls that callback for each newly informed living resident, including affected spouses and woodland owners.
`found_out` records discovery once and applies main’s occurrence effects. Its own learners receive the catalogue’s kin/friend effects once.
The callbacks process only the newly covered local village or hex. No world-population expansion or per-person event list is stored.
This retains exact directional effects without an aggregate approximation. Subsequent hearing sees the scope and exits before effects.
Promotion preserves discovery evidence and removes covered NPC source/reaction rows, as on the branch.

`event_disclosure.js` and `canDiscloseEvent` retain main’s teller/listener rules, including loyalty, spite and seeded rare confidences.
The news selector admits routed stories before applying that policy, so its trust shortcut cannot hide loyalty/spite routes.
Carried activity accounts resolve their source through the world event catalogue. Captured affected identities remain relevant after moves or marriage changes.
Secret activities use local planners, physical houses, terrain and the shared spatial query.
Summary sightings use the local household/village indexes and retain the original seeded neighbour order.

The live probe exposed old summary cottage beds without detailed positions.
`installStoredHistory` previously copied those beds and then created replacements, leaving invalid sleeping candidates.
The fix places the original beds in the surveyed cottage and keeps their identities and room membership.
A one-house regression failed before the fix and passed after it. No demographic rule changed.

## Parent reports and controls

Read `CLAUDE.md`, `docs/social.md`, `docs/travel.md`, `docs/verification.md`, `shots/query-memory-report.md` and `shots/history-cpu-report.md`.
Both requested report reads failed: `git show origin/main:shots/affair-trysts-report.md` and `git show 6803819:shots/affair-trysts-report.md`.
Both refs lack that path. Main’s comparison figures below therefore come from the brief.

Dependencies were already installed. No dependency setup or dependency file changed.
No delegation, other-arm inspection, stash, vault/ledger write, push or deployment occurred.
All created files and browser profiles remain in this worktree. Heavy checks use the supplied shared locks.
This JavaScript repository has no TypeScript area or typecheck command. Jest checks use the affected import graph and explicit file lists.

## Seed-13 generation

Both complete runs pass every numerical target. The final run includes the bed fix.
CPU and elapsed intervals include complete generation and `startGame`, with the intro skipped.
They exclude Babel module loading, diagnostic V8 exports and forced collection, matching the supplied measurement script.
The run covers all 180 seasons and all land communities. Population counts use history before the arriving player/backstory.

| Measure | Branch report before merge | First merged run | Final run | Required |
| --- | ---: | ---: | ---: | --- |
| CPU seconds | 251.886 | 236.808 | 235.240 | ≤309, pass |
| Elapsed seconds | 246.115 | 241.466 | 234.782 | Report |
| Heap after GC, MB | 238.87 | 238.20 | 238.75 | <250, pass |
| Living people | 570 | 580 | 580 | 560–757, pass |
| Births | 1,483 | 1,493 | 1,493 | 1,393–1,885, pass |
| Marriages | 576 | 580 | 580 | 432–584, pass |
| Retained history people | 1,723 | 1,733 | 1,733 | Full history |
| Per-person event lists | 0 | 0 | 0 | Scoped knowledge |

The branch column comes from `history-cpu-report.md`. Both new runs use this worktree and seed 13.
Final raw heap is 306.68 MB. Final collected RSS is 1086.47 MB.
Load averages change from [2.35, 2.72, 2.54] to [2.55, 3.04, 2.76] during the final run.
These shared-host measurements are observations, not quiet-host or physical-phone guarantees.

The bed fix preserves the complete raw history according to `util.isDeepStrictEqual`, with no omitted or normalised field.
Both exports contain 1,733 people and 40,999 events. This equality only compares the two merged runs.
The affair/discovery merge itself deliberately changes history from the branch parent.
No birth, ageing, marriage, housing-limit or courtship parameter was tuned to reach the targets.

Receipts: [final profile](regress-profile-one-world-merge-final.json), [final counts](merge-final-history-counts.json),
[run](merge-final-population-run.receipt.json), [bed-fix history equality](merge-bed-fix-history-equality.json).
The first run remains in `regress-profile-one-world-merge.json` and `merge-population-run.receipt.json`.

## Affairs and discovery audiences

The adapted `scripts/affairs.js` reads the final measured game export, then runs the actual planner for 28 days.
It queries both explicit knowers and village/hex scopes through `knowsEvent`, across the complete world catalogue.
It does not regenerate a different world or manufacture an active affair. Main’s figures come from the supplied brief because its report is absent.

| Measure | Main figures in brief | Final history | After 28 live days |
| --- | ---: | ---: | ---: |
| Affairs | 11 | 24 | 24 |
| Wholly secret | 7 | 16 | 16 |
| Known outside lovers | 4 | 8 | 8 |
| Discovered affairs | 2 | 1 | 1 |
| `found_out` events | Not supplied | 1 | 1 |
| Historical sightings | Not supplied | 8 | 8 |
| Live affair meetings | Not supplied | 0 | 0 |

Two thirds of affairs remain wholly secret. Discovery occurs naturally during history.
The discovery route is witness. The final arrival has zero active affairs, so the live probe records no new meeting or discovery.
The unchanged main tests exercise live meetings, later witnesses, loyalty/spite disclosure and rare confidences.
The new small-world cases prove discovery through village and public-hex promotion.
They also assert the individual kin/friend effects through village promotion.

| `found_out` account | Betrayed / unfaithful / lover | Source affair | Audience after history | Audience after 28 days |
| --- | --- | --- | ---: | ---: |
| `w1_3-event-1905` | `w1_3-social-50` / `w1_3-social-83` / `w1_3-social-85` | `w1_3-event-1696` | 66 | 66 |

The audience contains 19 living people and 47 retained dead identities, across four current villages in hexes `1,3` and `1,4`.
This is the current scoped knowledge query, not 66 observed spoken transmissions.
The account is generally known in `w1_3-village-1`. Its awareness retains six explicit exceptions outside that village and no public hex scope.
Travel memories and individual disclosures retain knowledge elsewhere. Promotion itself never broadcasts into another hex.
The full audience IDs, locations, explicit awareness and every affair’s outsider counts are in [affair evidence](merge-final-affairs.json).
Main’s `found_out` audience numbers were not supplied and its report path is missing, so no comparison audience is invented.

The live probe completes 6,741 steps, covering 28.029 game days from the measured new game.
Mean step cost is 8.015 ms, median 5.418 ms and p95 19.312 ms on this shared host.
Receipts: [probe](merge-final-affairs-run.receipt.json), `merge-final-affairs-run.log`.
The first live failure at day 1.292 remains in `merge-affairs-run.log` and `merge-affairs-failure.json`.
The single-cottage regression and final full probe demonstrate the repair.

## Tests retained and changed

The final affected gate at `34ac065` passes 130 files and 1,157 tests, with zero failures.
The selector follows imports from `83a79ed`, then runs Jest with an explicit file list under `/tmp/27agents-gate.lock`.
No whole suite ran. No test generates a production world. Relevant source and test ESLint checks pass.

Main’s `test/secret_activities.test.js` remains byte-for-byte unchanged: all 24 cases pass.
`test/social_events.test.js` retains all main cases and this branch’s added family-cache case: 29 pass.
Main itself changed its old disclosure test to call `tellNews` directly because automatic confidences now have a rare seasonal chance.
Main also changes the friend-exclusion fixture to use the betrayed spouse as teller, because lovers can now confide in their own Intimate friends.
These changes arrived exactly as on main and were not rewritten here.
The only additional edit to an existing test is in `test/scoped_news.test.js`.
Its old reason-only assertion counted the former direct discovery quarrel. The new representation records both `found_out` and its consequential quarrel with that reason.
The test now requires exactly one quarrel of that reason and exactly one `found_out`. All original behaviour remains required.
No timeout or meaningful assertion was weakened.

`test/scoped_discovery.test.js` adds eight small-world cases: village promotion for affair/poaching discovery, friend/kin promotion effects, public hex discovery, carried source resolution, and moved affected identities.
`test/history_beds.test.js` adds one single-cottage installation case for the live failure.

| Check | Files passed | Tests passed | Result |
| --- | ---: | ---: | --- |
| Initial promotion regressions | 0/1 | 0/5 | Expected failure before implementation |
| Combined discovery check | 3/5 | 63/66 | Exposed legacy route shortcut and old record assertion |
| Corrected discovery check | 5/5 | 66/66 | Pass |
| Carried-source regression | 0/1 | 6/7 | Expected failure before fix |
| Carried-source and disclosure check | 7/7 | 107/107 | Pass |
| Cottage-bed regression | 0/1 | 0/1 | Expected failure before fix |
| Cottage installation and planner check | 5/5 | 56/56 | Pass |
| Final affected gate | 130/130 | 1,157/1,157 | Pass |

The first lint invocation failed on quote style in the new gate script. The script was corrected.
A test-lint invocation then redeclared globals already present in main’s files. Separate commands for files with and without inline globals pass.
These failed logs remain beside the passing receipts.

## Affected files and passing case counts

| Test file | Passed/total |
| --- | ---: |
| `test/acceptance_selection.test.js` | 17/17 |
| `test/arrival_tasks.test.js` | 31/31 |
| `test/arrival.test.js` | 6/6 |
| `test/autosave.test.js` | 12/12 |
| `test/biography.test.js` | 5/5 |
| `test/campfire_visits.test.js` | 14/14 |
| `test/chat_acceptance.test.js` | 8/8 |
| `test/chat_answers.test.js` | 7/7 |
| `test/chat_guidance.test.js` | 6/6 |
| `test/chat_row_rules.test.js` | 15/15 |
| `test/chat_tell.test.js` | 21/21 |
| `test/chat_travel.test.js` | 1/1 |
| `test/chat_visits.test.js` | 8/8 |
| `test/chat.test.js` | 37/37 |
| `test/core_loop.test.js` | 14/14 |
| `test/courtship_contact.test.js` | 6/6 |
| `test/designation_selection.test.js` | 5/5 |
| `test/ecology_habitat.test.js` | 1/1 |
| `test/ecology.test.js` | 12/12 |
| `test/entities.test.js` | 1/1 |
| `test/event_index.test.js` | 6/6 |
| `test/event_knowledge.test.js` | 10/10 |
| `test/family_history_integration.test.js` | 3/3 |
| `test/favours.test.js` | 49/49 |
| `test/field_designation.test.js` | 4/4 |
| `test/fireside.test.js` | 9/9 |
| `test/first_run.test.js` | 3/3 |
| `test/food_economy.test.js` | 16/16 |
| `test/food_routes.test.js` | 2/2 |
| `test/food_variety.test.js` | 10/10 |
| `test/forage_designation.test.js` | 20/20 |
| `test/friend_help.test.js` | 15/15 |
| `test/gathering.test.js` | 5/5 |
| `test/geography_foundations.test.js` | 7/7 |
| `test/geography_placement.test.js` | 6/6 |
| `test/geography_refinement.test.js` | 9/9 |
| `test/gift_choices.test.js` | 1/1 |
| `test/gossip_bubbles.test.js` | 10/10 |
| `test/gossip.test.js` | 17/17 |
| `test/happy_paths.test.js` | 5/5 |
| `test/height.test.js` | 10/10 |
| `test/hex_detail.test.js` | 4/4 |
| `test/hex_eviction.test.js` | 10/10 |
| `test/hex_storage.test.js` | 6/6 |
| `test/history_beds.test.js` | 1/1 |
| `test/history_items.test.js` | 6/6 |
| `test/history_reference_index.test.js` | 2/2 |
| `test/history_scope.test.js` | 3/3 |
| `test/history.test.js` | 5/5 |
| `test/hop_checkpoint.test.js` | 2/2 |
| `test/household_routines.test.js` | 9/9 |
| `test/htn.test.js` | 6/6 |
| `test/info_ownership.test.js` | 5/5 |
| `test/integration_food.test.js` | 2/2 |
| `test/intro.test.js` | 4/4 |
| `test/journey_memory.test.js` | 2/2 |
| `test/leaks_regressions.test.js` | 3/3 |
| `test/local_queries.test.js` | 2/2 |
| `test/local_world.test.js` | 5/5 |
| `test/manager.test.js` | 13/13 |
| `test/map.test.js` | 15/15 |
| `test/mother_family.test.js` | 9/9 |
| `test/nearby_courtship.test.js` | 33/33 |
| `test/one_world.test.js` | 7/7 |
| `test/pathfinding.test.js` | 9/9 |
| `test/people_feedback.test.js` | 7/7 |
| `test/people_goals.test.js` | 5/5 |
| `test/people_interactions.test.js` | 4/4 |
| `test/people_orders.test.js` | 19/19 |
| `test/people_panel.test.js` | 1/1 |
| `test/people.test.js` | 7/7 |
| `test/person_activity.test.js` | 1/1 |
| `test/person_storage.test.js` | 4/4 |
| `test/play_session_feedback.test.js` | 13/13 |
| `test/player_day.test.js` | 10/10 |
| `test/player_farming.test.js` | 6/6 |
| `test/player_household.test.js` | 2/2 |
| `test/possession_disclosure.test.js` | 3/3 |
| `test/realm_map.test.js` | 1/1 |
| `test/reference_views.test.js` | 1/1 |
| `test/relationship_index.test.js` | 4/4 |
| `test/relationships.test.js` | 12/12 |
| `test/remote_family_review.test.js` | 3/3 |
| `test/replay_findings.test.js` | 11/11 |
| `test/replay2_findings.test.js` | 14/14 |
| `test/replay2_warning_care.test.js` | 2/2 |
| `test/roads_tracks.test.js` | 2/2 |
| `test/save_client.test.js` | 4/4 |
| `test/save_game.test.js` | 4/4 |
| `test/scoped_discovery.test.js` | 8/8 |
| `test/scoped_news.test.js` | 6/6 |
| `test/season_polish.test.js` | 8/8 |
| `test/seasons.test.js` | 18/18 |
| `test/secret_activities.test.js` | 24/24 |
| `test/settlement_access.test.js` | 9/9 |
| `test/settlement_details.test.js` | 2/2 |
| `test/settlement_growth.test.js` | 15/15 |
| `test/settlement_history.test.js` | 3/3 |
| `test/settlement_woodland.test.js` | 2/2 |
| `test/shelter_placement.test.js` | 2/2 |
| `test/simulation.test.js` | 6/6 |
| `test/social_events.test.js` | 29/29 |
| `test/social_gifts.test.js` | 13/13 |
| `test/social_mobility.test.js` | 19/19 |
| `test/social.test.js` | 13/13 |
| `test/succession_controls.test.js` | 9/9 |
| `test/succession_customs.test.js` | 3/3 |
| `test/succession_knowledge.test.js` | 2/2 |
| `test/succession.test.js` | 18/18 |
| `test/survival.test.js` | 22/22 |
| `test/tasks.test.js` | 11/11 |
| `test/tiredness.test.js` | 14/14 |
| `test/travel_generation_review.test.js` | 4/4 |
| `test/travel_review.test.js` | 8/8 |
| `test/travel_transfer.test.js` | 10/10 |
| `test/travel.test.js` | 7/7 |
| `test/tree_clearance.test.js` | 8/8 |
| `test/village_customs_favours.test.js` | 2/2 |
| `test/village_customs_readiness.test.js` | 13/13 |
| `test/village_customs_travel.test.js` | 2/2 |
| `test/village_customs.test.js` | 23/23 |
| `test/village_generation.test.js` | 19/19 |
| `test/village_hauling.test.js` | 1/1 |
| `test/villages.test.js` | 16/16 |
| `test/wood_task_estimates.test.js` | 1/1 |
| `test/woodland_generation.test.js` | 1/1 |
| `test/work_visit_wear.test.js` | 7/7 |
| `test/world_journeys.test.js` | 19/19 |
| `test/world_map_routes.test.js` | 1/1 |
| `test/world_travel.test.js` | 12/12 |

## Browser and build

The final browser starts a fresh seed-13 game on the owned development server at port 8191.
It plans the adjacent journey through the public UI action and walks the normal HTN queue from `5,3` to `6,2`.
The calendar advances exactly one season. It then plans the return, moves physically, saves and reloads through Continue.
Player identity, active hex, remaining route, exact position, age and home match after reload.
The canonical home and knowledge objects remain shared. There is exactly one resident/transit copy.
Page errors: zero. The server stops cleanly and port 8191 is free.
This is the requested builder smoke check, not a separate independent play or phone review.

| Browser operation | Final elapsed seconds | Result |
| --- | ---: | --- |
| Fresh new game | 139.297 | Pass |
| Walk and first hop | 1.730 | Pass |
| Hop processing within that interval | 1.669 | Pass |
| Save and reload while walking back | 17.847 | Pass |

The screenshots were visually inspected: [start](merge-final-start.png), [arrival](merge-final-arrival.png),
[mid-journey](merge-final-mid-journey.png) and [reload](merge-final-reloaded.png).
The reload shows the Travel activity at the same position in the new reach.
Receipts: [browser state](merge-final-browser.json), [browser process](merge-final-browser-run.receipt.json).

The final production build exits 0 at the frozen runtime candidate.
Webpack compiles the app in 15.447 seconds and the save worker in 0.554 seconds.
It reports three bundle-size recommendations. There is no compile error.
The process receipt includes shared-lock waiting time, so its 58.430 seconds is not compiler time.
Receipts: [build](merge-final-build.receipt.json), [raw build log](merge-final-build.log).
Two production builds ran. The first passed before the live probe exposed the bed-placement bug.
That demonstrated runtime fix required a second build. The first build and browser receipts remain available.

## Reproduction and delivery limits

Run these from this worktree with the installed dependencies:

```bash
node scripts/merge-affected-gate.cjs
flock -w 7200 /tmp/27agents-gate-2.lock env -u NODE_OPTIONS node --expose-gc scripts/local-population-measure.js one-world-merge-final
flock -w 7200 /tmp/27agents-gate.lock env -u NODE_OPTIONS AFFAIRS_V8=shots/regress-game-one-world-merge-final.v8 node scripts/affairs.js 13 28
flock -w 7200 /tmp/27agents-gate-2.lock env MERGE_BROWSER_LABEL=merge-recheck node scripts/merge-browser.cjs
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

The browser label selects a separate profile and output paths. Use an unused label for a fresh run.
The affected selector’s exact commands and file list are in [gate receipt](one-world-merge-affected-receipt.json).
Per-file assertion outcomes are in [Jest output](one-world-merge-affected-tests.json) and [counts](merge-test-counts.json).
The working directory retains diagnostic V8 exports and browser profiles. Large runtime exports and profiles are not committed.

Only seed 13 was measured. No production-world test or optional seed search was added.
The natural discovery occurred in history. No affair remains active on arrival, so live discovery evidence comes from the small-world tests.
Main’s report was absent, so only its supplied affair counts can be compared.
The old reason-count assertion changed because its record representation changed. No parent test was removed.
All numerical targets, scoped discovery, promotion effects, local activities, affected checks, browser operations and build have passing evidence.
The branch contains a real merge of `origin/main` followed by separate green fixes and evidence commits. Nothing was pushed.
