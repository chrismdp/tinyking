# Named social lookups

The social event engine now uses roles and three named lookups. It no longer follows component routes or dotted record paths.

Implementation commit: `bee7ba8`. Base: `4f5af9ac6df076de819752c19479fa058dfe55b8`. Worktree: `/home/cp/code/tk-lookups`, branch `tidy/named-lookups`.

## Routes found and replaced

The audit searched all of `src/data` for `"component"`, `"field"`, dotted keys and dotted values. It also searched engine readers for dynamic component access, field access and dotted-path traversal. The starting source was the supplied main commit in this worktree. No other branch was read.

| Data entry | Former route | Replacement |
| --- | --- | --- |
| `social_actions.json`, `arranged_refusal.participants.head` | Actor → `household.houseId` → `controllable.controllerId` | `{ "householdHeadOf": "actor" }` |
| `social_actions.json`, `arranged_refusal.participants.otherHead` | Partner → `household.houseId` → `controllable.controllerId` | `{ "householdHeadOf": "partner" }` |
| `social_actions.json`, `arranged_betrothal.participants.head` | Actor → `household.houseId` → `controllable.controllerId` | `{ "householdHeadOf": "actor" }` |
| `social_actions.json`, `arranged_betrothal.participants.otherHead` | Partner → `household.houseId` → `controllable.controllerId` | `{ "householdHeadOf": "partner" }` |
| `social_actions.json`, `visit_other_village.event.details.fromVillage` | Actor → `village.villageId` | `{ "villageOf": "actor" }` |
| `social_actions.json`, `visit_other_village.event.details.toVillage` | Partner → `village.villageId` | `{ "villageOf": "partner" }` |
| `event_types.json`, `affair.affected[0].from` | Each participant → `kinship.spouse` | `{ "spouseOf": "subject" }` |

These seven routes contained eleven component accesses: eight household/controller steps, two village steps and one spouse step. They accounted for all eleven `component` keys and eleven storage `field` keys in social data. The existing affair participant binding `{ "spouseOf": "actor" }` keeps its meaning and uses the shared lookup code. `secret_activities.json` contained no storage routes.

The audit also found twelve dotted references to event records:

| Data entry | Former reference | Replacement |
| --- | --- | --- |
| `event_types.json`, `marriage.onOccurrence` | `event.head` in four arguments | `head` |
| `event_types.json`, `marriage.onOccurrence` | `event.otherHead` in four arguments | `otherHead` |
| `event_types.json`, `found_out.onLearn` | `event.causeEventId` | `causeEventId` |
| `event_types.json`, `affair_meeting.onLearn` | `event.causeEventId` | `causeEventId` |
| `event_types.json`, `poaching_seen.onLearn` | `event.causeEventId` | `causeEventId` |
| `event_types.json`, `poaching_found_out.onLearn` | `event.causeEventId` | `causeEventId` |

Code binds these saved values by name. Declared event roles take precedence, so betrothals and refusals retain their own head roles. Marriage effects use the saved heads rather than the couple's current household heads.

Other search matches belong to separate formats:

| File | Matches | Treatment |
| --- | --- | --- |
| `jobs.json` | `target.walkable.speed`, `target.mappable.terrain`, `target.haulable`, `target.good.type`, `target.forageable.amount`, plus `$target.id` | Existing rules for selecting work targets in `src/components/info.js`. These are outside the social event engine and remain unchanged. |
| `messages.json` | `spatial.move`, `target.personable`, `season.is`, `time_of_day.is` | Translation keys, with no storage traversal by the social engine. |
| `conversation_lines.json` | 207 `field` keys: 77 binding names, 89 references to a farm field role, 41 comparisons of event details | Chat predicates and named sources. The 41 detail comparisons use `kind` (9), `toWorld` (12), `toVillage` (12), `cause` (5) and `fromWorld` (3). They do not select ECS components or people through storage routes. |
| `conversation_lines.json` and chat readers | Dotted line identities, presentation references and named-source arguments, including `npc.village` | Chat's separate fact and text format. Its dotted arguments are `npc.village`, `event.village`, `activity.partner`, `place.reach_key`, `context.world_key` and `npc.household`. No dotted arguments reach the shared social predicates in the current catalogue. |
| `event_types.json`, disclosure | `via: "causeEventId"` | An event payload link used by disclosure, rather than an ECS route or a person lookup. |

## Code removed and behaviour retained

Removed the recursive `participantBinding` function from `social_actions.js`. Removed its component/field route fallback and its separate spouse implementation. Removed dynamic `source.component` and `source.field` reads from event details. Removed dynamic `rule.from.component` and `rule.from.field` reads from `affectedParties`. Removed dotted traversal from `boundValue` in `social_conditions.js`.

`social_lookups.js` contains one small function per question and an explicit dispatch. Unknown names throw `Unknown social lookup: <name>`. Declarations with several keys are rejected. No general component, field, ownership-chain or nested lookup form exists.

Household-head lookup retains identity-directory access for household membership and the direct house controller. It does not climb to an overlord. Village lookup retains the former local ECS read. Known lookups still allow missing results. Affected people are still filtered and captured before later relationship changes.

`docs/social.md` now states the rule in British English. Its participant, event detail and affected-person descriptions show the named format.

## Test evidence

