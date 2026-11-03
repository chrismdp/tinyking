# TinyKing life stages

Seed 13 passes the population, CPU and collected-heap targets. Everyone gains two life years per season. The player sees life-stage labels. World history lasts 48 seasons.

The final birth multiplier is 2.2, four times 0.55. Birth probability alone could not preserve the starting population. The final change also reduces the birth cooldown from four seasons to one and increases household capacity from six to eight. Courtship still requires two seasons, mutual Intimate feelings, recent contact, housing and the existing kin exclusions.

Work stayed in `/home/cp/code/tk-life` on `feat/life-stages`, based on `98a33c5`. Dependencies were already installed. No delegation, other-branch inspection, stash, vault or bench-ledger write, push or deployment occurred. Main comparisons below come from the supplied brief and `one-world-merge-report.md`.

## Seed-13 result

The unchanged `scripts/local-population-measure.js` generated a new game and called `startGame` with the intro skipped. CPU and elapsed time exclude Babel loading, diagnostic exports and forced collection. Heap is measured after GC. Population and event counts come from the history export, before the arriving stranger and royal backstory.

| Measure | Main, 180 seasons | Final, 48 seasons | Acceptance |
| --- | ---: | ---: | --- |
| Living people | 580 | 686 | 560–757, pass |
| Births | 1,493 | 1,270 | Report |
| Marriages | 580 | 426 | Report |
| CPU seconds | 235.240 | 61.355 | ≤309, pass |
| Elapsed seconds | 234.782 | 74.446 | Report |
| Heap after GC, MiB | 238.75 | 157.53 | <250, pass |
| Retained people | 1,733 | 1,510 | Complete history |
| Recorded deaths | 1,153 | 824 | Report |
| Oldest person / death | Not supplied | 96 / 96 | No fixed age-88 limit |
| Oldest living person | Not supplied | 94 | Report |

CPU falls 73.9% from main. Births fall 14.9% and marriages fall 26.6%. The shorter history records fewer family events. Faster maturation partly offsets that reduction. The maternal window now closes at 40, while the former parenting window closed after 55. Larger households and shorter birth spacing preserve the arrival population without restoring the former event totals.

Collected RSS is 653.57 MiB. Shared-host load averages changed from `[3.01, 2.45, 2.17]` to `[5.78, 3.47, 2.55]`. These are observations on this host. Only seed 13 was measured.

Receipts: [profile](regress-profile-life-stages-final.json), [counts](life-stages-final-counts.json), [birth audit](life-stages-final-audit.json), [run log](life-stages-final.log), [source hashes](life-stages-source-manifest.json). The exported history and game remain in the worktree as ignored V8 files.

## Why births needed two additional changes

The birth multiplier scales the existing village population factor, which remains 0.2–2. The final comparison explicitly caps the resulting probability at one. A multiplier of five guarantees every eligible seasonal birth, even at the minimum factor. It therefore tests the probability limit without bypassing residence, kin, spouse, fertility, cooldown or room checks.

| Birth multiplier | Cooldown, seasons | Household capacity | Living people | Births | Marriages |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0.55 | 4 | 6 | 67 | 240 | 158 |
| 1.0 | 4 | 6 | 107 | 298 | 170 |
| 1.0 | 1 | 6 | 273 | 694 | 277 |
| 2.0 | 1 | 6 | 358 | 820 | 323 |
| 5.0, guaranteed eligible births | 1 | 6 | 358 | 820 | 323 |
| 5.0, guaranteed eligible births | 1 | 8 | 660 | 1,245 | 419 |
| 2.2, final | 1 | 8 | 686 | 1,270 | 426 |

Guaranteed births with six places still miss the minimum by 202 people, even after shortening the cooldown. Probability alone cannot solve that measured constraint. Four-season spacing consumes eight life years between births. One-season spacing restores two life years between births. Eight places allow a couple and up to six dependent children to share a home.

