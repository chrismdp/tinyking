# Day food report

The day-3 failure is fixed in seed 13. Hungry people at 18:00 fall from 16 to 0. Day-2 daytime sleepers fall from 41 to 0.

People now collect inherited food, bring it home and share real kin surplus. They sleep at night and finish their meals. No food, need or meter was added. Crop growth, yields, forage and starting stocks stay unchanged.

Real late-week shortages remain. Seed 7 ends with 15 hungry people at 18:00, down from 57. Its largest evening hunger value falls from 5.08 to 1.46 days. Its vacant stores retain only the absent heirs' next meals. Food requests still have a purpose.

The affected gate is green after two failures were corrected: 147 files and 1,446 tests. The production build passed. All real replay outcomes, including unsuccessful intermediate versions, are retained.

## Final rules

- `household_food.mealAccess` grants food access to residents, heirs and kin. It reads absent heirs' real households and retains each donor's next meal. Farms, beds and trades keep their separate residence rules.
- `updateHouseholdFood` gives adults real collection work when their home lacks two meals each and a shareable portion. It chooses owned estates, then the largest reachable kin surplus. Walking, hands and pantry capacity still apply.
- `compound.find_food` and `tasks.recover_meal` search actual supplies and forage. Failed searches keep the existing cooldown. Real deliveries and harvests clear stale failures. Only player orders retain the four-hour deadline.
- `tasks.eat`, storage tasks and their `primitive` effects retain accurate holding flags. A second carried portion reaches the store after the first is deposited.
- `updatePlannerFrame` starts ordinary bedtime at 22:00 and lets timed care finish. `tasks.sleep` restores real tiredness, stays through the night and finishes after dawn.

## Controls and setup

- Worktree: `/home/cp/code/tk-dayfood`, branch `day-food`, base `379c911`.
- `npm ci`: exit 0; 1,056 packages installed in 10 seconds. npm reported peer-version warnings and 19 dependency vulnerabilities. No dependency changes made.
- Read `CLAUDE.md`, the verification, social, survival and settlements documents, and the research design and hunger findings.
- Use only the saved worlds `.cache/play/initial-13.bin` and `initial-7.bin`. No generation, extra food or player help.
- `scripts/day-food.cjs` uses the real `slotChoices` and `playSlot`. Each part of each day the player visits reachable empty ground, then takes the day layer's normal night rest. All places are revealed as in `scripts/day-play.cjs`.
- Empty households means occupied households with fewer than one portion at 18:00. The comparison tables count hungry residents above the existing 0.9 threshold at 18:00. The evidence file also retains distinct daily counts, concurrent peaks and hourly counts. Daytime asleep means distinct residents sleeping at an hourly sample from 09:00 up to, but excluding, 17:00. The player is excluded. Arrival is recorded at 09:00, with hourly samples from 10:00. The other days have 24 samples each.
- Heavy runs use the two named shared gate locks. No server ports or external processes are needed by this replay driver.

## Causes found in the rules

`summarySeason` in `src/game/world_history.js` gives each summary field 18 grain at autumn harvest and deducts three meals per resident each season. Large families therefore enter play with empty stores. The rule still uses three-day food costs although a season now lasts seven days. It also adds autumn harvests to vacant houses. `installStoredHistory` preserves these stores and owners. `generateVillageLife` in `src/game/villages.js` installs freshly sown fields with zero growth. Grain takes 10.5 growing days, so those new fields cannot feed the first spring week.

`die` and `heirFor` in `src/game/possessions.js` pass legal ownership to a living spouse, then the eldest living child or nearest living kin. `repairHouseholds` preserves an owner's estate after a move. `moveHouse` in `src/game/social.js` changes residence, without moving the old store. These rules preserve goods but leave them in their original house. `householdAccess` in `src/game/playable.js` then insists that an actor's residence matches the asset's house. This excludes an heir from another home's store, including a wholly vacant one. It correctly keeps farms, beds and working permissions separate, but food needs its own narrower permission.

The empty Reedbrook cottage is `w5_3-home-1`. It holds 51 grain on arrival. Its final ownership transfers are Cuthbert Yaforlo → Agnes Friforrin at day -21, then Agnes → Hugh Seesi at day 0. Henry Seesi moves into it at day -7 and leaves for `w5_3-home-16` at day 0. Hugh lives in `w5_3-home-6`. Thus the cottage is empty, owned and stocked, but nobody's meal search can use it. Hugh's own household starts with only nine grain.

