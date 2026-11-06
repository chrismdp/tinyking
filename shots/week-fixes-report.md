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
