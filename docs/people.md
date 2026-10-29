# People model

The people model adds family records, village membership, personality and relationships to the existing ECS. Entity ids are strings. Every component also has the usual ECS `id` field.

| Component | Fields |
| --- | --- |
| `kinship` | `parents: string[]`, `spouse: string \| null`, `children: string[]` |
| `personable` | Adds `age`, in whole years. Age below 18 uses size 12. Adults use size 20. |
| `personality` | `traits: string[]`, `likes: string[]`, `dislikes: string[]` |
| `village` | `villageId: string \| null`, on both houses and people |
| `household` | `houseId: string`, on people |
| `relationships` | `known: { [otherId]: { ring, goodwill } }` |

`state.villages` maps each village id to `{ id, name, centre: { x, y }, houses: string[] }`.
The player's house and character have a null village id.
`state.peopleSeed` seeds the variation in opinions.
`state.opinionThresholds` stores `{ hate, love }` once per map.
The temporary `traits` component keeps its existing meaning.

## Generation

The map targets one village per 140 tiles, or 11 on a radius-22 map, where terrain permits.
Each village has 3–8 houses within three hexes of its centre.
Centres are at least seven hexes apart. Houses are at least two hexes apart.
The first village starts near the player. The player's start and its clear grassland ring follow the existing rules.

Families use three living generations. An elder household has adult children in nearby houses, with grandchildren in those households.
Some elders live alone after widowhood. Some grown grandchildren have a house of their own.
Parents are at least 18 years older than their children. Houses have enough beds for their occupants.

Every relative has a world entity. There are no separate dead-ancestor records.
The oldest generation has empty parent lists, and a widowed elder has a null spouse.
Parent/child and spouse links are reciprocal. Household control still uses the existing controller hierarchy.

Each personality has 2–3 traits from distinct opposed pairs.
The six pairs are hard-working/lazy, generous/greedy, proud/humble, pious/worldly, cheerful/gloomy and brave/timid.
Each person likes two distinct traits and dislikes two others. Tastes can concern traits that the person does not have.

## Opinions and relationships

`opinion(state, a, b)` adds one for each trait of `b` that `a` likes, and subtracts one for each disliked trait.
A seeded, directional variation adds a value from -0.2 inclusive to 0.2 exclusive.
All ordered pairs of different people, including the player, set the 20th and 80th percentile boundaries at generation.
`disposition(state, a, b)` returns hate below the lower boundary, love at or above the upper boundary, and like between them.

| Ring | Slots | Goodwill needed |
| --- | --- | --- |
| Public | Unlimited | 0 |
| Social | 10 | 10 |
| Personal | 6 | 30 |
| Intimate | 2 | 60 |

Disposition limits closeness: hate permits only public, like permits personal, and love permits intimate.
This limit also applies to initial family bonds. Kinship does not override someone's tastes.
Spouses and young children prefer intimate. Parents, siblings and grown children prefer personal.
Other villagers start at social for love and public otherwise. All villagers know their fellow villagers, but nobody knows the player.

Initial bonds above public receive their ring's required goodwill plus six.
Kin take slots after neighbours. When a ring fills, an incoming person displaces its existing member with the lowest goodwill.
That member moves out one ring. Displacement continues if the next ring is full.
Ties follow entity id order. Displacement preserves goodwill.

`meet(state, a, b)` adds `b` to `a`'s list only. Love starts at social with 16 goodwill, and other dispositions start at public with zero.
Meeting again preserves the existing bond. Meeting oneself does nothing.
`addGoodwill(state, from, to, amount)` changes `to`'s feelings about `from`, meeting first if needed.
Positive help selects the ring allowed by goodwill and disposition. Harm never promotes a displaced bond.
Negative goodwill puts the bond at public.

`drift(state, hours)` subtracts 0.125 goodwill per hour from positive bonds and adds the same amount to negative bonds, stopping at zero.
A bond moves out when its goodwill falls below its ring's requirement.
The initial six-point buffer lasts two days. Drift never promotes someone displaced from a full ring.
The simulation calls drift once for every crossed game hour, including long steps. Paused time does not decay relationships.

## Knowledge functions

`feelingHint(state, a, aboutId)` reads `a`'s feelings towards `aboutId`.
At public, or before meeting, it returns only `{ hint: "polite" | "warm" | "cool" }`.
Hate or negative goodwill gives cool. Otherwise, love or positive goodwill gives warm. The remaining cases give polite.
At social or closer, it returns `{ ring, disposition }`.

`knownFamilyTree(state, viewerId, personId)` returns `{ rootId, nodes }`, a graph indexed by node id.
It includes two generations of parents and children, the person's siblings, and spouses of those relatives.
Shared ancestors appear once. Each visible node has `{ id, age, parents, spouse, children, siblings }`.
Links at the two-generation boundary stop there.

The subject reveals this whole tree if their own relationship list places the viewer at social or closer.
A person also knows their own tree. Otherwise, only the subject, the viewer and relatives already on the viewer's list are identified.
Each hidden relative has `{ id: "unknown-N", name: "unknown", unknown: true }`, with an opaque id local to this result.
All nodes retain their kin links through these aliases, so unknown branches stay connected.
Hidden nodes expose no age or original entity id.
Both knowledge functions leave state unchanged.
