# People panels and talking

Selecting a villager opens the person sheet. It shows their household, learned traits, feelings, goodwill and known companions. The player keeps the existing status strip. The family tree preserves unknown branches and replaces question marks with learned names. Known cards open that person's panel.

Chat, Ask about someone and Give a gift enter the personal task queue. The player walks to the person and spends game time on the visit. A gift moves one real item from the player's stores to the recipient. Conversations leave household control unchanged. Recruit no longer exists in the job data, planner, task handlers or translations. The playtest checks its absence and exercises Chat and Gift.

The player's planner uses the existing eating, foraging and sleeping routines. Meals interrupt work and the queue resumes afterwards. The task panel shows “Stopped to eat”. The player planner preserves held gifts through meals. Villager priorities stay unchanged. The only change to `compound.js` removes the obsolete recruitment method and its job entry.

This work resumes commit `953f93a534dd56ba56b23540c0ceb410a57bdc84`. It retains that implementation and finishes its uncommitted playtest and screenshot scripts. Follow-up fixes correct kinship labels and let an already held gift bypass a route check to its old ground position.

## Decisions

The mock-up controls the panel structure, palette, ring symbols, relationship wording, family connectors, unknown cards and legend. Public shows an impression. Social and closer show the person's actual ring for the player. The rings are directional.

Live data replaces the mock-up's sample names, ages, places, family sizes and goodwill values. The existing people model keeps its thresholds of 10, 30 and 60. The mock-up explicitly labels its values as samples, including 40 and 80 in section 03. Generated families currently contain three generations. The tree displays every generation that the model returns, without adding invented ancestors.

The brief leaves these choices open:

- Talking buttons sit below the companions and above “Open family tree »”. Gift and gossip choosers expand inline. A completion message stays in that person's panel.
- On desktop, the person sheet sits beside the task queue and the tree spans the play area. A conversation partner waits while the player approaches and talks. Completion, cancellation or interruption releases their attention.
- A visit meets both people on completion. Looking at a panel does not meet anyone. An interaction reveals one previously unknown trait. Social shows at least the first two traits. Traits and family names learned through interaction remain in `state.knowledge[viewer].people`. Reported rings live in `state.knowledge[viewer].feelings[speaker][subject]`.
- Chat and gossip share daily patience. Gifts do not consume patience. Trust and patience are checked again on completion. A refused conversation completes its queue entry with an explanation.
- Ask about someone lists people in the speaker's relationship list. It records the speaker's ring for the subject and the family facts that the speaker knows. Hearing a name does not count as meeting that person.
- Gift choices include owned loose, held, stockpiled and contained goods. Each choice gives one portion or item. The queue waits if the chosen item disappears. Cancellation leaves a collected gift in the player's hand. Gift delivery transfers ownership and puts the item in the recipient's hand, or on the ground beside them if their hands are full.
- Existing personality tastes concern traits. Gift types therefore carry trait associations as well as their own type. The numeric rules below specify those associations.
- The closest-people list shows up to three people, ordered by ring then goodwill, whose identities the player knows. Public labels say “Known to you”, since the model has no record of observed meeting places. Social adds recorded kinship, including siblings' spouses. It does not invent the mock-up's “At the mill” observation.
- Until succession exists, the displayed household heir is its head's eldest living child, then its living spouse. Equal ages use entity-id order. A living person aged at least 18 with no recorded spouse is an unmarried adult. The single card tag prioritises heir, selected person, then householder. Card names use at most 21 visible characters, with the full name in the accessible label.
- The family layout uses variable-width generation rows, adjacent spouses and 164×82 cards. It grows for large families. The viewport scrolls on both axes and centres the selected person on opening. Phones use a full-width sheet, a sticky close button and safe-area spacing with `svh`. Landscape uses the same scrollable sheet. Buttons have 44px minimum targets. Tree cards support tap, click, Enter and Space. Escape closes the current sheet.

The mock-up's family legend says “Unmarried adult = could court”. That wording is retained. This ticket adds no courting action.

## Numbers