`compound.person` in `src/game/compound.js` only sends tired people to bed at night or before 09:00. Most historical residents arrive with zero tiredness at 09:00. `updateNeeds` adds one day of tiredness per day. They therefore cross 0.9 around 07:00 on day 2. `home_downtime` keeps them inside overnight but gives no sleep. The result is a first sleep after dawn, continuing into the working day. A new need also replans a villager's timed meal and calls `htn.finishTask` before the meal finishes. The player already has protection for this case, but villagers do not.

`find_food` builds a separate plan for every absent food and storage kind. It has no kin-sharing path. Existing `recover_meal` already searches actual food sources within one care task and remembers rejected routes. The fix can reuse this task for villagers.

## Test-first evidence

The first regression run used `flock -w 7200 /tmp/27agents-gate-2.lock` with `npx jest --runInBand test/household_food.test.js test/survival.test.js`.

```
Test Suites: 1 failed, 1 passed, 2 total
Tests:       5 failed, 25 passed, 30 total
Snapshots:   0 total
Time:        7.144 s
Ran all test suites matching test/household_food.test.js|test/survival.test.js.
EXIT_STATUS=1
```

The five failures prove inaccessible inherited stores, absent kin sharing, the offscreen permission mismatch, the missed first night and interrupted villager meals. Additional two-hour regressions for grain, roots and reachable forage already passed on the old rules. They constrain the replacement search but are not evidence of a two-hour failure in the old search. Full failure output is in `shots/day-food-red.log`.

## Initial fixes and regressions

- Added a food-only permission. Residents keep their own supplies. A vacant estate feeds its owner's household. An occupied home protects two meals per resident before sharing with the owner's household or close kin.
- Reused the existing complete meal-search task for villagers. The task checks all food kinds, keeps its walking and collection progress, and tries another real source after a route or access failure.
- Rechecked sharing permission on collection. A walking relative cannot take the portion that another relative already used.
- Applied the same permission to offscreen meals. Food remains physically in its original store until consumed.
- Sent villagers home to sleep at 22:00 even when they have not reached exhaustion. Kept timed meals and sleep running through new need signals.

The first implementation run found two failures because the new lower bound on tiredness also made the old sleep-completion comparison always true. Changed that comparison to finish rested sleep after dawn. This was an implementation failure, retained in `shots/day-food-green.log` (exit 1, 2 failed and 42 passed).

## Seed 13: where the food goes before the fix

There are ten houses and nine occupied households. Six occupied households are strictly empty at 18:00 on day 3. A seventh holds one portion for four people. This explains the brief's seven hungry households without counting the vacant cottage as a family.

| Household | House ID | People | Arrival | Day 1, 18:00 | Day 2, 18:00 | Day 3, 18:00 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Empty cottage, Reedbrook | `w5_3-home-1` | 0 | 51 | 51 | 51 | 51 |
| Seesi, Reedbrook | `w5_3-home-6` | 2 | 9 | 9 | 7 | 5 |
| Jobari, Reedbrook | `w5_3-home-11` | 5 | 0 | 0 | 0 | 0 |
| Frifoblo by the barn, Reedford | `w5_3-home-16` | 5 | 0 | 0 | 0 | 0 |
| Frifoblo, one resident, Reedford | `w5_3-home-21` | 1 | 27 | 27 | 26 | 25 |
| Bobarin by the brook, Reedford | `w5_3-home-26` | 4 | 0 | 0 | 0 | 0 |
| Frifoblo by the lane, Reedford | `w5_3-home-31` | 7 | 0 | 0 | 0 | 0 |
| Bobarin by the orchard, Reedford | `w5_3-social-62` | 7 | 0 | 0 | 0 | 0 |
| Thuson, Reedford | `w5_3-social-82` | 7 | 0 | 0 | 0 | 0 |
| Frifoblo, four residents, Reedford | `w5_3-social-99` | 4 | 9 | 9 | 5 | 1 |

The Jobari house contains Andrew Jobari, who owns Matthew Frifoblo's house and its 27 grain. Mabel Frifoblo is Matthew's sister. Neither ownership nor kinship permits them to eat that food under the old meal rule. Matthew eats one portion each day while their household forages.

The barn house belongs to Hugh Seesi, who lives in Reedbrook. Hugh's son Henry lives in the barn house. Emmeline Frifoblo is Matthew's sister. This family has two links to food, but the old rules admit neither. Its new crops cannot mature during the first week.

The brook house has no close-kin link to the three occupied stocked homes. Its four residents depend on public forage until their fields mature. This is a real shortage, not an inheritance fault.

