# Conversations

Choose Chat in a person's panel, or use the next-step hint. Your character walks into speech reach. The conversation panel pauses the world until you choose End chat. Reading has no time cost.

Each spoken line adds topic and person icons. Two identical live icons pop. The person who hears the completing line gains or loses regard. Topic scores come from their existing traits and tastes. A neutral pair costs 0.25 goodwill. Each person icon uses that person's stable identity.

The panel shows the remaining patience slots. The NPC's actual ring and goodwill set the maximum, from four to twelve. Surviving icons spend slots when the chat closes. Slots recover over game hours, faster with closer relationships. The panel labels live and resting slots and reports fades. A live icon can match on the third subsequent spoken line, before it fades out of the row. Faded icons blocking slots remains deferred.

The person sheet starts with unknown topic tastes. A pop that the NPC hears reveals only the tested taste. Replies can change the player's regard through the same rules. The reaction text states whose regard changed and the signed amount.

The shipped data contains 952 authored rows in `src/data/conversation_lines.json`. The engine binds each row to people, events, activities, needs and knowledge. A missing binding or false condition rejects the row. Selection chooses a purpose and a real situation, then uses seeded weights for the wording. Spoken IDs cannot repeat during a chat. The NPC avoids their last wording for that situation on the next encounter.

Other subjects offers family, work, news, help, village and season choices. You can select a known person as the news subject. A question does not inspect the NPC's hidden knowledge. Their answer can disclose a permitted fact, refuse on trust grounds, or report that they have no further news.

A first exchange establishes acquaintance. Nearby strangers with real needs show anonymous speech hints. The hint teaches no name or request identity. An adult can offer a real household favour after completed contact. Acceptance and decline are chat lines. Acceptance also authorises the existing physical collection, work and delivery order. Speech awards no favour completion reward.

Visit news requires an event the speaker knows, and a visitor the player knows or a notable visitor. Other people's visits do not enter the player's feed without spoken disclosure. Family and gossip events retain their existing trust and privacy rules. Telling an event calls `learnEvent`, including its once-only family reactions.

The save graph includes active chats, remaining slots, recovery credit, topic evidence, person reactions, used claims, last wording, encounter counts and spoken event sources. Visited map snapshots retain their conversation records. Existing gifts, courtship, marriage, oath and household invitation buttons remain outside the chat panel in version one.