| Rule | Value |
| --- | --- |
| Chat goodwill | +2 per completed chat |
| Base Chat / gossip / gift time | 15 / 20 / 10 game minutes, plus walking |
| Daily patience, Public / Social / Personal / Intimate | 2 / 4 / 6 / 8 visits per speaker and actor |
| Patience reset | When `Math.floor(state.days)` changes |
| Patience cost | One for Chat or Ask about someone, zero for gifts |
| Gift base value, forage / grain / gruel / wood | 2 / 3 / 5 / 3 |
| Other goods | Explicit item `value`, otherwise 4 |
| Liked / neutral / disliked gift | ×1.5 / ×1 / ×0.5 |
| Food for someone with hunger >0.9 | ×2 |
| Hate / like / love disposition | ×0.05 / ×1 / ×1.25 |
| Existing goodwill thresholds, Social / Personal / Intimate | 10 / 30 / 60 |
| Existing ring capacities, Social / Personal / Intimate | 10 / 6 / 2 |
| Existing drift | 0.125 goodwill per game hour towards the initial base |

The existing hunger slowdown applies to these base visit times. Gift goodwill is base value × taste × hunger × disposition. Food means forage, grain or gruel. Associations are forage → generous, grain and wood → hard-working, and gruel → cheerful. A match on either the type or its association counts. A like takes precedence over a dislike. Hate still caps the relationship at Public. For example, a neutral-taste hungry recipient gains 4 from forage at like disposition, or 0.2 at hate disposition.

## UI wording

The following inventory includes new templates and wording reused from the mock-up or brief. Braces indicate live values. Existing trait names, goods, village names, ring names and common queue controls remain unchanged.

- Person identity: `{name}'s panel`, `Close {name}'s panel`, `{age} years · {village}`, `{home} · {family} household`, `{surname} cottage`, `No household`, `Stranger`, `· † Dead`.
- Traits and feelings: `Traits you know`, `Unknown trait`, `?`, `{He|She} seems {polite|warm|cool}`, `They seem {polite|warm|cool}`, `{He|She} trusts you`, `They trust you`, `An impression. You do not yet know what {he|she} thinks of you.`, `An impression. You do not yet know what they think of you.`, `You are in {his|her|their} {ring} ring. {He|She} shares {his|her} family tree and gossip.`, `You are in their {ring} ring. They share their family tree and gossip.`
- Goodwill: `Goodwill with {first name}`, accessible `Goodwill with {full name}`, `{goodwill} / {next threshold}`, `{amount} more towards {ring} · space matters too.`, `Your closest ring · space matters too.`
- Companions: `People seen with {him|her|them}`, `{His|Her|Their} closest people`, `Known to you`, `Others not yet known`, `Spouse`, `Parent`, `Father`, `Mother`, `Child`, `Son`, `Daughter`, `Sibling`, `Brother`, `Sister`, `Sibling-in-law`, `Brother-in-law`, `Sister-in-law`.
- Family button: `Open family tree »`, `{n} name known · the rest show as ?`, `{n} names known · the rest show as ?`, `{His|Her|Their} whole family tree is known.`
- Talking: `Talking` (accessible group label), `Chat`, `Ask about someone`, `Give a gift`, `They've had enough of talking for today`, `They need to trust you before sharing gossip`, `They don't know that person`, `Choose a gift`, `Close chooser`, `One item from your stores. You carry it to them.`, `{n} in store`, `You have no goods to give.`, `What they told you`.
- Results: `You spent some time together.`, `They shared family news and their feelings.`, `They accepted your gift.`
- Rendered activity labels: `Chatting`, `Sharing family news`, `Giving a gift`.
- Queue: `{gift type} · 1 item`, `About {name}`, `Gift no longer available`, `No path to gift`, `Stopped to eat`, `Your tasks resume afterwards.` The existing generic `Target gone` also applies to dead or missing conversation partners.
- Tree window: `The family of {name}`, `{known} of {total} names known`, `Close family tree`, `Two generations above · two below`, `Ancestors · siblings & spouses · descendants`, `Scroll family tree`.
- Tree cards: `Unknown relative`, `Not yet known`, `Select {name}, {metadata}, {tag}`, `Died aged {age}`, `{age} · Unmarried adult`, `{age} · Child`, `{age} · Living`, `Selected person`, `Householder`, `◇ Heir · {household}`. Dead names use `†`. Long visible names use `…`, while the accessible label keeps the full name.
- Generations: `GRANDPARENTS`, `PARENTS`, `SELECTED PERSON & SIBLINGS`, `CHILDREN`, `GRANDCHILDREN`.
- Tree legend: `━ Marriage · ● Children from the join`, `† Dead · plain name = living`, `◇ Heir of the household`, `Unmarried adult = could court`, `? A relative you have not learned about`.

## Tests

No unrelated tests were deleted or weakened. Changed test files are:

