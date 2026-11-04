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
