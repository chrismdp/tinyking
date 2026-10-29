# Tiny King: game design

Status: draft, 29 October 2026. Nothing below is built yet unless it says so.

## The pitch

You arrive at the edge of a world hex as a stranger with a camp and nothing else: no house and no followers. You gather wood and food yourself to build a home and plant a field. The people who live there already have villages, homes and families, and they go about their own lives. You earn your place by helping them and getting to know them. You marry into a family, inherit or found a village, and pass it to your children. Over generations a stranger's line becomes a tiny kingdom.

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

For now, biome and morality change only how the map looks. Later they should change who lives there and what happens. For example, strangers might be trusted more slowly in an evil world hex. (Being built on the `world-hex` branch.)

## People and families

Everyone belongs to a family, and families live in villages: clusters of houses. Each person has parents, a spouse and children where they apply. Today's code generates families per house (`generateFamily` in `src/game/map.js`) but doesn't record who is related to whom. That record comes first, because almost everything below depends on it.

Villagers keep running their own lives through the existing HTN planner: work, eat, sleep, farm, haul. The planner stays as it is. Relationships add new options to it; they don't replace it.

## Relationships: the four rings

This is the proxemics model from Sol Trader (blog, April 2015). Each person has a limited number of slots at each level of closeness to other people, the player included:

| Ring     | Slots | What it gives the player                                                              |
|----------|-------|---------------------------------------------------------------------------------------|
| Public   | many  | They'll trade, and let you do jobs for them.                                           |
| Social   | 5–10  | They gossip about people they know, and you learn their whole family tree.             |
| Personal | 4–6   | They help you: building your house, working your fields, siding with you.              |
| Intimate | 1–2   | Marriage becomes possible.                                                             |

The slots are limited, so someone new moving closer can push someone else further out. Jealousy and rivals come out of this without extra rules. Relationships you neglect slowly drift outwards.

**Goodwill** moves you inwards. You earn it mainly by doing jobs for people, and also by chatting, gifts, and helping people they care about. Doing harm to someone loses goodwill with them and with the people close to them.

## You do the work yourself

Nobody works for you at the start. You direct your own character from a **task list**: the jobs you have agreed to do for others, plus your own work. Your character walks there and does each task. There's no doing it from a distance, and while you're busy for one person, you aren't helping another.

**Your own work: from a camp to a farm.**

1. **Camp.** You start with a campfire and a bedroll at the edge of the map. It's somewhere to sleep, with nothing stored.
2. **Gather.** Chop wood in the woods, forage for berries and roots, and carry it all back to the camp. Felling trees and hauling already exist.
3. **Build.** Wood becomes a house in stages: a lean-to, then a hut, then a proper house. Each stage takes wood and time, and more hands make it faster.
4. **Farm.** Clear and plant your own field, then sow and harvest it. All of this already exists.

Food is the pressure. Foraging only just keeps you fed, so time spent on other people's jobs is time not spent feeding yourself. That trade-off is the game's first real decision.

**Other people's jobs: the queue turned around.** Today the player posts jobs and villagers carry them out. In this design villagers post the jobs they need done (help with the harvest, fetch wood, mend a fence). You accept them onto your task list and do them yourself to earn goodwill. The job queue and the planner's job handling already exist; only who posts and who takes changes. Your own character can also run on the planner, with your task list as its jobs.

Once you are in someone's Personal ring, they put "help my friend" high in their own priorities, so they turn up to help with your house and field. Their loyalty shows in what they actually do, through the planner.

## Who helps you, and why

People help you for one of three reasons, and each works differently.

**Because they care.** Kin and friends in your Personal ring help for free. They expect help back, though: if you ignore their harvest, they drift outwards. Medieval villages ran on this kind of exchange; neighbours came for each other's harvests ("boon work").

**Because you pay them.** You hire hands with food or goods. It's quick and doesn't need a friendship, but it's a contract, not a bond:

- While someone works for you for pay, they can't come closer than Social.
- Offering pay to someone who already helps you out of care insults them, and they drop a ring. Paying for what was given freely spoils it, which is a real effect in people.
- Hired hands stop when the pay stops.

