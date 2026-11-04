The new-game hang is fixed. The 30 random seeds had 3/30 load failures before and 0/30 after. Village shortages fell from 6/30 to 0/30. Every fixed village has exactly one pad per stored house. The recovered incident reaches play in production Chromium with no page errors. Seed 13's complete history remains byte-identical. Runtime commit: `d6721696a9913e82c54307c36aeaa260aa128d05`.

The reported `4085071834` is a local seed, not the URL seed. `generateWorldHistory` derives it with `hashUnit(seed + ":hex:" + key)`. The no-URL caller samples integers from 0 through 10,000,000. Reversing that derivation recovered world seed `2177345` for hex `5,4`. The real generator confirmed both values and reproduced the exact exception: `Not enough surveyed house pads for stored household w5_4-social-72`. Passing `4085071834` directly as a world seed instead creates hex `5,5`, local seed `3824209498`, and already loaded on the baseline.

The Node reproduction called real world-history generation and then `buildHistoryMap` for the home hex. History contained five buildings in village 1 and four in village 2. All belonged to those local villages. The adjusted `houseCount` values reached the surveyor correctly. The baseline surveyed five and eight pads, then terrain grading retained five and three. Eight pads could not hold nine remembered households.

Two survey contracts disagreed. The primary survey ignored its stopping count whenever stored contents existed. The inland fallback also retained every candidate instead of the requested count. Extra pads added foundation, doorway and apron constraints. Meanwhile, grading could only replace rejected pads from the stricter natural survey. A four-house village's replacement radius was three hexes, although the inland survey already allowed five. The grader also protected a failed central pad by rejecting neighbouring pads. It could eventually delete an entire remembered village under a rule intended for procedural hamlets.

Commit `83e6ba982efbef4491b21a3f667874a1d99aadab` introduced the stored-history survey paths and disabled the primary stopping count. It returned only the natural candidate list after inland siting. The central-pad rejection rule predates world history. Commit `76bdf94` later extended replacements to five hexes only for counts above four. Git blame and patches establish these changes. I did not bisect the first demographic revision where this exact seed failed. The eight-person, compressed-history and step 8 commits did not introduce these survey conditions.

The final implementation surveys the requested count and keeps the existing inland candidates available for grading replacements. Recorded villages carry their five-hex survey radius. The grader relocates the actual failed pad, including a central pad, while retaining the original survey centre as the search anchor. Replacement centres cannot move the survey area progressively across the map. The existing terrain safety rules, earthwork limits and procedural-hamlet behaviour remain in force. The installer still throws on a true shortage. No household, building or error is skipped.

The first commit, `2daa9e1`, only limited the pad count. It fixed the incident but failed 4/30 random seeds. That result is retained in `first-fix-after-survey.json`. Sharing the inland pool and changing candidate order alone also failed the new terrain regression. The final fix relocates the failed centre instead of sacrificing neighbouring homes. The unused ordering trial was removed.

The small fixtures use real survey, grading and installation code. Two cases place seven stored households across two villages on 217 flat tiles. Grassland exercises the natural survey, and stone exercises the inland fallback. Both require exact counts, distinct physical pads and the correct village for every installed household. A third fixture uses a small northern clearing from seed `1638658394`, with four declared natural pads and real terrain. The old path removes all four. The final path retains four safe pads within the original five-hex area. It generates no world history or people. No existing test or shared fixture changed.

| Check | Passed suites / total | Passed tests / total | Failed tests | Exit |
| --- | ---: | ---: | ---: | ---: |
| Initial count regression | 0/1 | 0/1 | 1 | 1 |
| First fixture correction | 0/1 | 0/1 | 1 | 1 |
| Second fixture correction | 0/1 | 1/2 | 1 | 1 |
| Count fixtures green | 1/1 | 2/2 | 0 | 0 |
| Finished count fixtures on baseline | 0/1 | 0/2 | 2 | 1 |
| First affected gate, superseded candidate | 139/139 | 1357/1357 | 0 | 0 |
| Radius regression | 0/1 | 2/3 | 1 | 1 |
| Radius helper fixture | 2/2 | 36/36 | 0 | 0 |
| Complete survey regression | 0/1 | 2/3 | 1 | 1 |
| Shared pool only | 1/2 | 35/36 | 1 | 1 |
| Clearance ordering trial | 1/2 | 35/36 | 1 | 1 |
| Final focused fixtures | 2/2 | 36/36 | 0 | 0 |
| Final affected gate | 144/144 | 1385/1385 | 0 | 0 |

The first two fixture corrections supplied immovable map tiles and a buffered mainland. They corrected test inputs, without weakening the count or placement assertions. The finished count fixtures also failed against a byte-verified baseline map module through a private Jest alias. The later terrain fixture was strengthened to run the complete survey, rather than supplying radius metadata directly. All failed runs and their actual counts remain in the receipts.

The final import-graph selector chose 144 explicit Jest files from base `2793103`. It passed 1385/1385 tests and 144/144 suites, exit 0. Its one snapshot passed. The runner is `scripts/history-cpu-gate.cjs`, copied under `.cache/house-pads/` with the base and receipt paths changed. It uses `/tmp/27agents-gate-2.lock`. No full suite or selection exception ran. This JavaScript repository has no TypeScript configuration or typecheck task. Final source and test ESLint each exited 0 with zero warnings.