The lane house contains Felice and William Frifoblo, close kin of Ralph Frifoblo in the four-person house. The orchard house contains his sister Alice. Ralph's household starts with nine portions for four. This household cannot feed both larger households throughout the week. The old rules permit no kin sharing. Public forage remains important.

The Thuson house contains Margaret Seesi, Hugh's sister. Hugh's vacant inherited cottage holds 51 portions. The old rules stop Margaret's family using that surplus.

The four-person Frifoblo house uses eight of its own nine portions by the third evening. It genuinely needs another food source. The two Seesis use four of their nine while their inherited cottage stays untouched. Matthew uses two of his 27 while Andrew's household stays empty.

| Sample time | Stored portions left | Wild portions left | Meals eaten since arrival | Portions collected from stores | Portions foraged | Greatest field growth, days |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Arrival, day 1 at 09:00 | 96 | 159 | 0 | 0 | 0 | 0 |
| Day 1 at 18:00 | 96 | 159 | 0 | 0 | 0 | 0.375 |
| Day 2 at 18:00 | 89 | 138 | 28 | 7 | 21 | 1.375 |
| Day 3 at 18:00 | 82 | 112 | 61 | 14 | 47 | 2.375 |

At the third evening, all 61 consumed portions are accounted for: 14 from stores and 47 from wild plants. No food is carried at those snapshots. No live harvest occurs in the first week. Field growth remains below the existing 10.5-day requirement. New villagers first need a meal around day 2 at 07:00. Their late sleep takes priority then. Hugh Jobari arrives with existing hunger and tiredness, so his first search starts on day 1.

The inherited-surplus regression first failed with exit 1 (`shots/day-food-kin-red.log`: 1 failed, 6 passed). Extended the food permission to the heir's close kin while protecting two meals for each member of the heir's household. The focused run then passed:

```
Test Suites: 3 passed, 3 total
Tests:       45 passed, 45 total
Snapshots:   0 total
Time:        6.905 s, estimated 7 s
Ran all test suites matching test/household_food.test.js|test/survival.test.js|test/tiredness.test.js.
EXIT_STATUS=0
```

`npx eslint src/game/household_food.js src/game/compound.js src/game/needs.js src/game/simulation.js src/game/tasks.js scripts/day-food.cjs` produced no diagnostics and exited 0. This repository has plain JavaScript and no configured typecheck command. ESLint parses the changed runtime files and the replay driver.

## Absent heirs found in seed 7

Seed 7 starts with 246 stored portions and 113 wild portions. Two vacant houses hold 18 and 168 of the stored portions. Their owners are `w6_4-social-72` and `w6_4-social-75`, who live in neighbouring places. A food permission that only reads local residents cannot recognise those heirs' households. Added regressions for this case and for an ownerless cottage. An absent household must not become the set of all homeless people through an undefined house ID.

The first after-replays use commit `e126c8e`. They finish their full seven days before the absent-heir correction. Their raw results remain separate from the final comparison. The queued affected gate and build had not started, so I cancelled only my two lock waiters, PIDs 2530117 and 2530125, recorded in `.cache/day-food-pids.txt`. No test or build was killed. The final gates will run on the corrected source.

The first correction removed most daytime sleep, but seed 7 still exhausted its local food. Its vacant stores have local cousins rather than close kin. The existing `relatedPeople` rule recognises those cousins. Sharing now uses that rule as well as close family, and reads an absent heir's actual household through `homeState` and `personComponent`. It protects that household's two meals per person. An ownerless cottage has no beneficiaries.

A villager also brings one spare portion home from a shared store when a hand and pantry space are available. Both portions leave the real source. The normal meal consumes one and the existing storage plan carries the other home. This lets food pass between kin households. The planner retains its knowledge of the spare portion after eating, so the good does not get stuck in a working hand.

The absent-heir tests failed first (2 failed, 7 passed, exit 1). The complete sharing regressions then failed first (4 failed, 7 passed, exit 1). After the fixes:

```
Test Suites: 3 passed, 3 total
Tests:       49 passed, 49 total
Snapshots:   0 total
Time:        6.968 s, estimated 9 s
Ran all test suites matching test/household_food.test.js|test/survival.test.js|test/tiredness.test.js.
EXIT_STATUS=0
```

The final ESLint command also includes `src/game/primitive.js`. It produced no diagnostics and exited 0. The first candidate's seven-day results remain in `shots/day-food-first-after-13.json` and `shots/day-food-first-after-7.json`. These are intermediate evidence, not the final comparison.

## Completing household collection

