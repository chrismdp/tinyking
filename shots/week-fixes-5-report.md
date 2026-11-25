Implementation is committed. Acceptance is blocked: seed 13 did not finish world history within the required playtest’s existing five-minute startup wait. The full playtest exited 1. The first-season transcript and wedding screens are unproved, and the production build did not acquire its lock.

TinyKing now keeps the proposal answer in the paused conversation until the player closes it. Courtship needs six visits on different game days over at least five elapsed days. Courting lines have paired answers, and maternal introductions complete name and family questions without a goodwill penalty. The old line generator is deleted.

Gameplay candidate: `8766aa9` on `week-fixes-5`, based on `6b11be7`. No delegation, other-branch inspection, push or stash was used. All authored files and evidence are in this worktree.

## Proposal and wedding

The proposal no longer calls `closeChat` after accepting. Both outcomes remain visible in the paused panel. Only the player closes it. Closing still releases the listener and completes the queued chat after the household move. A refusal speaks the existing eligibility or housing reason and records no wedding.

The shared wedding memory reads the actual marriage event, its participants and its destination household. The notice names the couple and the home, including its village. It remains until dismissed. The Journal keeps this memory. The season page puts the player's wedding ahead of ordinary village news, even when there is enough news to overflow the page. The marriage and celebration remain real public events with the existing knowledge and news rules.

Test evidence: the modified proposal test failed because `s.chat.active` was undefined after acceptance. It now requires a paused active chat, the NPC's proposal answer, retained attention and an unfinished queued job. It then closes chat and requires released attention and the completed job. Existing refusal cases cover changed regard, age, spouse, kin, orientation, tastes, housing and a full row. `player_wedding.test.js` covers the real shared home, family news, save restoration and season-page overflow.

## Courtship over a season

A saved record in each player/NPC chat pair counts accepted courting days. The first accepted visit starts the clock. Three visits over two elapsed days allow Social wording. Five visits over four days allow Personal wording. Seven visits over six days allow Intimate wording. Wording also requires the corresponding mutual relationship ring.

A proposal requires six courting days over five elapsed days, plus the existing consent and relationship rules. A player who starts on day 1 can propose on day 6 at the earliest. Extra courting on the same game day neither grants time-together goodwill nor matching rewards. Gifts, favours, family goodwill and ordinary conversations still affect regard. They cannot replace the courting visits or elapsed days. Old saves start counting at their next courting visit.

Test evidence: all four new pacing tests failed against the original logic. They cover repeated courting on one day, a midnight crossing, time without enough visits, abundant goodwill, save restoration and extra matching rewards. Old marriage fixtures now represent an already mature courtship. Their consent, household, inheritance and birth assertions remain. The queued marriage helper now explicitly closes Chat before requiring job completion.

## Replies that answer the line

Each general courting line now has its own answer and refusal. Memory replies bind the actual trait, relative, work or news mentioned. The reply to a trait uses an authored response about that trait. News replies use the actual known event. The chat pair remembers used answers by courting stage and excludes them on later visits and after loading a save.

Test evidence: the corrected saved-visit test received one answer for three learned traits before the change. It now receives three distinct answers. The same test also exposed identical refusals, which now receive contextual answers. Existing checks still require learned facts, truthful marriage barriers, completed-exchange regard and persistence of spoken lines.

## Maternal introduction

The maternal line declares that it answers both name and family questions. It receives the same protection from negative topic matches as a name introduction. The existing kin welcome remains the reply. Recognition also preserves earned goodwill and any permitted stronger ring instead of replacing them with the family starting value.

Test evidence: both new pending-question tests failed because the line had no `answers` metadata. They now require completion of the original question, no negative match, no taste rebuff and the real maternal recognition. A relative can then ask for a favour. The test permits that new question. An additional regression demonstrated a loss from 55 goodwill to 38 during recognition. The fix preserves both goodwill and valid closeness. The Intimate test initially used tastes that capped the relationship at Personal; its final fixture permits Intimate closeness.

