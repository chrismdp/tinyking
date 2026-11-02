# Tiny King: game design

Status: core loop, 1 November 2026. This describes the implemented game. The separate [phase-two proposal](phase-two.md) remains a design only. Quests remain deferred.

## A life among people

A stranger arrives, finds their mother’s family, and becomes part of a village whose people they come to love, and grieve.

You arrive as a stranger with a camp, no house and no followers. Villages already have families, possessions and forty-five years of history. You meet people, help with real work, build a home and form a family. You play one person at a time. When that person dies, their heir can become the next player. The world continues without a victory screen.

The game aims to make these activities enjoyable:

- Watch villagers work, visit, court, marry and raise children.
- Learn named families' stories through conversations and remembered possessions.
- Earn help and make a home through relationships.
- Follow a family across generations in a persistent world.

## The world and time

Each local map is a world hex for travel and administration. Its edges do not
bound its habitat. Temperature, annual moisture and altitude form one continuous
landscape. The nine named biomes blend across and within reaches. Long mountain
belts, secondary ridges and lowlands share one world-coordinate height field.
Annual moisture moves along a seeded prevailing wind, with coastal supply and
drier rain shadows. Reach climate labels summarise these conditions.
[Geography](geography.md) describes terrain, habitats, passes, paths and placement.
Grey roads connect map edges, passes and village approaches. Local ways to homes,
fields and workplaces are brown tracks. Historical journeys seed their walking
wear before arrival.

Trees and forage use each tile's habitat mixture for species and density.
Individual plants retain a definite type and its growth rules. Trees regrow
through seasonal saplings near existing woods. Winter pauses growth. Fields use
real crop patches, seasonal growth, household permissions and harvested grain.
Local temperature and altitude control freezing, snow and crop growth. Weather
retains the hourly pressure model. Rain, snow, wind and storms affect presentation.
They do not introduce injury, warmth or storm damage.

A journey plans adjacent land hops. The normal planner walks through each hex
to its exit, using the road where available. Each hop advances one season and
arrives at the matching edge at dawn. When exhausted, the traveller camps at their
position, sits by the fire, and resumes after rest. Visited maps retain their people, buildings,
stores and ownership. Only the current hex runs live. Away communities advance
through seasonal history. Their snapshots still remain in memory until per-hex
storage and eviction are implemented. See [travel](travel.md).

Each season lasts seven days. The last evening brings a village festival.
After its night, a page shows only real events the player knows. Begin the new
season to continue from dawn.

The gameplay camera has a fixed local zoom limit. A separate top-down
[world map](realm-map.md) opens with World map or M. It shows biomes, known
hexes, discovered communities, recorded roads and a planned journey.
Opening it does not pause time or generate detailed maps.

## People and history

Each person has a stable identity, parents, spouse, children, developmental age, personality and directional relationships. Dead people remain historical records. Families own houses, fields, stores, trades, animals, tools and keepsakes. Items retain the identities of their makers and earlier owners. [People](people.md), [social life](social.md) and [village life](villages.md) describe these systems.

Generated history contains only the existing residents. The newly created stranger does not age, marry, die, meet villagers or inherit property during those forty-five years. Their lifecycle starts at arrival. After arrival, their actual person ages in live play and on the road. Reference-only people do not take a second local seasonal update.

Children reach developmental age 18 in two game years. Adults then gain two displayed years per game year. Old-age deaths use the shared seasonal probability from age 60 and the final age-88 boundary. Missed meals never cause starvation deaths.

NPC adults choose visits through the planner. Mutual Intimate relationships, recent conversation, kin exclusions, available housing and two seasons of courtship govern automatic NPC marriage. Automatic matchmaking never selects the player. Married player couples can have children through the shared age, residence, demographic and birth-cooldown rules. Marriage is the standing consent for this shared family simulation. Births do not require a separate player order.

## Relationships and disclosure

Player conversations use the paused panel and authored lines described in [Conversations](conversations.md). Topic and person pairs change the NPC's regard for the player, whichever speaker completes them. Patience slots recover over game time. A spoken fact reveals only its stated knowledge.

