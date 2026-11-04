# The day spent with people: simulation report

Work in progress. The idea is not yet proved. The first change makes simulation time independent of rendering. The following changes add three daily choices through existing tasks and social rules. Evidence and remaining limits will be recorded here as each run finishes.

Base: `a2c0cba`. Branch: `day-with`. No delegation, push, shared dependency writes or writes outside this worktree.

## Evidence in progress

- Dependency setup: `npm ci` started first. Private install in this worktree.
- Read the game instructions, verification policy, social and conversation docs, the design direction and the week-levers research.
- Raw logs: `.cache/day-with/`.

## Fixed clock

The browser accumulates frame time and runs complete one-minute game steps. Sleep acceleration runs those same steps. Headless callers can run one step with `simulation.tick()`. The saved clock retains partial frame credit.

The new regression first failed: the same seed and gift order at 10 ms and 100 ms produced different event dates and positions. After the change, a full week produces identical event records, end time and food totals. Small fixtures supply initial people and stores. Gifts, routes, visits, needs and seasons run through real systems.

`flock -w 7200 /tmp/27agents-gate-2.lock npx jest --runTestsByPath test/fixed_simulation.test.js test/simulation.test.js test/player_day.test.js --runInBand` exited 0:

```text
Test Suites: 3 passed, 3 total
Tests:       17 passed, 17 total
Snapshots:   0 total
Time:        23.509 s
Ran all test suites within paths "test/fixed_simulation.test.js", "test/simulation.test.js", "test/player_day.test.js".
```

`npx eslint src/game/simulation.js` exited 0 with no output. Two old assertions now allow partial minutes to accumulate. Other assertions remain intact. This JavaScript repository has no typecheck command or TypeScript configuration.

`npm ci` exited 0: added 1,056 packages and audited 1,057 in three minutes. No package file changed.

## Day layer in progress

`slotChoices(game)` returns the current day, slot, end time, discovered places, people present or walking there, and activity choices. Every activity includes an availability reason. It reads discovery and spoken offers without granting knowledge.

`playSlot(game, choice, hooks)` validates the current choice, queues real orders and runs fixed simulation steps. `hooks.chooseLine(game, lines, choice)` selects a real authored line. The default uses visible matches and learned tastes. Results include newly known events, learned facts, directional regard changes, conversations and unfinished tasks. Evening ends with a real rest order through dawn. Native seasonal transitions continue.

The social-rule tests first failed because the intervention module did not exist. The day tests first failed because the day module did not exist. The first implemented pass exposed a floating-point slot boundary and a half-hour contact boundary. Both now allow the existing small clock tolerance. Tests then passed: 17 tests across two files. Additional harvest and season tests are running.

The first seed-13 batch is a diagnostic run. The final batch will use the frozen source after fixes demonstrated by tests or this run.

## Rules added

Making peace requires Personal trust from both people towards the helper, within each person's fixed disposition cap. The helper must know the quarrel and must complete a conversation with each party after it. A successful request expires avoidance and creates ordinary visit plans. The request records no reconciliation. The next real contact uses the existing `reconcile` action and its seasonal attempt record.

Introducing two people requires the same trust, existing partner eligibility, compatible orientation, willingness, free time, satisfied needs and routes. It creates the same visit plans as autonomous visits. A completed half-hour contact calls the existing `courtTogether` clock with fractional season time. The existing consent, waiting period and housing checks still control marriage.

A discovered place also permits a visit when nobody can stop. This runs a real movement order and discovers ground through normal walking. A regression first failed for this case before that option was added. It prevents a quiet or tired village from blocking the calendar.

Harvest evidence initially expected both grains in the pantry. The real favour gives one grain to the helper as gleaning. The corrected assertion accounts for both real grains and their owners.

The first seed-13 diagnostic generated its starting state in 367,886 ms, then failed to finish its first slot. I stopped only its saved Node PID. Its log and the unchanged generated state remain cached. A regression confirmed that the default line picker repeated already-spoken fallback lines. The default and research policies now end when no fresh line remains. This uses the actual conversation's spoken IDs, with no arbitrary turn limit. The corrected batch reuses the same starting graph.

A live sample identified the second delay: `chatChoices` repeatedly called `reasonGone` and `householdFood`. The new small-world regression counted 298 full inventory scans for one choice query. `withFavourQuery` now shares one read snapshot within that synchronous query and discards it before speech or delivery. The regression also checks repeated choices and changed stores. Affected chat, favour, day and intervention tests pass: 111 tests in four files. The stopped slow run is retained separately. This correction changes query cost, not the food or conversation rules.

The first complete seed-13 baseline reached day value 14.25 after 42 slots. It recorded 259 visits, 22 quarrels, 17 reconciliations, three births, two deaths and one marriage. The learned game uses only the first player's known quarrel and spoken needs. Raw community events are not supplied as player knowledge.

The first survey pilot exposed a policy error: an empty target list from a quiet first slot prevented later target selection. A failing policy regression reproduced this. The correction reconsiders targets after people become visible. The pilot was stopped by its recorded PID. Its initial seed-1 graph and partial log are retained. The correction does not change seed 13's remembered, non-empty target list or simulation rules.

Extracting the helpful policy into a testable research module initially omitted its pair-key helper. The regression caught this. A survey build that started before that check finished still contained the omission. I stopped its saved Node PID and retained its partial log. The final survey pipeline now requires the policy check to pass before building and playing. This changes the research driver only. Seed 13's in-memory policy retains the original helper and its non-empty remembered targets.

The first affected gate ran 143 related files. It retained 1,379 passing tests and exposed nine failing files, including the new explicit-clock regression. The old headless calls with zero wall time accidentally received sleep presentation acceleration. Arrival presentation and already-completed travel inputs also needed handling outside the fixed game clock. Those paths now preserve their original meaning. Existing observation tests now advance one complete quantum, or observe actual edge-task execution instead of sampling a transient task after a six-minute frame. Their outcome assertions remain.

The failed seasonal tests then exposed an exact boundary: the hourly stamp was `6.999999999999999`, so the local ageing check still saw the previous season. A new regression first failed on that value. Fresh clocks now align with the world hour and hourly stamps use exact hour boundaries. This can alter real seasonal schedules, so the earlier seed-13 games and partial surveys are retained as pre-correction evidence. The final proofs will be repeated on the corrected clock.

A repeated affected gate is justified here because canonical hour dates feed the NPC planner's seeded schedules, weather and season rules throughout the import graph. It remains `--changedSince=a2c0cba`, not a whole-suite command.
