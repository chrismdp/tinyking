# Week fixes

Work in progress. This build repairs the conversation routes for promises, stalled replies, morning rest, interrupted deliveries, stale news and guidance, and the player's family knowledge and answers.

Baseline: `dc3b6ca`, branch `week-fixes`. Read the full week-play report, project guidance, conversations, favours, and the research design section about spending the day with people. Issues 7 and 12 remain outside this job.

## Checks

`npm ci`: exit 0. Installed 1,056 packages in 11 seconds. Reported peer dependency warnings, one old engine requirement, and 19 audit vulnerabilities. Dependencies stay inside this worktree.

Narrow regression logs below retain failures before implementation. Each heavy command uses a shared gate lock. No whole suite is run.

## Promise routes and replies

The carry-word failure came from the disclosure audience rule. A giver's relative can live outside the deceased person's family and village. The named recipient now qualifies for that accepted promise. Sealed events and ordinary trust rules still apply. Tell keeps the event available through a subject filter and names the giver's promise.

Peace asks now offer a follow-up under Help, News and Family. The response and journal share the current trust, contact and timing requirements. The meeting still needs the existing consent and physical visit rules.

Personal acceptance had no matching NPC catalogue acknowledgements. Added acknowledgements for all four personal ask kinds. A spent subject now leaves other subjects available. A missing ordinary reply uses an authored acknowledgement.

Initial regression command: `flock -w 7200 /tmp/27agents-gate.lock npx jest test/asks.test.js test/chat_interventions.test.js --runInBand`, exit 1. Literal output: [01-red.log](week-fixes/01-red.log). The follow-up run exposed a timing error in the new test: an explanation icon could itself improve trust. Explanations now use no icons. [01-green.log](week-fixes/01-green.log), exit 1.

Acceptance regression command: `flock -w 7200 /tmp/27agents-gate.lock npx jest test/asks.test.js test/chat_answers.test.js --runInBand`, exit 1. Literal output: [02-red.log](week-fixes/02-red.log). The broader follow-up exposed an invalid death fixture whose target already knew the news, corrected by declaring its initial audience. [02-green.log](week-fixes/02-green.log), exit 1.

## Rest and interrupted deliveries

Rest chosen during automatic sleep queued a second Rest. That queued sleep started after dawn. Rest now uses the sleep already underway. The morning note also states whether the player slept rough and whether a late or missed night limited recovery. Shelter changes the recovery rate. Weather does not cap energy in this code.

The first two narrow sleep probes did not reproduce the defect. Their exits were 0: [03-red.log](week-fixes/03-red.log), [03-dawn-red.log](week-fixes/03-dawn-red.log). The automatic-sleep plus Rest regression then failed as expected, exit 1: [03-repeat-red.log](week-fixes/03-repeat-red.log).

Movement, chat, meals and other ordinary orders now remove favour work from the queue while keeping its accepted promise. Gathering the requested food or wood still runs before delivery. The journal offers Resume delivery for work set aside. Explicit cancellation still ends the promise. Borrowed harvest is released at the player's position, preserving its owner and completed work. Expired needs remove their waiting task and show a notice.

Delivery regressions failed before implementation, exit 1: [04-red.log](week-fixes/04-red.log). The first combined run failed eight old expectations, exit 1: [04-green.log](week-fixes/04-green.log). Updated replacement tests to require an open promise, and retained explicit cancellation, ownership and no-reward assertions. The final narrow command passed: `flock -w 7200 /tmp/27agents-gate.lock npx jest test/player_day.test.js test/core_loop.test.js test/favours.test.js --runInBand`, exit 0. Literal output: [04-followup.log](week-fixes/04-followup.log), 85 tests passed.

## News, family and the player's own answers

A spoken whereabouts account now checks later travel known to its speaker. An older return cannot become a current-news opener after a known departure. Ordinary Tell cards can still tell dated past events.

The mother now starts with a named identity. The sealed father and royal history remain undisclosed. The player's home answers resolve the current household or completed shelter, rather than every owned camp. The arrival question offers a direct answer about growing up with Mother and coming to find her family. Refusal remains a choice.

