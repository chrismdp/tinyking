# Favours and friends

Requests come from living adult residents of a household with a real store. The resident head asks, or the first adult resident by entity ID if the legal owner lives elsewhere. A household has at most one offered or accepted request of each kind.

* Harvest: a family field has ripe crop patches. The request asks for up to three patches, at four goodwill per patch. Only patches actually harvested after acceptance count. Their real yield belongs to the field's household, including resident use when a remote heir legally owns it. The player carries that yield into the household store before earning goodwill.
* Wood: a baker's oven or smith's forge has no fuel and its household store has no wood. The request asks for one log and promises twelve goodwill. A log fuels four hours of actual trade work. Walking, waiting, meals and sleep do not burn fuel. `workplace.fuelHours` is the remaining fuel; `workplace.workHours` records actual work. Other trades have no fuel cost. This supplies one concrete wood use without adding warmth or another survival meter.
* Food: the family's real edible reserve is below two portions per resident. The request asks for up to three missing portions, at four goodwill each. Household containers, accessible loose/stockpiled crop and resident hands count as reserves. Delivery uses the player's own grain, gruel or forage.

Requests never create materials. Wood and food deliveries use goods the player already owns. If none is available, the favour waits and the player can queue explicit chopping or gathering after it. The existing construction rule remains: a build waits for delivered materials and never gathers them automatically.

Fuel delivery normally puts the carried log in the household store. If that store is full, the player instead walks to the household's actual oven or forge. Handover consumes that one owned log into the existing four hours of workplace fuel. The pantry keeps all its goods and its capacity. Trade work burns the fuel at the existing rate. A full output store still prevents new bread from entering it.

This receiver is resolved during planning and delivery. Already accepted requests and their queued tasks can therefore continue from the old store target. Delivery checks actual custody, ownership, commodity type, distance and fences before consumption or storage. The request retains a receipt with the item, previous owner, physical receiver, amount, use and date. An existing household estate account records the incoming goods as `received`. Direct fuel delivery also records the log as `consumed`. Normal trade work records stored wood consumption when it loads the fuel.

## Discovery and orders

The simulation checks needs initially and each game hour. A requester within 300 world units on explored ground teaches the request through `knowledge[player].favours`. The encounter records only the requester's name in the existing learned-person record, with no traits, kin or relationship. Knowing someone's name or hearing about a distant household reveals no needs. Lists contain learned requests only. Opening a sheet does not introduce anybody. Explicit acceptance introduces the player and giver through the existing interaction functions.

`state.favours` contains `nextId` and `requests`, keyed by stable request ID. Each record stores `giverId`, `householdId`, `kind`, `reason`, `targetId`, `quantity`, `progress`, `delivered`, `produced`, `goodwill`, `status`, `cargo` IDs and creation/acceptance/completion dates. Fuel requests also store `workplaceId`. Harvest work retains its current patch and remaining effort across interruptions. The personal queue entry has the normal stable task ID, `job.key: "favour"`, `favourId`, `forId` and `expectedGoodwill`.

Accepted favours use the normal ordered queue, including move earlier/later, drag, cancel and waiting text. The player walks to real sources, harvest patches and household stores through the existing actions. A stored portion is removed from its source exactly once and carried as a real good before delivery. Unique possessions never qualify as commodity delivery sources and keep their existing identity/provenance.

Goodwill is granted exactly once, on actual completion, in the giver's direction through `addGoodwill`. Existing thresholds, ring capacities, displacement and disposition caps apply. A hostile giver receives the whole promised number and stays Public. A completed favour records a known social event for its participants.

Death, a household move, a lost field/store or a need met by someone else expires the request with a reason and no completion reward. An unavailable player supply waits for explicit gathering. Work and goods already delivered remain where they are. Cancelling gives no completion reward and refunds nothing. Collected player goods remain in hand. Borrowed harvest is released on the ground at the player's actual position, still owned by its family, for their normal haulers. It cannot be eaten by the player. Accepted harvest cargo is reserved for its physical delivery so another family hauler cannot take the same portion.

## Friends helping

A free, fed adult who places the player in **their** Personal or Intimate ring may help. The player's opinion of them grants no help. There is capacity for one helper at a site, in addition to the player. This makes the additional worker visible while keeping the existing single-player task queue and household routines independent.

Needs, captured attention, home moves, existing visits and the helper's own queued work precede help. At a free planner boundary, help comes before routine farming, trade work and wood hauling. One helper at a time limits the interruption; their own routines resume afterwards. The helper's HTN chooses an ordinary walk followed by real construction effort or field work. It does not receive a player job or change controller, household, profession or legal ownership.

Construction help starts only once all logs have been delivered through the existing player construction flow. Helpers never collect wood or gather extra materials for a starved build. They share the site's actual work total, and completion is idempotent when another worker finishes first.

Field helpers plough and harvest while the player is working an owned field. Sowing remains the player's seed/food choice. Short-lived `slot.workerId` claims prevent two workers changing the same patch; the existing field claim still serialises ordinary family workers. Interrupted or finished workers release their claims. A helper's crop remains the player's. Hunger, tiredness or a lapsed Personal ring ends help and returns the helper to their own planner.

The standard seed-13 storyboard uses two conversations and one real fuel delivery to earn Personal, then explicitly chooses nearby trees by their actual timber yield and chops enough wood to let a friend help finish the house. It pauses through normal UI speed commands at the actual delivery and helper work for desktop/phone frames. It injects no materials, needs or relationships. Evidence and any limits are recorded in `shots/favours-report.md`.
