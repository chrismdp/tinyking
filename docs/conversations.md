# Conversations

Choose Chat in a person's panel, or use the next-step hint. Your character walks into speech reach. An indoor neighbour receives a knock at their real door and comes outside to talk. A sleeper gives no answer: try in the morning. An unfriendly neighbour refuses before you set off; a liked gift or an offered favour can repair goodwill, while their fixed disposition stays the same. The conversation panel pauses the world until you choose End chat. Reading has no time cost.

Each spoken line adds topic and person icons. Two identical live icons pop. Every pop changes the NPC's regard for you, whichever person completes the pair. Topic scores come from the NPC's existing traits and tastes. A neutral pair costs 0.25 goodwill. Each person icon uses that person's stable identity. Each choice marks the icons that match the row before you choose it.

The panel shows the remaining patience slots. The NPC's actual ring and goodwill set the maximum, from four to twelve. Surviving icons spend slots when the chat closes. Slots recover over game hours, faster with closer relationships. The panel labels live and resting slots and reports fades. A live icon can match on the third subsequent spoken line, before it fades out of the row. Faded icons blocking slots remains deferred.

The person sheet starts with unknown topic tastes. A pop reveals only the tested taste. Pops do not change the player's regard in version one. The reaction text states the NPC's name and the signed change.

The shipped data contains 1,374 authored rows in `src/data/conversation_lines.json`. The engine binds each row to people, events, activities, needs and knowledge. A missing binding or false condition rejects the row. Selection chooses a purpose and a real situation, then uses seeded weights for the wording. Spoken IDs cannot repeat during a chat. The NPC avoids their last wording for that situation on the next encounter.

Each NPC question, name request, offer, referral or warning declares `expects` in the catalogue. Player answers declare `answers`. A direct answer stays among the next choices even when the row is full, the player is tired, another subject is selected, or ordinary topics have been spent. The chat finishes its pending exchange before applying its usual closing rule.

Villagers can approach the player through the same navigation and open this paused panel with any authored opening. Woodland witnesses use this path. The warning seeds Village and Woodland icons; both catalogue replies stop forbidden cutting and preserve the fixed witness and elder losses. These consequential lines do not add matching rewards or disclose unspoken history.

Chat requires three free cells. The opening supplies two icons, or three when at least five cells are free. This gives the player a match from the first turn.

Other subjects offers family, work, news, help, village and season choices. Ordinary chats include weather, questions about the lands and questions about open needs. The lands use real villages, routes, terrain and recorded journeys. Heard needs become the next-step hint. A referral does not authorise acceptance. The requester must ask in person.

You can select a known person as the news subject. A question does not inspect the NPC's hidden knowledge. Their answer can disclose a permitted fact, refuse on trust grounds, or report that they have no further news.

A first exchange establishes acquaintance. Nearby strangers with real needs show anonymous speech hints. The hint teaches no name or request identity. An adult can offer a real household favour after completed contact. Acceptance and decline are chat lines. Acceptance also authorises the existing physical collection, work and delivery order. Speech awards no favour completion reward.

Visit news requires an event the speaker knows, and a visitor the player knows or a notable visitor. Other people's visits do not enter the player's feed without spoken disclosure. Family and gossip events retain their existing trust and privacy rules. Telling an event calls `learnEvent`, including its once-only family reactions.

The save graph includes active chats, remaining slots, recovery credit, topic evidence, person reactions, used claims, last wording, encounter counts and spoken event sources. Conversation records travel with either participant. Visited maps retain other local records. Eligible elders offer oath and leaving lines inside normal Chat. Their authored explanation includes the full rights and obligations before a separate answer. The elder’s sheet can also queue Chat directly about the oath or leaving, with eligibility checked before departure and at acceptance. A necessary customs opening reserves room to speak even when ordinary patience is spent. Gifts, courtship, marriage and household invitations retain their existing buttons.
