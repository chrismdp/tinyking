The birth policy is implemented. Population acceptance remains blocked: seed 13 ends with 250 living people against the required 560–757. The branch is not ready to merge against the full brief.

All births now require a man and a woman, using `nameable.male`. The woman must be 16–39 and the man 16–55. Same-sex couples retain courtship and marriage. Household capacity remains eight. Adoption, orphan placement, courtship, attraction and mortality rules remain unchanged.

The final source is `da8c409` on `feat/births-mf`, based on `4a9a05d299dd7c01864caa11af0c209acd71acf8`. Work stayed in `/home/cp/code/tk-births`. Dependencies were already installed. No delegation, push, stash, other-branch code inspection, vault write or bench-ledger write occurred. Main figures below come from the brief.

| Measure | Main | Delivered | Acceptance |
| --- | ---: | ---: | --- |
| Living people after history | 686 | 250 | Fail: 560–757 |
| History births | 1,270 | 815 | Report |
| History marriages | 426 | 333 | Report |
| New-game CPU, seconds | 61 | 44.323 | Pass: ≤309 |
| New-game elapsed time, seconds | Not supplied | 41.181 | Report |
| Heap after GC, decimal MB | About 158 | 133.029 | Pass: <250 |
| Heap after GC, MiB | 157.53 in prior report | 126.867 | Report |
| Retained people | 1,510 | 1,055 | Report |
| History deaths | 824 | 805 | Report |
| Same-sex history births | 377 | 0 | Pass |

The unchanged `scripts/local-population-measure.js` measured a seed-13 new game, then called `startGame` with the intro skipped. Its timers exclude Babel loading, diagnostic exports and forced GC. Demographics come from the history export before the arriving player and royal backstory. The final saved game retains the family quest, three named relatives and both royal birth events. Source hashes match the frozen runtime.

The audit checked all 815 history births. It found no same-sex parents, unknown parent sex or parental age-window violations. Both sealed royal births also have one man and one woman within their windows. These are actual generated results. Unit tests use small fixtures and never generate a production world.

The calibration tried the birth rate first, then the cooldown. Every run used seed 13, 48 history seasons, capacity eight and the existing demographic rules.

| Birth multiplier | Cooldown, seasons | Living people | Births | Marriages |
| --- | ---: | ---: | ---: | ---: |
| 2.2, existing | 1 | 250 | 815 | 333 |
| 5, guaranteed eligible births | 1 | 244 | 809 | 327 |
| 1 | 1 | 152 | 605 | 269 |
| 1.5 | 1 | 200 | 732 | 312 |
| 5, guaranteed eligible births | 0 | 244 | 809 | 327 |
| 2.2, final repeat | 1 | 250 | 815 | 333 |

A multiplier of five guarantees a birth whenever the existing eligibility, housing and spacing checks permit one. The population factor has a minimum of 0.2, and the final probability is capped at one. Higher multipliers therefore produce the same decisions as five.

The seasonal loop visits each married couple once. A one-season cooldown already permits a birth on every seasonal visit. A zero cooldown cannot add a second opportunity. The two guaranteed-probability runs have identical people, events, knowledge, villages and locations. Small fixtures also demonstrate identical birth counts with cooldowns zero and one.

No tested configuration reached the population target. The final settings retain 2.2 and one season because they gave the largest measured population. Seeded family outcomes change when birth timing changes, so these runs do not prove that every intermediate rate fails. They do establish that maximum probability and minimum cooldown fail. No successful rebalance is claimed.

The coordinator must decide whether to revise the population target or authorise another demographic control. This implementation does not add multiple births per seasonal opportunity, change marriage selection, increase capacity or introduce adoption.

Every child-creation path was searched through `birth(`, birth-event creation, `generatePerson`, parent assignments and reciprocal child links.

| Path | Delivered behaviour |
| --- | --- |
| Seasonal history, `historyStep` and world-clock history | `social.js:canHaveChild` uses the shared sex and age eligibility helper before the existing seasonal checks. |
| Live seasonal births | The same loop and helper enforce the rule after seasonal ageing. |
| Player households, including homes outside villages | The same loop includes arrived players and applies both windows and the sex restriction. |
| Direct `social.js:birth` calls | The creation boundary rejects invalid sex or age before adding a person, event or family link. |
| `map.js:generateFamilies` | Couples already contain a man and a woman. Backdated children now receive ages that fit both parents' windows. This covers founding adult children, ordinary children and grown grandchildren. |
| `mother_family.js` maternal ancestry and added sibling | Candidate ancestry must contain an eligible sex pair when both parents are known. Mother-age selection fits the known parents, the younger sibling and the player's own maternal window. Dead ancestors use their death dates. |
| `mother_family.js` royal children | Both template couples already contain a man and a woman. The queen's age stays within her window even when the player's mother is older. |
| `world_history.js` founding couples | Audited, unchanged: explicit male/female adults, with children created later through the seasonal birth function. |
| `generatePerson`, stranger creation and succession | Audited, unchanged: these create independent people without inventing couple births. |
| Orphan residence and inheritance | Audited, unchanged. No adoption path was added. |

