The birth policy, seeded orientation and life-clock conversion are implemented. With a normal birth probability, seed 13 ends with 127 living people against the required 560–757. Population acceptance fails by 433. CPU is 29.225 seconds and heap after GC is 110.144 MB. The branch is not ready to merge against the full population requirement. The new Life clock and bonds section supersedes the earlier population result.

All births require a man and a woman, using `nameable.male`. The woman must be 16–39 and the man 16–55. Reciprocal orientation now governs romantic attraction, courtship, romance and affairs. Same-sex couples retain courtship and marriage when both orientations permit it. Household capacity remains eight. Adoption, orphan placement and mortality retain their existing rules. Social growth, decay and waits now follow the life clock. Fixed tastes and marriage consent retain their existing rules.

The current runtime source is `6f69a55` on `feat/births-mf`. The orientation-stage runtime was `c31e618`. The orientation work started at `631fa54`. The earlier birth-policy runtime was `da8c409`, based on `4a9a05d299dd7c01864caa11af0c209acd71acf8`. Work stayed in `/home/cp/code/tk-births`. Dependencies were already installed. No delegation, push, stash, other-branch code inspection, vault write or bench-ledger write occurred. Main figures below come from the brief.

| Measure | Main | Before life-clock work | Delivered | Acceptance |
| --- | ---: | ---: | ---: | --- |
| Living people after history | 686 | 403 | 127 | Fail: 560–757 |
| History births | 1,270 | 977 | 397 | Report |
| History marriages | 426 | 317 | 182 | Report |
| Man–woman marriages | Not supplied | 317 | 181 | Report |
| Man–man marriages | Not supplied | 0 | 0 | Report |
| Woman–woman marriages | Not supplied | 0 | 1 | Report |
| New-game CPU, seconds | 61 | 61.507 | 29.225 | Pass: ≤309 |
| New-game elapsed time, seconds | Not supplied | 57.336 | 25.546 | Report |
| Heap after GC, decimal MB | About 158 | 146.914 | 110.144 | Pass: <250 |
| Heap after GC, MiB | Not supplied | 140.109 | 105.042 | Report |
| Retained people | 1,510 | 1,217 | 637 | Report |
| History deaths | 824 | 814 | 510 | Report |
| Same-sex history births | 377 | 0 | 0 | Pass |

The birth-policy and Orientation sections record earlier stages. Life clock and bonds records the current branch and its limits.

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

The birth-policy stage ended with 250 living people, 310 below the minimum. Its policy, affected tests, build, CPU and heap checks passed. The Orientation section below supersedes that population result.


## Orientation

Orientation and birth tuning raise seed 13 from 250 to 403 living people, an increase of 153. This remains 157 below the minimum. Compared with main, the final branch has 283 fewer living people, 293 fewer births and 109 fewer marriages. CPU is 0.507 seconds above the supplied main figure. Heap after GC is about 11.086 MB lower. Compared with the branch before orientation, births increase by 162 and marriages decrease by 16. CPU increases by 17.184 seconds and heap by 13.885 MB.

The original saved history confirms the diagnosis. Its 333 marriages comprise 231 man–woman, 50 man–man and 52 woman–woman couples. All 120 founding marriages are man–woman. Of the 213 marriages formed during history, 111 are man–woman, 50 man–man and 52 woman–woman. Same-sex couples therefore account for 47.9% of simulated marriages and 30.6% of all marriages. These counts come from `regress-history-births-mf-delivered.v8`, retained from the previous worker.

Each person stores `personality.orientation` once. `ORIENTATION_SHARES` in `src/game/orientation.js` holds the three shares: opposite sex 93%, same sex 4%, both 3%. The assignment hashes `nameable.seed` without consuming another random draw. A missing personal seed uses the stable person ID. Generated people, newborns and succession strangers receive the field.

Save restoration fills missing values in local components, remote identities and older per-map records. Existing values survive restoration.

Romantic interest and automatic or deliberate courtship require reciprocal orientation compatibility. Nearby candidate filtering uses the existing village and neighbouring-hex index. It reads each endpoint from its actual map and never scans the population for a candidate. Romance and affair actions use the same condition. Existing incompatible affair bonds cannot schedule new secret meetings. Friendship disposition, goodwill, relationship rings and ordinary social contact retain their existing rules.

Founding and previously married couples retain their spouses.

