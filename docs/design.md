# Tiny King: game design

Status: phase one, 31 October 2026. This describes the implemented game. The separate [phase-two proposal](phase-two.md) remains a design only. Quests remain deferred.

## A life among people

You arrive as a stranger with a camp, no house and no followers. Villages already have families, possessions and forty-five years of history. You meet people, help with real work, build a home and form a family. You play one person at a time. When that person dies, their heir can become the next player. The world continues without a victory screen.

The game aims to make these activities enjoyable:

- Watch villagers work, visit, court, marry and raise children.
- Learn named families' stories through conversations and remembered possessions.
- Earn help and make a home through relationships.
- Follow a family across generations in a persistent world.

## The world and time

Each local map is a world hex. Temperature, moisture, morality, elevation and continuous coastlines shape its terrain. Nine temperature/moisture combinations produce the biomes. Long mountain belts, secondary ridges and lowland envelopes share one world-coordinate height field. Annual moisture moves along a seeded prevailing wind, with coastal supply and drier rain shadows. Neighbouring world hexes differ by at most one category on each climate axis. [Geography](geography.md) describes terrain, passes, paths and placement rules.

Trees regrow through seasonal saplings near existing woods. Biomes set density and growth. Winter pauses growth. Fields use real crop patches, seasonal growth, household permissions and harvested grain. Weather follows the world pressure model. Rain, snow, wind and storms affect the presentation. They do not introduce injury, warmth or storm damage.

A deliberate journey uses the normal planner to walk off a map edge. The journey takes one season. Visited maps retain their people, events, buildings, stores and ownership. Other communities advance through the same seasonal rules while offscreen. New maps use deterministic history. See [travel](travel.md).

The gameplay camera provides a continuous 3D [realm view](realm-map.md). Zooming
out inspects public terrain and weather, plus communities that the current person
actually discovered. Realm fits the world and You restores local camera follow.
Inspection adds no orders, detailed maps, journeys or elapsed time.

## People and history

Each person has a stable identity, parents, spouse, children, developmental age, personality and directional relationships. Dead people remain historical records. Families own houses, fields, stores, trades, animals, tools and keepsakes. Items retain the identities of their makers and earlier owners. [People](people.md), [social life](social.md) and [village life](villages.md) describe these systems.

Generated history contains only the existing residents. The newly created stranger does not age, marry, die, meet villagers or inherit property during those forty-five years. Their lifecycle starts at arrival. After arrival, their actual person ages in live play and on the road. Reference-only people do not take a second local seasonal update.

Children reach developmental age 18 in two game years. Adults then gain two displayed years per game year. Old-age deaths use the shared seasonal probability from age 60 and the final age-88 boundary. Starvation can also kill a person after prolonged neglect.

NPC adults choose visits through the planner. Mutual Intimate relationships, recent conversation, kin exclusions, available housing and two seasons of courtship govern automatic NPC marriage. Automatic matchmaking never selects the player. Married player couples can have children through the shared age, residence, demographic and birth-cooldown rules. Marriage is the standing consent for this shared family simulation. Births do not require a separate player order.

## Relationships and disclosure

Relationships are one-way. Each observer has their own goodwill and limited slots:

| Ring | Slots | Goodwill | Effect |
| --- | --- | --- | --- |
| Public | Unlimited | 0 | Basic contact and trade |
| Social | 10 | 10 | Family disclosure and gossip |
| Personal | 6 | 30 | Unsolicited physical friend help |
| Intimate | 2 | 60 | Possible marriage with mutual consent |

Traits and tastes set directional dispositions. Hate permits Public, liking permits Personal, and love permits Intimate. Goodwill never changes those tastes. Ring displacement and drift still apply. A player can feel differently from the person they court.

Selecting a stranger does not introduce them. Names, biographies, events and possession stories use the current actor's actual knowledge. Completed conversations record spoken contact. A queued, unreachable or refused visit does not. An identified family story requires actual disclosure, rather than an anonymous tree or access to global history.

The family tree shows known people and connected unknown relatives. Its cards retain readable sizes. The viewport scrolls and can centre on the selected person, owner or heir when they are in the known tree. Household owner and heir text follows the real inheritance function and the current actor's knowledge.

## Orders, needs and help

Orders belong to the current player. They use the same planner as village work. The task panel supports ordering, cancellation, waiting reasons and progress from real work. A building without materials waits. It never gathers wood automatically.

An idle player stays where left. They can eat accessible food or rest in an available bed at that position. They do not walk away to seek care while idle. Find food and Rest are explicit orders. Running orders retain automatic meals and sleep, then resume. Hunger slows work, so manual idle care remains a deliberate part of play.

Playable children keep explicit movement, conversation, gifts, Find food, Rest and travel. Children can choose Play together with another child. From age six, Help at home can tend eligible household crops in season. Adult construction, field creation and marriage remain unavailable to children. An idle playable child stays where left.