The second candidate (`dd27dbb`) also completed both weeks. It improved early food access but still left later shortages. The remaining work was to collect household supplies before hunger started. Added an hourly choice of one adult collector for a low household. This uses the existing threshold of two meals per resident. The collector walks to a permitted store, fills available hands with real portions and uses the existing storage plan to bring them home. Each collection rechecks the donor's reserve. Food requests still expire only when their real outcome occurs.

The new regression failed first: 1 failed, 11 passed, exit 1 (`shots/day-food-restock-red.log`). Its first implementation found another existing fault: storing the first of two grain portions cleared the planner's holding flag, leaving the second portion in a working hand. Both container and stockpile storage now retain the flag while a matching good remains held.

The complete meal task also needed the existing four-hour failed-search cooldown. Without it, a hungry villager with a ripe field kept repeating the failed search instead of returning to harvest work. A regression first failed with its crop still ripe after five hours (`shots/day-food-ripe-red.log`, exit 1). The corrected test checks the actual six-grain harvest event and subsequent meal. It permits the villager to plough the harvested patch afterwards.

A failed meal search now lets ordinary work proceed during its existing four-hour cooldown. Actual harvests and food deliveries clear that stale failure for the household. The ripe-field regression retains its five-hour limit. The first storage fix run passed 61 tests but still caught the stale failed-search delay. Clearing that delay on real food arrival resolved it.

```
Test Suites: 4 passed, 4 total
Tests:       62 passed, 62 total
Snapshots:   0 total
Time:        5.212 s, estimated 6 s
Ran all test suites matching test/household_food.test.js|test/survival.test.js|test/tiredness.test.js|test/tasks.test.js.
EXIT_STATUS=0
```

The second candidate's results remain in `shots/day-food-second-after-13.json` and `shots/day-food-second-after-7.json`. Both completed with exit 0. The final comparison uses the version with household collection and correct storage flags. No crop age, crop yield, initial stock, forage density or need rate changes were made.

The third candidate (`86a1a7e`) completed both weeks and its production build passed. It still left food behind a replenishment rule. A household stopped collecting at exactly two meals each, while kin could only draw stock above that amount. A household between a rich relative and hungry kin therefore blocked the flow. A new three-household regression proved this: the last household received no grain, although the first still held a surplus.

Households now collect two meals each plus one shareable portion, using the existing surplus convention. Available adults can collect. Each person still uses their actual hands, walking route and store capacity. Collection rechecks the home's current total, including carried food. The restock test now expects six portions for two residents: the five-portion target reached through real two-hand loads. All twelve starting portions remain accounted for.

The chain regression failed first (1 failed, 12 passed, exit 1). Then:

```
Test Suites: 4 passed, 4 total
Tests:       63 passed, 63 total
Snapshots:   0 total
Time:        5.197 s, estimated 7 s
Ran all test suites matching test/household_food.test.js|test/survival.test.js|test/tiredness.test.js|test/tasks.test.js.
EXIT_STATUS=0
```

The third candidate's complete results remain in `shots/day-food-third-after-13.json` and `shots/day-food-third-after-7.json`. The earlier successful build is preserved in `shots/day-food-first-build.log`. The affected-gate waiter (PID 2566409) had not started and was cancelled before this source correction. The final gates below cover the corrected candidate.

The fourth candidate (`4a1d85f`) completed both weeks. Its day-7 seed 7 trace still showed 48 portions in the vacant estate while 33 people were hungry. Keeping two meals per donor resident blocked too much food in the connecting households. Kin now keep each donor's next meal. The existing two-meal threshold still controls food requests, and the collection target retains a shareable portion. The protection regressions now put the donor on its last portion, rather than its last two portions.

Collectors also preferred nearby small reserves to the much larger estate. They now use their own inherited estates first, then the greatest reachable kin surplus, then distance. A new regression first selected the small neighbour's store instead of the stocked estate. Both the next-meal and source-choice regressions failed before the correction (2 failed, 13 passed, exit 1).

```
Test Suites: 4 passed, 4 total
Tests:       65 passed, 65 total
Snapshots:   0 total
Time:        5.644 s, estimated 6 s
Ran all test suites matching test/household_food.test.js|test/survival.test.js|test/tiredness.test.js|test/tasks.test.js.
EXIT_STATUS=0
```

The fourth complete comparison remains in `shots/day-food-fourth-after-13.json` and `shots/day-food-fourth-after-7.json`. Its successful build remains in `shots/day-food-second-build.log`. The last queued affected-gate waiter, PID 2576148, was cancelled before it started. A duplicated earlier red-run waiter, PID 2551308, was also cancelled before it started. All stopped PIDs were my own saved lock waiters. No running replay, test, build or server was stopped.