The shared `life_stages.js:canParentTogether` helper owns the sex-specific age checks. The seasonal helper retains its existing residence and kin checks. Direct birth creation adds only the requested sex and age restrictions. `docs/social.md` describes the delivered policy.

Existing birth fixtures now specify a man and a woman. The map bed fixture uses parents aged 30. Existing inheritance, knowledge, personality, occupancy and planner assertions remain. The old same-sex birth expectation now requires refusal. Dedicated tests still require both male and female same-sex couples to court and marry.

| Development evidence | Actual result |
| --- | --- |
| Initial policy regressions | 79 passed, 17 failed before implementation |
| First implementation | 94 passed, two old same-sex capacity fixtures failed |
| Core correction | 96/96 passed |
| Backstory ancestry regression | 106 passed, four failed before screening |
| Backstory correction | 110/110 passed |
| Existing fixture updates | 98/98 passed across seven files |
| Initial founding fixture | 44/44 passed, so it did not demonstrate the defect |
| Founding fixture with fixed random draws | 43 passed, one failed: maternal age 42 |
| Founding correction | 73/73 passed across three files |
| First affected gate | 1,264/1,265 passed across 132 files |
| Missing-sex travel fixture correction | 7/7 passed, original assertions retained |
| Saved-state backstory inspection | Found the stricter ancestry check removed seed 13's family quest |
| Older-family regression | 14 passed, one failed before age selection changed |
| Older-family correction | 64/64 passed across three files |
| Royal-window regression | 15 passed, one failed: maternal age 42 |
| Royal-window correction | 65/65 passed across three files |
| Final affected gate on delivered source | 132/132 files, 1,267/1,267 tests passed |
| ESLint on four changed runtime files and new test file | Exit 0, no warnings |
| Whitespace check | Pass |
| Final production build | Exit 0, app 22.988 s, save worker 0.739 s |

The final affected gate uses the existing import-graph selector rooted at `4a9a05d`, then passes an explicit file list to Jest. It runs under `/tmp/27agents-gate.lock`. Measurements and builds use `/tmp/27agents-gate-2.lock`. No whole-suite run or selection exception was used. This JavaScript project has no TypeScript area or typecheck command.

The first measurement and build preceded the backstory correction and are superseded. The final measurement, build and affected gate use the same frozen runtime. The final build reports three bundle-size warnings. No browser acceptance pass was run because this change has no visual surface, and independent acceptance belongs to the coordinator.

| Green commit | Scope |
| --- | --- |
| `24acf91` | Shared parent eligibility, direct birth boundary and 96 passing core tests |
| `121312b` | Ancestry eligibility and existing birth-fixture corrections |
| `982a2f9` | Backdated family ages, cooldown-limit fixtures, travel fixture and policy documentation |
| `da8c409` | Maternal age selection, preserved family quest and both royal windows |

The report is the only committed file under `shots/`. Logs, source manifests, JSON receipts, diagnostic runners and V8 exports remain ignored in this worktree. Reproduction commands use these retained local runners:

```bash
node shots/births-mf-final-affected-gate.cjs
flock -w 7200 /tmp/27agents-gate-2.lock env -u NODE_OPTIONS node --expose-gc scripts/local-population-measure.js births-mf-recheck
node shots/births-mf-inspect.cjs births-mf-recheck
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

Final receipts: [affected gate](births-mf-final-affected-receipt.json), [test results](births-mf-final-affected-tests.json), [measurement](regress-profile-births-mf-delivered.json), [birth audit](births-mf-delivered-counts.json), [runtime hashes](births-mf-frozen-runtime-manifest.json), [build](births-mf-delivered-build.log), [lint](births-mf-final-lint.log). Earlier failed logs remain beside them.

Every affected test file and its final pass count follows.

| Affected test file | Passed / total |
| --- | ---: |
| `test/acceptance_selection.test.js` | 17/17 |
| `test/arrival_tasks.test.js` | 31/31 |
| `test/arrival.test.js` | 6/6 |
| `test/autosave.test.js` | 12/12 |
| `test/biography.test.js` | 5/5 |
| `test/births_mf.test.js` | 46/46 |
| `test/campfire_visits.test.js` | 14/14 |
| `test/chat_acceptance.test.js` | 8/8 |
| `test/chat_answers.test.js` | 7/7 |
| `test/chat_guidance.test.js` | 6/6 |
| `test/chat_row_rules.test.js` | 15/15 |
| `test/chat_tell.test.js` | 27/27 |
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
| `test/frame_indexes.test.js` | 2/2 |
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
| `test/history_length.test.js` | 3/3 |
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
| `test/life_stages.test.js` | 54/54 |
| `test/local_queries.test.js` | 2/2 |
| `test/local_world.test.js` | 5/5 |
| `test/manager.test.js` | 13/13 |
| `test/map.test.js` | 15/15 |
| `test/mother_family.test.js` | 16/16 |
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

The unresolved acceptance failure is population: 250 living people, 310 below the minimum. The requested policy, affected tests, build, CPU and heap checks pass. No successful population rebalance or full-ticket completion is claimed.
