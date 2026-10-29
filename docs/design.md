# Tiny King: game design

Status: draft, 29 October 2026. Nothing below is built yet unless it says so.

## The pitch

You arrive at the edge of a world hex as a stranger, with nothing: no house and no followers. The people who live there already have villages, homes and families, and they go about their own lives. You earn your place by helping them and getting to know them. You marry into a family, inherit or found a village, and pass it to your children. Over generations a stranger's line becomes a tiny kingdom.

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

## Jobs: the queue turned around

Today the player posts jobs and villagers carry them out. In this design villagers post the jobs they need done (help with the harvest, fetch wood, mend a fence), and the player takes them to earn goodwill. The job queue and the planner's job handling already exist; only who posts and who takes changes.

Once you are in someone's Personal ring, they put "help my friend" high in their own priorities. Their loyalty then shows in what they actually do, through the planner.

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
- **Start:** today the player starts in the middle with a house. In this design they start at the map edge with no house.

## First prototype: the arrival

The smallest version that tests whether this is fun:

1. Start at the edge of the map, with no house.
2. Two or three villages of related families, with the relationships recorded.
3. The four rings and goodwill, with the ring shown on a person when you select them.
4. Villagers post two kinds of job: help with the harvest, and fetch wood. Doing one gains goodwill.
5. Reaching Social shows that person's family tree.
6. Reaching Personal makes them help you build your first house.

Marriage, succession, gossip and travel between world hexes come after this, and only if the arrival is fun.

## Open questions

- **What is winning?** Ruling the whole world hex, a line that lasts a number of generations, or no end at all, just a story that keeps going?
- **Time per generation.** How long should one generation take to play?
- **Starting alone or not.** Does the player start alone, or with a spouse or companion?
- **How much morality matters.** How strongly should a world hex's good or evil change people's behaviour?
