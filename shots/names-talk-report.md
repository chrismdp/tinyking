TinyKing names and conversation changes are in progress on `names-talk`, starting at `f417ff0a1841ea5ec79825c809a395dcf62b9ecc`.

The work will reserve full names across living people and remembered people. It will also bind the keeping question to the listener and keep it available under Family and Moods alongside required answers.

Rules and scope:

- Preserve family names and deterministic results for a given seed.
- Cover founding history, village families, settlers, births, player arrivals, maternal reference people and succession strangers.
- Use the listener's existing person reaction, including dislike of talking about themselves.
- Keep required answers before the keeping question in the four choices.
- Run narrow failing tests before each implementation, the affected Jest gate and one production build under shared locks.
- Generate seed 13 through `generateWorldGame`, with the game's CSV loading behaviour, and count every person in the world directory.

Setup: `npm ci` exited 0. It installed 1,056 packages in 15 seconds. npm reported existing peer/engine warnings and 19 dependency vulnerabilities. No dependency versions were changed.

Evidence and exit statuses will be added below. No sub-agents, other branches, outside-worktree writes, pushes or shared stash operations are part of this work.

Current limits: acceptance evidence is pending. This builder will not repeat the independent browser acceptance pass.

Preparation: name lists moved from CSV to JSON without changing any rows, including the loader's final empty row. Name allocation now needs these lists in simulation code, which Jest imports directly. JSON lets both Jest and the browser load the same data without adding a test transformer or changing the shared test configuration. Existing name-list mocks now target JSON. This is a data-format change only.

`flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/names.test.js test/character_names.test.js` exited 0. Literal output: `shots/names-data-check.log`.