**Because they swore to you.** Someone in your Personal ring who lives on land you hold can swear fealty: a public oath, which was how medieval bonds of service worked. The oath runs both ways:

- They owe you labour (a few days a week on your fields, more at harvest) and come when you call.
- You owe them protection, food in a hard winter, and fair judgement in their quarrels.
- If you break your side, the oath breaks, and everyone close to them hears about it.

## The feudal ladder

The existing code already models "who answers to whom": each person has a controller (`controllable.controllerId`), and `topController` walks up the chain. That is a feudal hierarchy, so it can carry this ladder directly:

1. **Stranger:** a camp and nothing else.
2. **Cottager:** a hut and a small plot. You're now someone with a place.
3. **Householder:** a house, a field, a family and perhaps hired hands.
4. **Lord of a village:** by marriage, inheritance, or founding a village with people sworn to you. You hold the land; families live on it and owe you service.
5. **Tiny King:** the lords of other villages swear fealty to you.

**Lords control marriages.** When a lord dies and the heir is a child, the liege (the lord above) becomes the child's guardian and decides who the heir marries. Historically this was how land changed hands. In the game, marrying heirs within your realm becomes the main political tool.

## Not everyone likes you

Each person has traits, and so does your character. How well your traits match theirs sets the closest ring they will ever let you into. Some people will only ever be Public, however much you help them. A few dislike you on sight. They take your help without thanks, speak badly of you to the people close to them, and side against you.

These people also matter through the family tree. The surly father of the woman you want to marry is a real obstacle.

## Leading a village: Lencioni's five layers

The rings describe one person's closeness to you. Once you lead a household or a village, the group as a whole needs its own measure. Patrick Lencioni's pyramid from *The Five Dysfunctions of a Team* and *The Advantage* gives one. Each layer stands on the one below it:

1. **Trust.** People believe you mean well. Without it, nothing above works.
2. **Conflict.** People argue with you openly, instead of grumbling where you can't hear.
3. **Commitment.** Once a plan is decided, everyone backs it, even people who argued against it.
4. **Accountability.** Villagers hold each other to what was agreed, so you don't have to.
5. **Results.** The village works for shared goals, not just for each family.

In play, each layer you reach unlocks something, and each layer you lack shows up as a problem:

- **Low trust** means people hide problems from you.
- **No open conflict** means grudges build up quietly.
- **Weak commitment** means jobs get half-done.
- **No accountability** means a lazy villager drags everyone down.
- **Results** let you give the village one shared goal, such as "bring in the harvest before winter", and it organises itself.

This gives running a village its own gameplay that is separate from making friends.

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

**Succession.** You play a character, not a dynasty. When your character dies, you continue as their heir, keeping what the family owns and the relationships the heir has made. Dying without an heir ends the game.

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
- **Trait compatibility setting the closest ring:** new, built on the existing traits (`src/game/traits.js`).

## First prototype: the arrival

The smallest version that tests whether this is fun:

1. Start at a camp at the edge of the map, with no house.
2. A task list for your character. You chop wood, forage, and build a lean-to and then a hut.
3. Two or three villages of related families, with the relationships recorded.
4. The four rings and goodwill, with the ring shown on a person when you select them. Traits cap how close some people will let you get.
5. Villagers post two kinds of job: help with the harvest, and fetch wood. You accept a job, do it, and earn goodwill.
6. Reaching Social shows that person's family tree.
7. Reaching Personal makes them come and help with your house.

Marriage, succession, gossip, the five layers and travel between world hexes come after this, and only if the arrival is fun.

## Open questions

- **What is winning?** The feudal ladder suggests an answer: every village lord in the world hex has sworn to your line. Is that it, or is there no end at all, just a story that keeps going?
- **Feudal duties.** Is the service a sworn follower owes worth modelling in detail (days of labour, rent in kind), or should it be a simple "they help when asked"?
- **Time per generation.** How long should one generation take to play?
- **Starting alone or not.** Does the player start alone, or with a spouse or companion?
- **How you control your character.** Do you give your character orders from the task list and watch them carry the orders out, as now? Or do you steer them directly?
- **How much morality matters.** How strongly should a world hex's good or evil change people's behaviour?
