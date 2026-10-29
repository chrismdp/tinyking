# Tiny King: game design

Status: draft, 29 October 2026. Nothing below is built yet unless it says so.

## The pitch

You arrive at the edge of a world hex as a stranger with a camp and nothing else: no house and no followers. You gather wood and food yourself to build a home and plant a field. The people who live there already have villages, homes and families, and they go about their own lives. You earn your place by helping them and getting to know them. You marry into a family, inherit or found a village, and pass it to your children. Over generations a stranger's line becomes a tiny kingdom.

The game is open-ended. Nobody wins; the story just keeps going.

What the player should enjoy:

- watching a small civilisation live its own life
- families meeting, marrying and growing
- a story that comes out of the people, not a script

## The world

**World hex.** One playable map is a world hex: a large hexagon made of small hexes. A world hex has three values, each on a three-step scale:

- morality: good, neutral or evil
- temperature: hot, temperate or cold
- moisture: wet, normal or dry

**The world.** World hexes sit in a larger grid. Neighbouring world hexes differ by at most one step on each axis, so hot never borders cold and good never borders evil. You travel between world hexes by walking off the edge of the map.

**Biomes.** Temperature and moisture together give nine biomes:

|           | dry    | normal    | wet             |
|-----------|--------|-----------|-----------------|
| hot       | desert | savanna   | jungle          |
| temperate | steppe | grassland | marsh           |
| cold      | tundra | taiga     | bog / snowfield |

**Elevation.** High ground is one step colder than the world hex around it, so a temperate world hex has snowy, pine-covered high ground.

For now, biomes change only how the map looks. (Being built on the `world-hex` branch.)

**Morality is a spectrum, and it changes how people behave.** Underneath the three bands (good, neutral, evil), a world hex's morality is a continuous value.

- In a good world hex, people trust strangers sooner and help each other more.
- In an evil one, trust comes slowly and help is grudging.

Morality isn't fixed. When you behave badly (harming people, breaking your word), it drifts towards evil. When you help others, it drifts towards good, gradually making the place better as a whole. The change ripples to neighbouring world hexes, so the one-step rule always holds.

## Trees and wood

Wood builds houses, so how many trees a biome has decides how hard a start there is. Each biome sets the kind of tree and how dense they grow. Every tree still gives wood.

| Biome | Trees | Density | Regrowth |
|---|---|---|---|
| Jungle | broad, round canopy | very dense | fast |
| Taiga | pines | dense | medium |
| Grassland | mixed woods | patches | medium |
| Marsh | willows | scattered | medium |
| Savanna | flat-topped acacias | sparse, lone trees | slow |
| Steppe | scrub | sparse | slow |
| Bog / snowfield | stunted pines | sparse | very slow |
| Tundra | dwarf shrubs | almost none | very slow |
| Desert | palms near water, cacti elsewhere | almost none | almost none |

- **High ground:** trees follow the one-step-colder rule, so hills carry pines.
- **Evil world hexes:** the trees there are dark and withered.
- **Hard and easy starts:** a desert or tundra start is hard, because wood is scarce and you depend on villagers who have some. A jungle start has plenty of wood, but you have to clear land before you can farm. (Being built on the `world-hex` branch.)

**Regrowth.** Today trees never grow back, so chopping strips a map bare in time. That needs fixing now, because the game uses up wood. Trees regrow at a rate set by the biome:

- New saplings appear near existing trees, so woods spread from their edges and a bare plain stays bare.
- A sapling becomes a young tree and then a mature one over a few seasons. Only mature trees give full wood.
- Nothing grows in winter.
- Growth stops at the biome's natural density, so a jungle refills its gaps quickly and a desert barely changes.

**Planting (later).** You, or anyone, can take on a "plant saplings" task to start a wood where none would grow on its own.

## Food and survival

Survival is the smallest version that works. It exists so that time matters: doing someone's harvest means not feeding yourself.

- **Hunger has effects, in stages.** Hungry: you work more slowly. Starving: you're weak, and people find you harder to warm to. Death comes only after days of neglect.
- **Winter is the test.** Nothing grows, and foraging gives little, so what you've stored decides how winter goes. A lord who feeds their people through a hard winter keeps their loyalty.
- **Villagers live under the same rules.** A family running short asks for help, which creates favours. A famine year makes the whole village anxious.
- **Tiredness** stays as it is.
- **Left out for now:** thirst, health, injury and warmth. Warmth is the most likely to come back later, if winter turns out too easy, because cold places would then need firewood.