## Direct JSON authoring

Deleted `tools/chat-design/gen_lines.py` after searching for its callers, outputs and references. No build or runtime caller exists. Its only input file was the shared event catalogue, which the game also reads directly. Its output path came from its command-line argument. There is no checked-in generator-only output or private support module to delete.

Kept `tools/chat-design/validate.py`: it independently checks the authored conversation catalogue. Updated `docs/social.md`, `docs/conversations.md` and `docs/design.md` to describe direct JSON authoring. Conversation rows live in `src/data/conversation_lines.json`; courting exchanges live in `src/data/courtship_lines.json`.

## Play evidence

The first browser reached the menu and started seed 13. It did not reach character selection within the existing 300-second wait. Body queries and a later screenshot request also timed out during generation. That browser was stopped before the final maternal-warmth correction.

The frozen `8766aa9` browser reached the menu, started seed 13 and again exceeded the existing 300-second character-screen wait. It never reached arrival. No player was moved, no goodwill was granted, and no simulation function was called by the focused driver. All attempted interactions were real menu clicks. Read-only diagnostics did not change game state.

The full playtest then ran once against the same dev server. It reached the menu after 6.899 seconds and timed out waiting for `.character canvas`. It exited 1. Its saved failure snapshot had `days: -238`, `playerId: null` and 42 people in the current history map. Generation was still in the pre-arrival history. This is an observed startup failure, not evidence about courtship gameplay. No console errors were recorded.

Consequently, there is no UI evidence for the proposal answer, wedding notice, Journal, season page, maternal welcome or distinct courting replies. These remain acceptance requirements. A quieter verification environment, or a separate decision about startup performance, is needed. I did not extend the timeout or replace the required seed.

[The first menu screenshot](week-fixes-5/early.png) shows only the initial menu. Its build label predates the final candidate. It is not feature evidence. The failed generation runs did not produce usable screenshots.

## Courting transcript

No courting lines were spoken. Seed 13 never reached character selection or arrival, so there is no transcript to report. No transcript or wedding outcome is reconstructed from unit tests.

## Checks

Dependency setup: `npm ci` exited 0. It installed 1,056 packages in four minutes and reported 18 moderate vulnerabilities. It also reported existing peer, engine and deprecation warnings. Dependencies were installed in this worktree without symlinks to another checkout. An initial test attempt before npm finished linking binaries exited 127 (`jest: not found`). It was rerun after installation.

Two early scratch status queries exited 1 because they tried to read `s.personName` or `s.ecs.spatial` before the placeholder startup state supplied them. The read guards were corrected. These driver errors are separate from the later 300-second character-screen failures.

Narrow red checks used `/tmp/27agents-gate.lock` and `--runInBand`:

- Initial behavioural run: exit 1, four suites failed, eight tests failed and 69 passed. One new trait test initially attempted an unoffered candidate; the corrected test below established the real failure.
- Corrected distinct-trait test: exit 1, three replies collapsed to one.
- Wedding test before its new model existed: exit 1, module resolution failed for `game/player_wedding`.
- Refusal wording test: exit 1, one accepted case passed and the refusal case produced one answer instead of three.

Focused green checks:

- First combined run: exit 1, 76 passed and two maternal assertions failed because the real welcome offered a favour after answering. Corrected the assertions to distinguish the completed question from that new offer.
- Family and succession: exit 0, two suites and 35 tests passed.
- Romance, pacing and wedding: exit 0, four suites and 58 tests passed.
- Source ESLint: exit 0, no output. This JavaScript repository has no TypeScript configuration or typecheck command.
- `git diff --check`: exit 0, no output.
- Catalogue validator: exit 1, 22 warnings over 1,517 rows. Running it against `6b11be7` produced byte-identical output, also exit 1. Its rules have fallen behind the hand-authored catalogue.