- `test/people_interactions.test.js`, new: first meeting, goodwill, patience reset and ring allowances, trust gating, reported feelings, learned family names, gift multipliers and owned gift sources.
- `test/people_orders.test.js`, new: walking and time, actual gift collection and transfer, trust refusal and successful gossip after a queued visit, automatic eating with work resumption, cancellation, Recruit removal, held gifts and gifts interrupted by meals. The resumed run adds the successful gossip visit and unreachable old gift-position cases.
- `test/people_panel.test.js`, new: Public versus Social content, connected placeholders filled by gossip, dead people, unmarried adults, heirs, large family layout, household naming and pronouns. The resumed run adds unrelated-companion, sibling-in-law and householder labels.
- `test/support/people.js`, new shared fixture: independent households, kinship, personalities, a personal queue and the real simulation.
- `test/arrival_tasks.test.js`: replaces the removed Recruit missing-target case with Chat, Ask about someone and Gift cases. All other missing-target cases remain.
- `test/selected_person.test.js`: adds a name-module mock because the selected-person component now imports the person panel. Existing assertions remain unchanged.
- `test/task_panel.test.js`: adds a regression that a hungry sleeping player does not display a meal interruption.
- `test/i18n.test.js`: adds three checks that the renderer has readable activity labels for Chat, Ask about someone and Gift. A real browser run exposed the missing Chat translation. All earlier translation tests remain.

Tests preceded production changes. Earlier red-run logs remain in `shots/red-people.log`, `shots/red-panel.log`, `shots/red-orders.log`, `shots/red-held-gift.log`, `shots/red-panel-details.log` and `shots/red-sleep-label.log`. This resumed run adds `shots/red-resume-details.log`, `shots/red-resume-kinship.log` and `shots/red-householder.log`. The held-gift fixture was then corrected to disconnect a tile through reciprocal path links. A focused run against a copy of the previous committed manager confirms the failure: expected completed progress 1, received 0. That output is in `shots/red-held-source-baseline.log`. The corrected production code passes the same test.

## Acceptance evidence

The later boundary in the brief forbids a whole-suite run. The AFFECTED gate therefore follows the imports from every changed JS/data file and the shared fixture. No bare `npx jest` or whole-suite command was run. No test configuration or shared fixture outside this affected list changed. This JavaScript project has no separate TypeScript check. Webpack compiles JS/JSX and runs ESLint. Dependencies were already installed, so setup required no dependency changes.

The exact affected command was:

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --maxWorkers=2 --findRelatedTests src/components/person_panel.js src/components/selected_person.js src/components/task_panel.js src/components/world.js src/data/jobs.json src/data/messages.json src/game/compound.js src/game/htn.js src/game/manager.js src/game/people.js src/game/player.js src/game/primitive.js src/game/simulation.js src/game/tasks.js test/arrival_tasks.test.js test/i18n.test.js test/people_interactions.test.js test/people_orders.test.js test/people_panel.test.js test/selected_person.test.js test/support/people.js test/task_panel.test.js
```

Literal summary from `shots/jest-final.log`:

```text
Test Suites: 29 passed, 29 total
Tests:       214 passed, 214 total
Snapshots:   0 total
Time:        31.342 s
```

Build command: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`.
Literal tail from `shots/build-final.log`:

```text
WARNING in webpack performance recommendations:
You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
For more info visit https://webpack.js.org/guides/code-splitting/

webpack 5.112.2 compiled with 3 warnings in 31340 ms
```

The warnings concern asset size, entrypoint size and code splitting. Separate ESLint on the changed source and both scripts exited 0 with no output. Its output is in `shots/eslint-final.log`. `git diff --check` also passed.

A case-insensitive Recruit search finds no production-code references under `src/`. The remaining script/test references assert its absence. The design document and the old arrival report retain historical references. The arrival report's current description now states that villagers keep their own households and links to this report.

The server command is `npx webpack serve --config webpack.dev.js --no-open --port 8107`. Browser runs use the supplied Chromium executable with `--use-gl=swiftshader --enable-unsafe-swiftshader`. The main playtest skips the intro with `intro=skip`. The existing separate intro regression remains in the script.

One development probe timed out with the player asleep and three of four logs delivered. Action-button checks now allow ten seconds, building allows five minutes, and gift delivery allows three minutes. These waits retain the same completion assertions. Another run was interrupted when the production build updated the dev server's watched `dist` directory. A further run caught missing talking activity translations and a script trying to find a villager who had moved. Translations now have regression tests, with red output in `shots/red-talk-labels.log`. The Gift check chooses a currently visible villager through the real panel. A subsequent run delivered the gift but tried to click Pause twice. The speed helper now accepts an already-selected speed and asserts the requested game speed. The final sequence starts after the build finishes.

