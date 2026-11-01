# Conversations

Choose Chat in a person's panel, or use the next-step hint. Your character walks into speech reach. An indoor neighbour receives a knock at their real door and comes outside to talk. A sleeper gives no answer: try in the morning. An unfriendly neighbour refuses before you set off; a liked gift or an offered favour can repair goodwill, while their fixed disposition stays the same. The conversation panel pauses the world until you choose End chat. Reading has no time cost.

Each spoken line adds topic, person or mood icons. Two identical live icons pop. Every pop changes the NPC's regard for you, whichever person completes the pair. Topic scores come from the NPC's existing traits and tastes. A neutral pair costs 0.25 goodwill. Each person icon uses that person's stable identity. Each choice marks the icons that match the row before you choose it.

The panel shows the remaining patience slots. The NPC's actual ring and goodwill set the maximum, from six to twelve when rested. Surviving icons spend slots when the chat closes. Slots recover over game hours, faster with closer relationships. Unmatched icons stay until a matching line removes the pair. The panel labels occupied and resting slots. A full row ends the chat after any pending answer.

The person sheet starts with unknown topic and mood tastes. A pop reveals only the tested taste. Pops do not change the player's regard in version one. The reaction text states the NPC's name and the signed change.

The shipped data contains 1,365 authored rows in `src/data/conversation_lines.json`. The engine binds each row to people, events, activities, needs and knowledge. A missing binding or false condition rejects the row. Selection chooses a purpose and a real situation, then uses seeded weights for the wording. Spoken IDs cannot repeat during a chat. Catalogue account IDs include the event identity, so different events of one type remain available. The NPC avoids their last wording for that situation on the next encounter.

Each NPC question, name request, offer, referral or warning declares `expects` in the catalogue. Player answers declare `answers`. A direct answer stays among the next choices even when the row is full, the player is tired, another subject is selected, or ordinary topics have been spent. The chat finishes its pending exchange before applying its usual closing rule.

Villagers can approach the player through the same navigation and open this paused panel with any authored opening. Woodland witnesses use this path. The warning seeds Village and Woodland icons; both catalogue replies stop forbidden cutting and preserve the fixed witness and elder losses. These consequential lines do not add matching rewards. The defiant reply also adds a grievance and records the defiance as a real event.

Chat requires three free cells. The opening supplies two icons, or three when at least five cells are free. This gives the player a match from the first turn.

Other subjects offers family, work, news, help, village and season choices. Ordinary chats include weather, questions about the lands and questions about open needs. The lands use real villages, routes, terrain and recorded journeys. Heard needs become the next-step hint. A referral does not authorise acceptance. The requester must ask in person.

You can select a known person as the news subject. A question does not inspect the NPC's hidden knowledge. Their answer can disclose a permitted fact, refuse on trust grounds, or report that they have no further news.

A first exchange establishes acquaintance. Nearby strangers with real needs show anonymous speech hints. The hint teaches no name or request identity. An adult can offer a real household favour after completed contact. Acceptance and decline are chat lines. Acceptance also authorises the existing physical collection, work and delivery order. Speech awards no favour completion reward.

Visit news requires an event the speaker knows, and a visitor the player knows or a notable visitor. Other people's visits do not enter the player's feed without spoken disclosure. Family and gossip events use the shared event disclosure policy. Telling an event calls `learnEvent`, including its once-only family reactions.

The save graph includes active chats, remaining slots, recovery credit, topic evidence, person reactions, used claims, last wording, encounter counts and spoken event sources. Conversation records travel with either participant. Visited maps retain other local records. Eligible elders offer oath and leaving lines inside normal Chat. Their authored explanation includes the full rights and obligations before a separate answer. The elder’s sheet can also queue Chat directly about the oath or leaving, with eligibility checked before departure and at acceptance. A necessary customs opening reserves room to speak even when ordinary patience is spent. Gifts, courtship, marriage and household invitations retain their existing buttons.

Each catalogue line declares a `level`, the closeness or village standing that it needs. The four closeness rings are Public, Social, Personal and Intimate. Standing uses the listener's village and the player's own oath or household membership. Leaving that village removes this standing. Below the declared level, `below: "hide"` removes a line and `below: "risk"` marks it with a visible warning.