Today hunger and tiredness rise and the planner sends people to eat and sleep, but going without has no consequences. The hunger stages and winter are new.

## People and families

Everyone belongs to a family, and families live in villages: clusters of houses. Children stay children for a couple of game years, then grow up, so families and marriages move quickly enough to watch. Each person has parents, a spouse and children where they apply. Today's code generates families per house (`generateFamily` in `src/game/map.js`) but doesn't record who is related to whom. That record comes first, because almost everything below depends on it.

Villagers keep running their own lives through the existing HTN planner: work, eat, sleep, farm, haul. The planner stays as it is. Relationships add new options to it; they don't replace it.

## Relationships: the four rings

This is the proxemics model from Sol Trader (blog, April 2015). Each person has a limited number of slots at each level of closeness to other people, the player included. The rings are one-way: see the rule of five below.

| Ring     | Slots | What it gives the player                                                              |
|----------|-------|---------------------------------------------------------------------------------------|
| Public   | many  | They'll trade, and let you do jobs for them.                                           |
| Social   | 5–10  | They gossip about people they know, and you learn their whole family tree.             |
| Personal | 4–6   | They help you: building your house, working your fields, siding with you.              |
| Intimate | 1–2   | Marriage becomes possible.                                                             |

The slots are limited, so someone new moving closer can push someone else further out. Jealousy and rivals come out of this without extra rules. Relationships you neglect slowly drift outwards.

**Goodwill** moves you inwards. You earn it mainly by doing jobs for people, and also by chatting, gifts, and helping people they care about. Doing harm to someone loses goodwill with them and with the people close to them.

## You do the work yourself

You start alone, and nobody works for you. You direct your own character from a **task list**: the jobs you have agreed to do for others, plus your own work. Your character walks there and does each task. There's no doing it from a distance, and while you're busy for one person, you aren't helping another.

**Your own work: from a camp to a farm.**

1. **Camp.** You start with a campfire and a bedroll at the edge of the map. It's somewhere to sleep, with nothing stored.
2. **Gather.** Chop wood in the woods, forage for berries and roots, and carry it all back to the camp. Felling trees and hauling already exist.
3. **Build.** Wood becomes a house in stages: a lean-to, then a hut, then a proper house. Each stage takes wood and time, and more hands make it faster.
4. **Farm.** Clear and plant your own field, then sow and harvest it. All of this already exists.

Food is the pressure. Foraging only just keeps you fed, so time spent on other people's jobs is time not spent feeding yourself. That trade-off is the game's first real decision.

**How you control your character.** You give your character orders the way you give orders now, and each order goes onto your task list. Your character works through the list, running on the same planner as everyone else.

**Other people's jobs: favours.** When villagers want help (with the harvest, fetching wood, mending a fence), their requests appear as a list of favours. You choose which to accept, and accepted favours join your task list. You earn goodwill by doing them. The job queue and the planner's job handling already exist; what changes is who posts the jobs and who takes them.

Once you are in someone's Personal ring, they put "help my friend" high in their own priorities, so they turn up to help with your house and field. Their loyalty shows in what they actually do, through the planner.

## Who helps you, and why

People help you for one of three reasons, and each works differently.

**Because they care.** Kin and friends in your Personal ring help for free. They expect help back, though: if you ignore their harvest, they drift outwards. Medieval villages ran on this kind of exchange; neighbours came for each other's harvests ("boon work").

**Because you pay them.** You hire hands with food or goods. It's quick and doesn't need a friendship, but it's a contract, not a bond:

- While someone works for you for pay, they can't come closer than Social.
- Offering pay to someone who already helps you out of care insults them, and they drop a ring. Paying for what was given freely spoils it, which is a real effect in people.
- Hired hands stop when the pay stops.

**Because they swore to you.** Someone in your Personal ring who lives on land you hold can swear fealty: a public oath, which was how medieval bonds of service worked. The oath runs both ways:

- They share your job queue. When you set yourself a task ("I'm going to clear that field"), a sworn follower can take it and do it for you. There are no separate duties to track.
- You owe them protection, food in a hard winter, and fair judgement in their quarrels.
- If you break your side, the oath breaks, and everyone close to them hears about it.

## The feudal ladder

The existing code already models "who answers to whom": each person has a controller (`controllable.controllerId`), and `topController` walks up the chain. That is a feudal hierarchy, so it can carry this ladder directly:

1. **Stranger:** a camp and nothing else.
2. **Head of a family:** your own house, and a spouse or children living in it.
3. **Lord of a hamlet:** a few households living on your land and sworn to you.
4. **Lord of a town:** a larger settlement, with hamlet lords sworn to you.
5. **Tiny King:** town lords swear fealty to you.

You climb a rung by marriage, inheritance, or gathering people who swear to you. Each rung adds a layer of people who answer to you, and those layers are exactly what the controller chain already records.

**Land is divided into fixed areas, as in Crusader Kings III.** The areas are drawn when the map is generated, using nested hexes where seven of each size make the next:

| Area | Made of | Small hexes |
|---|---|---|
| Household | 1 hex | 1 |
| Hamlet | a flower of 7 hexes (one hex and its six neighbours) | 7 |
| Town | 7 hamlets | 49 |
| Kingdom | 7 towns | 343 |

A world hex is about 400 small hexes, so one kingdom roughly fills one world hex. Seven-hex flowers tile the map exactly. Groups of seven flowers don't make a perfect larger hexagon, so town borders come out slightly ragged, which suits medieval estates.

**Each area is a title**, and a title exists whether or not anyone holds it. Every hamlet, town and kingdom has a name, and "who holds this?" always has an answer, even if the answer is nobody.

- You hold a hamlet when you live in it and its households are sworn to you.
- You hold a town when most of its seven hamlets are held by you or by lords sworn to you.
- Titles pass by inheritance, and you can grant a hamlet you hold to a sworn follower, who becomes its lord under you.
- Villages are generated inside these areas, so the first villagers already hold hamlets. Taking one over by marriage then works naturally.
- An overlay shows the borders and who holds each title.

**Lords control marriages.** When a lord dies and the heir is a child, the liege (the lord above) becomes the child's guardian and decides who the heir marries. Historically this was how land changed hands. In the game, marrying heirs within your realm becomes the main political tool.

## The rule of five

Of every five people you meet, one will love you, three will like you, and one will hate you, whatever you do.

- **The one who loves you** warms to you quickly, starts at Social, and can reach Intimate.
- **The three who like you** start at Public. How close they get depends on what you do: help them, and they move in; neglect them, and they drift out. This middle group is where most of the game is played.
- **The one who hates you** never gets past Public. They take your help without thanks, speak badly of you to the people close to them, and side against you.

Who lands in which fifth isn't random, and it isn't mutual either. Every person has **traits** (what they are: hard-working, generous, proud, pious) and **tastes** (what they like and dislike in others). How much A likes B depends on B's traits measured against A's tastes, so A and B can feel quite differently about each other. Thresholds are set once, when the world is generated, so that across everyone, one in five opinions is love, three are liking, and one is hate. Your character has traits and tastes like everyone else, so a different character wins over different people.

**Relationships are one-way.** Each person keeps their own list of the people they know, with a ring and goodwill for each. A can have B in their Personal ring while B has A only at Social. Unrequited love, a friend who's fonder of you than you are of them, and a rival who doesn't know they're a rival all come from this.

What depends on which direction:

- **Help** follows *their* ring for you: they help you if you're in their Personal ring.
- **Marriage** needs both directions to reach Intimate.
- **Gossip** carries the speaker's own view of the person they're talking about.
- **Reading people.** You don't see exactly how someone feels about you. At Public you only see a hint (polite, warm, cool). As they trust you more, you see the truth. Gossip can let it slip, for example "she's sweet on you".

Haters matter through the family tree too. If the father of the woman you want to marry is in your bottom fifth, he is a real obstacle.

## Knowledge

You start knowing only what you can see. As people trust you more, they tell you more:

