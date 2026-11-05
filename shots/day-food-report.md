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