Pushing a stranger for work costs two goodwill and gets a rebuff. Ordinary help enquiries retain the introduction rule for timid or proud listeners. An intrusive death question or flirt needs Personal closeness. Below that level, it costs three goodwill and adds a grievance. Asking to speak in confidence stays hidden until Intimate closeness. Safe lines apply their normal effects and matching scores.

A grievance cannot match another icon. It uses one slot until the conversation closes and costs an extra two goodwill when added. Woodland defiance keeps the warning's existing costs and adds this extra loss. The defiance event records the player, witness, village, chosen line and spoken words. Both participants know it. An event sentence and authored account support later disclosure. NPC gossip spreading and overheard snippets remain separate work.

When the NPC asks for an answer, the direct answer leads the choices. At most one maternal family-search question appears beside it. A full or tired row still permits the required answer.

## Moods and evasive answers

Guarded, Grumbling, Cheerful and Joking are separate mood icons. Each person has stable hidden likes and dislikes for these moods. Personality traits and tastes bias these preferences. Seeded variation decides a preference when those influences balance. Mood tastes remain separate from topic tastes, and show `?` until a pair pops. A pop reveals only that mood and changes the NPC’s regard, whichever speaker completes it.

An evasive answer costs one goodwill from the listener towards the speaker. It adds a Guarded icon. The NPC can commiserate, completing the pair with the same mood. An NPC can also evade a family or news question. The player can answer with “I hear you” or leave the icon alone. Moods offers ordinary grumbling, cheerful and joking lines. Grievances remain unmatchable.

## Tell real stories

Choose Tell under Other subjects. The existing cards list permitted events the player knows, newest first. Scroll to reach older anecdotes. The Ask about selection can narrow the people concerned. Cards show the event’s topic, every participant and any spoken source. Records without a spoken source appear as your news. A witnessed event can describe an unnamed person without revealing their identity. A later account also keeps that person anonymous when its speaker does not know the name. A card never draws from unheard global history or sealed backstory.

Telling new news teaches the listener that event and records the player as its spoken source. Telling known news gets an honest “nothing new” response. A story remains available on later visits, while the same event cannot repeat within one chat. Learning effects run once. The player retains the source of an earlier account after retelling it. The same rule applies when legacy Ask about supplies a spoken event. Closing a chat preserves its event sources and learned mood tastes through saves and travel.

## Event catalogue and disclosure

`src/data/event_types.json` holds event wording, topic, ordered participant roles, ordinary disclosure and feed membership. The line generator reads that same table. It generates an NPC account and a player Tell row for each type. At binding time, an event icon expands into its topic and all participant icons. This includes inheritance, completed buildings, arriving households, oaths, woodland incidents and defiance. Existing special family and travel answers still require their real facts.

`canDiscloseEvent` applies the catalogue policy to NPC accounts, Tell and legacy Ask about. Trust runs from teller to listener. Relationships with the subjects run from listener to subject. These are current relationships, rather than relationships at the event date.

| Ordinary trust | Types |
| --- | --- |
| Public | Weddings, births, deaths, celebrations, building work, arrivals, founding, departures, visits, returns, harvests, festivals, oaths, leaving, succession and the existing fire wording |
| Social | Moves, marriage moves, favours and woodland incidents |
| Personal | Inheritance, household joining, gifts, reconciliation, quarrels and defiance |

A quarrel between current spouses is a family matter. A third-party listener needs Intimate trust. A rival can hear it at Personal trust. Close kin and Personal or Intimate friends of either spouse are excluded even when the teller trusts them. Participants can discuss their own quarrel at the ordinary Personal level. Other quarrels retain the Personal rule. This adds no affair, marital satisfaction or private event system.

Initial event audiences remain unchanged. A relative can already know an event from its occurrence even when a later teller withholds it. Unknown types and sealed backstory cannot enter ordinary disclosure. NPC news exchange, gossip preferences, overheard event speech and campfire visits remain deferred.