- **Public:** names and where people live.
- **Social:** the person's whole family tree, plus gossip: who they know, how they feel about them, where someone was last seen.
- **Personal:** private matters, such as feuds, debts and who is courting whom.

**Family tree view.** Each person you know has a family tree. It fills in as you learn more, and the parts you don't know yet are shown as unknown, not hidden. The tree is the main way to see the social map: who is married to whom, who will inherit, and who could marry your children.

Conversations follow Sol Trader's patience rule: each conversation has limited patience, and closer friends have more of it. Talking is a set of actions (chat, ask about someone, offer help, give a gift), not written dialogue. The rings and gossip carry the story, so the game doesn't need a large amount of written content.

## Marriage, ownership and succession

**Who owns a village.** Each village has an owner, the head of the family that founded it or inherited it. Ownership passes by inheritance: to a spouse or the eldest child, under one simple rule for now. The code's existing control hierarchy (`controllable.controllerId`, `topController`) already describes "who answers to whom" and can carry this.

**Marriage** needs a person in your Intimate ring, and the wedding joins two families. Marrying the heir of a village is the main way to come to own it. Marriage also brings the other family's goodwill: your in-laws start out closer to you.

**Succession.** You play a character, not a dynasty. When your character dies, you continue as their heir, keeping what the family owns and the relationships the heir has made. If you die with no heir, you start again as a new stranger arriving in the same world. Everything you built stays: the village, the people who knew you and the stories they tell.

**Founding.** Alternatively, you can build your own house and gather a following (people in your Personal ring) into a new village that you own.

## What this asks of the existing code

- **Family relationships:** parent, spouse and child links per person. New, and needed first.
- **Per-person relationship lists with the four rings and goodwill:** new.
- **Jobs posted by villagers and taken by the player:** reuses the job queue (`manager.js`) and the `check_jobs` task.
- **Ageing, death, births and marriage over time:** the code already has days, seasons and the `dead` flag; births and ageing are new.
- **Recruiting:** today a single job. In this design it is replaced by reaching someone's Personal ring.
- **Start:** today the player starts in the middle with a house. In this design they start at a camp at the map edge.
- **A task list for the player's character:** new. It can reuse the job queue, scoped to one person.
- **Foraging, and building in stages from wood:** new. Felling trees, hauling, fields and stockpiles already exist.
- **Personality traits and tastes:** new. The existing `traits` component holds temporary states (hungry, cold, planted), not personality, so personality is a separate addition.
- **One-way relationship lists per person:** new, with the rule-of-five thresholds set at world generation.

## First prototype: the arrival

The smallest version that tests whether this is fun:

1. Start at a camp at the edge of the map, with no house.
2. A task list for your character. You chop wood, forage, and build a lean-to and then a hut.
3. Two or three villages of related families, with the relationships recorded.
4. The four rings and goodwill, with the ring shown on a person when you select them. The rule of five decides each person's starting ring and how close they can get.
5. Villagers post two kinds of job: help with the harvest, and fetch wood. You accept a job, do it, and earn goodwill.
6. Reaching Social shows that person's family tree.
7. Reaching Personal makes them come and help with your house.
8. Hunger with stages, so time spent helping others costs you something.
9. Trees regrow at the biome's rate, so wood isn't used up for good.

Marriage, succession, gossip, sworn followers and travel between world hexes come after this, and only if the arrival is fun.

## Decided

- **No winning.** The game is open-ended.
- **Start alone.**
- **Orders.** You give your character orders as now, and they form a task list. Favours appear as requests you can accept onto that list.
- **Sworn followers share your job queue.** No detailed feudal duties.
- **Children grow up after a couple of game years.**
- **Land is divided into fixed areas** (nested hexes: hamlet of 7, town of 49, kingdom of 343), each one a title, as in Crusader Kings III.
- **Dying with no heir** means starting again as a new stranger in the same world.
- **Morality is a spectrum.** It changes trust and helpfulness, and your behaviour moves it.
- **The rule of five comes from traits and tastes, and relationships are one-way.**
- **Morality changes spread.** When your behaviour moves a world hex's morality, any neighbour now more than one step away is pulled along to within one step. That can pull its own neighbours in turn, so the change ripples outwards until the one-step rule holds everywhere again. What you do in one place gradually shifts the world around it.