The final Gift check observes the exact collected item with `requestAnimationFrame`. At completion it records the item's owner and the distance between player and recipient. It requires ownership by the chosen person and a distance of at most 10 world units. This replaces a later check for any owned loose goods, which can miss a gift after its recipient uses or stores it. The observer only reads game state. All orders, speed changes and delivery still run through the UI and real planner.

## Screenshots

Reproduce the people captures with `node scripts/people-shots.js http://localhost:8107/`.
The fixtures use the real map, people functions and simulation. A completed Ask about call changes the partially known tree into the learned tree. The Chat and meal snapshots come from real planner tasks. Only the fixture's dead flag is set directly to show the dead-card style.

All paths below are relative to `/home/cp/code/tinyking-peopleui/`. Desktop images are 1440×900. Phone images are 390×664, with `isMobile: true` and `hasTouch: true`.

| State | Desktop | Phone |
| --- | --- | --- |
| Public person | `shots/desktop-person-public.png` | `shots/phone-person-public.png` |
| Social person | `shots/desktop-person-social.png` | `shots/phone-person-social.png` |
| Partly known family | `shots/desktop-tree-partly-known.png` | `shots/phone-tree-partly-known.png` |
| Better known family | `shots/desktop-tree-better-known.png` | `shots/phone-tree-better-known.png` |
| Chat in queue | `shots/desktop-chat-task.png` | `shots/phone-chat-task.png` |
| Gift chooser | `shots/desktop-gift-chooser.png` | `shots/phone-gift-chooser.png` |
| Meal interruption | `shots/desktop-stopped-to-eat.png` | `shots/phone-stopped-to-eat.png` |

Landscape captures are `shots/phone-person-landscape.png` and `shots/phone-tree-landscape.png`, both 664×390. The capture script checks 44px targets, sheet bounds, a native touch swipe through the tree, and selection of a known relative. It also checks browser errors. Its log is `shots/people-screenshots.log`.

All sixteen final images were opened and inspected. The desktop person panel was compared with mock-up section 03, and the family tree with section 04. The identity header, trait chips, relationship box, goodwill meter, family button, dashed unknown cards, spouse joins, child lines, dead style and legend follow the study. The Public badge is retained alongside the impression, as in the mock-up. The talking controls add one row above the family footer. On phones, content scrolls below a sticky close control. The tree keeps readable cards and scrolls instead of shrinking its text.

The screenshot command exited 0. It confirmed that gossip reduced the unknown-name count, touch targets met 44px, every sheet stayed inside its viewport, a touch swipe moved the tree, and tapping a relative opened the right person's panel. No page or console errors were reported.

## Playtests

Three consecutive runs of `npm run playtest -- http://localhost:8107/` exited 0 with unchanged source and no intervening build. Each run passed all 21 checks and reported no console errors. The checks include actual Chat and Gift orders, walking, item ownership at delivery, fresh build-first waiting, explicit gathering, two completed lean-tos, field and stockpile work, villagers on the ground, resizing and the debug worldgen page.

| Run | Passed | Failed | Full output |
| --- | ---: | ---: | --- |
| 1 | 21 | 0 | `shots/playtest-1.log` |
| 2 | 21 | 0 | `shots/playtest-2.log` |
| 3 | 21 | 0 | `shots/playtest-3.log` |

Literal final line in each log:

```text
PASS no console errors - []
```

Literal gift evidence from the final run:

```text
PASS the player walks over and gives the gift - {"itemId":"2395","type":"wood","owner":"1768","personId":"1768","distance":0}
```

The server was stopped with `kill -TERM 3794246`. The command `ss -ltnp '( sport = :8107 )'` then returned only its table header, with no listener. Before/after output is in `shots/server-stop.log`. Port 8080 was not used.

## Commits

The work remains on `people-ui`. No push was made. No other branch was checked out or compared, and no work was delegated.

- `953f93a534dd56ba56b23540c0ceb410a57bdc84`: the retained people panels, conversations, knowledge and self-feeding implementation.
- `a4709b6c979b9c8e7f9414c20abd46f9aa6797d5`: kinship and householder labels, talking translations, held-gift delivery and regression tests.

The final evidence commit contains this report, the playtest update and the reproducible screenshot script. Its SHA is included in the delivery message.
