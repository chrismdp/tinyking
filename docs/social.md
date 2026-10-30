# Social life and history

The social simulation runs without a renderer. `historyStep(worldHexState, season)` returns a new world state for one dated season. The input stays unchanged. Old events and geography stay shared because the step never edits them.

Generation starts with founding households and advances 180 seasons, or 45 game years. Founding households start with adults. Seasonal births produce their children. The founders include unrelated families so that villagers can find partners outside their close kin. Dead people remain ECS records. Their `historical` flag keeps their bodies off the map. Family trees and provenance still refer to their original identities.

## Records

Each event contains `id`, `type`, `people`, `day`, `season`, `villageId`, `place` and `items`. Moves add `fromHouse` and `toHouse`. Deaths add `cause`. The event list lives at `state.events`. Each person's `state.knowledge[id].events` contains the event identities they know. Ask about copies relevant events from the speaker's knowledge.

A personal item has an ECS identity and a `possession` component. It contains `name`, `kind`, `ownerId`, `maker`, `originalOwner` and `owners`. Each entry in `owners` contains `personId`, `day` and `reason`. `carried` separates personal belongings from the two working hands. Personal items never enter commodity totals. A gift transfers the same unique item and appends its new owner. Splitting an ordinary stack preserves its good metadata.

Households own their house, rooms, stores, fields, workshops and animals through their house references and controller chain. People keep household membership in `household[personId].houseId`. A death or move repairs resident controllers and selects a living adult trade holder. An empty house controls itself until someone claims it. A vacant workshop retains its trade and building.

## Rules

A person learns their own events and close family events. Other villagers hear an event with probabilities of 12%, 40%, 75% or 100%, according to their closest ring with a participant. A nearby player can witness live news. Generated history gives the arriving player no automatic knowledge.

Learning about a quarrel with a close relative costs three goodwill towards the other participant. A gift to a close relative or a reconciliation adds one goodwill towards the giver or reconciler. Each witness receives each effect once. These rules change goodwill. They do not change a person's tastes or disposition.

Evening conversations last half a game hour. They add four goodwill towards someone loved, one towards someone liked, or subtract 0.25 towards someone hated. A hostile pair has a 12% quarrel chance. A quarrel costs six goodwill in both directions and starts three days of avoidance. Their next conversation after avoidance records a reconciliation. Meals and sleep run before storage, social visits and work. A full store cannot block a hungry person from eating carried grain. A person eats held food where they stand. An old gathering destination cannot delay a meal. Player orders retain their existing priority.

Unmarried adults need mutual Intimate rings to court. Parents, siblings and people who share grandparents cannot court. Mutual closeness must last two seasons before marriage. The living player takes no part in automatic courtship, marriage, ageing or succession.

A couple uses a family house with room for six residents, then an empty village house. If neither exists, a rendered world can build a cottage on nearby unused grassland. A summary world can supply plain `houseSites[villageId]` coordinates. The village retains its eight-house limit. If there is no suitable site, marriage waits. Marriage and moves retain both partners' personal belongings.

Birth probability is 5.5% per eligible couple per season. Population relative to three people per house scales it by 0.2 to 2. Couples wait three years between births. Parents must be adult and at most 55. A household with six residents waits for room before another birth. Grown children leave crowded households for empty local homes. Couples take their dependent children with them. A child inherits one parent's trait and the other parent's tastes. Opposed traits stay excluded.

Children reach developmental age 18 in two game years. Adults then gain one displayed year per game year. `lifeYears` stores elapsed game years on that scale. A newborn therefore reaches old-age eligibility after 44 game years. This keeps fast childhood separate from adult ageing.

From displayed age 60, death probability is 2% per season, multiplied by `1 + (age - 60) / 12`. Age 88 is the final old-age boundary. Inheritance chooses a living spouse, then the eldest living child, then the oldest person in the nearest kinship layer. With no heir, a personal item becomes an unclaimed estate and retains its provenance. No automatic inheritance selects the living player.

Seasonal history uses the same birth, courtship, death and inheritance functions. It summarises six half-day conversations with a seasonal companion. Hostile companions have one accidental encounter because they avoid each other. Hourly play requires real proximity and a running social task. Seasonal history applies the same 72 hours of relationship drift as live play.

## Review tools

`npm run storyboard -- <url> <outdir>` runs one ordinary session at 1440 by 900. It watches the opening, selects a villager, queues Chat, chopping and a lean-to, and runs one day at Fast. It opens news and a family tree, then selects the player. It records each frame's clock, tasks, hunger, ring, hint and latest events in `story.json`.

`node scripts/social-check.js 20 1234 98765 --determinism` runs the real planner for five years. It measures two-year survival, five-year population and meals, and compares a repeated final ECS. It saves real evening and wedding snapshots for `scripts/social-shots.js`. Those screenshots use diagnostic terrain discovery and camera selection. The heard-news fixture grants the speaker Social trust, then calls the real Ask about function. The storyboard does not use this setup.