`household_capacity.js` defines the capacity once. Birth occupancy, marriage placement, dependent-family moves, newly created beds, stored-history bed installation and maternal-family spare-room checks use it. The village limit remains eight houses. Timber costs, starting households, founder ages, population scaling, partner preference, relationship rewards and the two-season courtship wait keep their existing values.

Two diagnostic alternatives were tried and reverted: 24 summary conversations left 426 living people, and Young-adult founders left 353. Neither is in the delivered code. Their logs remain in `shots/`.

## Stages and parenting

`src/game/life_stages.js` owns these boundaries and their eligibility helpers.

| Label | Life ages | Game years |
| --- | --- | --- |
| Child | 0–7 | First |
| Teenager | 8–15 | Second |
| Young adult | 16–23 | Third |
| Adult | 24–39 | Fourth–fifth |
| Middle-aged | 40–55 | Sixth–seventh |
| Old | 56+ | Eighth onwards |

Adulthood starts at Young adult. Both dependent stages can play. Teenagers can help at home. Adult work, courtship, household founding and invitations use the shared adulthood check. Existing inheritance still permits minor heirs.

Births previously had two parent IDs, with no designated mother and no sex restriction. The new eligibility helper retains both parents' 16–55 window. If a woman is present, at least one woman must be 16–39. That woman can bear the child. Thus two women can remain parents when one is in that window. Two women both aged 40 cannot produce a seasonal birth. A woman aged 40 with a man cannot produce one either.

Couples with no woman retain their former birth behaviour through age 55. No mother requirement, adoption rule or marriage sex restriction was added for them. The final history contains 216 births to couples with no woman and 161 births to two-woman couples. All 1,270 births pass the reconstructed maternal-window audit. Tests cover the order of the parent IDs, both same-sex cases, a birth at maternal age 39, refusal at 40, and the male upper boundary.

Age increases directly by two each season. `lifeYears` becomes `age / 8`, so a stale value cannot preserve the former split clock. The last-season guard still prevents duplicate ageing. Stranger creation and sealed backstory dates use the same scale.

## Death and survival

Old-age risk is `min(1, 0.02 * 2 ** ((age - 56) / 8))`, with zero risk before Old. The existing seeded person-and-season roll chooses death. There is no separate age cap. The formula reaches certainty by age 102 on an even-age seasonal path, and 103 on an odd-age path.

| Age | Seasonal death probability |
| --- | ---: |
| 56 | 2% |
| 64 | 4% |
| 72 | 8% |
| 80 | 16% |
| 88 | 32% |
| 96 | 64% |
| 104 | 100% |

The requested lifetime expectations refer to reaching a birthday. A newborn's even-age path gives 53.82% dead before 80, 17.77% reaching 88 and 1.89% reaching 96. Including the death roll at 80 gives 61.21% dead through 80. This distinction explains the apparent difference between “about half by 80” and the inclusive death table.

| Age | History deaths at or below age | Share of 824 recorded deaths | Founders dead before age | Share of 240 founders |
| --- | ---: | ---: | ---: | ---: |
| 72 | 316 | 38.35% | 74 | 30.83% |
| 80 | 540 | 65.53% | 135 | 56.25% |
| 88 | 772 | 93.69% | 206 | 85.83% |
| 96 | 824 | 100% | 238 | 99.17% |

All 240 founders completed their lives in history. Of those founders, 34 reached 88 and two reached 96. Later generations include 686 living people whose eventual death ages are unknown. The recorded-death distribution excludes those unfinished lives, so it is biased towards earlier deaths. The oldest recorded person died at 96. The small seeded test also demonstrates a person surviving to 90.

Receipts: [complete founder cohort](life-stages-founders-deaths.json), [history death counts](life-stages-final-counts.json).

## Every changed age threshold

The final source grep leaves numeric age eligibility only in the shared stage module. The other comparison is the derived parent-generation gap in `mother_family.js`. Age ordering and age-gap preferences remain numeric because they compare people rather than define a stage.

