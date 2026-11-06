# Week fixes

This build repairs the eight requested areas. Test-first regressions cover promise routes, replies, rest, interrupted work, whereabouts, family knowledge, own-life answers and current guidance. Seed-13 play delivered the death message, kept a visit promise through a walk, explained a peace step, woke after the first night, and reached the phone shelter control. Adam's food need expired before delivery. Successful physical resumption has test evidence but no UI completion in this play. Issues 7 and 12 remain unchanged.

Baseline: `dc3b6ca`, branch `week-fixes`. Read the full week-play report, project guidance, conversations, favours, and the research design section about spending the day with people. Issues 7 and 12 remain outside this job.

## Acceptance evidence

| Fix | Test evidence | Play evidence and limits |
| --- | --- | --- |
| Carry word | `asks.test.js`, `chat_tell.test.js` | Margaret hears Agnes's death. Hugh's promise completes for +10. |
| Peace next step | `chat_interventions.test.js`, `ask_journal.test.js` in affected gate | Margaret accepts the promise and explains the trust condition. The journal shows the same words. No peace was forced. |
| NPC replies | `asks.test.js`, `chat_answers.test.js` | Word, visit and peace acceptance receive NPC acknowledgements. Choices return. |
| Night rest | `player_day.test.js`, `core_loop.test.js` | Day 2 is awake with no Rest task. The morning note explains energy 83 after a late night. Precise dawn is tested. |
| Set work aside and expire needs | `favours.test.js`, `player_day.test.js` | Move keeps Adam's promise open. Fair expiry clears delivery. A walked visit to Hugh completes for +6. Physical resumption completes in tests. |
| Latest whereabouts | `chat.test.js` | The exact old-return/later-departure exchange was not reproduced in this run. Its speaker-knowledge regression passes. |
| Know Mother | `mother_family.test.js` | Dionisia is named in the first family tree and in the subject chooser. |
| Own-life answers | `chat_answers.test.js` | The direct origin answer is offered and chosen. Current completed-home eligibility is tested. No shelter was completed in play. |
| Phone notices and current guidance | `chat_guidance.test.js` plus browser check | Notices hide for the ground menu. Build shelter receives the click. Expired food work does not leave a delivery waiting. Meal-availability refresh is tested. |

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

Initial production build: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`, exit 0. Complete literal output: [build.log](week-fixes/build.log). Webpack reported three bundle-size warnings. The app compiled in 29,521 ms and the save worker in 910 ms.

A final path check found that `do_favour` could expire its own request before the hourly updater. That path bypassed the new queue cleanup. A new regression failed first: [04-task-expiry-red.log](week-fixes/04-task-expiry-red.log), exit 1. Both expiry paths now use the same cleanup and notice. The complete favour, player-day and energy files passed, 86 tests: [04-task-expiry-green.log](week-fixes/04-task-expiry-green.log), exit 0.

This demonstrated runtime correction landed after the first production build. A second build is required to cover it. This repeat covers the concrete missed expiry path. A later layout-only repeat is recorded below.

Final correction build: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`, exit 0. Literal output: [build-final.log](week-fixes/build-final.log). The same three bundle-size warnings remain. App compilation took 35,091 ms and the save worker 2,762 ms. Final expiry source lint exited 0: [lint-expiry.log](week-fixes/lint-expiry.log). Driver syntax check exited 0: [driver-check.log](week-fixes/driver-check.log).

## UI play, seed 13

Used the real 3D game at `http://localhost:8175/?seed=13`. The observer is based on `scripts/talk-3d-observe.cjs`. Choices click actual rendered buttons. Time advances through Normal speed and Rest. The driver does not call simulation steps or set game outcomes. Read-only inspections supply receipts and known people or ground for navigation. It also saves through the existing autosave interface before a browser reload, so the remaining observations use the frozen candidate without replacing the played world. These two navigation/save commands are labelled `inspect` in the raw driver log but are explicitly recorded here as actions.

The first browser startup command was issued twice while startup was pending. The second Start command timed out because its menu was already hidden. This was a driver error. The early browser closed normally. The final play starts a fresh seed-13 game, then continues that same saved game after reloading the frozen code. The final play log retains its failed selectors and actual results: [focused-session.json](week-fixes/focused-session.json). The earlier startup error is documented here.

