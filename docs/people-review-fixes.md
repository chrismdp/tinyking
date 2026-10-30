# People review fixes

The person sheet now shows a recorded trade and the current activity beside the home and village. The smith remains “Smith” during meals, walks and sleep. Adults without a recorded trade show “Farming household” only when their household farms. Children show “Child”. Death replaces the live activity with “Dead”.

The sheet and world labels use `currentActivity` in `src/game/person_activity.js`. It reads the running task, profession, farm slot and walking destination. It ignores stale `world.label` values and future plans. Timber work keeps the existing `woodPhase` reader. No planner priorities or gameplay numbers change.

Gossip now states the direction with full names: “Kelvin Seefobrin is in Adrian Seefobrin's Personal ring.” The sentence reads `knowledge[viewer].feelings[speaker][subject]`. This is the speaker's reported ring for the subject. It does not read either person's ring for the player, the reverse bond or a newer live bond.

Gift buttons show the item type, source and available quantity. Sources include “In your hands”, “On the ground · tile x, y”, “Stockpile · tile x, y”, “Home stores” and “Container · tile x, y”. Tile coordinates describe map locations, not entity identifiers. Explicit item values remain visible when they distinguish otherwise similar choices.

`giftChoices` groups goods with the same type, value and source location. Held goods form one location. Ground goods on different tiles stay separate. Home stores identify containers inside the actor's home. Other containers and stockpiles show their tile. Each choice retains one original `giftOptions` entry. The queue receives that source unchanged, even when the displayed quantity includes several equivalent entries.

Collection and delivery still use the existing planner. The availability and ownership checks, one-item split, goodwill calculation, cancellation and missing-source behaviour remain unchanged. A missing selected source waits rather than silently substituting another source from its group.

The new tests cover stale forge labels, all six trades, current farm work, childhood, death, rest and timber phases. The gossip test uses different reverse and player rings, then changes the live speaker bond after learning. Gift tests cover owned held, loose, stockpiled and contained sources, equivalent groups, foreign ownership, queue metadata, cancellation and unavailable sources. Simulation tests require exactly one transferred portion and conserved ownership totals.

Run the focused Jest gate with the explicit changed files under the shared lock. Run the production build separately. This JavaScript project has no separate TypeScript check. Webpack compiles JavaScript and checks source lint rules. The coordinator runs full Jest after rebase.

Run `node scripts/people-review-fixes-shots.js http://localhost:8119/` against the owned server for the desktop and phone evidence. The script labels its fixtures on each image. It uses real seed-13 planner routines for the smith, fixture trust and asymmetric rings for gossip, and fixture supplies for source choices. Canvas selections, gossip requests, gift selection and speed changes use real UI input. Its delivery observer reads the transferred item and total wood at completion.

The final run details and image paths are in the ignored `shots/fix-report.md`. The prescribed `npm run playtest -- http://localhost:8119/` separately exercises earned wood and real Gift delivery.