The fifth candidate (`64afa2d`) completed seed 7 with 18 hungry at 18:00 on day 7, compared with 57 before. Its largest evening hunger value fell from 5.08 to 1.92 days. Only the two absent heirs' next meals remained in vacant stores: seven and five portions. The remaining wild plants and collection journeys still matter. These results do not promise a full pantry in every home.

A final regression found that reusing the player's meal task also copied its four-hour order limit onto villagers. That was a new limit on the old NPC rules. A resident with a valid ongoing collection now finishes it. The existing player-order limit stays in place. This regression failed first (`shots/day-food-journey-red.log`, exit 1), then:

```
Test Suites: 4 passed, 4 total
Tests:       66 passed, 66 total
Snapshots:   0 total
Time:        6.909 s
Ran all test suites matching test/household_food.test.js|test/survival.test.js|test/tiredness.test.js|test/tasks.test.js.
EXIT_STATUS=0
```

The final affected gate and replays use this correction. The fifth candidate's complete run files are retained separately. Its successful production build remains in `shots/day-food-third-build.log`.

## Affected gate correction

`flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=379c911 --runInBand` finished with 145 files passing and two failing. The full output appears below.

- `test/play_session_feedback.test.js` exposed a home without any bed component table. The new bedtime path reached an old assumption in `find_place`: `Object.keys(ecs.sleepable)` threw instead of finding no bed. An absent table now means no available beds. Neither saved world can enter this case: both have persistent bed tables. Their completed and running replay evidence remains applicable.
- `test/htn.test.js` still required the removed sequence of separate food searches. Updated that one existing test to require the complete recovery task, its planned held meal and the final fed state. It still checks state passing through compound planning, and now also checks that the input holding map stays unchanged. No existing assertion about gameplay was removed to hide a failure.

The repository policy retains the 145 passing files. The retry uses `--onlyFailures` with the same affected selection. A focused rerun covers the changed meal, bed and storage behaviour. The missing-table correction does not alter any saved-world transition with an existing bed table. The final production build includes it.

The affected retry passed both failed files: 19 tests, exit 0. The focused rerun passed all 66 tests, exit 0. Together with the retained 145 passing files, the affected gate is green: 147 files and 1,446 tests. The existing snapshot also passed.

The earlier production source map did not contain the missing-bed correction. Preserved that build as `shots/day-food-fourth-build.log` and ran the production build on the corrected source. The final source map is checked against that exact correction below.

## Final first-week comparison

Each cell shows before → after. Empty households and hungry people are measured at 18:00. Daytime sleepers are distinct residents sleeping at any hourly sample from 09:00 to before 17:00. The player is excluded.

### Seed 13

42 residents, nine occupied households and one vacant cottage.

| Day | Empty households | Hungry people | Daytime sleepers |
| --- | ---: | ---: | ---: |
| 1 | 6 → 0 | 1 → 1 | 0 → 0 |
| 2 | 6 → 0 | 19 → 1 | 41 → 0 |
| 3 | 6 → 4 | 16 → 0 | 1 → 0 |
| 4 | 7 → 9 | 17 → 0 | 21 → 0 |
| 5 | 7 → 9 | 18 → 3 | 35 → 0 |
| 6 | 8 → 9 | 22 → 7 | 31 → 0 |
| 7 | 8 → 9 | 25 → 14 | 26 → 0 |

### Seed 7

60 residents, thirteen occupied households and two vacant cottages.

| Day | Empty households | Hungry people | Daytime sleepers |
| --- | ---: | ---: | ---: |
| 1 | 10 → 1 | 0 → 0 | 0 → 0 |
| 2 | 11 → 0 | 40 → 1 | 60 → 0 |
| 3 | 11 → 1 | 18 → 1 | 0 → 0 |
| 4 | 11 → 6 | 36 → 3 | 31 → 0 |
| 5 | 11 → 3 | 53 → 7 | 40 → 0 |
| 6 | 11 → 7 | 57 → 10 | 42 → 1 |
| 7 | 11 → 13 | 57 → 15 | 38 → 2 |

Everyone still crosses the ordinary hunger threshold before eating. Distinct daily hungry counts therefore remain 42 and 60 from day 2. The duration changes substantially. The next table sums the hungry residents at each hourly sample. These are sampled resident-hours, not a new game meter.