The first regressions failed, exit 1: [05-07-red.log](week-fixes/05-07-red.log). Two initial fixture problems were corrected: the origin story needed its relatives array, and the news test had checked candidates after the opener had already consumed the return. The corrected regressions failed on all three behaviours, exit 1: [05-07-red-followup.log](week-fixes/05-07-red-followup.log).

## Notices and current guidance

Phone notices hide while a control sheet is open and return when it closes. The notice stack has a bounded height. This is checked in the browser, with no layout or copy tests.

Delivery guidance now needs a live favour task. A personal promise or work set aside does not ask the player to wait for an absent delivery. Approach failures caused by availability read the neighbour's current needs.

Guidance regressions failed, exit 1: [08-red.log](week-fixes/08-red.log). Mother and guidance regressions passed, exit 0: [06-08-green.log](week-fixes/06-08-green.log), 25 tests.

## Follow-up findings during build and play

A new multiple-promise regression found that request-bound lines shared a spoken ID. One follow-up could hide another ask in the same chat. Request-bound lines now qualify their IDs with the request, as event lines already did. The initial test assumed a fixed choice order. The corrected test follows the visible ask and then asks about the remaining one. Both failures are preserved: [01-multiple-red.log](week-fixes/01-multiple-red.log), [01-multiple-red-followup.log](week-fixes/01-multiple-red-followup.log), exits 1. The fix passed 54 tests: [01-multiple-green.log](week-fixes/01-multiple-green.log), exit 0.

The truthful origin answer initially inherited the refusal's guarded acknowledgement. Play showed the mismatch. A regression failed before correcting that reply purpose: [07-origin-reply-red.log](week-fixes/07-origin-reply-red.log), exit 1.

The mother's record is off-map. The subject chooser previously filtered to local ECS records. A failing eligibility regression confirmed that missing route: [06-subject-red.log](week-fixes/06-subject-red.log), exit 1. The chooser now uses the same permitted person facts as speech. Father and sealed history stay hidden.

The combined follow-up passed 50 tests: [06-07-followup-green.log](week-fixes/06-07-followup-green.log), exit 0. The earlier news/home/origin run preserved one origin failure: [05-07-green.log](week-fixes/05-07-green.log), exit 1. Its news and current-home tests passed.

The first affected-gate shell ended with tool exit 143 before it wrote any Jest output. This is a terminated shell receipt, not a Jest result. Its empty log is [affected.log](week-fixes/affected.log). The command was rerun under the lock.

## Gate and production build

The affected gate used the required command under its lock:

```text
flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=dc3b6ca --runInBand
```

Exit 1. Complete literal output: [affected-rerun.log](week-fixes/affected-rerun.log).

```text
Test Suites: 2 failed, 150 passed, 152 total
Tests:       3 failed, 1531 passed, 1534 total
Snapshots:   1 passed, 1 total
Time:        254.359 s
Ran all test suites related to changed files.
```

The multiple-ask failure was corrected as described above. Two old peace tests checked the words “conversation” and “Personal”. Those assertions now test the blocking behaviour: a reason is returned, a meeting attempt is refused, and no visit starts. The fixed hate cap and all other original assertions remain. This follows the instruction to avoid copy tests.

Retained the 150 passing files. Reran the two failed files and five files exposed to the final speech, subject eligibility and request-ID changes:

```text
flock -w 7200 /tmp/27agents-gate.lock npx jest test/social_interventions.test.js test/chat_interventions.test.js test/chat_answers.test.js test/mother_family.test.js test/chat_tell.test.js test/chat_row_rules.test.js test/conversation_rungs.test.js --runInBand

Test Suites: 7 passed, 7 total
Tests:       100 passed, 100 total
Snapshots:   0 total
Time:        19.413 s, estimated 23 s
Ran all test suites matching test/social_interventions.test.js|test/chat_interventions.test.js|test/chat_answers.test.js|test/mother_family.test.js|test/chat_tell.test.js|test/chat_row_rules.test.js|test/conversation_rungs.test.js.

Exit status: 0
```