The first affected command was stopped after over five CPU minutes without a suite result. Its exit status was 143 and its only output was `Terminated`. The replacement uses the same lock and `NODE_OPTIONS=--inspect=0` for a brief diagnostic profile. The profile showed progress through the existing favour simulation fixtures. A queued build command was cancelled while still waiting for its lock; no production build started in that attempt (exit 143).

The replacement affected run was also stopped, exit 143. It ran for roughly 18 minutes, with only the old Intimate fixture failure reported before moving into expensive existing simulation and geography work. A five-second diagnostic profile showed actual progress through these fixtures. The fixed maternal file then passed under the same lock: 23 tests, exit 0. This does not constitute a completed affected gate.

Both build commands remained queued behind the occupied `/tmp/27agents-gate-2.lock`. Each was cancelled while waiting, exit 143. No production build ran. The dev server did compile successfully, but that is not a substitute for the required production build.

Final focused regressions on `8766aa9`: exit 0, 72 tests in five files. Together with the final maternal file, 95 tests passed across six files. Final source ESLint exited 0 with no output. These focused results do not replace the unfinished affected gate or production build.

The dev server was stopped with `kill -TERM 3370785`, using the webpack PID reported by `ss -ltnp 'sport = :8176'`. The subsequent socket check showed only its header and no listener. The webpack process also no longer existed. Logs, raw snapshots, profiles and scratch drivers are excluded from the commit.

The literal command outputs follow. ANSI colour controls are removed for readability.

## Literal gate outputs

Affected attempt 1. Exit 143.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=6b11be7 --runInBand
```

```text
Terminated

```

Affected attempt 2. Exit 143.

```sh
flock -w 7200 /tmp/27agents-gate.lock env NODE_OPTIONS=--inspect=0 npx jest --changedSince=6b11be7 --runInBand
```

```text
Debugger listening on ws://127.0.0.1:41129/25f98462-8a50-4fb3-b44f-8af5722780a3
For help, see: https://nodejs.org/learn/getting-started/debugging
Debugger listening on ws://127.0.0.1:37039/d97c3992-ca23-4d76-aa12-2501e6ceef24
For help, see: https://nodejs.org/learn/getting-started/debugging
FAIL test/mother_family.test.js (17.273 s)
  ● preserves earned intimate warmth when an already close person learns the maternal connection

    expect(received).toBe(expected) // Object.is equality

    Expected: "intimate"
    Received: "personal"

      228 |   expect(chooseLine(s,chatChoices(s).find(l=>l.family==="maternal_introduction").key)).toBe(true);
      229 |   expect(s.ecs.relationships[n].known[p].goodwill).toBeGreaterThanOrEqual(before);
    > 230 |   expect(s.ecs.relationships[n].known[p].ring).toBe(ring);
          |                                                ^
      231 | });
      232 |

      at test/mother_family.test.js:230:48

Debugger attached.
Debugger ending on ws://127.0.0.1:37039/d97c3992-ca23-4d76-aa12-2501e6ceef24
For help, see: https://nodejs.org/learn/getting-started/debugging
Debugger attached.
Debugger ending on ws://127.0.0.1:37039/d97c3992-ca23-4d76-aa12-2501e6ceef24
For help, see: https://nodejs.org/learn/getting-started/debugging
Terminated

```

Production build, first queue. Exit 143.

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

```text
(no output; cancelled before acquiring the lock)
```

Production build, final queue. Exit 143.

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

```text
(no output; cancelled before acquiring the lock)
```

Full playtest. Exit 1.

```sh
CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=shots/week-fixes-5/full-playtest npm run playtest -- http://localhost:8176/?seed=13
```

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://localhost:8176/?seed=13

STARTUP menu ready after 6.899 seconds
locator.waitFor: Timeout 300000ms exceeded.
Call log:
  - waiting for locator('.character canvas') to be visible

    at waitForCharacter (/home/cp/code/tk-fixes5/scripts/acceptance-selection.js:442:43)
    at opening (/home/cp/code/tk-fixes5/scripts/playtest.js:85:9)
    at async /home/cp/code/tk-fixes5/scripts/playtest.js:59:34
FAIL the playtest ran to the end - "locator.waitFor: Timeout 300000ms exceeded."
PASS no console errors - []

```