Favours come from actual household harvest, food or fuel needs. Acceptance queues physical work and delivery. Completion awards goodwill once. Death or cancellation gives no completion reward. Already delivered goods and work remain done. See [favours and friends](favours.md).

A fed, rested Personal friend can contribute real work to a funded building or an owned field. The friend keeps their home, belongings, controller and priorities. There is no Recruit action. Household access follows actual residence. Legal ownership, residence, social trust and person-scoped local rights remain separate. Succession does not copy a predecessor's oaths, discoveries, goodwill or community permissions onto another person.

Local elders can receive an independent adult's oath after actual conversation and enough goodwill. The oath grants common gathering rights, without private property access. Actual household residence can also give local recognition. Leaving ends common gathering rights. These rights belong to the person. See [village customs](village-customs.md).

## Marriage, ownership and succession

The player deliberately chooses Court or Ask to marry in a person's panel. Each action queues a real visit and half an hour together. Courtship increases mutual regard through the existing disposition rules. Chat also increases the player's own regard. Ordinary play can therefore reach mutual Intimate with a compatible person.

Marriage requires two living unmarried adults who both place the other at Intimate. Parents, children, siblings and people with shared grandparents are excluded. Player proposals also reject any recorded direct ancestor or descendant beyond the two generations shown in the tree. NPC cousin compatibility keeps its existing two-generation rule. The existing NPC rules impose no sex restriction, and player marriage uses that same policy. Eligibility and mutual consent are checked again when the timed dialogue finishes. A death, earlier marriage, lost ring or exhausted patience can prevent the wedding.

A successful wedding records marriage, memories and a visible celebration notice. It introduces the spouses through actual dialogue. Their close relatives gain six directional goodwill in each direction, subject to existing dispositions and ring limits. Marriage changes neither traits nor tastes. Mutual NPC courtship still waits two seasons. The deliberate player proposal uses its own timed visit instead of an automatic seasonal wedding.

Household formation reuses the NPC function. A couple and dependent children join a family home with room, use an available home, or wait for housing. Homes with a living unrelated owner cannot be taken. Existing buildings, stores, fields, trades, animals and keepsakes survive moves. Marrying an heir gives a future family inheritance path. It does not take a living householder's land.

One inheritance rule applies to assets, visible heir labels and gameplay succession: living spouse, then eldest living child, then the oldest living person in the nearest kinship layer. Age ties use stable identity order. Children, including minors, remain eligible. A living player can inherit from an NPC.

On death, possessions retain their identities and append inheritance provenance. Death, inheritance and gameplay succession produce social events. Dead actors lose active work and cannot finish a gift, promise or asynchronous departure. Their unfinished favours cancel without rewards. Borrowed harvest returns to the ground under its actual ownership. Heirs keep their own belongings and outstanding personal orders. Their former autonomous walks, visits and play stop when control changes.

The successor keeps their existing appearance, age, personality, needs, kin, relationships, household, knowledge, custody and position. The controls, camera, selected person, inventory and task panel follow them. A successor in another visited world hex activates that existing map after normal calendar catch-up. Control transfer adds no journey season. Pending road commitments are retained as a visible paused journey when a traveller becomes the player.

With no living heir, a deterministic new stranger arrives through the existing two-hex camp sequence in the same world. They have a new identity and tastes, no family estate and no followers. Old villages, buildings, ownership, people and stories remain. Shelter limits and camp lookup use the current owner. Another family's camp keeps its bed when the stranger builds.

A completed player-owned house can found a small village. Willing unmarried adult friends with mutual Personal regard can accept a timed invitation to join its household, subject to room. They keep their own possessions and old legal property. Founding adds no titles, feudal wage system, guardian or political hierarchy.

## Small optional people goals

The task panel contains one next hint and a collapsed list of completed milestones. Each actor earns their own evidence:

- Someone in the nearest village at arrival trusts them after actual conversation.
- A speaker discloses an identifiable event from a family's life.
- A friend physically contributes to their work without a request.
- They witness a live wedding between other people.

These records travel with the person. Old history, an anonymous family tree, a queued action or someone else's global event does not complete them. An heir and a new stranger keep their own evidence. The game does not force a friendship or wedding to complete a goal.

## Deferred work

Quests remain a design, with no board, fabricated giver, errands, rewards or mission chains. A future quest must arise from an actual person's situation, knowledge and possessions. It must lapse when its reason disappears. Existing physical favours are the limited implemented help system.

Paid labour, political fealty, nested land titles, guardians controlling marriages, castles, noble recognition, coronation and kingship are deferred. The [phase-two proposal](phase-two.md) preserves the political direction without authorising implementation. Phase one remains an open-ended game about individual people and their families.