Literal receipt: [affected-repairs.log](week-fixes/affected-repairs.log). No whole-suite gate ran. This JavaScript repo has no typecheck script or TypeScript configuration. ESLint covered all changed source and the observation driver: exit 0, [lint-final.log](week-fixes/lint-final.log). Earlier source lint also exited 0: [lint.log](week-fixes/lint.log).

One production build: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`, exit 0. Complete literal output: [build.log](week-fixes/build.log). Webpack reported three bundle-size warnings. The app compiled in 29,521 ms and the save worker in 910 ms.

A final path check found that `do_favour` could expire its own request before the hourly updater. That path bypassed the new queue cleanup. A new regression failed first: [04-task-expiry-red.log](week-fixes/04-task-expiry-red.log), exit 1. Both expiry paths now use the same cleanup and notice. The complete favour, player-day and energy files passed, 86 tests: [04-task-expiry-green.log](week-fixes/04-task-expiry-green.log), exit 0.

This demonstrated runtime correction landed after the first production build. A second build is required to cover it. This is the only repeated production build, caused by a concrete missed expiry path rather than a routine repeat.

Final correction build: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`, exit 0. Literal output: [build-final.log](week-fixes/build-final.log). The same three bundle-size warnings remain. App compilation took 35,091 ms and the save worker 2,762 ms. Final expiry source lint exited 0: [lint-expiry.log](week-fixes/lint-expiry.log). Driver syntax check exited 0: [driver-check.log](week-fixes/driver-check.log).

## UI play, seed 13

Used the real 3D game at `http://localhost:8175/?seed=13`. The observer is based on `scripts/talk-3d-observe.cjs`. Choices click actual rendered buttons. Time advances through Normal speed and Rest. The driver does not call simulation steps or set game outcomes. Read-only inspections supply receipts and known people or ground for navigation. It also saves through the existing autosave interface before a browser reload, so the remaining observations use the frozen candidate without replacing the played world. These two navigation/save commands are labelled `inspect` in the raw driver log but are explicitly recorded here as actions.

The first browser startup command was issued twice while startup was pending. The second Start command timed out because its menu was already hidden. This was a driver error. The early browser closed normally. The final play starts a fresh seed-13 game, then continues that same saved game after reloading the frozen code. Failed selectors and actual results remain in [focused-session.json](week-fixes/focused-session.json).

At 09:03, before any conversation, [the phone family tree](week-fixes/d1-mother-known-phone.png) names Dionisia Seesi and shows 2 of 4 names known. Hugh's first chat offers the [direct origin answer and the optional refusal](week-fixes/d1-honest-origin.png).

At 09:48, Hugh recognises William and tells him that Agnes Friforrin died. He asks William to tell Margaret. William accepts and Hugh acknowledges the promise. [Acceptance](week-fixes/d1-word-accepted.png). Margaret is nearby. Her Tell choices show [the exact death message linked to Hugh's promise](week-fixes/d1-word-offered-tell.png). William tells her and she replies, “I hadn't heard that.” [Telling the news](week-fixes/d1-word-told.png). The simulation completes the promise at 10:00 and gives Hugh +10 goodwill. The [journal at 11:21](week-fixes/d1-word-completed.png) records that the news reached her. The speech and event receipts are in the driver log.

The first phone preview showed that the ground menu is a `.popper` beside `#ui`, rather than a sheet inside it. Its Build shelter control was clickable, but a second notice at dawn could still cover it. Extended the notice rule to that actual menu. The initial preview is retained as [phone-shelter-controls-uncovered.png](week-fixes/phone-shelter-controls-uncovered.png). A final phone screenshot below checks the corrected selector. This layout-only fix needs a third production build. The extra builds are recorded because each followed a demonstrated gap.

The final layout build passed: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`, exit 0. Literal output: [build-layout-final.log](week-fixes/build-layout-final.log). It retained the same three bundle-size warnings. App compilation took 31,464 ms and the save worker 823 ms. No further runtime changes follow this build.
