# Seed 13: seven days in the valley

This report is in progress. Scores remain unassigned until the week ends. The comparison is the supplied 22 November report: choices 3, difference 3, immersion 2, caring 3, all out of 5.

## Courting, proposing and the wedding

Not yet played. Every spoken courting exchange will be recorded with its game time.

## Issues, worst first

1. The nearby Chat shortcut led to a long chase without a word.

   Day 1: I chose the nearby-neighbour prompt in Reedbrook after the first walk. By 10:47, I was waiting for an unknown person to finish walking. At 11:16, the journal put them in woods south of camp, nine hexes away, with about 33 minutes left. At 11:29, it put them near Reedford, still with about 32 minutes left. At 12:26, I still had no conversation. I cancelled the visit and tried someone standing nearby.

   [Waiting near Reedford, day 1 about 12:19](week-play-4/06-nearby-chat-chase.png). The status explains that they are walking. It does not explain their food run or offer a useful meeting point. A read-only check showed that they were collecting household grain and returning it home. I expected a brief exchange within speaking distance, or a spoken explanation of where to meet. The wait consumed game hours as well as real time, so this is separate from the machine's slow drawing.

This ranking remains provisional until the week ends.

At 16:43 on day 1, Hugh's own request cost one regard. He welcomed me with, “Then you are my nephew! Your mother is my own kin. Welcome, child; you have found family here.” He then said, “Agnes is gone. I keep setting a place at the table.” His request was, “Margaret doesn't know yet. They're over in Reedford. Would you take them the news, gently? I would rather not talk about family just now.” His Family match took regard from 36 to 35 while he was speaking. The welcome's disliked match correctly scored zero. I expected his own request to keep his regard unchanged and avoid rebuking me for his subject. See [Hugh's welcome, grief and request](week-play-4/10-hugh-reunion-and-ask.png). This will be placed in the final ranking.

## Play record and evidence

Frozen source: `b4b796378eb13e13075224e60cd9ae31549c0f8e`, branch `week-play-4`. Seed 13, port 8188. No game code will change. The named `scripts/talk-3d-observe.cjs` is absent from this checkout. A local Playwright command driver will use mouse and keyboard input, with read-only state observations.

I read the supplied previous report and the five required documents, including the seven direction principles. I used the simple-English skill for the report. Dependency installation started before other work. Setup and world generation do not count as play.

`npm ci` exited 0. It installed 1,056 packages in about two minutes. It reported peer dependency and old-engine warnings, deprecations and 18 moderate vulnerabilities. Webpack compiled successfully in 208,396 ms. Its save worker compiled in 70,409 ms. Webpack PID `3545646` was saved from `ss -ltnp`. The owned browser PID is `3545977` and the driver PID is `3545913`.

The initial navigation timed out while webpack compiled. The subsequent Start new game click reached generation, but its post-click wait timed out. These are driver/setup costs. Seed 13 stayed unchanged. Generation proceeded from surveying 91 reaches into twelve years of world history.

The first browser became impractically slow after arrival. Ordinary screenshots timed out, including after the font wait was removed. A direct CDP screenshot succeeded. The ground selection completed at day 1, about 09:40, but no walk or conversation completed. Renderer observation showed 73 draw calls, 13,413 triangles, no pending redraws and no pending neighbouring maps. This does not isolate a game defect from the shared machine or graphics configuration. I stopped that browser and driver through their own endpoint. Their four saved PIDs, including crash handlers, were gone. I restarted Chromium with `--use-gl=angle --use-angle=swiftshader`, preserving seed 13. The earlier in-memory browser context had no transferable ordinary save. The fresh generation and first abandoned setup are outside the scored week. The [first-browser receipt](week-play-4-first-browser-receipt.json) preserves the failures.

The replacement generation took 26 minutes 20.704 seconds, from 23:07:00.353 to 23:33:21.057 UTC. The page was visible and focused. I started the fresh game at 23:34:14 UTC. Native mouse input still responded slowly. Zooming out through the wheel reduced the visible geometry and improved motion. I continued play.

The camp-to-Reedbrook walk completed: day 1, 09:05–09:43, 38 game minutes and 178.510 real seconds. The player moved from `(2008, 227.846)` to `(2070, 571.577)`. A read-only observer timed the actual Move here click and the completed ground order. I zoomed out during this walk. No conversation or season page paused it.

The Reedford-to-Reedbrook walk completed on day 1, 14:31–15:46: 75 game minutes and 445.884 real seconds. It ran from `(2479.634, 1365.587)` to `(2070, 571.577)`, through clicked ground orders. No conversation or season page paused it. These are timings on this shared host, rather than a controlled speed comparison with the previous report.

The [first journal](week-play-4/04-first-journal-or-chat.png) named Dionisia Seesi and her wish: find Hugh, Margaret and Humphrey. The [first family tree](week-play-4/05-first-family-tree.png) showed Dionisia as dead and old, with two of seventeen names known. These gave the walk a personal purpose before I managed to speak to anyone.

Hugh was the first relative found, on day 1 at 16:43. His grief over Agnes made me want to keep his request. He gave an actual purpose to going back to Reedford, beyond the family-search prompt.

## What I found that adds nothing to the four questions

Pending the week of play.