| Previous threshold | Shared rule | Every affected file or surface |
| --- | --- | --- |
| Child/adult split: 18 in two game years, then two life years per game year | Everyone gains two life years per season | `social.js`, `succession.js`; travel fixtures and ageing expectations |
| Size below 18: 12, otherwise 20 | Dependent size 12, Young adult onwards 20 | `map.js`, `social.js` |
| Adult marriage minimum 18 | Young adult onwards, 16+ | `social.js`, `family.js`, `person_panel.js` |
| Automatic family seeking 18–55 | Young adult through Middle-aged, 16–55 | `social.js`, `nearby_courtship.js`; automatic pools retain the upper limit |
| Both parents adult and no older than 55 | Both 16–55; a mother 16–39 | `social.js`, new `canHaveChild` helper |
| Dependent children below 18 | Child or Teenager, below 16 | `social.js` moves and settlement, `people.js` family bonds, `simulation.js` planner state |
| Adult household founding / invitations at 18 | Young adult onwards | `family.js`, `guidance.js`, `manager.js`, `status_strip.js` |
| Adult workers at 18 | Young adult onwards | `farming.js`, `favours.js`, `friend_help.js`, `possessions.js`, `villages.js`, `settlement_growth.js`, `hex_detail.js`, `person_panel.js` |
| Established workers / elders at 19 | Young adult onwards; existing residence and birth-date waits remain | `settlement.js` expansion and gathering actors |
| Oath and local-adult eligibility at `ADULT_AGE` 18 | Young adult onwards | `village_customs.js`; compatibility export in `people.js` derives from the stage |
| Adult visitors / independent travellers at 18 | Young adult onwards | `campfire_visits.js`, `social_visits.js`, `travel.js` |
| Children below 18 for play | Both dependent stages, below 16 | `family.js`, `tasks.js`, `social_visits.js`, `person_panel.js` |
| NPC play from age 4 | Child or Teenager | `social_visits.js`; the stage model has no separate infant boundary |
| Home help from age 6 | Teenager onwards, 8+ | `household_routines.js`, `tasks.js`, `simulation.js` |
| All-adult festival readiness at 18 | Young adult onwards | `seasons.js` |
| Social `is_adult` at 18; authored `age_below:18` | Shared `isAdult` and `is_dependent` | `social_conditions.js`, conversation data and its Python generator |
| Anonymous child/adult description at 18 | Dependent-stage check | `knowledge.js` |
| Backstory parent gap / minimum generated adult 18 | Young-adult boundary 16 | `mother_family.js`: mother age, ancestor gap, sibling and half-brother minima |
| Hidden old king minimum age 65 | Old-stage boundary 56 | `mother_family.js`; he remains a sealed dead reference |
| Old age from 60, linear risk, certain at 88 | Old from 56; exponential risk | `social.js`, `life_stages.js` |
| Diagnostic adult selections at 18 | Shared Young-adult boundary | `scripts/social-events-browser.js` |

## Player text and shorter-history assumptions

Person and family panels show stage labels for living and dead people. Family cards say, for example, `Died · Old`. Chat descriptions and all seven authored age phrases use `life_stage`. Tell content shares those facts. `chat_facts.js` no longer exports `age_words`.

The source audit covered UI components, renderer text, `messages.json`, event templates, biography code, conversation data and `tools/chat-design/gen_lines.py`. Biography and event templates contained dates and causes, but no exact personal-age formatter. Those dates remain. No `age_words`, `age_below`, old split-age rate or numeric age placeholder remains. No view test was added. Conversation-model tests assert the final spoken stage text. Regenerating all 1,428 conversation rows produces a byte-identical catalogue.