At 09:03, before any conversation, [the phone family tree](week-fixes/d1-mother-known-phone.png) names Dionisia Seesi and shows 2 of 4 names known. Hugh's first chat offers the [direct origin answer and the optional refusal](week-fixes/d1-honest-origin.png).

At 09:48, Hugh recognises William and tells him that Agnes Friforrin died. He asks William to tell Margaret. William accepts and Hugh acknowledges the promise. [Acceptance](week-fixes/d1-word-accepted.png). Margaret is nearby. Her Tell choices show [the exact death message linked to Hugh's promise](week-fixes/d1-word-offered-tell.png). William tells her and she replies, “I hadn't heard that.” [Telling the news](week-fixes/d1-word-told.png). The simulation completes the promise at 10:00 and gives Hugh +10 goodwill. The [journal at 11:21](week-fixes/d1-word-completed.png) records that the news reached her. The speech and event receipts are in the driver log.

The first phone preview showed that the ground menu is a `.popper` beside `#ui`, rather than a sheet inside it. Its Build shelter control was visible below the single notice, but a second notice at dawn could still cover it. Extended the notice rule to that actual menu. The initial preview is retained as [phone-shelter-controls-uncovered.png](week-fixes/phone-shelter-controls-uncovered.png). A final phone screenshot below checks the corrected selector. This layout-only fix needs a third production build. The extra builds are recorded because each followed a demonstrated gap.

The final layout build passed: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`, exit 0. Literal output: [build-layout-final.log](week-fixes/build-layout-final.log). It retained the same three bundle-size warnings. App compilation took 31,464 ms and the save worker 823 ms. No further runtime changes follow this build.

At 11:57, Adam Thuson asks for three portions. The [offer also shows Dionisia in Ask about](week-fixes/mother-in-subjects-and-food-offer.png) after loading the corrected subject chooser. William accepts. A first attempt to click Move here failed because selecting the already selected ground closed its menu. The driver then invokes the same public Move here UI action. At 13:01, movement has reached the selected ground and Adam's promise remains accepted. [Open promise after movement](week-fixes/d1-moved-food-promise-still-open.png). The earlier [waiting card](week-fixes/d1-walk-keeps-food-promise.png) predates the successful move and is not completion evidence.

William gathers two berries. His hands fill before the third. At 16:00, the household meets its own need. Adam's ask expires without goodwill. The delivery task is absent, and the notice explains that the food is no longer needed. The unrelated Forage task keeps its own hands-full message. [Lapsed request](week-fixes/d1-need-lapsed-notice-and-journal.png). This proves fair expiry and queue cleanup in play. It does not prove successful delivery after setting work aside.

The phone screenshot and request receipts also show limits in this attempt: I did not complete the shelter, and Adam's three-portion need was met before I resumed delivery. Two berries fill the player's hands. I kept that failed delivery attempt and its expiry result rather than granting food or extending the need.

At 16:40, Emmeline gives a spoken food lead to Geoffrey Jobari in the north-west. I follow that visible referral for the delivery check. I do not inspect hidden needs to choose a requester.

The Geoffrey food follow-up did not yield an accepted request. He required an introduction, then refused the offered help on trust grounds. His regard reached -5.25 from the existing introduction/help rules and matches. The next Chat refused before walking. This is the deferred regard problem from issue 7. It remains unchanged. No goods, trust or requests were granted to get past it.

## Check receipts

Every test below ran through one of the two gate locks. The linked logs contain literal output. Earlier failures remain in the record.

| Log | Exit | Scope |
| --- | ---: | --- |
| [01-red.log](week-fixes/01-red.log) | 1 | Carry word and peace routes |
| [01-green.log](week-fixes/01-green.log) | 1 | Carry word and peace routes |
| [02-red.log](week-fixes/02-red.log) | 1 | Personal acknowledgements and answers |
| [02-green.log](week-fixes/02-green.log) | 1 | Asks, meetings and answers |
| [02-followup.log](week-fixes/02-followup.log) | 0 | Asks and meetings |
| [03-red.log](week-fixes/03-red.log) | 0 | Initial rest probe |
| [03-dawn-red.log](week-fixes/03-dawn-red.log) | 0 | Initial dawn probe |
| [03-repeat-red.log](week-fixes/03-repeat-red.log) | 1 | Rest during automatic sleep |
| [04-red.log](week-fixes/04-red.log) | 1 | Order interruption and expiry |
| [04-green.log](week-fixes/04-green.log) | 1 | Favours, rest and energy |
| [04-followup.log](week-fixes/04-followup.log) | 0 | Favours, rest and energy |
| [05-07-red.log](week-fixes/05-07-red.log) | 1 | News, mother and own answers |
| [05-07-red-followup.log](week-fixes/05-07-red-followup.log) | 1 | Corrected news and own-answer fixtures |
| [05-07-green.log](week-fixes/05-07-green.log) | 1 | News passed, origin reply still failed |
| [06-08-green.log](week-fixes/06-08-green.log) | 0 | Mother and guidance |
| [08-red.log](week-fixes/08-red.log) | 1 | Guidance and availability |
| [01-multiple-red.log](week-fixes/01-multiple-red.log) | 1 | Multiple accepted promises |
| [01-multiple-red-followup.log](week-fixes/01-multiple-red-followup.log) | 1 | Multiple promises, visible choice order |
| [01-multiple-green.log](week-fixes/01-multiple-green.log) | 0 | Promises, answers and Tell |
| [07-origin-reply-red.log](week-fixes/07-origin-reply-red.log) | 1 | Truthful answer reply purpose |
| [06-subject-red.log](week-fixes/06-subject-red.log) | 1 | Off-map mother in subjects |
| [06-07-followup-green.log](week-fixes/06-07-followup-green.log) | 0 | Mother, answers and meetings |
| [affected-rerun.log](week-fixes/affected-rerun.log) | 1 | Required affected gate |
| [affected-repairs.log](week-fixes/affected-repairs.log) | 0 | Failed files and speech files exposed to final changes |
| [04-task-expiry-red.log](week-fixes/04-task-expiry-red.log) | 1 | Expiry inside physical delivery |
| [04-task-expiry-green.log](week-fixes/04-task-expiry-green.log) | 0 | Favours, rest and energy after final logic change |
| [build.log](week-fixes/build.log) | 0 | Initial production build |
| [build-final.log](week-fixes/build-final.log) | 0 | Production build after delivery expiry correction |
| [build-layout-final.log](week-fixes/build-layout-final.log) | 0 | Production build after actual phone menu correction |
| [lint.log](week-fixes/lint.log) | 0 | Changed source |
| [lint-final.log](week-fixes/lint-final.log) | 0 | Changed source and driver |
| [lint-expiry.log](week-fixes/lint-expiry.log) | 0 | Final expiry source |
| [driver-check.log](week-fixes/driver-check.log) | 0 | Observer syntax |

The empty first affected log came from a shell terminated with tool exit 143 before Jest output. No child Jest exit is inferred.

The first Rest starts late after the approach driver left time running. William reaches camp after midnight. On Day 2 at 11:06 he is awake, with no Rest job and no forced-rest flag. The night task records 5.55 hours of sleep, then ordinary idle time. Energy is 83. The morning note explains the rough bed and late-night limit. [Awake on Day 2](week-fixes/d2-awake-after-night.png). The driver waited a fixed twelve game hours, so this screenshot does not capture the precise dawn minute. The regression tests capture dawn directly.

On Day 2, the [390-pixel ground menu](week-fixes/d2-phone-notices-clear-ground-controls.png) hides both daily notices. A browser hit check reports `notices: "none"`, `popup: "visible"`, and the Build shelter button at the pointer hit point. The actual Build shelter click succeeds. This creates an unfinished shelter site. The phone uses mouse and keyboard emulation, not touch hardware.

Humphrey has no recent trouble to discuss on Day 2. Margaret's first approach expires after an hour from the distant camp. The game offers Move closer. I follow that recovery action. The driver originally left Normal running after failed approaches, so some extra game time passed during selector errors. Later approach checks explicitly pause at a time boundary. These are preserved observation limits, not invented simulation outcomes.

The observer also exposes recent global events and NPC availability. Margaret's recorded quarrel was a diagnostic cue for choosing her follow-up. Her request, acceptance and next-step explanation still require real UI dialogue. This is a builder's focused check, not an unaided or independent play review. The saved driver now pauses after a failed Chat approach and waits for actual choice rows, so future use avoids the extra clock drift observed here.

Margaret first offers a visit to Hugh after speaking about her quarrel. William accepts at 17:07 on Day 2, walks to Hugh, and asks about his life at 18:00. Hugh speaks about Agnes's inheritance. This supplies the named visit outcome through an ordinary walk and conversation. William then returns to Margaret for her remaining ask.

At 18:46 on Day 2, Margaret asks for help making peace with Andrew. William accepts. Margaret acknowledges it, then the visible promise follow-up explains that both people need to trust him as a friend. The journal shows exactly the same next step. [Journal step](week-fixes/d2-peace-step-in-journal.png). The transcript receipt includes the structured request ID and `ready: false`. The visit to Hugh completes for +6 goodwill at this point.

Two Help-tab clicks hit a driver ambiguity between the topic icon and the tab while playback was busy. The actual promise follow-up still worked. The first [conversation screenshot](week-fixes/d2-peace-step-in-conversation.png) caught the player's question during playback, so it is not the settled spoken-step frame. A subsequent capture attempt and its actual failure are recorded below. The saved driver now scopes subject-tab clicks to the subject controls.

The additional spoken-frame attempt failed because the short return approach did not open a new chat before the driver tried to choose a line. No rendered choices appeared, and the capture timed out. I do not count that as a new application failure or a successful screenshot. The accepted peace ask and NPC explanation remain established by the first real transcript and the journal. The raw failed attempts remain in the action log.

The repeat Margaret approach was refused because she needed rest. This was a real patience condition, not a missing reply. I stopped repeating the capture.

The second night gives a precise UI dawn check. William rests from the evening. At Day 3, `2.250000000000193` days, he has 100 energy, no active task, no jobs and no forced-rest flag. His sleep counter is 8.98 hours. The morning note says he slept rough and recovered to 100. [First light, awake](week-fixes/d3-first-light-awake.png). No clock or energy value was set for this observation.

At 07:00 on Day 3, William remains awake at 100 energy. The sleep counter is still 8.98 hours, the task is ordinary idle waiting, and no job is queued. [Still awake at seven](week-fixes/d3-still-awake-at-seven.png). The browser then closes normally through the driver, exit 0.

## Remaining limits

The exact old-return exchange and the completed-home answer have regression evidence but no new UI reproduction. The first night's precise dawn minute was missed by a fixed-duration observation. The second night's dawn and following hour were captured directly. Physical favour resumption completes in the business tests. In this UI run, the food request lapsed fairly before delivery, while the walked personal visit completed. The peace request remains accepted because the required trust is missing. It was not reconciled by fixtures or state edits.

The existing regard penalties still made helpful conversation costly. Familiar speech and interface wording still expose some machinery. Those are issues 7 and 12, deliberately left for later. The driver also needs careful waiting around playback and full patience rows. Its saved version addresses the observed subject-selector ambiguity and clock drift after failed approaches.

Runtime source is commit `00018a8` on `week-fixes`, with earlier logical changes in `9ede5ec`, `0f4d77d`, `67cd3b8` and `7677deb`. Subsequent changes are this report, check receipts, screenshots and the observer. No push, deployment, branch comparison, delegation, stash or vault write was performed.

## Final evidence and cleanup

The archive contains 211 action records, 17 successful screenshots from the final play and one early preview. It records 17 driver/action errors, including the refused approaches and capture/selector failures described above. Browser page errors are zero. The archive validator checks every successful screenshot, PNG dimensions, every report link and the final game receipts. [Evidence validation](week-fixes/evidence-check.log), exit 0.

The final observer passes `node --check scripts/week-fixes-observe.cjs`, exit 0: [syntax receipt](week-fixes/driver-check-final.log). It also passes `npx eslint scripts/week-fixes-observe.cjs`, exit 0: [lint receipt](week-fixes/driver-lint-final.log). Final `git diff --check` exits 0.

The browser and observer closed normally. Saved PIDs 105373, 105534 and the transient launch helper 105576 are no longer running. The server's saved process tree contained npm 87567, shell 87591 and webpack 87592. Each identity and working directory was verified before SIGTERM. No other process was stopped. [Owned-process record](week-fixes/owned-processes.json), [cleanup receipt](week-fixes/cleanup.log), exit 0. [Port check](week-fixes/port-check.log), exit 0, shows no listener on 8175. Ports 8080–8082 were not used.

The first staged whitespace check exited 2 because webpack's raw progress log contains trailing blanks. The [raw server log](week-fixes/server.log.gz) and [failed whitespace receipt](week-fixes/whitespace-before-archive.log.gz) are preserved losslessly as gzip files. The plain local log remains in the worktree. This avoids editing literal process output to satisfy whitespace rules. The final staged check passes, exit 0: [whitespace receipt](week-fixes/whitespace-final.log).