Final maternal check. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/mother_family.test.js
```

```text
Test Suites: 1 passed, 1 total
Tests:       23 passed, 23 total
Snapshots:   0 total
Time:        58.395 s
Ran all test suites matching test/mother_family.test.js.

```

Final focused regressions. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/chat_courtship.test.js test/player_courtship_season.test.js test/week_fixes_4.test.js test/player_wedding.test.js test/succession.test.js
```

```text

Test Suites: 5 passed, 5 total
Tests:       72 passed, 72 total
Snapshots:   0 total
Time:        92.41 s
Ran all test suites matching test/chat_courtship.test.js|test/player_courtship_season.test.js|test/week_fixes_4.test.js|test/player_wedding.test.js|test/succession.test.js.
```

Server cleanup. Exit 0.

```sh
ss -ltnp 'sport = :8176'
```

```text
State Recv-Q Send-Q Local Address:Port Peer Address:PortProcess
```

Final source lint. Exit 0, no output.

```sh
npx eslint src/game/chat.js src/game/chat_courtship.js src/game/family.js src/game/people.js src/game/player_courtship.js src/game/player_wedding.js src/game/seasons.js src/components/status_strip.js src/components/wedding_notice.js
```

## New strings

Every new player-facing string is listed here. Placeholders are filled from learned facts. Existing player courting lines are unchanged.