The final history contains 317 man–woman marriages and no same-sex marriages. This includes 120 founding couples and 197 simulated marriages. The intermediate multiplier of 2.2 produced one woman–woman marriage, so a same-sex outcome remains possible for this seed. Small fixtures also demonstrate both male and female same-sex couples courting and marrying when compatible.

All 1,217 retained history people have an orientation. All 197 simulated marriages and all 178 romance events pass the reciprocal-orientation audit. This history has no affair events. All 977 history births pass the sex and parental-age checks. Maximum living household occupancy is eight. The saved new game retains the family quest, three named relatives and both royal births. Both royal births also pass the sex and parental-age checks.

The seeded distribution test creates 10,000 individual people, without generating a world:

| Orientation | Requested share | Observed people | Observed share |
| --- | ---: | ---: | ---: |
| Opposite sex | 93% | 9,270 | 92.70% |
| Same sex | 4% | 417 | 4.17% |
| Both | 3% | 313 | 3.13% |

Calibration changed the rate before testing cooldown changes. Every run used seed 13, 48 history seasons and household capacity eight. History-only runs stop at the same history boundary as a new game. Their CPU figures are not used for the new-game acceptance comparison.

| Birth multiplier | Cooldown, seasons | Living people | Births | Marriages | Run |
| --- | ---: | ---: | ---: | ---: | --- |
| 2.2 | 1 | 396 | 969 | 310 | New game |
| 5 | 1 | 403 | 977 | 317 | New game |
| 1 | 1 | 224 | 682 | 239 | History only |
| 5 | 2 | 181 | 514 | 194 | History only |
| 1.5 | 1 | 285 | 822 | 267 | History only |
| 5 | 0 | 403 | 977 | 317 | History only |
| 5, final source | 1 | 403 | 977 | 317 | New game |

The final multiplier is five. Since the population factor is at least 0.2, every eligible birth opportunity succeeds. The final cooldown remains one season. A zero cooldown produces identical people, events, knowledge, villages and locations because each couple receives one seasonal opportunity. Increasing the cooldown to two reduces the population sharply. The later intermediate-rate check also fails to reach the target. These runs do not prove that every intermediate multiplier fails.

The final snapshot measures the remaining limits:

| Limit | Final observation |
| --- | --- |
| Single adults aged 16–55 | 97 of 121, or 80.2%; two are in transit |
| Resident single seekers | 95 |
| Seekers with a nearby single candidate | 95 |
| Seekers with an unrelated, reciprocally oriented candidate | 89 |
| Seekers with a mutually loved candidate | 13 |
| Seekers with mutual love and mutual Intimate bonds | 2 |
| Women aged 16–39 | 23, including 18 single women |
| Living couples | 34 |
| Couples outside either parental age window | 31 |
| Couples within both windows but in a full home | 2 |
| Couples within both windows with household room | 1 |
| Houses | 149, including 144 occupied and three full |
| Villages at the eight-house limit | 0 |
| Living people aged 56 or older | 273 of 403, or 67.7% |
| Living people younger than 16 | 9 |

The candidate counts use the actual courtship index after attaching the saved identity directory. Compatibility alone leaves many candidates available. Fixed personality tastes and mutual closeness leave few couples ready to court. Most living couples are already outside the parenting windows. Housing capacity is a local limit for two potentially fertile couples, but most houses have room at the end. This snapshot describes the final state, rather than every earlier seasonal constraint.

No tested configuration meets the population target. No extra births per opportunity, relaxed consent, changed personality tastes, wider age windows, extra housing capacity or new demographic rules were added.

The first regression run exposed ten orientation failures after fixing a missing-contact fixture. Added boundary tests then exposed deliberate courtship and old affair-meeting failures. The final 21 orientation tests cover reciprocal same-sex and opposite-sex compatibility, both-sex attraction, unchanged friendship, indexed filtering without population scans, deterministic assignment, shares, newborns, save migration, deliberate courtship, romance, affairs and old affair meetings.

Existing fixtures now specify compatible orientations where their scenarios require courtship or romance. The nearby and journey fixtures also supply the previously absent sex. Changes are confined to `births_mf`, `courtship_contact`, `nearby_courtship`, `secret_activities`, `social`, `social_events`, `social_mobility`, `travel_transfer` and `world_journeys` tests. Their original assertions remain. No shared harness or fixture file changed.