The before and final captures called `generateWorldHistory(state, 13)` with a fresh `{}`. Both complete `JSON.stringify(state)` outputs contain 199,928,327 bytes. SHA-256: `5c22e0dcd4489c73646701b29ed3823e7d5e35097a95e6a4e30bf63621d7f5e2`. No fields were filtered, sorted, projected or rounded. Both capture processes and final `cmp` exited 0. Terrain detail changes, while the remembered history remains identical.

Both production builds exited 0. The first belongs to the superseded candidate. The final app and save worker compiled successfully from `d6721696a9913e82c54307c36aeaa260aa128d05`. The app emitted the same three bundle-size warnings. The final Node incident replay installed nine households and created the player, exit 0. Final control maps installed ten households for seed 13 and thirteen for world seed `4085071834`, exit 0.

The final production browser used Chromium 156.0.8078.4, served by `scripts/serve-frozen.py dist --port 8137`. It opened `/?seed=2177345`, selected Start new game, entered character selection, started play and skipped the introduction through the UI. The clock advanced, and Pause responded. All 7/7 browser assertions passed, exit 0, with 0 page errors and 0 console errors. The production build exposed no development state object. The screenshot is `final-production-play.png`. Source remained frozen throughout the final gates and browser observation. I checked the saved server PID's command and working directory, then stopped only PID `1059702` with SIGTERM. The stop receipt exited 0.

The first browser launcher exited 1 because its short-lived server ended before navigation. It never loaded the application. The successful browser pass on the first candidate is also retained, separate from the final pass. Initial Node driver failures omitted the UI object or expected a root map during replay. A terrain-inspection driver bypassed installation and then reached downstream code. These driver failures are distinct from the reproduced game exception. Their logs and exit receipts remain under `.cache/house-pads/`.

The sample consists of 30 distinct random unsigned 32-bit world seeds, recorded once before editing game code. Every baseline seed ran real history generation and the home-hex map path. The probe counted pads at the installer, after the complete terrain survey and grading. A total shortage exactly predicts this installer's exception because it can fall back to any unused pad. A village shortage is recorded separately, even when spare pads elsewhere prevent an exception. All 30 baseline seeds disagreed with the stored house count in at least one village, often by surveying extra pads.

The final comparison reused each exact generated history, world, content roll and entrance contract. It checked the seed identities, unchanged building counts and exact per-village pad counts. Directory attachment does not affect the terrain operations before installation, so the count replay omitted personal-directory attachment. The baseline ran in two locked processes with separate seed indices. The first completed indices 0–19, then its saved PID was stopped at the planned boundary, exit 143. The second completed indices 20–29, exit 0. The final after process and comparison each exited 0. There were no generation or driver errors in the sample. The known incident is an additional case and is excluded from the random count.

| Seed | Stored houses | Pads before | Pads after | Shortage before |
| --- | ---: | ---: | ---: | --- |
| 1900882784 | 9 | 11 | 9 | None |
| 1933309286 | 15 | 21 | 15 | None |
| 2060715 | 14 | 18 | 14 | None |
| 2531905166 | 8 | 9 | 8 | Village only |
| 4271054026 | 10 | 16 | 10 | None |
| 1547006628 | 15 | 19 | 15 | None |
| 1779597873 | 10 | 8 | 10 | Total and village |
| 1905291530 | 10 | 15 | 10 | None |
| 1638658394 | 12 | 13 | 12 | Village only |
| 3600253669 | 9 | 15 | 9 | None |
| 30297998 | 11 | 17 | 11 | None |
| 3971659846 | 11 | 8 | 11 | Total and village |
| 1531025630 | 15 | 20 | 15 | Village only |
| 3074014394 | 16 | 23 | 16 | None |
| 3486315245 | 7 | 12 | 7 | None |
| 3039642818 | 9 | 10 | 9 | None |
| 1927154413 | 10 | 16 | 10 | None |
| 3146668027 | 8 | 11 | 8 | None |
| 135267487 | 9 | 14 | 9 | None |
| 3784924176 | 14 | 17 | 14 | None |
| 501917923 | 14 | 24 | 14 | None |
| 1240178572 | 16 | 19 | 16 | None |
| 1016704877 | 12 | 24 | 12 | None |
| 1430396019 | 13 | 16 | 13 | None |
| 1124891773 | 9 | 12 | 9 | None |
| 522801447 | 11 | 15 | 11 | None |
| 1584490904 | 10 | 14 | 10 | None |
| 2694778045 | 9 | 16 | 9 | None |
| 1021324735 | 10 | 5 | 10 | Total and village |
| 1022610393 | 12 | 15 | 12 | None |

This sample measures valid seeded new games across the 32-bit range. The no-URL caller uses the narrower 0–10,000,000 range, so its exact failure rate remains unmeasured. The sample and focused browser check prove the requested cases, not every possible terrain seed.

Probe scripts, logs, full history captures, source hashes, process receipts and screenshots remain under `.cache/house-pads/`, outside git. `survey-comparison.json` contains the complete comparison. `source-receipt.json` verifies the baseline copies against `2793103`. Dependencies were already installed, so setup cost was zero. No push, delegation, other-branch inspection, full-suite run or dependency installation formed part of this work. The report is a documentation commit after the two green implementation commits.