Relationships are one-way. Each observer has their own goodwill and limited slots:

| Ring | Slots | Goodwill | Effect |
| --- | --- | --- | --- |
| Public | Unlimited | 0 | Basic contact and trade |
| Social | 10 | 10 | Family disclosure and gossip |
| Personal | 6 | 30 | Unsolicited physical friend help |
| Intimate | 2 | 60 | Possible marriage with mutual consent |

Traits and tastes set directional dispositions. Hate permits Public, liking permits Personal, and love permits Intimate. Goodwill never changes those tastes. Ring displacement and drift still apply. A player can feel differently from the person they court.

Selecting a stranger does not introduce them. Names, biographies, events and possession stories use the current actor's actual knowledge. Completed conversations record spoken contact. An ordered, unreachable or refused visit does not. An identified family story requires actual disclosure, rather than an anonymous tree or access to global history.

The family tree shows known people and connected unknown relatives. Its cards retain readable sizes. The viewport scrolls and can centre on the selected person, owner or heir when they are in the known tree. Household owner and heir text follows the real inheritance function and the current actor's knowledge.

## Orders, needs and help

Orders belong to the current player. They use the same planner as village work. A new order cancels the current order. Delivered goods and completed work stay done. A compact strip shows energy, current activity and Stop. The Journal opens with its button or J and contains family goals, Life here, favours and work details. A building without materials waits. It never gathers wood automatically.

Energy is the player's daily work budget. Physical work spends it. Chatting is free.
Low energy slows work. At zero, work waits for food or sleep. Eat consumes a
specific carried or owned portion. The player never searches for a meal automatically.
Rest walks home and sleeps. A bed restores more energy than rough ground or a
camp bedroll. Late nights and collapse reduce the next morning's recovery.
Work and visits remain available after dark. At zero energy the player walks
home and sits by their fire or camp. At 11pm they turn in unless in a conversation. See [energy](survival.md).

Villagers retain real meals and household larders. Low reserves cause food
requests, and ripe crops cause harvest requests. Missed meals cannot kill them.

Playable children keep explicit movement, conversation, gifts, Eat, Rest and travel. Children can choose Play together with another child. From age six, Help at home can tend eligible household crops in season. Adult construction, field creation and marriage remain unavailable to children. An idle playable child stays where left.

Favours come from actual household harvest, food or fuel needs. Acceptance through a chat line starts physical work in place of the current order and authorises delivery. Completion awards goodwill once. Death or cancellation gives no completion reward. Already delivered goods and work remain done. See [favours and friends](favours.md).

A fed, rested Personal friend can contribute real work to a funded building or an owned field. The friend keeps their home, belongings, controller and priorities. There is no Recruit action. Household access follows actual residence. Legal ownership, residence, social trust and person-scoped local rights remain separate. Succession does not copy a predecessor's oaths, discoveries, goodwill or community permissions onto another person.

Local elders can receive an independent adult's oath after actual conversation and enough goodwill. The oath grants common gathering rights, without private property access. Actual household residence can also give local recognition. Leaving ends common gathering rights. These rights belong to the person. See [village customs](village-customs.md).

## Seasons and gatherings

Each village gathers at its green on the last evening of each seven-day season.
Seedwake Fair welcomes spring sowing. Midsummer Gathering gives courting couples
time together. Harvest Hearth honours real harvests and favours from the year.
Longest-night Vigil remembers the year's recorded dead. Every door is open.
The gathering changes no household access or legal ownership.

Villagers walk there and remain available for chat. The festival panel offers one Attend action and at most four nearby people, prioritising the player’s family search, friends and known favours. Other people remain clickable in the world. Attendance gives two goodwill
with villagers present, once per season. Midsummer conversations use the existing
marriage rules, including consent, kin exclusions, housing and two seasons of courtship.
The player receives no forced wedding. Authored chat openings live in the generated catalogue.

After festival night, the season-turn page pauses at dawn. It shows known births,
marriages, deaths, moves, harvests, buildings, favours and other recorded events.
Life events come first, routine work is grouped by kind, and a short account of the player’s own season follows. The page has at most six entries, with an overflow count for extra known news. Sealed family secrets and unheard events stay hidden. A quiet season can have no news.
The player must choose Begin to start the new season.

