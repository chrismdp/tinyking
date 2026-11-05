# Day food investigation

The village has food, but some of it is held in homes that the people who need it cannot use. I am tracing the saved worlds before changing the rules. This report will record the causes, the fixes and the first-week comparison.

## Controls and setup

- Worktree: `/home/cp/code/tk-dayfood`, branch `day-food`, base `379c911`.
- `npm ci`: exit 0; 1,056 packages installed in 10 seconds. npm reported peer-version warnings and 19 dependency vulnerabilities. No dependency changes made.
- Read `CLAUDE.md`, the verification, social, survival and settlements documents, and the research design and hunger findings.
- Use only the saved worlds `.cache/play/initial-13.bin` and `initial-7.bin`. No generation, extra food or player help.
- `scripts/day-food.cjs` uses the real `slotChoices` and `playSlot`. Each part of each day the player visits reachable empty ground, then takes the day layer's normal night rest. All places are revealed as in `scripts/day-play.cjs`.
- Empty households means occupied households with fewer than one portion at 18:00. Hungry means distinct residents above the existing 0.9 hunger threshold at any hourly sample that calendar day. Daytime asleep means distinct residents sleeping at an hourly sample from 09:00 up to, but excluding, 17:00. The player is excluded. The arrival day begins at 09:00; the others have 24 samples.
- Heavy runs use the two named shared gate locks. No server ports or external processes are needed by this replay driver.

## Investigation in progress

Baseline, regression tests, fixes and gate receipts follow as the work completes.

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

## Fixes under test

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

The lane house contains Felice and William Frifoblo, close kin of Ralph Frifoblo in the four-person house. The orchard house contains his sister Alice. Ralph's household starts with nine portions for four. At most one portion is surplus above its two-meal reserve. Kin sharing can help briefly, but cannot make this family a lasting food source.

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
