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