| Check | Result |
| --- | --- |
| Initial corrected regression fixture | 9 passed, 10 failed |
| New deliberate-courtship and affair-meeting regressions | 19 passed, 2 failed |
| Focused orientation and social checks | 191/191 passed across eight files |
| First affected gate | 1,289 passed, five old fixtures failed across two files |
| Corrected journey and transfer fixtures | 29/29 passed |
| Affected gate before rate tuning | 1,294/1,294 passed across 134 files |
| Affected gate on final rate | 1,294/1,294 passed across 134 files |
| ESLint on nine runtime files and the new orientation tests | Exit 0, no warnings |
| Whitespace | Pass |
| Production build | Exit 0; app 16.520 s, save worker 0.727 s |
| Final new-game CPU | 61.507 s, below 309 s |
| Final heap after GC | 146.914 MB, below 250 MB |
| Runtime source manifest | All 181 tracked source files match the frozen measurement source |

The affected gate uses the existing import-graph selector rooted at `631fa54` and supplies an explicit file list to Jest. It runs under `/tmp/27agents-gate.lock`. Measurements and the single production build use `/tmp/27agents-gate-2.lock`. No whole-suite run, selection exception or TypeScript check applies. This project is JavaScript and defines no typecheck command. The build retains three bundle-size warnings. No visual surface changed, and the independent browser acceptance pass remains the coordinator's responsibility.

The unchanged `scripts/local-population-measure.js` produced the final acceptance measurement on the frozen runtime. Its export and GC boundaries match the previous worker's measurement. Diagnostic calibration overrides remain in ignored local runners. Main comparisons use only the supplied figures. No other branch was read. No delegation, push, stash, dependency installation, vault write or bench-ledger write occurred.

| Green commit | Scope |
| --- | --- |
| `17062ae` | Seeded orientation, reciprocal romantic compatibility, migration and fixture corrections |
| `c31e618` | Guaranteed eligible births, retained one-season cooldown and updated birth documentation |

Only this report is committed under `shots/`. Reproduction commands use the retained ignored runners:

```bash
node shots/orientation-delivered-affected-gate.cjs
flock -w 7200 /tmp/27agents-gate-2.lock env -u NODE_OPTIONS node --expose-gc scripts/local-population-measure.js orientation-delivered
node shots/orientation-inspect.cjs orientation-delivered
node shots/orientation-limits.cjs orientation-delivered
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

Final receipts: [affected gate](orientation-delivered-affected-receipt.json), [test results](orientation-delivered-affected-tests.json), [measurement](regress-profile-orientation-delivered.json), [demographic and birth audit](orientation-delivered-counts.json), [remaining limits](orientation-delivered-limits.json), [cooldown comparison](orientation-cooldown-comparison.json), [distribution](orientation-shares.json), [runtime manifest](orientation-frozen-runtime-manifest.json), [build](orientation-delivered-build.log), [lint](orientation-delivered-lint.log). Failed attempts remain ignored beside them.

The unresolved limit is population: 403 living people against 560–757. Orientation, save migration, birth policy, household capacity, affected checks, build, CPU and heap checks pass. The measured constraints do not justify adding rules outside this brief.


## Life clock and bonds

The life-clock conversion and normal birth probability are implemented. Seed 13 ends with 127 living people, 433 below the minimum. Population acceptance fails. Work stops at the measured constraint, as requested. Practical marriages need a separate decision from Chris and the coordinator.

The runtime is `6f69a55`. The fixture corrections are `fb20ab1` and do not change runtime files. Work started at `71b766c` in `/home/cp/code/tk-births`. Only seed 13 was evaluated. No other branch was read. Dependencies were already installed. No delegation, push, stash, vault write or bench-ledger write occurred.

### Ages before implementation

The saved `orientation-delivered` history supplies the starting branch measurement. Ages are reconstructed from each person's retained age, death season or history endpoint, and the event season. The slope is two life years per season. Each woman contributes her earliest recorded marriage or birth once. Dead women remain included.

The main-history export and main age figures are absent from this worktree. The supplied reports contain population totals, but no marriage or birth medians. The instruction against reading other branches prevents a new main run. The main age comparison therefore remains unmeasured. No substitute branch was inspected.

Founders enter history already married. Their founding weddings do not measure the time needed to form a bond. The primary comparison below uses women born during history, whose full recorded lives start with a birth event. This excludes founding weddings and the founders' later first births. It also excludes women who never marry or give birth, so these medians cannot measure their unmet opportunities.

| Age measure, life years | Main | Starting branch | Final branch |
| --- | --- | ---: | ---: |
| Median first marriage, women born during history | Unavailable | 26, 195 women | 24, 63 women |
| Median first birth, women born during history | Unavailable | 28, 140 mothers | 28, 49 mothers |
| Median first recorded marriage, including founders | Unavailable | 27, 315 women | 26, 183 women |
| Median first recorded birth, including founders | Unavailable | 28, 260 mothers | 30, 167 mothers |
| First marriages at age 40+, women born during history | Unavailable | 29 of 195 | 7 of 63 |

The fixture confirms a fourfold slowdown in goodwill earned per life year before implementation. The starting median first marriage still leaves seven seasonal opportunities before age 40. These figures support a timing problem but do not establish it as the sole cause of the population deficit. The final run changes both social rates and birth probability. It does not isolate their effects on population.

### Conversion and rate audit

`src/game/social_clock.js` defines the former clock once as 0.5 life years per season. It derives the scale from `LIFE_YEARS_PER_SEASON`, currently two. Growth and decay multiply by four. Independent chances use `1 - (1 - p) ** 4`. Waits divide by four.

| Rate or wait | At the starting commit | Delivered value |
| --- | ---: | ---: |
| Contact goodwill towards someone loved | +4 per conversation | +16 |
| Contact goodwill towards someone liked | +1 per conversation | +4 |
| Contact goodwill towards someone hated | −0.25 per conversation | −1 |
| Goodwill drift, per hour | 0.010714285714 | 0.042857142857 |
| Goodwill drift, per season | 1.8 | 7.2 |
| Festival attendance goodwill, once per season | +2 | +8 |
| Negative-goodwill quarrel chance, per conversation | 0.08 | 0.28360704 |
| Disposition-friction chance, per conversation | 0.0015 | 0.0059865134949376 |
| Courtship wait, seasons | 2 | 0.5 |
| Recent-contact window, seasons | 1 | 0.25 |
| Avoidance effect of one authored season | 1 season | 0.25 season |
| Birth base probability, per season | 5, guaranteed after population scaling | 0.45 |

The contact reward applies to completed live and summary conversations. The six summary conversations remain six. Scaling their reward avoids counting the conversion twice. One three-conversation visit now earns 48 goodwill. After one season's drift, its net gain is 40.8. Per life year, that is the former `(12 - 1.8) / 0.5 = 20.4`.

Rings have no separate promotion timer. Their thresholds remain 10, 30 and 60, and their capacities remain 10, six and two. The scaled goodwill reaches those same thresholds sooner. Disposition comes from fixed traits and tastes. It has no seasonal growth or decay rate. Opinion thresholds, orientation, age windows, kin exclusions and candidate weights retain their values.

Romance and affair chances were already scaled by the life-stage worker. The JSON now stores their original chances, 0.02 and 0.12. `SOCIAL_ACTIONS` converts the catalogue once when loading it. The effective chances remain 0.07763184 and 0.40030464. Tests assert both values, so neither receives another fourfold conversion. Custom actions supplied explicitly to the runner retain their exact supplied probabilities.

The previously scaled summary sighting chance remains 0.047142891264 for affairs and poaching. The rare confidence chance remains 0.03940399 on both disclosure routes. Those values are not converted again. Certain actions retain probability one. Quarrel and reconciliation effects remain −6 and +6 because those amounts belong to events, rather than elapsed time. The five-percent traveller share is a fixed trait, not a seasonal chance.

Conversation duration, routes, daily visit scheduling, meal and sleep timing, and the news budget still describe physical game actions. They retain their existing values. Player conversation choices, gifts and family starting bonds are discrete effects, rather than seasonal relationship rates.

Live wedding retries now use fractional seasons, so the half-season wait can finish between boundaries. A current completed conversation remains required. History samples meetings only at seasonal boundaries. Its earliest wedding after starting courtship is therefore the next seasonal meeting, two life years later. No intermediate contacts or dates are fabricated.

### Birth probability and spacing

The base probability is 0.45. The existing population factor remains 0.2–2, so the effective chance is 9%–90%. At the reference population, an eligible couple expects one birth every 2.22 seasons, or 4.44 life years. Crowding and sparse populations still change that interval. The one-season cooldown and eight-person household capacity retain their existing values.

The final history contains 230 intervals between successive births to the same woman. Their mean is 1.913 seasons, or 3.826 life years. The median is one season. Of those intervals, 119 are one season, 82 are two or three, and 29 are four or more. The observed mean is close to the lower edge of the requested spacing, but the median is shorter. These completed intervals exclude mothers with only one child and gaps cut off by the history endpoint or maternal window. They are not an unbiased estimate of every eligible opportunity.

The starting guaranteed-birth history has 717 completed intervals, with mean 1.167 seasons and median one. No further rate sweep or new birth rule was added after the final population failure.

### Seed-13 acceptance

The unchanged `scripts/local-population-measure.js` generated a new game and started it with the intro skipped. CPU excludes Babel loading, diagnostic exports and forced collection. Heap is measured after GC. Demographics come from the history export before the player and royal backstory arrive. Runtime hashes match all 182 tracked source files after the checks and fixture corrections.

| Measure | Starting branch | Final branch | Acceptance |
| --- | ---: | ---: | --- |
| Living people | 403 | 127 | Fail: 560–757 |
| Child, ages 0–7 | 9 | 0 | Report |
| Teenager, ages 8–15 | 0 | 0 | Report |
| Young adult, ages 16–23 | 14 | 2 | Report |
| Adult, ages 24–39 | 32 | 11 | Report |
| Middle-aged, ages 40–55 | 75 | 31 | Report |
| Old, ages 56+ | 273 | 83 | Report |
| History births | 977 | 397 | Report |
| History marriages, including 120 founding couples | 317 | 182 | Report |
| Marriages formed during history | 197 | 62 | Report |
| New-game CPU, seconds | 61.507 | 29.225 | Pass: ≤309 |
| New-game elapsed time, seconds | 57.336 | 25.546 | Report |
| Heap after GC, decimal MB | 146.914 | 110.144 | Pass: <250 |
| Heap after GC, MiB | 140.109 | 105.042 | Report |

All 397 history births pass the sex and parental-age audit. All 62 simulated marriages and all romance or affair events pass reciprocal orientation checks. The final history contains 181 man–woman marriages and one woman–woman marriage, including founders. Maximum living household occupancy is six. Every retained person has an orientation. The started game retains its family quest, three named relatives and both valid royal births.

### Remaining limit

| Constraint at the final history snapshot | Starting branch | Final branch |
| --- | ---: | ---: |
| Resident single seekers | 95 | 40 |
| Seekers with a nearby single candidate | 95 | 39 |
| Seekers with a compatible, unrelated nearby candidate | 89 | 35 |
| Seekers with a mutually loved candidate | 13 | 0 |
| Seekers with mutual love and mutual Intimate bonds | 2 | 0 |
| Women aged 16–39 | 23 | 7 |
| Single women aged 16–39 | 18 | 7 |
| Living couples | 34 | 7 |
| Couples outside either parenting window | 31 | 7 |
| Fertile couples in a full home | 2 | 0 |
| Fertile couples with room at home | 1 | 0 |
| Houses / occupied houses | 149 / 144 | 120 / 77 |
| Full houses | 3 | 0 |
| Villages at the eight-house limit | 0 | 0 |

Compatible candidates remain available to 35 of 40 seekers. None has a mutually loved candidate, so faster goodwill cannot make those pairs mutually Intimate under the current tastes rule. All seven women in the maternal window are single. All seven living couples are outside the parenting windows. Empty housing remains available. This snapshot identifies a partner-formation constraint, rather than a final housing or birth-roll constraint. It does not describe every earlier season.

The normal birth rate produces a much smaller population than the starting guaranteed rate. First marriage improves by two life years among women born during history. First birth does not improve for that cohort. The run does not support claiming that social-rate conversion alone restores the population. Mutual Personal marriages, wider age windows, extra housing, changed tastes and guaranteed births were not added. The coordinator must decide whether to authorise practical marriages or another change.

### Tests and receipts

Small fixtures ran before implementation. The first attempt failed to resolve the new module. After adding the clock helper, six behavioural tests failed and one passed. Failures showed quarter-speed goodwill, late marriage, the old drift rate and the long avoidance wait. After implementation, fixtures show equal net goodwill per life year in live and summary contact. A couple starting at age 16 with Social bonds marries at 18 after steady seasonal contact. A live couple waits exactly half a season. Tests also cover the contact cutoff and each chance conversion once.

The normal-birth tests failed before changing the rate. They then passed with a small population of independently seeded three-person fixtures. Those tests check ordinary probability, expected spacing at the reference population, and one opportunity per season. No unit test generates a production world.

| Check | Result |
| --- | --- |
| Initial behavioural regressions | 1 passed, 6 failed |
| Focused social checks after fixture updates | 156/156 passed across nine files |
| Birth regressions before rate change | 0 passed, 2 failed |
| Focused birth and lifecycle checks | 115/115 passed across four files |
| Initial affected gate, base `71b766c` | 1,293 passed, 7 failed across 134 files |
| Corrected affected files | 67/67 passed across five files |
| Combined final affected evidence | 1,300/1,300 passed across 134 files |
| ESLint on six runtime files and both new tests | Exit 0, no warnings |
| Whitespace | Pass |
| Production build | Exit 0, app 18.139 s, save worker 0.570 s |
| Frozen runtime manifest | All 182 source hashes match |

The affected gate uses the existing import-graph selector with base `71b766c`, then supplies an explicit Jest file list. It runs under `/tmp/27agents-gate.lock`. Measurements, focused tests and the production build use a shared heavy-work lock. No whole suite, shared-harness exception or TypeScript check applies. This project is JavaScript and defines no typecheck command. The build retains three bundle-size warnings. No visual surface changed. Independent browser acceptance remains the coordinator's responsibility.

Changed existing tests retain their substantive constraints. Nearby weddings and lost-intimacy resets use the shorter wait. Live mobility uses three completed visits to earn 48 goodwill, and its quiet period retains the former half-life-year duration. Its deterministic history fixture now specifies one compatible pair because the faster simulation otherwise produces a different consenting marriage. Quarrel frequency uses the compounded probability, and deduplication still checks the same quarrel attempt across hooks. Reconciliation can now occur within that season.

The final five corrected files update travel and hourly drift numbers, contact rewards and the probabilistic birth fixture. The disclosure test calls the real news exchange directly because the larger contact reward outweighs its three-point kin reaction. It still requires demotion and refusal to disclose the second story. The journey fixture supplies an empty bed store for the real planner. The player cooldown test forces only the next opportunity after an ordinary probabilistic first birth. Original input-purity, reciprocal-family, needs, ownership and source assertions remain.

The original affected failure is retained. Only the five failed files were rerun. Runtime did not change after measurement or build. Combined evidence replaces those five file results and preserves the other 129 passing files.

| Green commit | Scope |
| --- | --- |
| `03b01e2` | Clock conversion, social rates, documentation and 156 passing focused tests |
| `6f69a55` | Normal birth probability and 115 passing focused birth/lifecycle tests |
| `fb20ab1` | Final affected-fixture corrections and 67 passing tests |

Only this report is added to tracked `shots/` content. Logs, runners, exports and JSON receipts remain ignored. Reproduction commands use retained local runners:

```bash
node shots/life-clock-ages.cjs orientation-delivered
node shots/life-clock-affected-gate.cjs
flock -w 7200 /tmp/27agents-gate-2.lock env -u NODE_OPTIONS node --expose-gc scripts/local-population-measure.js life-clock-final
node shots/orientation-inspect.cjs life-clock-final
node shots/life-clock-ages.cjs life-clock-final
node shots/orientation-limits.cjs life-clock-final
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

Final receipts: [starting ages](orientation-delivered-ages.json), [final ages and spacing](life-clock-final-ages.json), [profile](regress-profile-life-clock-final.json), [birth and orientation audit](life-clock-final-counts.json), [remaining limits](life-clock-final-limits.json), [affected command](life-clock-affected-receipt.json), [original affected results](life-clock-affected-tests.json), [corrected results](life-clock-gate-corrections-tests.json), [combined affected results](life-clock-combined-tests.json), [source hashes](life-clock-frozen-runtime-manifest.json), [lint](life-clock-final-lint.log), [build](life-clock-final-build.log). Failed attempts remain beside them.

Population and the main age comparison remain unresolved. The measured partner constraint needs a policy decision outside this brief.