| Former history assumption | Delivered change |
| --- | --- |
| Local summary dates and loops start at -180 | `history.js` derives them from `HISTORY_SEASONS = 48` in `time.js` |
| World founding dates / travel cursor at -180, last season -181 | `world_history.js` derives both, then advances -47 through 0, exactly 48 transitions |
| Local history loops -180 through -1 | Loops -48 through -1, exactly 48 transitions |
| Village founding spread -32 to -180 | `map.js` uses the shared founding helper: first village -48; others -8 through -47 |
| Settlement cursors and woodland start -181 | `map.js`, `settlement.js`, `history.js` derive -49 |
| Progress divisors 180 and offsets 180/181 | Shared history length and derived offsets in both history routes |
| “Forty-five years of history” text | Shared label says “12 years of history” or “12 years of world history” |
| Sealed stranger birth date uses former accelerated childhood / adult conversion | Birth date is `-age / LIFE_YEARS_PER_SEASON * DAYS_IN_SEASON` |
| Romance chance 0.02 per contact | 0.07763184, equivalent to four former opportunities |
| Affair chance 0.12 per contact | 0.40030464, equivalent to four former opportunities |
| Summary affair / poaching sighting chance 0.012 | 0.047142891264 for both activities |
| Rare affair / poaching confidence chance 0.01 | 0.03940399 for both routes |
| Complete-history test fixture at -180 and cursors -181 | `history.test.js`, `support/founding.js` use the shared length |
| Historical-date fixture expects year -44 | `settlement_details.test.js` derives year -11 |
| Measurement scripts report 180 seasons / 45 years | `social-events-measure.js`, `social-events-browser.js`, `social-probe.js` use shared history constants |
| Design and social documentation describe 45 years and the old age curve | Updated to the delivered stages, clock, history, birth policy and death curve |

Rare chances use `1 - (1 - oldChance) ** 4`, preserving four former opportunities on the compressed life clock. Conversation counts, quarrel chances, seasonal drift and courtship duration remain unchanged. Other occurrences of 180 concern geometry, storage capacity or elapsed simulation frames, rather than history length.

## Tests, lint and build

Tests use small people, household, hamlet and travel fixtures. None generates a production world. The AFFECTED selector follows imports from `98a33c5`, includes changed tests and uses an explicit Jest file list under `/tmp/27agents-gate.lock`. It sees the JavaScript fixture imports directly. No whole suite or exception run was needed. This JavaScript repository has no TypeScript area or typecheck command.

| Check | Result |
| --- | --- |
| Initial life-stage test | Expected failure before module implementation |
| First implemented life-stage run | 46 passed, five failed; corrected API/fixture and implementation errors |
| Core life-stage check | 51/51 passed |
| History length / founding-label regression | Expected failure: 180 transitions and absent shared helpers |
| Rare-chance, backstory clock and one-season birth regressions | Each failed before its change |
| Household-room regression | Failed before capacity change; eight-member bound now enforced |
| Initial AFFECTED gate | 123/137 files, 1,219/1,237 tests passed; old-age and old-clock assumptions exposed |
| Lifecycle fixture migration check | 16/16 files, 218/218 tests passed |
| Household and spoken-label check | 6/6 files, 156/156 tests passed |
| Final broad AFFECTED run | 135/137 files, 1,243/1,246 tests passed; three old assertions remained |
| Bed-capacity corrections | 1/1 file, 15/15 tests passed |
| Player birth-spacing correction | 1/1 file, 18/18 tests passed |
| Combined final affected evidence | 137/137 files, 1,246/1,246 tests passed |
| Changed source / new-test / changed-script ESLint | Exit 0, no warnings |
| Changed diagnostic scripts: Node syntax | Pass |
| Generated conversation catalogue | 1,428 rows, byte-identical to committed JSON |
| Production build | Exit 0; app 20.013 s, save worker 0.551 s; three bundle-size warnings |

The final evidence combines the passing suites from the broad affected run with the two corrected files. It does not claim that the originally failing command passed. Runtime source did not change for those final assertion fixes. Original failures remain in their logs.

Existing tests retain their behavioural assertions. Deterministic death fixtures move from 87/88 to 102. Age and `lifeYears` fixtures use the new clock. Household fixtures now fill eight places before testing construction, ownership and birth limits. The bed-growth assertion still requires four additional places. The large-household test now exceeds the eight-place base.