| Day | Seed 13, before → after | Seed 7, before → after |
| --- | ---: | ---: |
| 1 | 3 → 3 | 0 → 0 |
| 2 | 485 → 88 | 835 → 166 |
| 3 | 217 → 84 | 533 → 146 |
| 4 | 245 → 189 | 617 → 254 |
| 5 | 286 → 253 | 1020 → 254 |
| 6 | 331 → 202 | 1375 → 291 |
| 7 | 538 → 265 | 1375 → 386 |
| Week | 2105 → 1084 | 5755 → 1497 |

### What remains

An empty pantry can belong to fed people who just foraged. More empty pantries at the season end also reflect real consumption of food that previously stayed unused. Both comparisons keep identical arrival state and all 21 idle destinations. No player gift, work or food collection changes either outcome.

Seed 13 ends the last evening with 0 household portions and 21 wild portions. Its largest evening hunger value during the week is 1.46 days.

Seed 7 ends the last evening with 12 household portions and 10 wild portions. Its largest evening hunger value during the week is 1.46 days.

Seed 7 still falls short late in the week. Its two vacant stores hold seven and five portions for the absent heirs' seven- and five-person households. No shareable surplus remains there. The patch does not grant unrelated households ownership of those meals. Some wild food remains away from households. Walking, collection time and routes still matter.

The two saved worlds do not establish balance for every seed or later seasons. The compact history still supplies the recorded arrival stocks, and the detailed fields need their actual 10.5 growing days. No agricultural history was rewritten or stocks granted to obtain the comparison. The observed late requests remain a limit of the result.

## Verification receipts

The execution wrappers captured both output streams, recorded the child status as `EXIT_STATUS`, and returned that status. The excerpts below omit end-of-line padding. The linked logs retain the literal output.

Literal outputs: [affected gate](day-food-affected.log), [affected retry](day-food-affected-retry.log), [focused checks](day-food-final-focused.log), [lint](day-food-lint-final.log), [production build](day-food-build.log).

Runtime commit: `09589b1e441c3056e8eb53320b2d0956043ee9ad`. The final absent-bed correction is inert in these saved worlds, whose bed tables exist throughout the replay. The final production source map contains that correction and `dist/COMMITHASH` names this commit. This repository has no configured typecheck. The final changed-file ESLint command exited 0.

### Affected gate, initial result

`flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=379c911 --runInBand`