Added `test/social_lookups.test.js` before changing runtime code. Its small fixtures cover all three lookups, aliases, binding order, missing results, local precedence and remote identity records. They also cover literal event details, affected identities, exclusions, saved event bindings and source-event learning. Unknown lookups are rejected at all three entry points: participants, details and affected people. A catalogue test rejects component keys, field keys and dotted record paths in all three social data files.

All existing test files and assertions remain unchanged. No route fixtures in existing tests needed migration.

| Run | Suites | Tests | Exit code |
| --- | --- | --- | --- |
| Initial red tests | 1 failed | 16 failed, 8 passed, 24 total | 1 |
| Completed red tests, including source learning and the data rule | 1 failed | 18 failed, 7 passed, 25 total | 1 |
| First lookup implementation | 1 passed | 25 passed, 25 total | 0 |
| Existing social, secret-activity and marriage tests | 1 failed, 2 passed | 3 failed, 71 passed, 74 total | 1 |
| Added regression for betrothal/refusal role precedence | 1 failed | 1 failed, 25 passed, 26 total | 1 |
| Corrected implementation, all four focused files | 4 passed | 100 passed, 100 total | 0 |
| Final affected gate | 140 passed | 1,364 passed, 1,364 total | 0 |

The intermediate marriage failures exposed saved-head bindings overwriting declared roles. The correction gives declared roles precedence. The existing assertions pass without changes.

Every Jest run used `/tmp/27agents-gate.lock` with `flock -w 7200`. Focused commands used `--runTestsByPath` and the files named above. The final gate reuses the repository's import-graph selector in `scripts/history-cpu-gate.cjs`, with the base set to `4f5af9a`. Its private runner selects 140 affected files and runs Jest with `--runTestsByPath`, `--maxWorkers=2` and `--workerIdleMemoryLimit=1GB`. The selection includes changed JSON imports. The whole suite was not run. No test-configuration, shared-fixture or generated-type exception was needed.

Source ESLint passed with exit code 0. Final ESLint, including the added tests, passed with exit code 0 and no output. This is a JavaScript project with no TypeScript configuration or typecheck command. The production build compiled the changed modules and passed with exit code 0. Webpack reported three bundle-size warnings. Both the app and save worker compiled successfully. The build used `/tmp/27agents-gate-2.lock`.

Commands and receipts:

| Check | Command | Receipt under `.cache/named-lookups/` |
| --- | --- | --- |
| Affected selection and execution | `node .cache/named-lookups/affected-gate.cjs` | `affected-receipt.json`, `affected-tests.json`, `affected-runner.exit` |
| Final lint | `npx eslint src/game/social_lookups.js src/game/social_actions.js src/game/social_effects.js src/game/social_conditions.js src/game/event_roles.js test/social_lookups.test.js` | `final-lint.log`, `final-lint.exit` |
| Production compilation | `flock -w 7200 /tmp/27agents-gate-2.lock npm run build` | `build.log`, `build.exit` |
| Baseline history | `flock -w 7200 /tmp/27agents-gate.lock node .cache/named-lookups/seed13.cjs before` | `before-receipt.json`, `before.exit` |
| Final history comparison | `flock -w 7200 /tmp/27agents-gate.lock node .cache/named-lookups/seed13.cjs after` | `after-receipt.json`, `after.exit` |

The affected gate took 90.984 seconds in Jest, with 91.713 seconds recorded by its runner. Its receipt names implementation commit `bee7ba82b651195fd47a91590fdabbd1065b2fd6`.

## Seed-13 proof

Before editing game code, the real `generateWorldHistory({}, 13)` ran at the supplied base commit. The same generator runs after the change. This is the history stage called by `generateWorldGame`, before terrain detail and the arriving stranger. It avoids rebuilding terrain solely to compare history.

The comparison preserves event order, every event field and the order of living identities. It compares the complete JSON strings directly, without sorting, filtering event fields or rounding values.

| Measure | Before | After |
| --- | --- | --- |
| Living people | 716 | 716 |
| Births | 1,164 | 1,164 |
| Love marriages | 178 | 178 |
| Practical marriages | 274 | 274 |
| Arranged marriages | 7 | 7 |
| Betrothals | 7 | 7 |
| Refusals | 1 | 1 |
| Complete event records | 18,103 | 18,103 |

Baseline generation and count assertions exited 0. Final generation, direct string comparisons and count assertions also exited 0. All 18,103 event records and all 716 ordered living identities are byte-for-byte identical. The checks include event details, affected identities, knowledge stored on events and event order. The hashes below match before and after. Generation took 49.630 seconds before and 53.417 seconds after. These timings describe the runs, rather than a performance claim.

Identical complete event JSON: 7,828,786 bytes. SHA-256: `0c5b1a462e05902ff5dbcc8090add094500fa6a59d652ec0dca81de56981f727`.

Identical ordered living identities: 12,668 bytes. SHA-256: `166cf6ecd350cd727ca1e2cc8ee3f7d2672c0a695745b68fbbb0ec43837adb61`.

## Delivery

Private logs, exact JSON captures, test results, the adapted gate runner and exit receipts live under `.cache/named-lookups/`. They are ignored and excluded from git. The requested report is the only force-added file under ignored `shots/`. Dependencies were already installed. No dependency setup was necessary.

The implementation is committed as `bee7ba8`. The following documentation commit contains `docs/social.md` and this final report. No push, delegation, stash, external message, vault write or comparison with another branch occurred. No visual changes were made, so the builder check uses the real history generator. The independent browser acceptance pass remains with the coordinator under `docs/verification.md`.