## Marriage, ownership and succession

The player deliberately chooses Court or Ask to marry in a person's panel. Each action orders a real visit and half an hour together. Courtship increases mutual regard through the existing disposition rules. Chat changes the NPC's regard through matching icons. Courtship can build mutual Intimate regard with a compatible person.

Marriage requires two living unmarried adults who both place the other at Intimate. Parents, children, siblings and people with shared grandparents are excluded. Player proposals also reject any recorded direct ancestor or descendant beyond the two generations shown in the tree. NPC cousin compatibility keeps its existing two-generation rule. The existing NPC rules impose no sex restriction, and player marriage uses that same policy. Eligibility and mutual consent are checked again when the timed dialogue finishes. A death, earlier marriage, lost ring or exhausted patience can prevent the wedding.

A successful wedding records marriage, memories and a visible celebration notice. It introduces the spouses through actual dialogue. Their close relatives gain six directional goodwill in each direction, subject to existing dispositions and ring limits. Marriage changes neither traits nor tastes. Mutual NPC courtship still waits two seasons. The deliberate player proposal uses its own timed visit instead of an automatic seasonal wedding.

Household formation reuses the NPC function. A couple and dependent children join a family home with room, use an available home, or wait for housing. Homes with a living unrelated owner cannot be taken. Existing buildings, stores, fields, trades, animals and keepsakes survive moves. Marrying an heir gives a future family inheritance path. It does not take a living householder's land.

One inheritance rule applies to assets, visible heir labels and gameplay succession: living spouse, then eldest living child, then the oldest living person in the nearest kinship layer. Age ties use stable identity order. Children, including minors, remain eligible. A living player can inherit from an NPC.

On death, possessions retain their identities and append inheritance provenance. Death, inheritance and gameplay succession produce social events. Dead actors lose active work and cannot finish a gift, promise or asynchronous departure. Their unfinished favours cancel without rewards. Borrowed harvest returns to the ground under its actual ownership. Heirs keep their own belongings and outstanding personal orders. Their former autonomous walks, visits and play stop when control changes.

The successor keeps their existing appearance, age, personality, needs, kin, relationships, household, knowledge, custody and position. The controls, camera, selected person, inventory and status strip follow them. A successor in another visited world hex activates that existing map after normal calendar catch-up. Control transfer adds no journey season. Pending road commitments are retained as a visible paused journey when a traveller becomes the player.

With no living heir, a deterministic new stranger arrives through the existing two-hex camp sequence in the same world. They have a new identity and tastes, no family estate and no followers. Old villages, buildings, ownership, people and stories remain. Shelter limits and camp lookup use the current owner. Another family's camp keeps its bed when the stranger builds.

A completed player-owned house can found a small village. Willing unmarried adult friends with mutual Personal regard can accept a timed invitation to join its household, subject to room. They keep their own possessions and old legal property. Founding adds no titles, feudal wage system, guardian or political hierarchy.

## Small optional people goals

The Journal contains one next hint and completed milestones. Each actor earns their own evidence:

- Someone in the nearest village at arrival trusts them after actual conversation.
- A speaker discloses an identifiable event from a family's life.
- A friend physically contributes to their work without a request.
- They witness a live wedding between other people.

These records travel with the person. Old history, an anonymous family tree, an unfinished order or someone else's global event does not complete them. An heir and a new stranger keep their own evidence. The game does not force a friendship or wedding to complete a goal.

## Deferred work

Quests remain a design, with no board, fabricated giver, errands, rewards or mission chains. A future quest must arise from an actual person's situation, knowledge and possessions. It must lapse when its reason disappears. Existing physical favours are the limited implemented help system.

Paid labour, political fealty, nested land titles, guardians controlling marriages, castles, noble recognition, coronation and kingship are deferred. The [phase-two proposal](phase-two.md) preserves the political direction without authorising implementation. Phase one remains an open-ended game about individual people and their families.