```text
FAIL test/play_session_feedback.test.js
  ● walks home physically at night, hides only after arrival and lights actual occupancy; player stays put

    TypeError: Cannot convert undefined or null to object
        at Function.keys (<anonymous>)

      647 |
      648 |   if (filter == "allows_sleep") {
    > 649 |     const available_in_realm = Object.keys(state.ecs.sleepable).filter(id =>
          |                                       ^
      650 |       householdAccess(state.ecs, actorId, id) &&
      651 |       state.ecs.sleepable[id].occupiers.length < state.ecs.sleepable[id].capacity);
      652 |     const home = actualHome(state, actorId);

      at Object.find_place (src/game/tasks.js:649:39)
      at Object.runTask (src/game/htn.js:77:31)
      at updatePlannerFrame (src/game/simulation.js:156:13)
      at src/game/simulation.js:54:71
      at withGardenHelpIndex (src/game/household_routines.js:13:16)
      at src/game/simulation.js:54:57
      at withFenceCache (src/game/fences.js:9:16)
      at updatePlanners (src/game/simulation.js:54:24)
      at stepWorld (src/game/simulation.js:260:5)
      at tick (src/game/simulation.js:301:20)
      at Object.step (src/game/simulation.js:332:11)
      at step (test/support/people.js:46:68)
      at Object.<anonymous> (test/play_session_feedback.test.js:48:3)

{"childExtras":false,"before":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]},"after":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]}}
{"childExtras":true,"before":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]},"after":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]}}
FAIL test/htn.test.js
  ● HTN planning › allows planned world to persist after descent into compound task

    expect(received).toEqual(expected) // deep equality

    - Expected  - 25
    + Received  +  3

      Array [
        Array [
    -     "make_meal_space",
    -   ],
    -   Array [
    -     "find_place",
    -     "container_with gruel",
    -     "container_with",
    -     "gruel",
    -   ],
    -   Array [
    -     "walk_to",
    -     "container_with gruel",
    -   ],
    -   Array [
    -     "pick_up_from_container",
    -     "container_with gruel",
    -     "gruel",
    -   ],
    -   Array [
    -     "forget_place",
    -     "container_with gruel",
    -   ],
    -   Array [
          "set_label",
    +     "eating",
        ],
        Array [
    -     "set_label",
    -     "eating",
    +     "recover_meal",
        ],
        Array [
          "eat",
    -     "gruel",
    +     "meal",
        ],
      ]

      88 |     // NOTE: picking up stored gruel happens inside the first find_food descent;
      89 |     // the second find_food must see that held gruel and eat it at the pickup place.
    > 90 |     expect(plan).toEqual([
         |                  ^
      91 |       ["make_meal_space"],
      92 |       ["find_place", "container_with gruel", "container_with", "gruel"],
      93 |       ["walk_to", "container_with gruel"],

      at Object.<anonymous> (test/htn.test.js:90:18)


Summary of all failing tests
FAIL test/play_session_feedback.test.js
  ● walks home physically at night, hides only after arrival and lights actual occupancy; player stays put

    TypeError: Cannot convert undefined or null to object
        at Function.keys (<anonymous>)

      647 |
      648 |   if (filter == "allows_sleep") {
    > 649 |     const available_in_realm = Object.keys(state.ecs.sleepable).filter(id =>
          |                                       ^
      650 |       householdAccess(state.ecs, actorId, id) &&
      651 |       state.ecs.sleepable[id].occupiers.length < state.ecs.sleepable[id].capacity);
      652 |     const home = actualHome(state, actorId);

      at Object.find_place (src/game/tasks.js:649:39)
      at Object.runTask (src/game/htn.js:77:31)
      at updatePlannerFrame (src/game/simulation.js:156:13)
      at src/game/simulation.js:54:71
      at withGardenHelpIndex (src/game/household_routines.js:13:16)
      at src/game/simulation.js:54:57
      at withFenceCache (src/game/fences.js:9:16)
      at updatePlanners (src/game/simulation.js:54:24)
      at stepWorld (src/game/simulation.js:260:5)
      at tick (src/game/simulation.js:301:20)
      at Object.step (src/game/simulation.js:332:11)
      at step (test/support/people.js:46:68)
      at Object.<anonymous> (test/play_session_feedback.test.js:48:3)

FAIL test/htn.test.js
  ● HTN planning › allows planned world to persist after descent into compound task

    expect(received).toEqual(expected) // deep equality

    - Expected  - 25
    + Received  +  3

      Array [
        Array [
    -     "make_meal_space",
    -   ],
    -   Array [
    -     "find_place",
    -     "container_with gruel",
    -     "container_with",
    -     "gruel",
    -   ],
    -   Array [
    -     "walk_to",
    -     "container_with gruel",
    -   ],
    -   Array [
    -     "pick_up_from_container",
    -     "container_with gruel",
    -     "gruel",
    -   ],
    -   Array [
    -     "forget_place",
    -     "container_with gruel",
    -   ],
    -   Array [
          "set_label",
    +     "eating",
        ],
        Array [
    -     "set_label",
    -     "eating",
    +     "recover_meal",
        ],
        Array [
          "eat",
    -     "gruel",
    +     "meal",
        ],
      ]

      88 |     // NOTE: picking up stored gruel happens inside the first find_food descent;
      89 |     // the second find_food must see that held gruel and eat it at the pickup place.
    > 90 |     expect(plan).toEqual([
         |                  ^
      91 |       ["make_meal_space"],
      92 |       ["find_place", "container_with gruel", "container_with", "gruel"],
      93 |       ["walk_to", "container_with gruel"],

      at Object.<anonymous> (test/htn.test.js:90:18)


Test Suites: 2 failed, 145 passed, 147 total
Tests:       2 failed, 1444 passed, 1446 total
Snapshots:   1 passed, 1 total
Time:        173.16 s
Ran all test suites related to changed files.
EXIT_STATUS=1
```

### Affected gate, failed files only

`flock -w 7200 /tmp/27agents-gate-2.lock npx jest --changedSince=379c911 --onlyFailures --runInBand`

```text

Test Suites: 2 passed, 2 total
Tests:       19 passed, 19 total
Snapshots:   0 total
Time:        1.413 s
Ran all test suites related to changed files.
EXIT_STATUS=0
```

### Focused checks after the gate correction

`flock -w 7200 /tmp/27agents-gate-2.lock npx jest --runInBand test/household_food.test.js test/survival.test.js test/tiredness.test.js test/tasks.test.js`

```text

Test Suites: 4 passed, 4 total
Tests:       66 passed, 66 total
Snapshots:   0 total
Time:        5.021 s
Ran all test suites matching test/household_food.test.js|test/survival.test.js|test/tiredness.test.js|test/tasks.test.js.
EXIT_STATUS=0
```