1. `A moment, then. You have my attention.`
2. `A pleasant day together is something I can share. I cannot offer more.`
3. `A quiet place will not change what I need to tell you.`
4. `A short walk would be welcome. Come alongside me.`
5. `And I choose you. Tomorrow will be another day to say it.`
6. `And here we are. I wondered whether you would come back.`
7. `Ask me, then. I am beginning to trust you with more.`
8. `Being brave is easier with someone worth standing beside.`
9. `Choosing each other must be something we can both do freely.`
10. `Facing things together also means hearing the difficult truth.`
11. `Feeling at home beside someone matters. I must be honest about what is possible.`
12. `Home has begun to mean your company to me. That is something I cherish.`
13. `I am fond of you too. Let us give that feeling time to grow.`
14. `I am glad my company lifts you. I cannot offer everything you hope for.`
15. `I am glad my voice pleases you. Affection needs more than that.`
16. `I am glad too. It is a good day to meet someone.`
17. `I am glad we know each other. I do not want to repay that with a false hope.`
18. `I am glad you like who I am. I must still be plain about my feelings.`
19. `I am glad you listened about {name}. I need you to hear my answer as well.`
20. `I am glad you saved it for me. I have been waiting for a quiet moment.`
21. `I am grateful for the time you saved. I cannot turn it into a promise.`
22. `I am happier for seeing you. I was hoping you would say that.`
23. `I am here, and I hear you. I need to tell you how I feel.`
24. `I am proud, yes. It matters to me that you see something to value in that.`
25. `I can make time for you too. We both have lives to tend.`
26. `I can offer a friendly walk. I cannot offer courtship.`
27. `I can see that life too. I want us to be sure of it.`
28. `I can spare a moment of company, but I must speak plainly.`
29. `I can talk with you, but knowing me better will not change my feelings.`
30. `I did want you to hear this: {news}. Sharing news was not a promise of courtship.`
31. `I do look forward to them. More than I expected at first.`
32. `I do not want loneliness to lead either of us into a false promise.`
33. `I do not want you to shape every day around a promise I cannot make.`
34. `I enjoy seeing you, but I must not let these visits promise more than I feel.`
35. `I feel the same when it is time to part. There will be another visit.`
36. `I find more to be cheerful about when you are here.`
37. `I give what I can. I am glad my generous ways brought you closer.`
38. `I hear that you feel drawn to me. I must be honest about my own feelings.`
39. `I hear that you missed me. I need to be clear about my feelings.`
40. `I hear that you thought of me. Please listen to what I need to say.`
41. `I hear the life you picture. I must be honest before you build your hopes on it.`
42. `I hear what home means to you. I cannot let you mistake my answer.`
43. `I hear what you say about your heart. I will answer with care.`
44. `I hope you will like the less polished parts of me as well.`
45. `I hoped we would meet again today. I kept a place for you.`
46. `I know I am dear to you. That makes it harder to say this, but I must.`
47. `I know I can be greedy. You need not pretend every part of me is easy.`
48. `I know that loneliness. I am glad we can ease it for each other.`
49. `I know you look for me. I do not want you waiting for an answer that will change.`
50. `I know, and you have mine. I do not say that lightly.`
51. `I like being able to talk easily. That makes honesty all the more necessary.`
52. `I like that you can rest beside me. You need not put on a brave face.`
53. `I look for you too. The village feels different when you are away.`
54. `I love it too. Even the small, untidy parts of our days.`
55. `I missed you as well. Tell me how your day went.`
56. `I trusted you with this: {news}. You have given me no cause to regret it.`
57. `I try to be kind. You make me glad of the effort.`
58. `I turn our talks over in my mind as well. Especially the quiet parts.`
59. `I value our talks. I do not want you to read a promise into them.`
60. `I want our lives to grow together too, without either of us disappearing.`
61. `I want to be there when things are hard, as well as when they are easy.`
62. `I want you to keep those memories of {name} with me. They belong in the life we share.`
63. `I welcome your visits, but I cannot welcome them as courtship.`
64. `I will honour your trust by speaking plainly about what I can offer.`
65. `I will look out for you as well. There are worse ways to begin a day.`
66. `I will save you a story from the {trade} work. I like having you to tell.`
67. `I will take care of that trust. Tell me what you have held back.`
68. `I would be sorry if looking for me kept you from finding someone willing.`
69. `I would like that. There is room for you among my ordinary days.`
70. `I would like to see you tomorrow. Let us both have a day worth telling.`
71. `It is kind of you to take an interest in my {trade} work. I must answer honestly.`
72. `Let us learn each other’s ways, and see where that takes us.`
73. `Longer visits would not make this answer kinder or different.`
74. `My days have made a place for you that nobody else could fill.`
75. `My faith shapes my pious ways. I would like you to understand it.`
76. `My humble ways do not mean I have nothing to say. I like that you listen.`
77. `My lazy side does like a quiet seat. I am glad you would share it.`
78. `My timid ways can make a first step hard. You make it easier.`
79. `My worldly ways have given me a few stories. I would like to share them.`
80. `Our lives matter too much for me to promise what I cannot give.`
81. `Our paths can cross without either of us promising more.`
82. `So do I. A life is made of days like this, after all.`
83. `Some days the {trade} work leaves me worn out. I would like to come home to you then.`
84. `Speak freely, and let me do the same about my feelings.`
85. `Speaking of {name} with you feels easier now. You understand why that story matters to me.`
86. `The life we have found deserves an honest answer about marriage.`
87. `The {trade} work fills much of my day. It is good to have someone take an interest.`
88. `The {trade} work is easier to face knowing you are beside me. I love that ordinary life with you.`
89. `Then sit with me. We can let the rest of the village hurry.`
90. `Then stay and find out. I am curious about you too.`
91. `Then we will face it side by side. You need not carry it alone.`
92. `Then you will have to give me something worth talking about.`
93. `There are things you can still learn about me. They will not change this answer.`
94. `There is always work to do. You noticed how hard-working I am, and that means something.`
95. `There is more I can tell you about {name}. I am glad you want to listen.`
96. `There is room here. Sit, and tell me about yourself.`
97. `Tomorrow can bring another friendly talk, but I cannot promise courtship.`
98. `We can be part of each other’s village days without courting.`
99. `We can begin with a little time together. What would you like to know?`
100. `We can talk again. I need you to understand where I stand.`
101. `We can value these days together without promising a shared life.`
102. `We have come a little way together. I am glad of it.`
103. `We have learned how to listen to each other. I like that ease.`
104. `We need not be strangers. I cannot promise we will become lovers.`
105. `What were you thinking? I like knowing I crossed your mind.`
106. `Yes, I remember telling you: {news}. It helps to talk it over with you.`
107. `Yes, let us sit away from the bustle for a while.`
108. `You are dear to me too. I think you know how much that means.`
109. `You can speak freely here. I want to know what is on your mind.`
110. `You deserve someone who can choose you through the hard days.`
111. `You do know me well. Please hear this part of me too.`
112. `You found me. I am pleased you made the effort.`
113. `You have chosen to sit here. I want you to know where I stand.`
114. `You have made my day lighter too. Stay a little longer.`
115. `You have noticed my {trait} side. I must be clear about my feelings.`
116. `You have seen my cruel side. We must speak honestly about that.`
117. `You have seen my gloomy side and still come back. I value that.`
118. `You have stayed to learn me. I trust you with what you have found.`
119. `You may sit here. Please do not mistake a welcome for a promise.`
120. `You may stay as a neighbour. I do not want to give you false hope.`
121. `You may stay. I would like to see what caught your eye.`
122. `You remembered the news: {news}. I am glad you listened.`
123. `You remembered {name}. It means something to me that you kept that story.`
124. `You stayed to listen when I told you: {news}. I love that you care about the people in my stories.`
125. `Your fondness deserves an honest answer from me.`
126. `Your time is precious. I do not want to take it under a false promise.`
127. `{trait_reply} I am curious to learn your ways too.`
128. `{trait_reply} I like that you are learning who I am.`
129. `{trait_reply} I trust you to see that part of me clearly.`
130. `{trait_reply} You know that part of me, and I love that you stay.`
131. `I want more days to know you, and time between our visits to be sure. Let us keep courting.`
132. `You have noticed my ${trait} ways.`
133. `${named.join(" and ")} married. Our home is ${home}. Our families celebrated with us.`
134. `our shared home`