The history calibration assertion now requires exact integer quantile counts, rather than an impossible percentage tolerance on a small population. The confidence test retains stable per-season rolls and a rare-frequency bound below 8%, suitable for the new 3.94% chance. The player birth test now requires a next-season birth and prevents another birth in that same season.

Receipts: [original final-gate output](life-stages-final-affected-tests.json), [gate command and file list](life-stages-final-affected-receipt.json), [bed correction](life-bed-tests.json), [player correction](life-succession-tests.json), [combined file counts](life-stages-combined-tests.json), [lint](life-complete-lint.log), [build](life-stages-build.receipt.json).

## Affected test files and pass counts

| File | Passed / total |
| --- | ---: |
| `test/acceptance_selection.test.js` | 17/17 |
| `test/annual_moisture.test.js` | 5/5 |
| `test/arrival_tasks.test.js` | 31/31 |
| `test/arrival.test.js` | 6/6 |
| `test/autosave.test.js` | 12/12 |
| `test/biography.test.js` | 5/5 |
| `test/biome_field.test.js` | 5/5 |
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
| `test/mother_family.test.js` | 10/10 |
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
| `test/road_wear.test.js` | 3/3 |
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
| `test/weather.test.js` | 10/10 |
| `test/wood_task_estimates.test.js` | 1/1 |
| `test/woodland_generation.test.js` | 1/1 |
| `test/work_visit_wear.test.js` | 7/7 |
| `test/world_journeys.test.js` | 19/19 |
| `test/world_map_routes.test.js` | 1/1 |
| `test/world_travel.test.js` | 12/12 |

## Browser preview and delivery

A fresh seed-13 game completed in 44.426 seconds in the final browser preview. The normal opening hint ordered a real visit and opened a conversation. The family tree shows `Adult`, and the identified conversation header shows `Adult · Reedbrook`. The undisclosed relative's panel keeps identity and household details hidden. No exact personal age appears on these observed surfaces. Page errors: zero. The owned server stopped cleanly.

The [family tree](life-stages-family.png), [relative panel](life-stages-person.png) and [conversation](life-stages-chat.png) screenshots were inspected. This was a builder text check, not an independent play review, phone review or complete storyboard. The conversation screenshot captures its incoming-line animation.

Two earlier driver attempts failed. The first selected the player, whose NPC panel is intentionally hidden. The second assumed Continue would be available after a commit change. Neither produced a page error. The corrected driver used a fresh private browser profile and the actual new-game flow. Those failed receipts remain beside the passing [preview receipt](life-stages-browser-preview.json).

Runtime source was frozen before the final measurement and production build. The last changes after that freeze adjusted test expectations only. The measured source hashes match the delivered runtime. Build and browser evidence apply to that same runtime.

| Commit | Green-step scope |
| --- | --- |
| `6148b7d` | Shared stages, uniform ageing, exponential death and parenting eligibility; 51-case core check |
| `04d2f0f` | Short history, rare chances, backstory clock and lifecycle fixture migration; 218-case focused check |
| `81f7a73` | Final demographic settings, shared household capacity, spoken-label tests and documentation; focused household checks passed, then broad affected checks exposed old bed and cooldown expectations |
| `a101068` | Corrected the remaining player cooldown expectation; 18/18 succession tests passed |

The report is the only committed file under `shots/`. Logs, profiles, screenshots, browser profiles, source manifests, runner copies and V8 exports remain ignored in the worktree. No unresolved implementation or numerical acceptance failure remains. Independent acceptance remains the coordinator's separate gate.

Reproduce the measurements and retained checks from this worktree:

```bash
flock -w 7200 /tmp/27agents-gate-2.lock env -u NODE_OPTIONS node --expose-gc scripts/local-population-measure.js life-stages-recheck
node shots/life-final-affected-gate.cjs
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

The retained affected runner uses base `98a33c5`. Its receipt records the exact explicit Jest file list. Use a new measurement label to preserve the original evidence. The final report commit adds no runtime change.