### Final lint

`npx eslint src/game/household_food.js src/game/compound.js src/game/needs.js src/game/simulation.js src/game/tasks.js src/game/primitive.js scripts/day-food.cjs`

```text
EXIT_STATUS=0
```

### Final production build

`flock -w 7200 /tmp/27agents-gate-2.lock npm run build`

```text

> tinyking@1.0.0 build
> webpack --config webpack.prod.js

app:
  assets by path *.js 3.55 MiB
    asset app.30120576851ba5edb009.js 2.61 MiB [emitted] [immutable] [minimized] [big] (name: app) 1 related asset
    asset vendors.67f5ab9c200a0caba974.js 962 KiB [emitted] [immutable] [minimized] [big] (name: vendors) (id hint: vendor) 2 related assets
    asset runtime.42ef496b93112205a055.js 1.58 KiB [emitted] [immutable] [minimized] (name: runtime) 1 related asset
  asset index.html 479 bytes [emitted] [minimized]
  asset COMMITHASH 40 bytes [emitted]
  asset LASTCOMMITDATETIME 25 bytes [emitted]
  asset VERSION 19 bytes [emitted]
  Entrypoint app [big] 3.55 MiB (7.57 MiB) = runtime.42ef496b93112205a055.js 1.58 KiB vendors.67f5ab9c200a0caba974.js 962 KiB app.30120576851ba5edb009.js 2.61 MiB 3 auxiliary assets
  orphan modules 467 KiB [orphan] 134 modules
  runtime modules 3.9 KiB 9 modules
  javascript modules 5.24 MiB
    modules by path ./node_modules/ 3.82 MiB 123 modules
    modules by path ./src/ 1.42 MiB
      modules by path ./src/game/*.js 913 KiB 93 modules
      modules by path ./src/components/*.js 79.5 KiB 6 modules
      modules by path ./src/data/ 1.16 KiB 2 modules
      ./src/index.js + 65 modules 330 KiB [built] [code generated]
      ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss 128 KiB [built] [code generated]
  json modules 1.8 MiB
    ./src/data/event_types.json 16.4 KiB [built] [code generated]
    ./src/data/crops.json 80 bytes [built] [code generated]
    ./src/data/secret_activities.json 1.01 KiB [built] [code generated]
    ./src/data/conversation_lines.json 1.78 MiB [built] [code generated]

  WARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).
  This can impact web performance.
  Assets:
    app.30120576851ba5edb009.js (2.61 MiB)
      Largest modules: ./src/data/conversation_lines.json (1.78 MiB), ./src/index.js + 65 modules (330 KiB), ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss (128 KiB)
    vendors.67f5ab9c200a0caba974.js (962 KiB)
      Largest modules: ./node_modules/three/build/three.core.js (1.39 MiB), ./node_modules/@fortawesome/free-solid-svg-icons/index.es.js (696 KiB), ./node_modules/three/build/three.module.js (647 KiB)

  WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
  Entrypoints:
    app (3.55 MiB)
        runtime.42ef496b93112205a055.js
        vendors.67f5ab9c200a0caba974.js
        app.30120576851ba5edb009.js

  WARNING in webpack performance recommendations:
  You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
  For more info visit https://webpack.js.org/guides/code-splitting/

  app (webpack 5.112.2) compiled with 3 warnings in 20853 ms

save-worker:
  asset save-worker.js 11.7 KiB [emitted] [minimized] (name: main) 1 related asset
  orphan modules 57.5 KiB [orphan] 13 modules
  ./src/game/save_worker.js + 11 modules 60 KiB [built] [code generated]
  save-worker (webpack 5.112.2) compiled successfully in 721 ms
EXIT_STATUS=0
```

## Reproduction and retained evidence

Run `flock -w 7200 /tmp/27agents-gate.lock node scripts/day-food.cjs 13 shots/replay-13.json`, or use seed 7 under the other lock. The driver reads the existing saved world and plays three idle visits each day for seven days. All baseline and final replay commands exited 0. No new world was generated. No server port was opened. No push or stash was used. All writes stayed in this worktree.

`shots/day-food-evidence.json` holds daily results, stock locations, owner identities and all idle destinations. The `shots/day-food-*.json.gz` files preserve full hourly records and all intermediate versions. The uncompressed files remain in this worktree. These files are diagnostic observations of real simulation runs. Only unit tests use small labelled fixtures.