The home combines its recorded house name with ` in ` and its village name when that village is available. The couple’s names are joined with ` and `. These are formatting fragments, not additional dialogue.

## What is still weak

The existing validator rejects 22 patterns already present in the baseline. Its output is identical before and after this work. It rejects icon-free consequential replies, the old `content` mood and some long player lines. The existing repeated marriage barrier can still appear as a sentence after several different replies. Whole replies remain distinct.

The implementation has 95 passing focused tests, but has no completed affected gate, production build or successful UI acceptance. Do not treat it as ready to merge. The observed load reached 40 on four CPUs, with 9.1 GiB of swap used. This gives resource context, but does not establish the root cause of the startup delay.

The courtship clock is new. A save from before this change preserves its goodwill and spoken-line history, but has no evidence of distinct prior courting days. Its next accepted visit starts the clock.

Initial UI observation on the first candidate did not reach character selection within the existing five-minute harness wait. Several 30-second body queries also timed out during generation. No game state was changed. That browser was stopped before a final maternal-warmth correction. The final candidate was tried separately and failed at the same startup wait.

## Things that should not exist

The startup path did not finish seed 13 world history within the playtest’s five-minute wait. It needs an explicit performance decision before this candidate can meet acceptance. The stale generator is removed. The validator still carries rules that disagree with the shipped catalogue, including the obsolete `content` mood. Those 22 existing inconsistencies need their own fix.
