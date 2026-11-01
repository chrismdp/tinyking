#!/usr/bin/env python3
"""Generate chat-design/lines-v1.json from compact situation specs.

Each situation shares its family, bindings, base conditions, icons, facts,
use key, trade-off, effects and disclosure. Each variant adds voice
conditions and its own text. The output rows follow design.md's format.
"""
import json, sys, re
from collections import Counter, OrderedDict

OUT = sys.argv[1]
rows = []
ids = set()

# ---------- small builders ----------
def P(test, **args):
    return {"test": test, "args": args}

def T(key):
    return {"kind": "topic", "key": key}

def R(ref):
    return {"kind": "person", "ref": ref}

def F(ref, fields, tense="present"):
    return {"ref": ref, "fields": fields, "tense": tense}

PHASE_OPEN = P("phase_is", phase="opening")
PHASE_REPLY = P("phase_is", phase="reply")
PHASE_PLAYER = P("phase_is", phase="player_turn")
PHASE_CLOSE = P("phase_is", phase="closing")
PHASE_BUBBLE = P("phase_is", phase="world_bubble")

CONTACT = P("completed_contact_exists", actor="player", person="npc")
FIRST_ENCOUNTER = P("npc_first_encounter", person="npc", other="player")
HATE = P("disposition_is", person="npc", towards="player", value="hate")
LOVE = P("disposition_is", person="npc", towards="player", value="love")
PRACTICAL = P("chat_mode_is", mode="practical_only")
NPC_ADULT = P("is_adult", person="npc")
PLAYER_ADULT = P("is_adult", person="player")

def RING(r, person="npc", towards="player"):
    return P("ring_is", person=person, towards=towards, ring=r)

def RING_MIN(r, person="npc", towards="player"):
    return P("ring_at_least", person=person, towards=towards, ring=r)

def GW_MIN(v):
    return P("goodwill_at_least", person="npc", towards="player", value=v)

def GW_BELOW(v):
    return P("goodwill_below", person="npc", towards="player", value=v)

def TR(t, person="npc"):
    return P("has_trait", person=person, trait=t)

def PTR(t):
    """A trait of the player's own character, for voicing player lines."""
    return TR(t, person="player")

def WX(w):
    return P("weather_is", type=w)

def SEASON(s):
    return P("season_is", season=s)

def PART(p):
    return P("season_part_is", part=p)

def TOD(t):
    return P("time_of_day_in", values=t if isinstance(t, list) else [t])

def ACT(a, **extra):
    return P("activity_snapshot_is", person="npc", activity=a, **extra)

def TRADE(t):
    return P("profession_is", person="npc", trade=t)

HAS_TRADE = P("has_profession", person="npc")
SNOW = P("snow_lying_at", person="npc", min_depth=0.25)
FROZEN = P("ground_frozen_at", person="npc")

def add_row(family, situation, speaker, n, voice, text, *, bindings, when_all, when_none,
            tags, facts, icons, use_key, tradeoff, resolve, effects, disclosure):
    rid = f"{speaker}.{family}.{situation}.{voice}.{n:02d}"
    if rid in ids:
        raise SystemExit("duplicate id " + rid)
    ids.add(rid)
    rows.append(OrderedDict([
        ("id", rid),
        ("speaker", speaker),
        ("family", family),
        ("situation", situation),
        ("bindings", bindings),
        ("when", {"all": when_all, "none": when_none}),
        ("tags", tags),
        ("text", text),
        ("facts", facts),
        ("icons", icons),
        ("use_key", use_key),
        ("tradeoff", tradeoff),
        ("resolve", resolve),
        ("effects", effects),
        ("disclosure", disclosure),
    ]))

def situation(family, sit, speaker, *, base_all=(), base_none=(), bindings=None,
              require=(), forbid=(), add=(), remove=(), facts=(), icons=(),
              use_key, risks=(), reveals=(), commitment=None, resolve=None,
              effects=(), disc_people=(), disc_events=(), disc_requests=(), disc_facts=(),
              variants=()):
    listener = "npc" if speaker == "player" else "player"
    counters = Counter()
    for v in variants:
        if isinstance(v, str):
            v = {"text": v}
        voice = v.get("voice", "base")
        counters[voice] += 1
        when_all = list(base_all) + list(v.get("add", []))
        when_none = list(base_none) + list(v.get("none", []))
        tg = {"require": list(require) + list(v.get("require", [])),
              "forbid": list(forbid) + list(v.get("forbid", [])),
              "add": list(add) + list(v.get("tags_add", [])),
              "remove": list(remove)}
        fx = list(facts) + list(v.get("facts", []))
        ic = v.get("icons", list(icons))
        eff = list(effects) + list(v.get("effects", []))
        b = dict(bindings or {})
        b.update(v.get("bindings", {}))
        disc = {"to": listener,
                "people": list(disc_people) + list(v.get("disc_people", [])),
                "events": list(disc_events) + list(v.get("disc_events", [])),
                "requests": list(disc_requests),
                "facts": list(disc_facts) + list(v.get("disc_facts", []))}
        tradeoff = {"risks": list(risks) + list(v.get("risks", [])),
                    "reveals": list(reveals) + list(v.get("reveals", [])),
                    "commitment": v.get("commitment", commitment)}
        add_row(family, sit, speaker, counters[voice], voice, v["text"],
                bindings=b, when_all=when_all, when_none=when_none, tags=tg,
                facts=fx, icons=ic, use_key=v.get("use_key", use_key),
                tradeoff=tradeoff, resolve=v.get("resolve", resolve),
                effects=eff, disclosure=disc)

def V(text, voice="base", *add, **kw):
    d = {"text": text, "voice": voice, "add": list(add)}
    d.update(kw)
    return d

NPC_ID = F("npc", ["identity", "first_name"])
NPC_NAME = F("npc", ["identity", "first_name", "family_name"])
PLAYER_ID = F("player", ["identity", "first_name"])
CTX_TIME = F("context", ["time_of_day"])
CTX_WX = F("context", ["weather", "season", "season_part"])
ACT_FACT = F("activity", ["key", "place_kind", "held_goods"])
JOB_FACT = F("job", ["trade", "workplace_id", "workplace_name"])
REL_FACT = F("relationship", ["ring", "goodwill_sign", "disposition"])

ACTIVITY_BINDING = {"activity": {"source": "npc_activity_at_approach"}}
JOB_BINDING = {"job": {"source": "npc_current_profession"}}

GREETING_EFFECTS = [{"op": "set_reply_purpose", "purpose": "open"}]
INTRO_EFFECTS = [{"op": "learn_identity", "viewer": "player", "person": "npc"},
                 {"op": "set_reply_purpose", "purpose": "player_introduction_or_open"}]

# --- opening helpers: every NPC opening lays down two or three icons ---
# The second icon is a real topic the line says or narrates: what the speaker was
# doing (Work, Harvest, Food), the weather or season (Season), their village
# (Village), a chapel (Faith), a question about news (Gossip) or help (Help).
# Three-icon openings need five free cells, so the player always has room to reply.
FREE5 = P("free_cells_at_least", count=5)
NOT_RES = P("not_resident_of_village", person="player", village="npc.village")
WORK_ACT = P("activity_snapshot_was_work", person="npc")
WET = P("weather_in", types=["rain", "storm"])
FOUL = P("weather_in", types=["rain", "snow", "storm"])
VILLAGE_FACT = F("npc", ["village_name"])
TOPIC_FACTS = {"season": [CTX_WX], "village": [VILLAGE_FACT], "work": [ACT_FACT], "harvest": [ACT_FACT],
               "food": [ACT_FACT], "faith": [F("village", ["shared_places"])], "gossip": [], "help": []}

def G(text, voice, topic, *preds, facts=None, also=(), **kw):
    """One opening variant: the topic icon(s), then the speaker's portrait."""
    icons = [T(topic)] + [T(t) for t in also] + [R("npc")]
    fx = list(TOPIC_FACTS[topic]) if facts is None else list(facts)
    for t in also:
        fx += [f for f in TOPIC_FACTS[t] if f not in fx]
    extra = list(preds) + ([FREE5] if also else [])
    return V(text, voice, *extra, icons=icons, facts=fx, **kw)

CHAPEL = P("village_has_place", village="npc.village", kind="chapel")
TRADE_KW = dict(bindings=JOB_BINDING, facts=[ACT_FACT, JOB_FACT])

# Narration of the real activity at approach, with the topic it backs.
ACT_OPEN = [
    ("trade_work", "work", "*Looking up from the {job.workplace_name}.*", [], TRADE_KW),
    ("plough", "harvest", "*Straightening from the plough.*", [], {}),
    ("sow", "harvest", "*Pausing in the sowing.*", [], {}),
    ("harvest", "harvest", "*Breaking off from the harvest.*", [], {}),
    ("tend_field", "harvest", "*Looking up from the weeding.*", [], {}),
    ("garden", "food", "*Looking up from the garden.*", [], {}),
    ("fell", "work", "*Breaking off from the felling.*", [], {}),
    ("collect_wood", "work", "*Fetching in wood.*", [], {}),
    ("forage", "food", "*Breaking off from foraging.*", [], {}),
    ("walk_to_place", "village", "*On the way to the {activity.place_name}.*", [], {}),
    ("carry_home", "work", "*Carrying {activity.held_phrase}.*",
     [P("activity_holds_good", person="npc", goods=["wood", "planks"])], {}),
    ("carry_home", "harvest", "*Carrying {activity.held_phrase}.*",
     [P("activity_holds_good", person="npc", goods=["grain"])], {}),
    ("carry_home", "food", "*Carrying {activity.held_phrase}.*",
     [P("activity_holds_good", person="npc", goods=["gruel", "bread", "flour", "forage"])], {}),
]

def act_openings(heads):
    """Pair each narrated activity with a head, rotating so the wording varies."""
    out = []
    for i, (act, topic, narr, extra, kw) in enumerate(ACT_OPEN):
        kw = dict(kw)
        facts = kw.pop("facts", [ACT_FACT])
        out.append(G(narr + " " + heads[i % len(heads)], "activity", topic, ACT(act), *extra, facts=facts, **kw))
    return out

# =====================================================================
# GREETINGS
# =====================================================================
GREET_RISKS = ["The topic can land badly with them.",
               "Their own portrait scores as attention when it pops: proud speakers may like it, humble ones may not."]

# --- first meeting, NPC introduces themself ---
TRADE_INTRO = dict(bindings=JOB_BINDING, facts=[JOB_FACT], disc_facts=[{"ref": "job", "fields": ["trade"]}],
                   reveals=["The speaker's trade"])
situation(
    "greeting", "first_meeting", "npc",
    base_all=[PHASE_OPEN, FIRST_ENCOUNTER],
    base_none=[CONTACT, HATE],
    bindings={**ACTIVITY_BINDING},
    forbid=["greeting_spoken", "npc_named"], add=["greeting_spoken", "npc_named"],
    facts=[NPC_NAME, F("contact", ["npc_had_no_relationship_record_before_this_chat"]), CTX_TIME],
    icons=[R("npc")],
    use_key="introduce:{npc.id}:{player.id}",
    risks=GREET_RISKS,
    reveals=["The speaker's name"],
    effects=INTRO_EFFECTS, disc_people=["npc"],
    variants=[
        # the weather and season, which every first meeting can speak of
        G("Fine day. I don't know your face. I'm {npc.first_name}.", "weather", "season", WX("clear")),
        G("Grey old day, isn't it? I'm {npc.first_name}. I don't think we've met.", "weather", "season", WX("cloudy")),
        G("Wet day to be out in. I'm {npc.first_name}.", "weather", "season", WX("rain")),
        G("Snowing, and you out in it. I'm {npc.first_name}.", "weather", "season", WX("snow")),
        G("Rough weather to be meeting in. I'm {npc.first_name}.", "weather", "season", WX("storm")),
        G("Mind the snow underfoot. I'm {npc.first_name}.", "weather", "season", SNOW),
        G("{context.salute}. A new face, this {context.season}. I'm {npc.first_name}.", "base", "season"),
        G("{npc.first_name} {npc.family_name}. I don't think we've met, this {context.season} or any other.", "base", "season"),
        G("Spring, and a new face with it. I'm {npc.first_name}.", "season", "season", SEASON("spring")),
        # the speaker's village
        G("Hello there. You're not from {npc.village_name}, are you? I'm {npc.first_name}.", "base", "village", NOT_RES),
        G("{context.salute}. I'm {npc.first_name}, of {npc.village_name}.", "base", "village"),
        # trades (Work + speaker)
        G("I'm {npc.first_name}. I keep the forge.", "trade", "work", TRADE("smith"), **TRADE_INTRO),
        G("{npc.first_name}, carpenter. If it's wood, it's my trade.", "trade", "work", TRADE("carpenter"), **TRADE_INTRO),
        G("I'm {npc.first_name}. I do the weaving for our house.", "trade", "work", TRADE("weaver"), **TRADE_INTRO),
        G("{npc.first_name}. I do the baking.", "trade", "work", TRADE("baker"), **TRADE_INTRO),
        G("I'm {npc.first_name}, the tanner.", "trade", "work", TRADE("tanner"), **TRADE_INTRO),
        G("{npc.first_name}. The mill's mine to work.", "trade", "work", TRADE("miller"), **TRADE_INTRO),
        G("{context.salute}. I'm {npc.first_name}, the {job.trade} here in {npc.village_name}.", "trade", "work", HAS_TRADE,
          bindings=JOB_BINDING, facts=[JOB_FACT, VILLAGE_FACT], disc_facts=[{"ref": "job", "fields": ["trade"]}],
          reveals=["The speaker's trade and village"]),
        # caught at work (narration of the real activity being interrupted)
        *act_openings(["Yes? I'm {npc.first_name}.", "{context.salute}. I'm {npc.first_name}.",
                       "Hello. I'm {npc.first_name}.", "{npc.first_name}. What can I do for you?"]),
        G("I'm {npc.first_name}. I was just going visiting.", "activity", "village", ACT("visiting"), facts=[ACT_FACT]),
        # traits, each with a real topic
        G("Well, hello! A new face in {npc.village_name}. I'm {npc.first_name}.", "cheerful", "village", TR("cheerful")),
        G("Hello, hello! I'm {npc.first_name}, from {npc.village_name}. And who are you?", "cheerful", "village",
          TR("cheerful"), tags_add=["asked:name"]),
        G("Hello! Lovely day for meeting folk. I'm {npc.first_name}.", "cheerful", "season", TR("cheerful"), WX("clear")),
        G("{npc.first_name}. For what it's worth. Wet, isn't it?", "gloomy", "season", TR("gloomy"), WET),
        G("I'm {npc.first_name}. Not much to tell. Another {context.season} wearing on.", "gloomy", "season", TR("gloomy")),
        G("My name is {npc.first_name} {npc.family_name}, of {npc.village_name}. Remember it.", "proud", "village", TR("proud")),
        G("{npc.first_name} {npc.family_name}. The {job.trade} here, and a good one.", "proud", "work", TR("proud"), HAS_TRADE,
          **TRADE_INTRO),
        G("I'm only {npc.first_name}. Nobody special in {npc.village_name}.", "humble", "village", TR("humble")),
        G("*Looking up from the {job.workplace_name}.* Oh, I'm only {npc.first_name}.", "humble", "work", TR("humble"),
          ACT("trade_work"), **TRADE_KW),
        G("Oh! You gave me a start. I'm {npc.first_name}. Are you new to {npc.village_name}?", "timid", "village",
          TR("timid"), NOT_RES),
        G("Oh. Hello. I'm {npc.first_name}. Out in {context.weather_phrase}?", "timid", "season", TR("timid")),
        G("Oh! I'm {npc.first_name}. I don't care for this wind.", "timid", "season", TR("timid"), WX("storm")),
        G("Speak up, stranger. I'm {npc.first_name}, of {npc.village_name}.", "brave", "village", TR("brave")),
        G("A bit of weather never hurt anyone. I'm {npc.first_name}. And you'd be?", "brave", "season", TR("brave"), FOUL,
          tags_add=["asked:name"]),
        G("{npc.first_name}. I'll be brief. The {activity.work_noun} won't wait.", "hardworking", "work",
          TR("hard-working"), WORK_ACT),
        G("{npc.first_name}. I'm at the {job.workplace_name} till five, so I'll not stop long.", "hardworking", "work",
          TR("hard-working"), ACT("trade_work"), **TRADE_KW),
        G("Take your time. I'm {npc.first_name}, and I'm in no hurry. Not in {context.weather_phrase}.", "lazy", "season",
          TR("lazy")),
        G("{npc.first_name}. Glad of the company, and a rest from the {activity.work_noun}.", "lazy", "work", TR("lazy"),
          WORK_ACT),
        G("Peace to you, stranger. I'm {npc.first_name}. Keeping well this {context.season}?", "pious", "season", TR("pious")),
        G("Peace be on you. {npc.first_name}'s my name. We've a chapel here, if you want one.", "pious", "faith",
          TR("pious"), CHAPEL),
        G("{npc.first_name}. You've come from somewhere else, then? What's it like out there?", "worldly", "village",
          TR("worldly"), NOT_RES),
        G("{npc.first_name}. A stranger! What's the news, then?", "worldly", "gossip", TR("worldly")),
        G("You're welcome in {npc.village_name}. I'm {npc.first_name}.", "generous", "village", TR("generous")),
        G("Welcome, stranger. I'm {npc.first_name}. You've a fine day to see {npc.village_name}.", "generous", "village",
          TR("generous"), WX("clear")),
        G("{npc.first_name}. And what can you do for me?", "greedy", "help", TR("greedy")),
        G("{npc.first_name}. I'll not stop work for nothing, mind.", "greedy", "work", TR("greedy"), WORK_ACT),
        G("*Smiling.* Hello. I'm {npc.first_name}, and you're very welcome in {npc.village_name}.", "love", "village", LOVE,
          facts=[VILLAGE_FACT, F("relationship", ["disposition"])], reveals=["A warm disposition towards you"]),
        G("*Smiling.* {context.salute}! I'm {npc.first_name}. Welcome to {npc.village_name}.", "love", "village", LOVE,
          facts=[VILLAGE_FACT, F("relationship", ["disposition"])], reveals=["A warm disposition towards you"]),
    ])

# --- met before, but no exchange was ever completed ---
situation(
    "greeting", "met_no_exchange", "npc",
    base_all=[PHASE_OPEN, P("npc_knew_player_before_chat", person="npc", other="player")],
    base_none=[CONTACT, HATE],
    bindings={**ACTIVITY_BINDING},
    forbid=["greeting_spoken", "npc_named"], add=["greeting_spoken", "npc_named"],
    facts=[NPC_ID, F("contact", ["relationship_record_exists", "no_completed_exchange"])],
    icons=[R("npc")], use_key="introduce:{npc.id}:{player.id}",
    risks=GREET_RISKS, reveals=["The speaker's name"],
    effects=INTRO_EFFECTS, disc_people=["npc"],
    variants=[
        G("You again. We never did get talking. I'm {npc.first_name}, of {npc.village_name}.", "base", "village"),
        G("We've not had a proper word yet. I'm {npc.first_name}. Out in {context.weather_phrase}, are you?", "base", "season"),
        G("*Looking up from the {activity.work_noun}.* We've not had a proper word yet. I'm {npc.first_name}.", "activity",
          "work", WORK_ACT, facts=[ACT_FACT]),
        G("Oh, it's you. I'm {npc.first_name}, since we never got as far as names. Lovely day for it!", "cheerful",
          "season", TR("cheerful"), WX("clear")),
        G("Oh, it's you! I'm {npc.first_name}, since we never got as far as names. Welcome to {npc.village_name}.",
          "cheerful", "village", TR("cheerful")),
    ])

# --- first meeting, hostile disposition: refuses casual talk ---
HOSTILE_NAMED = dict(tags_add=["npc_named"], effects=[{"op": "learn_identity", "viewer": "player", "person": "npc"}],
                     disc_people=["npc"])
situation(
    "greeting", "first_meeting_hostile", "npc",
    base_all=[PHASE_OPEN, FIRST_ENCOUNTER, HATE],
    base_none=[CONTACT],
    bindings={**ACTIVITY_BINDING},
    forbid=["greeting_spoken"], add=["greeting_spoken", "practical_only"],
    facts=[F("relationship", ["disposition"])],
    icons=[R("npc")], use_key="greeting:{npc.id}:{player.id}:{context.encounter_number}",
    risks=GREET_RISKS,
    reveals=["A hostile disposition towards you", "Casual talk is refused"],
    effects=[{"op": "set_chat_mode", "mode": "practical_only"}, {"op": "set_reply_purpose", "purpose": "practical"}],
    variants=[
        G("You're not from {npc.village_name}, and I've no great wish to know you.", "base", "village", NOT_RES),
        G("{npc.first_name}. If it's not business, I've no time for it. I've the {activity.work_noun} to see to.", "base",
          "work", WORK_ACT, facts=[ACT_FACT, NPC_ID, F("relationship", ["disposition"])], **HOSTILE_NAMED),
        G("What do you want? Be quick about it, in this weather.", "base", "season", FOUL),
        G("I'm {npc.first_name}. I'll hear your business in {context.weather_phrase}, and that's all.",
          "base", "season", facts=[CTX_WX, NPC_ID, F("relationship", ["disposition"])], **HOSTILE_NAMED),
        G("A stranger in {npc.village_name}. Say your piece and go.", "proud", "village", TR("proud")),
        G("What is it now? As if {context.weather_phrase} weren't enough.", "gloomy", "season", TR("gloomy")),
    ])

# --- known people: greeting tone follows the real ring and goodwill ---
KNOWN_BASE_NONE = [HATE]
def known_greeting(sit, ring_preds, variants, extra_none=()):
    situation(
        "greeting", sit, "npc",
        base_all=[PHASE_OPEN, CONTACT] + ring_preds,
        base_none=KNOWN_BASE_NONE + list(extra_none),
        bindings={**ACTIVITY_BINDING},
        forbid=["greeting_spoken"], add=["greeting_spoken"],
        facts=[NPC_ID, PLAYER_ID, REL_FACT, CTX_TIME],
        icons=[R("npc")], use_key="greeting:{npc.id}:{player.id}:{context.encounter_number}",
        risks=GREET_RISKS,
        reveals=["How the speaker greets you, which follows their real ring and goodwill"],
        effects=GREETING_EFFECTS, variants=variants)

known_greeting("acquaintance", [RING("public"), GW_MIN(0)], [
    G("Fine day, {player.first_name}.", "weather", "season", WX("clear")),
    G("{context.salute}, {player.first_name}. Not a cloud about.", "weather", "season", WX("clear")),
    G("Grey old day, {player.first_name}.", "weather", "season", WX("cloudy")),
    G("{player.first_name}. Wet enough for you?", "weather", "season", WX("rain")),
    G("{player.first_name}. Snow coming down, look.", "weather", "season", WX("snow")),
    G("{player.first_name}! You're out in this?", "weather", "season", WX("storm")),
    G("Mind the snow, {player.first_name}.", "weather", "season", SNOW),
    G("{context.salute}, {player.first_name}. How's the {context.season} treating you?", "base", "season"),
    G("Oh, it's you, {player.first_name}. Keeping well this {context.season}?", "base", "season"),
    G("{player.first_name}. {context.season|cap}'s only just come in.", "season", "season", PART("early")),
    G("You're back, then. Not much {context.season} left now.", "season", "season", PART("late")),
    G("{player.first_name}. How do you find {npc.village_name}?", "base", "village", NOT_RES),
    *act_openings(["{context.salute}, {player.first_name}.", "Oh, it's you, {player.first_name}.", "You're back, then.",
                   "{player.first_name}. What can I do for you?", "It's {player.first_name}, isn't it?"]),
    G("{player.first_name}! Back again, and on a day like this!", "cheerful", "season", TR("cheerful"), WX("clear")),
    G("Hello again, {player.first_name}! Lovely {context.season}, isn't it?", "cheerful", "season", TR("cheerful")),
    G("{player.first_name}. Hm. Another {context.season} dragging on.", "gloomy", "season", TR("gloomy")),
    G("Oh. {player.first_name}. You again, and in {context.weather_phrase}.", "gloomy", "season", TR("gloomy")),
    G("Ah. {player.first_name}. You've found me at the {job.workplace_name}.", "proud", "work", TR("proud"),
      ACT("trade_work"), **TRADE_KW),
    G("{player.first_name}. You'll want something from the {job.workplace_name}, I expect.", "proud", "work", TR("proud"),
      HAS_TRADE, bindings=JOB_BINDING, facts=[JOB_FACT]),
    G("Oh, {player.first_name}. You came back to me, in {context.weather_phrase} and all.", "humble", "season", TR("humble")),
    G("{player.first_name}. Fancy you remembering me, with all the folk in {npc.village_name}.", "humble", "village",
      TR("humble")),
    G("Oh! It's only you, {player.first_name}. Out in {context.weather_phrase}?", "timid", "season", TR("timid")),
    G("Oh. {player.first_name}. Hello. I don't care for this wind.", "timid", "season", TR("timid"), WX("storm")),
    G("{player.first_name}. Never mind the weather. Out with it.", "brave", "season", TR("brave"), FOUL),
    G("{player.first_name}. Come to keep me from the {activity.work_noun}? Good.", "lazy", "work", TR("lazy"), WORK_ACT),
    G("{player.first_name}. I can spare a moment from the {activity.work_noun}.", "hardworking", "work",
      TR("hard-working"), WORK_ACT),
    G("Peace to you, {player.first_name}. Keeping well this {context.season}?", "pious", "season", TR("pious")),
    G("You're welcome in {npc.village_name}, {player.first_name}.", "generous", "village", TR("generous"), NOT_RES),
    G("{player.first_name}. Come to ask for something?", "greedy", "help", TR("greedy")),
    G("{player.first_name}. Any news from outside {npc.village_name}?", "worldly", "gossip", TR("worldly")),
    G("{player.first_name}? You're about late, and in {context.weather_phrase}.", "night", "season", TOD("night")),
])

known_greeting("familiar", [RING("social")], [
    G("{player.first_name}! Fine day for it.", "weather", "season", WX("clear")),
    G("{player.first_name}. Grey, but dry, at least.", "weather", "season", WX("cloudy")),
    G("{player.first_name}. Foul weather for walking.", "weather", "season", WET),
    G("{player.first_name}! Snow coming down, and you out in it.", "weather", "season", WX("snow")),
    G("Mind your feet in this snow, {player.first_name}.", "weather", "season", SNOW),
    G("{context.salute}, {player.first_name}. Keeping well this {context.season}?", "base", "season"),
    G("Well, {player.first_name}. How's the {context.season} been with you?", "base", "season"),
    G("There you are, {player.first_name}. Not much {context.season} left now.", "season", "season", PART("late")),
    G("{player.first_name}! {context.season|cap}'s hardly started, and here you are.", "season", "season", PART("early")),
    *act_openings(["{player.first_name}! Good to see you.", "There you are, {player.first_name}.",
                   "Well, {player.first_name}.", "Ah, {player.first_name}. Always a pleasure.",
                   "{context.salute}, {player.first_name}."]),
    G("*Breaking off from the harvest.* {player.first_name}! Fine day for cutting.", "activity", "harvest", ACT("harvest"),
      WX("clear"), facts=[ACT_FACT], also=["season"]),
    G("*Looking up from the {activity.work_noun}.* {player.first_name}. Wet work, today.", "activity", "work", WORK_ACT, WET,
      facts=[ACT_FACT], also=["season"]),
    G("{player.first_name}! You've brightened a grey {context.time_of_day}.", "cheerful", "season", TR("cheerful"),
      P("weather_in", types=["cloudy", "rain"])),
    G("{player.first_name}! Lovely to see you. Lovely {context.season}, too.", "cheerful", "season", TR("cheerful")),
    G("{player.first_name}. You're a better sight than {context.weather_phrase}.", "gloomy", "season", TR("gloomy")),
    G("{player.first_name}. I'm glad you came to me. You'll find me at the {job.workplace_name} till five.", "proud",
      "work", TR("proud"), HAS_TRADE, bindings=JOB_BINDING, facts=[JOB_FACT]),
    G("{player.first_name}! You came to see me? In {context.weather_phrase}?", "humble", "season", TR("humble")),
    G("Oh, it's you, {player.first_name}. That's all right, then. Keeping well this {context.season}?", "timid", "season",
      TR("timid")),
    G("Oh, it's you, {player.first_name}. I'm glad it's you, in this wind.", "timid", "season", TR("timid"), WX("storm")),
    G("Stay a while, {player.first_name}. The {activity.work_noun}'ll keep.", "lazy", "work", TR("lazy"), WORK_ACT),
    G("{player.first_name}. I'll stop for you, but not for long. The {activity.work_noun} wants me.", "hardworking", "work",
      TR("hard-working"), WORK_ACT),
    G("{player.first_name}, come here. Is there anything you need this {context.season}?", "generous", "help",
      TR("generous"), also=["season"]),
    G("{player.first_name}, come here. Is there anything you need?", "generous", "help", TR("generous")),
    G("{player.first_name}! Come on, out with your news. Never mind {context.weather_phrase}.", "brave", "gossip",
      TR("brave")),
    G("{player.first_name}. What's the news beyond {npc.village_name}?", "worldly", "gossip", TR("worldly")),
    G("{player.first_name}. You'll be wanting something, I suppose. Help, is it?", "greedy", "help", TR("greedy")),
    G("Peace to you, {player.first_name}. Are you keeping well, in {context.weather_phrase}?", "pious", "season", TR("pious")),
])

known_greeting("friend", [RING("personal")], [
    G("{player.first_name}! Here's a friendly face, on a fine day.", "weather", "season", WX("clear")),
    G("{player.first_name}. Grey old day, but here's a friendly face.", "weather", "season", WX("cloudy")),
    G("{player.first_name}! Wet day for visiting.", "weather", "season", WET),
    G("Snow on the ground, and you out in it, {player.first_name}.", "weather", "season", SNOW),
    G("Come here, {player.first_name}. How are you keeping this {context.season}?", "base", "season"),
    G("Well, if it isn't {player.first_name}. How's the {context.season} been?", "base", "season"),
    G("{context.salute}, friend. Keeping well, in {context.weather_phrase}?", "base", "season"),
    *act_openings(["{player.first_name}! Here's a friendly face.", "{player.first_name}. I'm always glad to see you.",
                   "Well, if it isn't {player.first_name}.", "{context.salute}, friend."]),
    G("*Looking up from the {activity.work_noun}.* {player.first_name}! Come and keep me company, {context.weather_phrase} or no.",
      "activity", "work", WORK_ACT, facts=[ACT_FACT], also=["season"]),
    G("{player.first_name}! The very person, on a day like this!", "cheerful", "season", TR("cheerful"), WX("clear")),
    G("{player.first_name}! The very person! How's the {context.season} with you?", "cheerful", "season", TR("cheerful")),
    G("{player.first_name}. Good. I'd rather talk to you than stand about in {context.weather_phrase}.", "gloomy", "season",
      TR("gloomy")),
    G("{player.first_name}. I don't say it to many, but I'm glad you're here, {context.weather_phrase} and all.", "proud",
      "season", TR("proud")),
    G("{player.first_name}. You're kind to come by, in {context.weather_phrase}.", "humble", "season", TR("humble")),
    G("{player.first_name}! I'm glad it's you. This wind had me on edge.", "timid", "season", TR("timid"), WX("storm")),
    G("{player.first_name}! I'm glad it's you. Keeping well this {context.season}?", "timid", "season", TR("timid")),
    G("{player.first_name}. Stay. The {activity.work_noun}'ll keep.", "lazy", "work", TR("lazy"), WORK_ACT),
    G("{player.first_name}. I'll always stop the {activity.work_noun} for you.", "hardworking", "work",
      TR("hard-working"), WORK_ACT),
    G("Aye, there you are. Come on, then, {player.first_name}. Never mind {context.weather_phrase}.", "brave", "season",
      TR("brave")),
    G("{player.first_name}, come here. Is there anything you need?", "generous", "help", TR("generous")),
    G("{player.first_name}! What news have you brought me?", "worldly", "gossip", TR("worldly")),
])

known_greeting("close", [RING("intimate")], [
    G("{player.first_name}. There's few I'd sooner see, on a day like this.", "weather", "season", WX("clear")),
    G("Come here, you. Out of {context.weather_phrase}.", "weather", "season", FOUL),
    G("{player.first_name}, love. I'm glad you came, this {context.season}.", "base", "season"),
    G("There you are. Come and talk to me. How's the {context.season} been?", "base", "season"),
    G("*Smiling.* {player.first_name}. Keeping well, in {context.weather_phrase}?", "base", "season"),
    *act_openings(["{player.first_name}. There's few I'd sooner see.", "Come here, you. {context.salute}.",
                   "{player.first_name}, love. I'm glad you came.", "There you are. Come and talk to me."]),
    G("*Looking up from the {activity.work_noun}, smiling.* {player.first_name}. Come and talk, {context.weather_phrase} or no.",
      "activity", "work", WORK_ACT, facts=[ACT_FACT], also=["season"]),
    G("{player.first_name}! Oh, come here! Lovely {context.season}, now you're here.", "cheerful", "season", TR("cheerful")),
    G("{player.first_name}. You I'm always glad of, {context.weather_phrase} or no.", "gloomy", "season", TR("gloomy")),
    G("{player.first_name}. I'd not say this to just anyone. I'm glad you're here, this {context.season}.", "proud",
      "season", TR("proud")),
    G("{player.first_name}. I feel easier when you're about, in this wind.", "timid", "season", TR("timid"), WX("storm")),
    G("{player.first_name}. I feel easier when you're about. Keeping well this {context.season}?", "timid", "season",
      TR("timid")),
])

known_greeting("cool", [GW_BELOW(0)], [
    G("Oh. It's you. I'm busy with the {activity.work_noun}.", "base", "work", WORK_ACT),
    G("*Coolly.* {player.first_name}. Wet day for calling.", "base", "season", WET),
    G("What is it, {player.first_name}? It's cold to stand about.", "base", "season", SEASON("winter")),
    G("Make it quick, {player.first_name}. I've no wish to stand about in {context.weather_phrase}.", "base", "season"),
    G("*Coolly.* {player.first_name}. What brings you to {npc.village_name}?", "base", "village", NOT_RES),
    G("{player.first_name}. Well? I've the {job.workplace_name} to see to.", "proud", "work", TR("proud"),
      ACT("trade_work"), **TRADE_KW),
    G("You. What now? As if {context.weather_phrase} weren't enough.", "gloomy", "season", TR("gloomy")),
])

situation(
    "greeting", "hostile_known", "npc",
    base_all=[PHASE_OPEN, CONTACT, HATE],
    bindings={**ACTIVITY_BINDING},
    forbid=["greeting_spoken"], add=["greeting_spoken", "practical_only"],
    facts=[PLAYER_ID, F("relationship", ["disposition"])],
    icons=[R("npc")], use_key="greeting:{npc.id}:{player.id}:{context.encounter_number}",
    risks=GREET_RISKS,
    reveals=["A hostile disposition towards you", "Casual talk is refused"],
    effects=[{"op": "set_chat_mode", "mode": "practical_only"}, {"op": "set_reply_purpose", "purpose": "practical"}],
    variants=[
        G("You again. Say what you want and go. I've the {activity.work_noun} to see to.", "base", "work", WORK_ACT),
        G("If it's not business, {player.first_name}, leave it. I'll not stand in {context.weather_phrase} for you.", "base",
          "season"),
        G("I've nothing to say to you, {player.first_name}. Not this {context.season}, unless it's business.", "base",
          "season"),
        G("What now? In this weather?", "base", "season", FOUL),
        G("{player.first_name}. I've no time for you, here in {npc.village_name} or anywhere.", "proud", "village", TR("proud")),
    ])

# --- recall openings: a real shared event outranks a plain greeting ---
situation(
    "recall", "favour_thanks_harvest", "npc",
    base_all=[PHASE_OPEN, CONTACT, P("event_type_is", event="event", type="favour"),
              P("event_detail_is", event="event", field="kind", value="harvest")],
    base_none=[HATE],
    bindings={"event": {"source": "completed_favour_event_player_helped_npc"}},
    forbid=["greeting_spoken"], add=["greeting_spoken"],
    facts=[F("event", ["id", "type", "people", "kind", "quantity", "day"], "past")],
    icons=[T("help"), T("harvest")], use_key="thank_favour:{event.id}",
    risks=["Help or Harvest can land badly with them."],
    reveals=["The speaker remembers your completed favour"], effects=GREETING_EFFECTS,
    variants=[
        "You brought our grain in. I'm obliged to you, {player.first_name}.",
        "{player.first_name}. Thank you for the harvest. Every patch of it.",
        V("{player.first_name}! You got our grain in. I'll not forget it.", "cheerful", TR("cheerful")),
    ])
situation(
    "recall", "favour_thanks_wood", "npc",
    base_all=[PHASE_OPEN, CONTACT, P("event_type_is", event="event", type="favour"),
              P("event_detail_is", event="event", field="kind", value="wood")],
    base_none=[HATE],
    bindings={"event": {"source": "completed_favour_event_player_helped_npc"}},
    forbid=["greeting_spoken"], add=["greeting_spoken"],
    facts=[F("event", ["id", "type", "people", "kind", "day"], "past")],
    icons=[T("help"), T("work")], use_key="thank_favour:{event.id}",
    risks=["Help or Work can land badly with them."],
    reveals=["The speaker remembers your completed favour"], effects=GREETING_EFFECTS,
    variants=[
        "You brought us that log. Thank you, {player.first_name}.",
        "{player.first_name}. That log you fetched {event.when}. I've not forgotten it.",
        V("{player.first_name}. I owe you for that log.", "proud", TR("proud")),
    ])
situation(
    "recall", "favour_thanks_food", "npc",
    base_all=[PHASE_OPEN, CONTACT, P("event_type_is", event="event", type="favour"),
              P("event_detail_is", event="event", field="kind", value="food")],
    base_none=[HATE],
    bindings={"event": {"source": "completed_favour_event_player_helped_npc"}},
    forbid=["greeting_spoken"], add=["greeting_spoken"],
    facts=[F("event", ["id", "type", "people", "kind", "quantity", "day"], "past")],
    icons=[T("help"), T("food")], use_key="thank_favour:{event.id}",
    risks=["Help or Food can land badly with them."],
    reveals=["The speaker remembers your completed favour"], effects=GREETING_EFFECTS,
    variants=[
        "You brought us food when we were short. I'll not forget it.",
        "{player.first_name}. That food you brought {event.when}. Thank you.",
        V("{player.first_name}. You kept us fed. Thank you.", "humble", TR("humble")),
    ])
situation(
    "recall", "commons_warning", "npc",
    base_all=[PHASE_OPEN, P("event_type_is", event="event", type="commons_warning"),
              P("event_participant_is", event="event", index=0, person="npc"),
              P("event_participant_is", event="event", index=1, person="player"),
              P("not_member_of", person="player", village="event.village")],
    bindings={"event": {"source": "commons_warning_event_npc_gave_player"}},
    forbid=["greeting_spoken"], add=["greeting_spoken"],
    facts=[F("event", ["id", "type", "people", "villageId", "day"], "past")],
    icons=[T("village"), R("player")], use_key="recall_warning:{event.id}:{context.encounter_number}",
    risks=["Village can land badly with them.", "Your portrait costs 1 of their goodwill if it pops."],
    reveals=["The speaker remembers warning you off the common"], effects=GREETING_EFFECTS,
    variants=[
        "You were cutting on our common, {event.when}. I've not forgotten.",
        "{player.first_name}. The common woodland's still not yours to cut.",
    ])

# =====================================================================
# INTRODUCTIONS
# =====================================================================
def player_intro(sit, base, variants, facts, reveals):
    situation(
        "introduction", sit, "player",
        base_all=[PHASE_PLAYER] + list(base), forbid=["player_named"], add=["player_named"],
        base_none=[P("knows_identity", viewer="npc", person="player")],
        facts=[PLAYER_ID] + list(facts), icons=[R("player")], use_key="introduce:{player.id}:{npc.id}",
        risks=["Your portrait costs 1 of their goodwill whenever it pops, whoever completes the pair."],
        reveals=reveals,
        effects=[{"op": "learn_identity", "viewer": "npc", "person": "player"},
                 {"op": "set_reply_purpose", "purpose": "introduction_reply"}],
        disc_people=["player"], variants=variants)

player_intro("player_name", [], [
    "I'm {player.first_name}.",
    "My name's {player.first_name} {player.family_name}.",
    "{player.first_name}. Pleased to meet you.",
    "Hello. I'm {player.first_name}.",
], [], ["Your name"])
player_intro("player_name_new", [P("arrived_within_days", person="player", days=12),
                                 P("not_resident_of_village", person="player", village="npc.village")], [
    "I'm {player.first_name}. I'm new here.",
    "{player.first_name}. I arrived {player.arrived_when}.",
    "I'm {player.first_name}, just arrived.",
], [F("player", ["arrived_at", "village"])], ["Your name", "That you arrived recently"])
player_intro("player_name_camp", [P("home_stage_is", person="player", stage="camp")], [
    "I'm {player.first_name}. Camped out, for now.",
    "{player.first_name}. I've a camp, for now.",
    "{player.first_name}. No roof yet, just a camp.",
], [F("player_home", ["stage"])], ["Your name", "That you live at a camp"])

situation(
    "introduction", "player_asks_name", "player",
    base_all=[PHASE_PLAYER], forbid=["npc_named", "asked:npc_name"], add=["asked:npc_name"],
    base_none=[P("knows_identity", viewer="player", person="npc")],
    facts=[F("player_knowledge", ["npc_identity_unknown"])], icons=[R("npc")],
    use_key="ask_name:{player.id}:{npc.id}",
    risks=["Their portrait scores as attention: proud people may like it, humble people may not."],
    reveals=["Nothing beyond the question"],
    effects=[{"op": "set_reply_purpose", "purpose": "name_answer"}],
    variants=["And who are you?", "I don't know your name.", "May I ask your name?", "What do they call you?"])

situation(
    "name_answer", "npc_gives_name", "npc",
    base_all=[PHASE_REPLY], forbid=["npc_named"], add=["npc_named"],
    facts=[NPC_NAME], icons=[R("npc")], use_key="introduce:{npc.id}:{player.id}",
    risks=["The portrait can match later, and scores as attention."], reveals=["The speaker's name"],
    effects=INTRO_EFFECTS, disc_people=["npc"],
    variants=[
        V("{npc.first_name}.", "base", GW_BELOW(0)),
        V("{npc.first_name}. Not that it's your business.", "hate", HATE),
        V("I'm {npc.first_name} {npc.family_name}.", "base", GW_MIN(0)),
        V("{npc.first_name}. Folk call me that, anyway.", "base", GW_MIN(0)),
        V("{npc.first_name}, the {job.trade}.", "trade", HAS_TRADE, bindings=JOB_BINDING,
          icons=[T("work"), R("npc")], facts=[JOB_FACT], disc_facts=[{"ref": "job", "fields": ["trade"]}]),
    ])

COLD = P("cold_towards", person="npc", towards="player")
def hears_name(sit, base_all, base_none, variants, icons):
    situation(
        "introduction_reply", sit, "npc",
        base_all=[PHASE_REPLY] + base_all, base_none=base_none,
        require=["player_named"], forbid=["player_name_acknowledged"], add=["player_name_acknowledged"],
        facts=[PLAYER_ID, F("relationship", ["disposition", "goodwill_sign"])], icons=icons,
        use_key="ack_name:{npc.id}:{player.id}",
        risks=["Your portrait in their line costs 1 of their goodwill if it pops."],
        reveals=["How they take your introduction, from their real disposition and goodwill"],
        effects=GREETING_EFFECTS, variants=variants)

hears_name("npc_hears_name", [], [COLD], [
    "{player.first_name}. I'll remember that.",
    "Good to know you, {player.first_name}.",
    "{player.first_name}. Right you are.",
    "{player.first_name}. Well, you're here now.",
    V("{player.first_name}! A good name, that.", "cheerful", TR("cheerful")),
    V("{player.first_name}! Glad to know you.", "cheerful", TR("cheerful")),
    V("{player.first_name}. I'll not forget it.", "proud", TR("proud")),
    V("{player.first_name}. Good. Now we know each other.", "proud", TR("proud")),
    V("{player.first_name}. Right.", "gloomy", TR("gloomy")),
    V("{player.first_name}. Well. There it is.", "gloomy", TR("gloomy")),
    V("{player.first_name}. Peace to you.", "pious", TR("pious")),
    V("{player.first_name}. You're welcome among us.", "generous", TR("generous")),
    V("{player.first_name}. You're very welcome here.", "love", LOVE),
], [R("player")])
hears_name("npc_hears_name_cold", [COLD], [], [
    "Hm.",
    "{player.first_name}. If you say so.",
    "Right.",
    V("{player.first_name}. I'll not forget it, either.", "proud", TR("proud")),
], [R("npc")])

# =====================================================================
# WORK TALK (small talk)
# =====================================================================
NOT_PRACTICAL = [PRACTICAL]
ASK_WORK_EFFECTS = [{"op": "set_reply_purpose", "purpose": "work_talk"}]
situation(
    "work_question", "general", "player",
    base_all=[PHASE_PLAYER, P("knows_identity", viewer="player", person="npc")], base_none=NOT_PRACTICAL,
    forbid=["asked:work"], add=["asked:work"], icons=[T("work")],
    facts=[F("player_knowledge", ["npc_identity"])],
    use_key="ask_work:{player.id}:{npc.id}:{context.encounter_number}",
    risks=["Work can land badly with them."], reveals=["Nothing beyond the question"], effects=ASK_WORK_EFFECTS,
    variants=["Busy day?", "What keeps you busy?", "Much work on?", "How's the work?"])
situation(
    "work_question", "personal", "player",
    base_all=[PHASE_PLAYER, P("knows_identity", viewer="player", person="npc")], base_none=NOT_PRACTICAL,
    forbid=["asked:work"], add=["asked:work"], icons=[T("work"), R("npc")],
    facts=[F("player_knowledge", ["npc_identity"])],
    use_key="ask_work:{player.id}:{npc.id}:{context.encounter_number}",
    risks=["Work or their portrait can land badly with them.", "Uses two slots for two chances to match."],
    reveals=["Nothing beyond the question"], effects=ASK_WORK_EFFECTS,
    variants=["What are you at today, {npc.first_name}?", "How goes the work, {npc.first_name}?",
              "Keeping busy, {npc.first_name}?", "Busy, {npc.first_name}?"])
situation(
    "work_question", "workplace_age", "player",
    base_all=[PHASE_PLAYER, P("player_knows_trade", person="npc")], base_none=NOT_PRACTICAL,
    bindings={"job": {"source": "player_known_trade_of_npc"}},
    forbid=["asked:workplace"], add=["asked:workplace"], icons=[T("work"), R("npc")],
    facts=[F("player_knowledge", ["npc_trade"])],
    use_key="ask_workplace:{player.id}:{npc.id}",
    risks=["Work or their portrait can land badly with them."], reveals=["Nothing beyond the question"],
    effects=[{"op": "set_reply_purpose", "purpose": "work_talk"}],
    variants=["Has the {job.workplace_name} been here long?", "How long has the {job.workplace_name} stood?"])
situation(
    "work_question", "field", "player",
    base_all=[PHASE_PLAYER, P("knows_identity", viewer="player", person="npc")], base_none=NOT_PRACTICAL,
    forbid=["asked:field"], add=["asked:field"], icons=[T("harvest"), R("npc")],
    facts=[F("player_knowledge", ["npc_identity"])],
    use_key="ask_field:{player.id}:{npc.id}:{context.encounter_number}",
    risks=["Harvest or their portrait can land badly with them."], reveals=["Nothing beyond the question"],
    effects=[{"op": "set_reply_purpose", "purpose": "field_talk"}],
    variants=["How's your grain coming on?", "Is your field near ripe?", "How's the field doing?"])

# --- NPC work statements, grounded in the interrupted activity ---
def npc_work(sit, base, variants, icons=None, bindings=None, facts=None, reveals=None, key=None):
    situation(
        "work_talk", sit, "npc",
        base_all=[PHASE_REPLY] + base, base_none=NOT_PRACTICAL,
        bindings={**ACTIVITY_BINDING, **(bindings or {})},
        facts=[ACT_FACT] + (facts or []),
        icons=icons or [T("work"), R("npc")],
        use_key=key or ("work_fact:{npc.id}:{player.id}:" + sit + ":{context.game_hour}"),
        risks=["Work or the speaker's portrait can land badly with them."],
        reveals=reveals or ["What the speaker was doing when you came over"],
        effects=[{"op": "remember_observation", "viewer": "player", "fact": "activity"}],
        disc_facts=[{"ref": "activity", "fields": ["key"]}],
        variants=variants)

npc_work("trade_any", [ACT("trade_work")], [
    "The {job.workplace_name} keeps me from eight till five.",
    "The {job.workplace_name} has stood here since {job.since_when}.",
    "Same as ever. The {job.workplace_name}.",
    "I'm at my trade till five.",
], bindings=JOB_BINDING, facts=[JOB_FACT, F("job", ["workplace_built_day"])])
npc_work("trade_baker", [ACT("trade_work"), TRADE("baker")], [
    "Baking. One log keeps the oven hot four hours, then it wants another.",
    "The oven eats wood. A log for every four hours' baking.",
    "Two loaves for every measure of flour.",
    "No flour, no bread. No log, no baking.",
    V("Baking, and glad of it. There's nothing like it.", "cheerful", TR("cheerful")),
], bindings=JOB_BINDING, facts=[JOB_FACT, F("job", ["fuel_hours_per_log"]), F("recipe", ["baker_flour_to_bread"])])
npc_work("trade_smith", [ACT("trade_work"), TRADE("smith")], [
    "The forge wants a log for every four hours I'm at it.",
    "At the forge, and feeding the fire.",
    "The forge from eight till five. Then I'm done.",
    "Hot work, the forge.",
    V("Forge work. It's hard, and I like it hard.", "hardworking", TR("hard-working")),
], bindings=JOB_BINDING, facts=[JOB_FACT, F("job", ["fuel_hours_per_log"])])
npc_work("trade_miller", [ACT("trade_work"), TRADE("miller")], [
    "The mill runs on the wind. No wood wanted, thank goodness.",
    "Milling grain. The wind does the heavy work.",
    "One measure of grain gives two of flour.",
    "No grain in the store, no milling.",
], bindings=JOB_BINDING, facts=[JOB_FACT, F("job", ["power"]), F("recipe", ["miller_grain_to_flour"])])
npc_work("trade_carpenter", [ACT("trade_work"), TRADE("carpenter")], [
    "Carpentry. Wood in, and something useful out.",
    "I've the workshop till five.",
    "One log makes two planks.",
    "Planks, mostly. Two to a log.",
], bindings=JOB_BINDING, facts=[JOB_FACT, F("recipe", ["carpenter_wood_to_planks"])])
npc_work("trade_weaver", [ACT("trade_work"), TRADE("weaver")], [
    "Weaving. It's slow work, but it's steady.",
    "The loom, from eight till five.",
    "Weaving for the household.",
    "Steady hands, steady work. That's weaving.",
], bindings=JOB_BINDING, facts=[JOB_FACT])
npc_work("trade_tanner", [ACT("trade_work"), TRADE("tanner")], [
    "Tanning hides. It's not pretty work.",
    "Hides, all day. Somebody has to.",
    "The tan-yard keeps me busy till five.",
    "Tanning. It's honest work, if not sweet.",
], bindings=JOB_BINDING, facts=[JOB_FACT])
npc_work("plough", [ACT("plough")], [
    "Ploughing. {field.ploughable_words|cap} patches to turn yet.",
    "Ploughing. The ground won't turn itself.",
    "Ploughing. It's slow, but it has to be done.",
    "Turning the field for seed.",
    V("Ploughing. I'd sooner be doing nothing, but there it is.", "lazy", TR("lazy")),
], icons=[T("harvest"), R("npc")], bindings={"field": {"source": "npc_household_field"}},
   facts=[F("field", ["ploughable_count"])])
npc_work("sow", [ACT("sow")], [
    V("Sowing. A season and a half of growing, and it's ripe.", "base",
      P("crops_growing_at", field="field")),
    "Getting the grain in the ground.",
    "Sowing grain.",
    "Sowing. Then it's waiting.",
    V("Sowing. It'll sit there till spring, mind. Nothing grows in winter.", "winter", SEASON("winter")),
], icons=[T("harvest"), R("npc")], bindings={"field": {"source": "npc_household_field"}},
   facts=[F("field", ["sown_count", "growing"]), F("crop", ["growing_time_days"])])
npc_work("harvest", [ACT("harvest")], [
    "Harvesting. {field.ripe_words|cap} patches still standing.",
    "The grain's ripe, so I'm cutting it.",
    "Cutting the grain while it's ripe.",
    "Bringing the harvest in.",
    V("Harvest! Best time of the year.", "cheerful", TR("cheerful")),
    V("Harvest. Round it comes again.", "gloomy", TR("gloomy")),
], icons=[T("harvest"), R("npc")], bindings={"field": {"source": "npc_household_field"}},
   facts=[F("field", ["ripe_count"])])
npc_work("tend", [ACT("tend_field")], [
    "Weeding. Keeps the crop clean.",
    "Tending the field.",
    "Keeping the weeds down.",
    "Seeing to the crop.",
], icons=[T("harvest"), R("npc")])
npc_work("garden", [ACT("garden")], [
    "Seeing to the garden.",
    "The vegetables want weeding.",
    "Just the garden.",
], icons=[T("food"), R("npc")])
npc_work("fell", [ACT("fell")], [
    "Felling a tree. It'll go in our store.",
    "Felling. A tree's a few good logs.",
    "Felling. Wood for the store.",
    "Bringing a tree down.",
    V("Felling. I'd rather be at it than not.", "hardworking", TR("hard-working")),
])
npc_work("collect_wood", [ACT("collect_wood")], [
    "Fetching wood in.",
    "Bringing the logs home.",
    "Getting the logs in.",
])
npc_work("forage", [ACT("forage")], [
    "Foraging. There's food out there if you look.",
    "Seeing what I can gather.",
    "Gathering what grows wild.",
    "Out foraging.",
], icons=[T("food"), R("npc")])
npc_work("carry_home", [ACT("carry_home")], [
    "Taking this {activity.held_phrase} home.",
    "Just bringing {activity.held_phrase} in.",
    "Taking {activity.held_phrase} back to the store.",
])
npc_work("walk_place", [ACT("walk_to_place")], [
    "I was on my way to the {activity.place_name}.",
    "Off to the {activity.place_name}, I was.",
    "Heading for the {activity.place_name}.",
    "I'd a mind to go to the {activity.place_name}.",
], icons=[T("village"), R("npc")])
npc_work("walk_chapel", [ACT("walk_to_place", place_kind="chapel")], [
    V("On my way to the chapel. I like the quiet of it.", "pious", TR("pious")),
    "I was going up to the chapel.",
], icons=[T("faith"), R("npc")])
npc_work("visiting", [ACT("visiting"), P("knows_identity", viewer="player", person="activity.partner")], [
    "I've come over to see {activity.partner.first_name}.",
    "I'm visiting {activity.partner.first_name}.",
], icons=[T("village"), R("npc")])
npc_work("returning", [ACT("returning_home")], [
    "I'm on my way home.",
    "Heading home, I was.",
], icons=[T("village"), R("npc")])
npc_work("helping_you", [ACT("helping_friend")], [
    "Helping with your work, as you can see.",
    "Lending you a hand. What else?",
], icons=[T("help"), R("npc")])
npc_work("idle", [ACT("idle")], [
    "Nothing pressing just now.",
    "Not much on, at present.",
    "I've a moment.",
    "Not a lot, just now.",
    V("Nothing, and glad of it.", "lazy", TR("lazy")),
    V("Nothing, and I can't abide it.", "hardworking", TR("hard-working")),
])
npc_work("workplace_age", [HAS_TRADE], [
    "The {job.workplace_name} has stood since {job.since_when}.",
    "Since {job.since_when}. It's seen some work.",
], bindings=JOB_BINDING, facts=[JOB_FACT, F("job", ["workplace_built_day"], "past")],
   reveals=["When the workplace was built"], key="work_fact:{npc.id}:{player.id}:workplace_age")

# --- household and field facts, answering a field question or volunteered ---
def npc_home(sit, base, variants, icons, facts, family="work_talk", key=None, bindings=None):
    situation(
        family, sit, "npc",
        base_all=[PHASE_REPLY] + base, base_none=NOT_PRACTICAL,
        bindings=bindings or {"home": {"source": "npc_household"}, "field": {"source": "npc_household_field"}},
        facts=facts, icons=icons,
        use_key=key or ("home_fact:{npc.id}:{player.id}:" + sit + ":{context.game_hour}"),
        risks=["The topic or the speaker's portrait can land badly with them."],
        reveals=["A current fact about the speaker's household"],
        effects=[{"op": "remember_observation", "viewer": "player", "fact": sit}],
        variants=variants)

npc_home("field_ripe", [P("field_has_state", field="field", state="harvestable", min=1)], [
    "Our grain's ripe.", "The field's ripe. {field.ripe_words|cap} patches of it.", "Ripe and waiting.",
    V("Grain's come good this year.", "cheerful", TR("cheerful"))],
    [T("harvest"), R("npc")], [F("field", ["ripe_count"])], family="field_talk")
npc_home("field_growing", [P("field_has_state", field="field", state="sown", min=1), P("crops_growing_at", field="field")], [
    "The grain's in and growing.", "Sown, and coming on.", "Coming on nicely."],
    [T("harvest"), R("npc")], [F("field", ["sown_count", "growing"])], family="field_talk")
npc_home("field_waiting_winter", [P("field_has_state", field="field", state="sown", min=1), P("crops_not_growing_at", field="field")], [
    "It's sown, but nothing grows till the cold lifts.", "Sown. It'll wait for spring now.", "In the ground, and waiting."],
    [T("harvest"), T("season")], [F("field", ["sown_count", "growing"])], family="field_talk",
    )
npc_home("field_ploughed", [P("field_has_state", field="field", state="ploughed", min=1)], [
    "Ploughed and waiting for seed.", "The ground's turned. Seed next.", "Ploughed, and ready."],
    [T("harvest"), R("npc")], [F("field", ["ploughed_count"])], family="field_talk")
npc_home("field_bare", [P("field_all_states_in", field="field", states=["empty", "harvested"])], [
    "Our field's bare just now.", "Nothing in the field at present.", "Bare till we sow."],
    [T("harvest"), R("npc")], [F("field", ["slot_states"])], family="field_talk")
npc_home("no_field", [P("household_has_no_field", household="home")], [
    "We've no field of our own.", "No field. We get by without.", "Not a field to our name."],
    [T("harvest"), R("npc")], [F("home", ["fields"])], family="field_talk",
    bindings={"home": {"source": "npc_household"}})
npc_home("store_full", [P("household_store_full", household="home")], [
    "Our store's full to the roof.", "There's no room left in our store."],
    [T("work"), R("npc")], [F("home", ["store_id", "store_has_space"])])
npc_home("food_enough", [P("household_food_per_resident_at_least", household="home", value=2),
                         P("household_food_per_resident_below", household="home", value=4)], [
    "We've enough put by for now.", "We'll do, for food. For now."],
    [T("food"), R("npc")], [F("home", ["food_portions", "residents"])])
npc_home("food_plenty", [P("household_food_per_resident_at_least", household="home", value=4)], [
    "We're well stocked this {context.season}.", "The larder's full. Can't complain.",
    V("Plenty put by. I like to know there's plenty.", "timid", TR("timid"))],
    [T("food"), R("npc")], [F("home", ["food_portions", "residents"]), CTX_WX])
npc_home("pasture", [P("household_has_pasture", household="home")], [
    "We keep {yard.animal_plural} out the back.", "The {yard.animal_plural} out the back are ours."],
    [T("work"), R("npc")], [F("yard", ["kind", "houseId"])],
    bindings={"home": {"source": "npc_household"}, "yard": {"source": "npc_household_pasture"}})

# --- player work statements ---
def player_work(sit, base, variants, icons=None, facts=None, bindings=None, reveals=None, extra_tags=()):
    situation(
        "player_work", sit, "player",
        base_all=[PHASE_PLAYER] + base, base_none=NOT_PRACTICAL,
        bindings=bindings or {"home": {"source": "player_home"}},
        add=["player_said:" + sit] + list(extra_tags),
        facts=facts or [F("home", ["stage", "owner"])], icons=icons or [T("work"), R("player")],
        use_key="own_work:{player.id}:{npc.id}:" + sit,
        risks=["Your portrait costs 1 of their goodwill whenever it pops, whoever completes the pair.", "Work can land badly with them."],
        reveals=reveals or ["A fact about your own home or work"],
        effects=[{"op": "set_reply_purpose", "purpose": "player_work_reply"}],
        disc_facts=[{"ref": (facts or [F("home", ["stage"])])[0]["ref"],
                     "fields": (facts or [F("home", ["stage"])])[0]["fields"]}], variants=variants)

player_work("camp", [P("home_stage_is", person="player", stage="camp")], [
    "I'm still sleeping at my camp.", "I've only a camp, so far."])
player_work("lean_to", [P("home_stage_is", person="player", stage="lean-to")], [
    "I've put up a lean-to.", "I've a lean-to. A hut next, I hope."])
player_work("hut", [P("home_stage_is", person="player", stage="hut")], [
    "I've built myself a hut.", "My hut's up. A house next, I hope."])
player_work("house", [P("home_stage_is", person="player", stage="house"),
                      P("event_type_is", event="built", type="house_built")], [
    "I've built a house of my own.", "I finished my house {built.when}."],
    bindings={"home": {"source": "player_home"}, "built": {"source": "player_house_built_event"}},
    facts=[F("home", ["stage", "owner"]), F("built", ["id", "day"], "past")])
player_work("building", [P("player_construction_in_progress")], [
    "I'm building a {site.stage} for myself.", "I've a {site.stage} going up."],
    bindings={"site": {"source": "player_construction_site"}}, facts=[F("site", ["stage", "work", "owner"])],
    reveals=["Your building in progress"])
player_work("felling", [P("player_has_queued_order", key="cut_tree_down")], [
    "I've timber to fell.", "I'm felling wood just now."],
    bindings={"order": {"source": "player_queued_order"}}, facts=[F("order", ["job_key"])])
player_work("clearing", [P("player_has_queued_order", key="create_field")], [
    "I'm clearing a field.", "I'm making a field of my own."],
    bindings={"order": {"source": "player_queued_order"}}, facts=[F("order", ["job_key"])])
player_work("own_field_sown", [P("player_field_has_state", state="sown", min=1)], [
    "I've grain in my own field.", "My field's sown."],
    icons=[T("harvest"), R("player")], bindings={"pfield": {"source": "player_field"}},
    facts=[F("pfield", ["sown_count"])])
player_work("own_field_ripe", [P("player_field_has_state", state="harvestable", min=1)], [
    "My grain's ripe.", "My field's ready to cut."],
    icons=[T("harvest"), R("player")], bindings={"pfield": {"source": "player_field"}},
    facts=[F("pfield", ["ripe_count"])])

# favour in progress: tells the listener about the player's real commitment to someone else
situation(
    "player_work", "favour_in_hand", "player",
    base_all=[PHASE_PLAYER, P("request_status_is", request="request", status="accepted"),
              P("request_accepted_by", request="request", actor="player"),
              P("knows_identity", viewer="player", person="giver")],
    base_none=NOT_PRACTICAL + [P("request_household_is_npc_household", request="request")],
    bindings={"request": {"source": "player_accepted_request_elsewhere"},
              "giver": {"source": "request_giver", "request": "request"}},
    facts=[F("request", ["id", "kind", "status", "actorId", "giverId", "quantity"])],
    icons=[T("help"), R("giver")], use_key="tell_commitment:{player.id}:{npc.id}:{request.id}",
    risks=["Help or the giver's portrait can land badly with them.", "The listener learns you are helping that household."],
    reveals=["Your accepted favour for another household"],
    effects=[{"op": "set_subject", "person": "giver"}, {"op": "set_reply_purpose", "purpose": "player_work_reply"}],
    disc_people=["giver"], disc_facts=[{"ref": "request", "fields": ["kind", "giverId", "status"]}],
    variants=[
        V("I'm helping {giver.first_name} with the harvest.", "harvest", P("request_kind_is", request="request", kind="harvest")),
        V("I've promised {giver.first_name} a log.", "wood", P("request_kind_is", request="request", kind="wood")),
        V("I'm taking food to {giver.first_name}'s house.", "food", P("request_kind_is", request="request", kind="food")),
        V("I've a promise to keep to {giver.first_name}.", "base"),
    ])

# --- NPC replies to the player's work statement ---
situation(
    "player_work_reply", "home", "npc",
    base_all=[PHASE_REPLY], base_none=NOT_PRACTICAL,
    facts=[F("chat", ["player_statement_this_chat"])], icons=[T("work")],
    use_key="work_reply:{npc.id}:{player.id}:{context.encounter_number}",
    risks=["Work can land badly with them."], reveals=["Nothing new; a reply to what you said"],
    effects=GREETING_EFFECTS,
    variants=[
        V("A camp will do for a start.", "camp", require=["player_said:camp"]),
        V("A camp's a camp. Walls are better.", "camp_gloomy", TR("gloomy"), require=["player_said:camp"]),
        V("A lean-to's a start.", "lean_to", require=["player_said:lean_to"]),
        V("A lean-to! Well done, you.", "lean_to_cheerful", TR("cheerful"), require=["player_said:lean_to"]),
        V("A hut's a fair step up.", "hut", require=["player_said:hut"]),
        V("A house of your own. That's something.", "house", require=["player_said:house"]),
        V("A whole house. You've worked for that.", "house_hw", TR("hard-working"), require=["player_said:house"]),
        V("Keep at it.", "building", require=["player_said:building"]),
        V("Felling's honest work.", "felling", require=["player_said:felling"]),
        V("A field's the making of a household.", "field", require=["player_said:own_field_sown"]),
        V("Get it cut and stored, then.", "field_ripe", require=["player_said:own_field_ripe"]),
    ])

# =====================================================================
# SEASON AND WEATHER (small talk)
# =====================================================================
def player_wx(sit, base, variants, icons=None):
    situation(
        "season_talk", sit, "player",
        base_all=[PHASE_PLAYER] + base, base_none=[],
        bindings={"observation": {"source": "player_observed_local_weather"}},
        add=["season_mentioned"], facts=[F("observation", ["weather_type", "season", "season_part", "game_hour", "world_hex"])],
        icons=icons or [T("season")],
        use_key="observe_weather:{player.id}:{npc.id}:" + sit + ":{context.game_hour}",
        risks=["Season can land badly with them."], reveals=["The weather you can both see"],
        effects=[{"op": "remember_observation", "viewer": "npc", "fact": "observation"},
                 {"op": "set_reply_purpose", "purpose": "season_talk"}],
        disc_facts=[{"ref": "observation", "fields": ["weather_type", "season"]}],
        variants=variants)

player_wx("clear", [WX("clear")], ["Fine day today.", "Clear skies.", "Good weather for working.", "Lovely day.",
                                    V("Lovely day, isn't it!", "cheerful", PTR("cheerful")),
                                    V("Fine, for now.", "gloomy", PTR("gloomy")),
                                    V("A fine day. Something to be thankful for.", "pious", PTR("pious"))])
player_wx("cloudy", [WX("cloudy")], ["Grey old day.", "Overcast today.", "Clouds, but dry.", "Grey skies today.",
                                      V("Grey. Suits me well enough.", "gloomy", PTR("gloomy")),
                                      V("Dry, at least. Good for working.", "hardworking", PTR("hard-working"))])
player_wx("rain", [WX("rain")], ["Wet one today.", "It's coming down.", "Rain, and plenty of it.", "Wet out there.",
                                  V("Rain. Well, it would.", "gloomy", PTR("gloomy")),
                                  V("A drop of rain never hurt.", "brave", PTR("brave")),
                                  V("Too wet for working, this.", "lazy", PTR("lazy"))])
player_wx("snow", [WX("snow")], ["Snow's falling.", "Snow coming down.", "It's snowing.", "Look at that snow.",
                                  V("Snow! I do like snow.", "cheerful", PTR("cheerful")),
                                  V("Snow. I can't abide it.", "gloomy", PTR("gloomy"))])
player_wx("storm", [WX("storm")], ["Wild weather today.", "Hark at that wind.", "Quite a storm.", "Rough weather.",
                                    V("I don't like this wind.", "timid", PTR("timid")),
                                    V("Bit of wind. Nothing to it.", "brave", PTR("brave"))])
player_wx("spring", [SEASON("spring")], ["Spring, at last.", "It's spring.", "Spring's come.",
                                          V("Spring! Everything starting again.", "cheerful", PTR("cheerful"))])
player_wx("summer", [SEASON("summer")], ["Summer's here.", "Summer, then.", "Summer at last.",
                                          V("Too warm for work, this.", "lazy", PTR("lazy"))])
player_wx("autumn", [SEASON("autumn")], ["Autumn already.", "The back end of the year.", "Autumn, then.",
                                          V("Autumn. Winter's not far behind.", "gloomy", PTR("gloomy"))])
player_wx("winter", [SEASON("winter")], ["Winter's set in.", "Cold, isn't it?",
                                         V("Deep winter now.", "late", P("season_part_in", parts=["mid", "late"]))])
player_wx("season_late", [PART("late")], ["{context.season|cap}'s nearly out.", "Not much {context.season} left."])
player_wx("season_early", [PART("early")], ["Early {context.season} yet.", "{context.season|cap}'s only just begun."])
player_wx("snow_lying", [SNOW], ["There's snow on the ground.", "Snow lying everywhere."])
player_wx("frozen", [FROZEN], ["The ground's frozen hard.", "Hard frost on the ground."])
player_wx("no_growth", [P("crops_not_growing_here")],
          ["Nothing grows in this cold.", "Nothing will grow till spring."], icons=[T("season"), T("harvest")])
player_wx("named", [P("knows_identity", viewer="player", person="npc"), P("weather_in", types=["clear", "cloudy"])],
          ["Fair day, {npc.first_name}.", "Dry today, {npc.first_name}."], icons=[T("season"), R("npc")])

def npc_wx(sit, base, variants, icons=None):
    situation(
        "season_talk", sit, "npc",
        base_all=[PHASE_REPLY] + base, base_none=NOT_PRACTICAL,
        facts=[CTX_WX, F("context", ["snow_lying", "ground_frozen", "crops_growing"])],
        icons=icons or [T("season")],
        use_key="observe_weather:{npc.id}:{player.id}:" + sit + ":{context.game_hour}",
        risks=["Season can land badly with them."], reveals=["The weather and season, as the speaker sees it"],
        effects=GREETING_EFFECTS, variants=variants)

npc_wx("clear", [WX("clear")], [
    "Fine day. Can't complain.", "Not a cloud.", "Good clear day.",
    V("Lovely day!", "cheerful", TR("cheerful")),
    V("Fine, for now.", "gloomy", TR("gloomy")),
    V("A fine day. Something to be thankful for.", "pious", TR("pious"))])
npc_wx("cloudy", [WX("cloudy")], [
    "Grey, but it's dry.", "Overcast. Could be worse.", "Dull old day.", "Grey skies.",
    V("Grey. It suits me.", "gloomy", TR("gloomy"))])
npc_wx("rain", [WX("rain")], [
    "Proper wet.", "Wet, isn't it?", "Wet out.",
    V("Rain. Well, it would.", "gloomy", TR("gloomy")),
    V("A drop of rain never hurt anyone.", "brave", TR("brave"))])
npc_wx("rain_crop", [WX("rain"), P("field_has_state", field="field", state="sown", min=1)], [
    "Rain does the grain no harm.", "A drop of rain won't hurt the crop."], icons=[T("season"), T("harvest")])
npc_wx("snow", [WX("snow")], [
    "Snow coming down.", "Snow. I'll be glad when it stops.", "Snow, and plenty of it.", "It's snowing.",
    V("Snow! I do like snow.", "cheerful", TR("cheerful")),
    V("Snow. I can't abide it.", "gloomy", TR("gloomy"))])
npc_wx("storm", [WX("storm")], [
    "Wild out there.", "Listen to that wind.", "Proper storm, this.", "Quite a blow.",
    V("I don't like a storm.", "timid", TR("timid")),
    V("A bit of wind never hurt anyone.", "brave", TR("brave"))])
npc_wx("frozen", [FROZEN], [
    "Ground's frozen. Nothing grows till it thaws.", "Hard as iron, the ground.", "Frozen solid."],
    icons=[T("season"), T("harvest")])
npc_wx("spring", [SEASON("spring")], [
    "Spring. Time to get the seed in.", "Spring at last.", "Spring's come round.",
    V("Spring! Everything starting again.", "cheerful", TR("cheerful"))])
npc_wx("summer", [SEASON("summer")], [
    "Summer's here.", "Summer at last.", "Summer, and the days are good.",
    V("High summer.", "late", P("season_part_in", parts=["mid", "late"])),
    V("Summer. Too warm for work, if you ask me.", "lazy", TR("lazy"))])
npc_wx("autumn", [SEASON("autumn")], [
    "Autumn. Winter's not far off.", "The back end's come round again.", "Autumn's here.",
    "Autumn. Time to think about the store.",
    V("Autumn. I don't care for what comes after.", "gloomy", TR("gloomy"))])
npc_wx("winter", [SEASON("winter")], [
    V("Winter. We live off the store till spring.", "base", icons=[T("season"), T("food")]),
    V("Winter. Nothing grows now.", "base", icons=[T("season"), T("harvest")]),
    "Winter, and no mistake.",
    "Cold old season, winter.",
    V("Winter. A time for patience.", "pious", TR("pious"))])
npc_wx("late", [PART("late")], ["{context.season|cap}'s nearly out.", "Not long left of {context.season}.",
                                 "{context.season|cap}'s on its way out."])
npc_wx("early", [PART("early")], ["Still early {context.season}.", "{context.season|cap}'s hardly started.",
                                  "{context.season|cap}'s only just come in."])
npc_wx("snow_lying", [SNOW], ["Mind your feet in this snow.", "Snow everywhere you look.", "Look at all this snow."])

# =====================================================================
# VILLAGE (teaches what the town is like; see notes)
# =====================================================================
situation(
    "village_question", "general", "player",
    base_all=[PHASE_PLAYER, P("knows_village_name", viewer="player", village="npc.village")], base_none=NOT_PRACTICAL,
    forbid=["asked:village"], add=["asked:village"], icons=[T("village")],
    facts=[F("player_knowledge", ["npc_village_name"])],
    use_key="ask_village:{player.id}:{npc.id}:{context.encounter_number}",
    risks=["Village can land badly with them."], reveals=["Nothing beyond the question"],
    effects=[{"op": "set_reply_purpose", "purpose": "village_talk"}],
    variants=["What's {npc.village_name} like?", "Tell me about {npc.village_name}.", "Is {npc.village_name} a big place?"])
situation(
    "village_question", "elder", "player",
    base_all=[PHASE_PLAYER, P("knows_village_name", viewer="player", village="npc.village")], base_none=NOT_PRACTICAL,
    forbid=["asked:elder"], add=["asked:elder"], icons=[T("village")],
    facts=[F("player_knowledge", ["npc_village_name"])],
    use_key="ask_elder:{player.id}:{npc.id}",
    risks=["Village can land badly with them."], reveals=["Nothing beyond the question"],
    effects=[{"op": "set_reply_purpose", "purpose": "elder_answer"}],
    variants=["Who's the elder here?", "Who speaks for {npc.village_name}?"])

def npc_village(sit, base, variants, icons=None, bindings=None, facts=None, people=()):
    situation(
        "elder_answer" if sit.startswith("elder") else "village_talk", sit, "npc",
        base_all=[PHASE_REPLY] + base, base_none=NOT_PRACTICAL,
        bindings=bindings or {"village": {"source": "npc_village"}},
        facts=facts or [F("village", ["id", "name", "house_count", "shared_places"])],
        icons=icons or [T("village"), R("npc")],
        use_key="village_fact:{npc.id}:{player.id}:" + sit,
        risks=["Village or the portrait can land badly with them."], reveals=["A fact about the village"],
        effects=[{"op": "remember_observation", "viewer": "player", "fact": sit}],
        disc_people=list(people), disc_facts=[{"ref": "village", "fields": ["name", "house_count", "shared_places"]}],
        variants=variants)

npc_village("size", [P("village_has_place", village="village", kind="green")], [
    "{village.name}'s {village.house_count_words} houses and a green.",
    V("{village.house_count_words|cap} houses, a green and a well. That's {village.name}.", "well",
      P("village_has_place", village="village", kind="well")),
    "{village.name}? {village.house_count_words|cap} houses round the green.",
    V("Just {village.house_count_words} houses. Small, but we know each other.", "small",
      P("village_house_count_at_most", village="village", count=4))])
npc_village("places", [P("village_has_place", village="village", kind="chapel"),
                       P("village_has_place", village="village", kind="alehouse"),
                       P("village_has_place", village="village", kind="well")], [
    "We've a chapel and an alehouse, besides the well.",
    "There's a chapel, and an alehouse, and the green."])
npc_village("trades", [P("village_trade_count_at_least", village="village", count=1)], [
    "There's {village.trade_list} in {village.name}.", "For trades, we've {village.trade_list}."],
    facts=[F("village", ["id", "trade_list"])])
npc_village("elder", [P("village_has_elder", village="village"), P("knows_identity", viewer="player", person="elder")], [
    "{elder.first_name}'s our elder.", "Ask {elder.first_name}. {elder.first_name}'s the elder here."],
    bindings={"village": {"source": "npc_village"}, "elder": {"source": "village_elder", "village": "village"}},
    facts=[F("elder", ["identity"]), F("village", ["elder_rule"])], icons=[T("village"), R("elder")])
npc_village("elder_intro", [P("village_has_elder", village="village"), P("does_not_know_identity", viewer="player", person="elder")], [
    "Our elder's {elder.name}. The eldest of us.",
    "{elder.name} is elder here. If it's the oath you want, see {elder.first_name}."],
    bindings={"village": {"source": "npc_village"}, "elder": {"source": "village_elder", "village": "village"}},
    facts=[F("elder", ["identity", "age"]), F("village", ["elder_rule"])], icons=[T("village"), R("elder")],
    people=["elder"])
npc_village("common_wood", [P("village_has_common_woodland", village="village")], [
    "The common woodland's for those who've sworn the oath.",
    "Mind the common woods. They're for folk who've taken the oath."],
    facts=[F("village", ["id", "common_claims"]), F("rules", ["OATH_RIGHTS", "resourcePermission"])])
npc_village("founded", [P("event_type_is", event="founding", type="founding"),
                        P("event_known_to", person="npc", event="founding")], [
    "{village.name} was founded {founding.when_exact}. {founder.name} was one of them that did it.",
    "{founder.name} founded {village.name}, {founding.when_exact}."],
    bindings={"village": {"source": "npc_village"}, "founding": {"source": "village_founding_event", "village": "village"},
              "founder": {"source": "event_person", "event": "founding", "index": 0}},
    facts=[F("founding", ["id", "type", "people", "day", "villageId"], "past")], icons=[T("village"), R("founder")],
    people=["founder"])

# =====================================================================
# THE LANDS (what lies around: villages, roads and passes, the country)
# A newcomer can always ask these. Every answer reads the real map and world.
# =====================================================================
ARRIVED = P("arrived_within_days", person="player", days=12)

def topic_risk(icons):
    """Every pop scores for the NPC being talked to, whoever completes the pair."""
    names = [i["key"].capitalize() for i in icons if i["kind"] == "topic"]
    parts = [" or ".join(names) + " can land badly with them."] if names else []
    for i in icons:
        if i["kind"] == "person":
            parts.append("Their own portrait scores as attention when it pops." if i["ref"] == "npc" else
                         "Your portrait costs 1 of their goodwill if it pops." if i["ref"] == "player" else
                         "That person's portrait scores by how they regard them.")
    return " ".join(parts)

def lands_q(sit, purpose, icons, variants, base=(), bindings=None, facts=None, effects=()):
    situation(
        "lands_question", sit, "player",
        base_all=[PHASE_PLAYER] + list(base), base_none=[],
        bindings=bindings or {}, forbid=["asked:lands_" + sit], add=["asked:lands_" + sit],
        facts=facts or [F("player_knowledge", ["heard_places"])], icons=icons,
        use_key="ask_lands:{player.id}:{npc.id}:" + sit + ":{context.encounter_number}",
        risks=[topic_risk(icons)], reveals=["That you are new to these parts, or curious about them"],
        effects=list(effects) + [{"op": "set_reply_purpose", "purpose": purpose}], variants=variants)

lands_q("villages", "lands_villages", [T("village")], [
    "What lies round about here?",
    "Are there other villages near?",
    "Is there anywhere else near, besides {npc.village_name}?",
    "What's round about {npc.village_name}?",
    V("I'm new here. What lies round about?", "new", ARRIVED),
    V("Is it far to the next village?", "timid", PTR("timid")),
    V("I like to know a country. What's near?", "worldly", PTR("worldly")),
])
lands_q("roads", "lands_roads", [T("village")], [
    "Which way do the roads go?",
    "Is there a way out of here?",
    "Where are the passes?",
    "Which roads lead out of here?",
    V("Which way's the road out? I'd walk it.", "brave", PTR("brave")),
    V("Where does the road go from here?", "worldly", PTR("worldly")),
])
lands_q("beyond", "lands_beyond", [T("village")], [
    "What lies past the passes?",
    "Have you been beyond the passes?",
    "What's the country like further off?",
    V("What's past the passes? I'd like to see.", "worldly", PTR("worldly")),
    V("What's out past the passes? I'm not afraid.", "brave", PTR("brave")),
])
lands_q("country", "lands_country", [T("season")], [
    "What's the country like hereabouts?",
    "Is it good land round here?",
    "What's the weather like here, as a rule?",
    V("Is it always this wet here?", "new_wet", ARRIVED, WX("rain")),
    V("Is it always this cold here?", "new_cold", ARRIVED, SEASON("winter")),
    V("Does it often blow like this?", "new_storm", ARRIVED, WX("storm")),
    V("Is it always this grey?", "gloomy", PTR("gloomy"), WX("cloudy")),
    V("Lovely country. What's it like all year?", "cheerful", PTR("cheerful")),
], facts=[F("player_knowledge", ["arrived_at"]), CTX_WX])
lands_q("known_village", "lands_place", [T("village")], [
    "What's {place.name} like?",
    "Do you know {place.name}?",
    "Tell me about {place.name}.",
    V("I've seen {place.name}. Do you know it?", "seen", P("player_discovered_village", viewer="player", village="place")),
], base=[P("different_village_id", a="place", b="npc.village")],
   bindings={"place": {"source": "player_known_other_village"}},
   facts=[F("place", ["id", "name", "known_to_player"])],
   effects=[{"op": "set_subject_place", "place": "place"}])

def lands_ans(family, sit, base, variants, icons, bindings, facts, reveals, key=None, people=(), events=(),
              effects=None, none=()):
    situation(
        family, sit, "npc",
        base_all=[PHASE_REPLY] + list(base), base_none=NOT_PRACTICAL + list(none),
        bindings=bindings, facts=facts, icons=icons,
        use_key=key or ("lands_fact:{npc.id}:{player.id}:" + family + ":" + sit),
        risks=[topic_risk(icons)], reveals=reveals,
        effects=effects if effects is not None else [{"op": "remember_observation", "viewer": "player", "fact": "lands:" + sit}],
        disc_people=list(people), disc_events=list(events), variants=variants)

TOLD = lambda fact: P("lands_fact_told", viewer="player", speaker="npc", fact=fact)
LANDS_B = {"lands": {"source": "local_lands"}}
LANDS_F = [F("lands", ["map_entrances", "neighbour_reaches", "home_reach_biome"])]

# --- other villages on this map ---
OTHER_B = {"other": {"source": "npc_local_other_village_unknown_to_player"}}
OTHER_F = [F("other", ["id", "name", "house_count", "direction_from_npc_village"])]
HEARD_PLACE = [{"op": "record_heard_place", "viewer": "player", "village": "other", "speaker": "npc"},
               {"op": "remember_observation", "viewer": "player", "fact": "lands:other_village"}]
lands_ans("lands_villages", "other_village", [], [
    "There's {other.name}, off to the {other.direction}. {other.house_count_words|cap} houses.",
    "{other.name} lies to the {other.direction}.",
    "Go {other.direction} and you'll come to {other.name}.",
    "{other.name}'s to the {other.direction}. {other.house_count_words|cap} houses, near enough.",
    V("{other.name}, to the {other.direction}. They've {other.trade_list} there.", "trades",
      P("village_trade_count_at_least", village="other", count=1), facts=[F("other", ["trade_list"])]),
    V("I've walked to {other.name} myself. It's off to the {other.direction}.", "visited",
      P("npc_visited_village", person="npc", village="other"), facts=[F("npc_knowledge", ["own_visit_to_village"])]),
    V("{other.name}'s {other.direction} of here. I've never been, mind.", "timid", TR("timid"),
      P("npc_not_visited_village", person="npc", village="other")),
    V("{other.name}! Just off to the {other.direction}. Go and see it.", "cheerful", TR("cheerful")),
    V("There's {other.name} to the {other.direction}. Smaller than us, mind.", "proud", TR("proud"),
      P("village_smaller_than", a="other", b="npc.village"), facts=[F("other", ["house_count"]), F("npc", ["village_house_count"])]),
    V("{other.name}, to the {other.direction}. {other_elder.name}'s elder there.", "worldly", TR("worldly"),
      P("village_has_elder", village="other"), bindings={"other_elder": {"source": "village_elder", "village": "other"}},
      facts=[F("other_elder", ["identity", "elder_rule"])], disc_people=["other_elder"]),
], [T("village"), R("npc")], OTHER_B, OTHER_F,
   ["One real village near here, its name, direction and size"],
   key="place_fact:{npc.id}:{player.id}:{other.id}", effects=HEARD_PLACE)
lands_ans("lands_villages", "only_village", [P("no_other_local_village", village="npc.village")], [
    "{npc.village_name}'s the only village hereabouts.",
    "There's only us, this side of the passes.",
    "No, there's just {npc.village_name} round here.",
    V("Just us, and that's all.", "gloomy", TR("gloomy")),
    V("Just {npc.village_name}. We've no need of more.", "proud", TR("proud")),
], [T("village"), R("npc")], {}, [F("map", ["villages"])], ["That no other village shares this land"],
   key="only_village:{npc.id}:{player.id}:{context.encounter_number}")
lands_ans("lands_villages", "all_known", [P("other_local_village_exists", village="npc.village"),
                                          P("other_local_villages_all_known_to", viewer="player", village="npc.village")], [
    "That's all of them. You know as many as I do.",
    "You've heard of them all now, I think.",
    "There's no others. You know them all.",
], [T("village")], {}, [F("map", ["villages"]), F("player_knowledge", ["villages"])],
   ["That you already know every village near here"],
   key="villages_all_known:{npc.id}:{player.id}:{context.encounter_number}")

# --- a village the player already knows of ---
PLACE_B = {"place": {"source": "place_asked_by_player"}}
lands_ans("lands_place", "local", [P("village_on_current_map", village="place")], [
    "{place.name}? {place.house_count_words|cap} houses, off to the {place.direction}.",
    "{place.name}'s {place.direction} of here. {place.house_count_words|cap} houses.",
    V("{place.name}? They've {place.trade_list} there.", "trades", P("village_trade_count_at_least", village="place", count=1),
      facts=[F("place", ["trade_list"])]),
    V("{place.name}. {place_elder.name}'s elder there.", "elder", P("village_has_elder", village="place"),
      bindings={"place_elder": {"source": "village_elder", "village": "place"}},
      facts=[F("place_elder", ["identity", "elder_rule"])], disc_people=["place_elder"]),
    V("I've been to {place.name}. It's off to the {place.direction}.", "visited",
      P("npc_visited_village", person="npc", village="place"), facts=[F("npc_knowledge", ["own_visit_to_village"])]),
    V("{place.name}? Bigger than us, I'll grant.", "proud", TR("proud"), P("village_smaller_than", a="npc.village", b="place"),
      facts=[F("place", ["house_count"]), F("npc", ["village_house_count"])]),
], [T("village"), R("npc")], PLACE_B, [F("place", ["id", "name", "house_count", "direction_from_npc_village"])],
   ["Real facts about a village you know of"], key="place_fact:{npc.id}:{player.id}:{place.id}:asked")
lands_ans("lands_place", "far_not_been", [P("village_not_on_current_map", village="place"),
                                          P("npc_no_world_trip_to_reach", person="npc", reach="place.reach_key")], [
    "{place.name}? That's not round here. I've never been that way.",
    "{place.name}'s past the passes, then. I've not been so far.",
    V("{place.name}? Past the passes. I'd like to see it, one day.", "worldly", TR("worldly")),
    V("{place.name}? That's a long way. Not for me.", "timid", TR("timid")),
], [R("npc")], PLACE_B, [F("place", ["reach_key"]), F("npc_knowledge", ["no_own_trip_to_reach"])],
   ["That the village lies beyond this country, and the speaker has not been that way"],
   key="place_far:{npc.id}:{player.id}:{place.id}")
lands_ans("lands_place", "far_been_that_way", [P("village_not_on_current_map", village="place")], [
    "I've been out to the {trip.far_direction}, {trip.when}. I don't know {place.name} itself, mind.",
    "I went {trip.far_direction} once, {trip.when}. Never came across {place.name}.",
], [T("village"), R("npc")], {**PLACE_B, "trip": {"source": "npc_own_world_trip_to_reach", "reach": "place.reach_key"}},
   [F("place", ["reach_key"]), F("trip", ["id", "type", "people", "day", "fromWorld", "toWorld"], "past")],
   ["That the speaker has been that way, but does not know the village"],
   key="place_far:{npc.id}:{player.id}:{place.id}")

# --- roads and passes out of this map ---
lands_ans("lands_roads", "ways_out_one", [P("map_open_side_count_is", count=1)], [
    "There's only the one road out, to {lands.open_sides_words}.",
    "The only way out's to {lands.open_sides_words}.",
    "One pass, to {lands.open_sides_words}. That's your road.",
    V("One road out, to {lands.open_sides_words}. I've no fear of it.", "brave", TR("brave")),
], [T("village"), R("npc")], LANDS_B, LANDS_F, ["Which way the land route leaves this country"],
   effects=[{"op": "remember_observation", "viewer": "player", "fact": "lands:ways_out"}])
lands_ans("lands_roads", "ways_out_many", [P("map_open_side_count_at_least", count=2)], [
    "There are {lands.open_count_words} ways out: to {lands.open_sides_words}.",
    "The roads go out to {lands.open_sides_words}.",
    "You can get out to {lands.open_sides_words}.",
    V("Out to {lands.open_sides_words}. Nowhere else.", "base", P("map_closed_side_count_at_least", count=1)),
    V("Roads to {lands.open_sides_words}. I've walked one or two.", "worldly", TR("worldly"),
      P("npc_has_world_trip", person="npc"), facts=[F("npc_knowledge", ["own_world_trip"])]),
    V("Out to {lands.open_sides_words}. I don't go far myself.", "timid", TR("timid"),
      P("npc_has_no_world_trip", person="npc"), facts=[F("npc_knowledge", ["no_world_trip"])]),
], [T("village"), R("npc")], LANDS_B, LANDS_F, ["Which ways the land routes leave this country"],
   effects=[{"op": "remember_observation", "viewer": "player", "fact": "lands:ways_out"}])
lands_ans("lands_roads", "no_way_out", [P("map_open_side_count_is", count=0)], [
    "There's no road out of here at all.",
    "No way out. Not on foot.",
    V("No road out. We're on our own here.", "gloomy", TR("gloomy")),
], [T("village"), R("npc")], LANDS_B, LANDS_F, ["That no land route leaves this country"],
   effects=[{"op": "remember_observation", "viewer": "player", "fact": "lands:ways_out"}])
lands_ans("lands_roads", "sea", [TOLD("ways_out"), P("map_sea_side_count_at_least", count=1)], [
    "The sea's off to {lands.sea_sides_words}. No road that way.",
    "There's sea to {lands.sea_sides_words}. You'll not walk that way.",
    V("Sea to {lands.sea_sides_words}. I keep away from it.", "timid", TR("timid")),
], [T("village"), R("npc")], LANDS_B, LANDS_F, ["Which sides of this country meet the sea"])
lands_ans("lands_roads", "no_road_side", [TOLD("ways_out"), P("map_closed_land_side_count_at_least", count=1)], [
    "No road goes out to {lands.closed_land_sides_words}.",
    "There's no way through to {lands.closed_land_sides_words}.",
], [T("village"), R("npc")], LANDS_B, LANDS_F, ["Which land sides have no route through"])
lands_ans("lands_roads", "all_told", [TOLD("ways_out"), P("lands_roads_all_told", viewer="player", speaker="npc")], [
    "That's all the roads I know of.",
    "That's the whole of it, for roads.",
    "I've told you all I know of the roads.",
], [R("npc")], LANDS_B, LANDS_F, ["That the speaker has no more to say of roads"],
   key="lands_roads_done:{npc.id}:{player.id}:{context.encounter_number}", effects=[])

# --- beyond the passes: only what the speaker saw, or a real traveller they know of ---
TRIP_F = [F("trip", ["id", "type", "people", "day", "fromWorld", "toWorld"], "past"),
          F("far_reach", ["biome", "temperature", "moisture"])]
lands_ans("lands_beyond", "came_from", [P("event_type_in", event="trip", types=["world_move", "world_visit"]),
                                        P("event_detail_is", event="trip", field="toWorld", value="context.world_key")], [
    "I came here from the {trip.from_direction} myself, {trip.when}. It's {trip.far_country_words} country there.",
    "I came from the {trip.from_direction}. {trip.far_country_words|cap} country, that.",
    V("I came from the {trip.from_direction}, {trip.when}. {trip.far_country_words|cap} country. I'd not hurry back.",
      "gloomy", TR("gloomy")),
    V("From the {trip.from_direction}, me! {trip.far_country_words|cap} country, and I liked it.", "cheerful", TR("cheerful")),
], [T("season"), R("npc")], {"trip": {"source": "npc_own_world_trip"}}, TRIP_F,
   ["Where the speaker came from, and what that country is like"], key="lands_trip:{npc.id}:{player.id}:{trip.id}")
lands_ans("lands_beyond", "went_out", [P("event_type_is", event="trip", type="return")], [
    "I've been out to the {trip.from_direction}. Came home {trip.when}. It's {trip.far_country_words} country there.",
    "The {trip.from_direction}? I went, and came back {trip.when}. {trip.far_country_words|cap}, all of it.",
    V("I've been {trip.from_direction}, and I'd go again. {trip.far_country_words|cap} country.", "brave", TR("brave")),
    V("I've seen the {trip.from_direction}. {trip.far_country_words|cap} country. Worth the walk.", "worldly", TR("worldly")),
], [T("season"), R("npc")], {"trip": {"source": "npc_own_world_trip"}}, TRIP_F,
   ["Where the speaker has travelled, and what that country is like"], key="lands_trip:{npc.id}:{player.id}:{trip.id}")
TRAVELLER_B = {"event": {"source": "npc_known_world_travel_by_other"},
               "traveller": {"source": "event_person", "event": "event", "index": 0}}
TRAVELLER_FX = [{"op": "set_subject", "person": "traveller"},
                {"op": "record_spoken_source", "viewer": "player", "event": "event", "speaker": "npc"}]
lands_ans("lands_beyond", "heard_traveller", [P("npc_own_world_trips_all_told", viewer="player", speaker="npc"),
                                              P("event_known_to", person="npc", event="event")], [
    V("I've not been myself. But {traveller.first_name} came in from the {event.from_direction} {event.when}.", "known",
      P("knows_identity", viewer="player", person="traveller"), P("event_detail_is", event="event", field="toWorld", value="context.world_key")),
    V("Not me. {traveller.first_name} would know. Came from the {event.from_direction} {event.when}.", "known",
      P("knows_identity", viewer="player", person="traveller"), P("event_detail_is", event="event", field="toWorld", value="context.world_key")),
    V("I've not been. {traveller.first_name} went off to the {event.to_direction} {event.when}.", "known",
      P("knows_identity", viewer="player", person="traveller"), P("event_detail_is", event="event", field="fromWorld", value="context.world_key")),
    V("I've not been. {traveller.name}, the {traveller.trade}, came in from the {event.from_direction} {event.when}.",
      "notable", P("does_not_know_identity", viewer="player", person="traveller"), P("has_profession", person="traveller"),
      P("event_detail_is", event="event", field="toWorld", value="context.world_key"), disc_people=["traveller"]),
], [T("village"), R("traveller")], TRAVELLER_B,
   [F("event", ["id", "type", "people", "day", "fromWorld", "toWorld"], "past")],
   ["A real journey across the passes, with the speaker recorded as your source"],
   key="tell_event:{npc.id}:{player.id}:{event.id}", events=["event"], effects=TRAVELLER_FX)
lands_ans("lands_beyond", "unknown", [P("npc_has_no_world_trip", person="npc"),
                                      P("npc_knows_no_tellable_world_travel", speaker="npc", viewer="player")], [
    "Past the passes? I couldn't tell you. I've never been.",
    "I've never been past the passes myself.",
    V("I couldn't say. Nobody I know has been that way.", "base", P("npc_knows_no_world_travel", speaker="npc")),
    V("Past the passes? Not me. I like it here.", "timid", TR("timid")),
    V("I've never been, more's the pity.", "worldly", TR("worldly")),
], [R("npc")], {}, [F("npc_knowledge", ["no_world_trip", "no_known_world_travel"])],
   ["That the speaker knows nothing of the country past the passes"],
   key="lands_beyond_unknown:{npc.id}:{player.id}:{context.encounter_number}", effects=[])
lands_ans("lands_beyond", "all_told", [P("lands_beyond_all_told", viewer="player", speaker="npc")], [
    "That's all I know of what's past the passes.",
    "That's the whole of it. I've told you all I know.",
    V("That's all I've seen. You'll have to go and look.", "brave", TR("brave")),
], [R("npc")], {}, [F("npc_knowledge", ["own_world_trips", "tellable_world_travel"])],
   ["That the speaker has no more to say of the country past the passes"],
   key="lands_beyond_done:{npc.id}:{player.id}:{context.encounter_number}", effects=[])

# --- the country here: the reach's real biome and the local map's terrain ---
lands_ans("lands_country", "country_here", [], [
    "It's {lands.country_words} country hereabouts.",
    "{lands.country_words|cap} country, this.",
    "Round here? {lands.country_words|cap} country, mostly.",
    V("Cold country, this. You'll want a good roof.", "cold", P("reach_temperature_is", value="cold")),
    V("Mild country, as a rule. Not too hot, not too cold.", "mild", P("reach_temperature_is", value="temperate")),
    V("Warm country, this, most of the year.", "hot", P("reach_temperature_is", value="hot")),
    V("Wet country. The ground's seldom dry.", "wet", P("reach_moisture_is", value="wet")),
    V("Dry country. Rain's scarce here.", "dry", P("reach_moisture_is", value="dry")),
    V("{lands.country_words|cap} country, and I'd not live anywhere else.", "cheerful", TR("cheerful")),
    V("{lands.country_words|cap} country. It could be worse, I suppose.", "gloomy", TR("gloomy")),
    V("{lands.country_words|cap} country. Hard work, but it feeds you.", "hardworking", TR("hard-working"),
      P("household_has_field", household="npc.household"), facts=[F("home", ["fields"])]),
], [T("season"), R("npc")], LANDS_B, [F("lands", ["home_reach_biome", "temperature", "moisture"])],
   ["What the country is like here: its real climate and land"],
   effects=[{"op": "remember_observation", "viewer": "player", "fact": "lands:country_here"}])
lands_ans("lands_country", "mountains", [TOLD("country_here"), P("local_terrain_present", terrain=["mountain"])], [
    "There's mountains off to the {lands.mountain_direction}.",
    "High ground to the {lands.mountain_direction}. Mountains.",
    V("Mountains to the {lands.mountain_direction}. I'd not climb them.", "timid", TR("timid")),
], [T("village"), R("npc")], LANDS_B, [F("lands", ["mountain_tiles", "mountain_direction"])],
   ["Where the high ground lies"])
lands_ans("lands_country", "water", [TOLD("country_here"), P("local_terrain_present", terrain=["shallow water", "deep water"])], [
    "There's water off to the {lands.water_direction}.",
    "Water to the {lands.water_direction}, if you're looking for it.",
], [T("village"), R("npc")], LANDS_B, [F("lands", ["water_tiles", "water_direction"])], ["Where the water lies"])
lands_ans("lands_country", "woods", [TOLD("country_here"), P("local_tree_count_at_least", count=20)], [
    "There's timber about, if you've an axe.",
    "Plenty of trees round about.",
    V("There's timber about. Mind which of it is common wood.", "base", P("village_has_common_woodland", village="npc.village"),
      facts=[F("village", ["common_claims"])]),
], [T("village"), R("npc")], LANDS_B, [F("lands", ["tree_count"])], ["That there is timber to be had"])
lands_ans("lands_country", "all_told", [TOLD("country_here"), P("lands_country_all_told", viewer="player", speaker="npc")], [
    "That's the lay of the land, near enough.",
    "That's all there is to tell of it.",
], [R("npc")], LANDS_B, LANDS_F, ["That the speaker has no more to say of the country"],
   key="lands_country_done:{npc.id}:{player.id}:{context.encounter_number}", effects=[])

# =====================================================================
# FAMILY
# =====================================================================
FAMILY_Q_EFFECTS = [{"op": "set_reply_purpose", "purpose": "family_answer"}]
def player_family_q(sit, variants, icons=None, base=(), bindings=None, facts=None, purpose="family_answer", key=None):
    situation(
        "family_question", sit, "player",
        base_all=[PHASE_PLAYER, P("knows_identity", viewer="player", person="npc")] + list(base),
        base_none=NOT_PRACTICAL, bindings=bindings or {},
        add=["asked:family"], facts=facts or [F("player_knowledge", ["npc_identity"])],
        icons=icons or [T("family"), R("npc")],
        use_key=key or ("ask_family:{player.id}:{npc.id}:" + sit + ":{context.encounter_number}"),
        risks=["Family or their portrait can land badly with them.", "They need to trust you (Familiar or closer) to name relatives."],
        reveals=["Nothing beyond the question"],
        effects=[{"op": "set_reply_purpose", "purpose": purpose}], variants=variants)

player_family_q("general", ["Have you family here in {npc.village_name}?", "Have you kin hereabouts?",
                            "Who are your people?", "Is your family close by?"])
player_family_q("household", ["How many under your roof?", "Is yours a big household?"], purpose="household_answer")
player_family_q("spouse", ["Are you married?", "Is there a husband or a wife?"])
player_family_q("children", ["Have you children?", "Any little ones?"])
player_family_q("parents", ["Are your parents living?", "Tell me about your parents."])
player_family_q("residence", ["Have you always lived in {npc.village_name}?", "Were you born here?",
                              "How long have you been in {npc.village_name}?"],
                icons=[T("village"), R("npc")], purpose="residence_answer")
player_family_q("known_relative", [
    "How's your {link.kin_term}, {relative.first_name}?", "How's {relative.first_name} keeping?",
    "And your {link.kin_term}? How is {relative.first_name}?"],
    icons=[T("family"), R("relative")],
    base=[P("kin_link_known_to", viewer="player", link="link")],
    bindings={"link": {"source": "player_known_kin_link_of_npc"},
              "relative": {"source": "link_relative", "link": "link"}},
    facts=[F("link", ["speaker_id", "relative_id", "kinship"])], purpose="relative_news",
    key="ask_relative:{player.id}:{npc.id}:{relative.id}:{context.encounter_number}")

TRUST_SOCIAL = RING_MIN("social")
def npc_family(sit, base, variants, icons, bindings, facts, people=(), events=(), effects=(), reveals=None,
               family="family_answer", key=None, none=()):
    situation(
        family, sit, "npc",
        base_all=[PHASE_REPLY] + list(base), base_none=NOT_PRACTICAL + list(none),
        bindings=bindings, facts=facts, icons=icons,
        use_key=key or "disclose_link:{npc.id}:{player.id}:{relative.id}:{link.kinship}",
        risks=["Family or the relative's portrait can land badly with them."],
        reveals=reveals or ["One real family link, and that relative's name"],
        effects=list(effects) or [{"op": "set_subject", "person": "relative"},
                                   {"op": "learn_kin_link", "viewer": "player", "link": "link"}],
        disc_people=list(people) or ["relative"], disc_events=list(events),
        disc_facts=[{"ref": "link", "fields": ["speaker_id", "relative_id", "kinship"]}] if "link" in bindings else [],
        variants=variants)

LINK_B = {"link": {"source": "npc_undisclosed_kin_link"}, "relative": {"source": "link_relative", "link": "link"}}
LINK_F = [F("link", ["speaker_id", "relative_id", "kinship", "relative_alive"])]
def KIN(k):
    return P("kinship_is", link="link", kind=k)
ALIVE = P("person_alive", person="relative")

npc_family("refuse_trust", [P("ring_is", person="npc", towards="player", ring="public")], [
    "I don't talk family with folk I barely know.",
    "Ask me again when I know you better.",
    "That's my business, for now.",
    "Family's family. I keep it close.",
    V("I'll not lay out my family for someone I hardly know.", "proud", TR("proud")),
    V("Oh, I'd rather not say. Not yet.", "timid", TR("timid")),
    V("Ha! Get to know me first.", "cheerful", TR("cheerful")),
], [R("npc")], {}, [F("relationship", ["ring"])], effects=[{"op": "set_reply_purpose", "purpose": "open"}],
   people=["__none__"], reveals=["That they do not trust you yet; nothing about their family"],
   key="family_refusal:{npc.id}:{player.id}:{context.encounter_number}")

npc_family("spouse", [TRUST_SOCIAL, KIN("spouse"), ALIVE], [
    "I'm married to {relative.first_name}.",
    "{relative.first_name}'s my {link.kin_term}.",
    "My {link.kin_term}'s {relative.first_name}.",
    V("{relative.first_name}. My {link.kin_term}, and the best of us.", "love_spouse",
      P("ring_is", person="npc", towards="relative", ring="intimate"),
      facts=[F("relationship_to_relative", ["ring"])]),
], [T("family"), R("relative")], LINK_B, LINK_F)
npc_family("spouse_dated", [TRUST_SOCIAL, KIN("spouse"), ALIVE, P("event_type_is", event="wedding", type="marriage")], [
    "{relative.first_name} and I were married {wedding.when}.",
    "My {link.kin_term}'s {relative.first_name}. We wed {wedding.when}.",
], [T("family"), R("relative")], {**LINK_B, "wedding": {"source": "marriage_event_of_link", "link": "link"}},
   LINK_F + [F("wedding", ["id", "type", "people", "day"], "past")], events=["wedding"])
npc_family("child", [TRUST_SOCIAL, KIN("child"), ALIVE], [
    "I've a {link.kin_term}, {relative.first_name}.",
    "{relative.first_name}'s my {link.kin_term}. {relative.age_words|cap} now.",
    "I've a {link.kin_term} called {relative.first_name}.",
    V("My {link.kin_term} {relative.first_name} lives over in {relative.village_name}.", "away",
      P("different_village", a="npc", b="relative"), facts=[F("relative", ["village"])]),
    V("{relative.first_name}'s my youngest.", "youngest", P("is_youngest_living_child", parent="npc", child="relative")),
    V("{relative.first_name}, my {link.kin_term}. {relative.age_words|cap}, and growing fast.", "young",
      P("age_below", person="relative", age=18), facts=[F("relative", ["age"])]),
], [T("family"), R("relative")], LINK_B, LINK_F + [F("relative", ["age"])])
npc_family("parent", [TRUST_SOCIAL, KIN("parent"), ALIVE], [
    "My {link.kin_term} is {relative.first_name}.",
    "{relative.first_name}'s my {link.kin_term}. {relative.age_words|cap} now.",
    "I'm {relative.first_name}'s {link.inverse_term}.",
    V("My {link.kin_term}, {relative.first_name}, lives in {relative.village_name}.", "away",
      P("different_village", a="npc", b="relative"), facts=[F("relative", ["village"])]),
], [T("family"), R("relative")], LINK_B, LINK_F + [F("relative", ["age"])])
npc_family("sibling", [TRUST_SOCIAL, KIN("sibling"), ALIVE], [
    "{relative.first_name} is my {link.kin_term}.",
    "I've a {link.kin_term}, {relative.first_name}.",
    "I'm {relative.first_name}'s {link.inverse_term}.",
    V("I've a {link.kin_term}, {relative.first_name}, in {relative.village_name}.", "away",
      P("different_village", a="npc", b="relative"), facts=[F("relative", ["village"])]),
], [T("family"), R("relative")], LINK_B, LINK_F)
npc_family("grandchild", [TRUST_SOCIAL, KIN("grandchild"), ALIVE], [
    "I've a {link.kin_term} now. {relative.first_name}.",
    "{relative.first_name}'s my {link.kin_term}.",
], [T("family"), R("relative")], LINK_B, LINK_F)
npc_family("grandparent", [TRUST_SOCIAL, KIN("grandparent"), ALIVE], [
    "My {link.kin_term}'s {relative.first_name}.",
    "{relative.first_name} is my {link.kin_term}. {relative.age_words|cap} now.",
    "I'm {relative.first_name}'s {link.inverse_term}.",
], [T("family"), R("relative")], LINK_B, LINK_F + [F("relative", ["age"])])
npc_family("dead_relative", [TRUST_SOCIAL, P("person_dead", person="relative"),
                             P("event_type_is", event="death", type="death"),
                             P("event_known_to", person="npc", event="death")], [
    "My {link.kin_term}, {relative.first_name}, died {death.when}.",
    V("My {link.kin_term}, {relative.first_name}, died {death.when}. Old age.", "old_age",
      P("event_detail_is", event="death", field="cause", value="old age")),
    V("I lost my {link.kin_term} {death.when}. {relative.first_name}. A good age.", "old_age",
      P("event_detail_is", event="death", field="cause", value="old age")),
    V("{relative.first_name}, my {link.kin_term}. Died of old age, {death.when}.", "old_age",
      P("event_detail_is", event="death", field="cause", value="old age")),
    V("My {link.kin_term} {relative.first_name} died for want of food, {death.when}.", "starved",
      P("event_detail_is", event="death", field="cause", value="starvation")),
    V("I lost my {link.kin_term}, {relative.first_name}, {death.when}. Went hungry too long.", "starved",
      P("event_detail_is", event="death", field="cause", value="starvation")),
], [T("family"), R("relative")], {**LINK_B, "death": {"source": "death_event_of", "person": "relative"}},
   LINK_F + [F("death", ["id", "type", "people", "day", "cause"], "past")], events=["death"])

npc_family("no_kin", [P("has_no_living_kin", person="npc")], [
    "There's only me.",
    V("I've no family left.", "had_kin", P("had_kin", person="npc")),
    V("No family. Not now.", "had_kin", P("had_kin", person="npc")),
    V("All gone now. There's only me.", "had_kin", P("had_kin", person="npc")),
    "Just me, and I'm used to it.",
], [R("npc")], {}, [F("npc", ["kinship_living_count"])], people=["__none__"],
   effects=[{"op": "set_reply_purpose", "purpose": "open"}], reveals=["That they have no living kin"],
   key="no_kin:{npc.id}:{player.id}")
npc_family("nothing_more", [TRUST_SOCIAL, P("no_undisclosed_kin_links", speaker="npc", viewer="player")], [
    "That's all my family, near enough.",
    "That's the lot.",
    "You know them all now.",
    "There's no more to tell of my family.",
    V("That's everyone. Small family, mine.", "small", P("living_kin_count_at_most", person="npc", count=2)),
], [R("npc")], {}, [F("player_knowledge", ["kin_links_disclosed_by_npc"])], people=["__none__"],
   effects=[{"op": "set_reply_purpose", "purpose": "open"}], reveals=["That every relative has been named"],
   key="family_done:{npc.id}:{player.id}:{context.encounter_number}")

npc_family("household_size", [TRUST_SOCIAL], [
    "There's {home.size_words} of us under this roof.",
    "{home.size_words|cap} of us, all told.",
    "We're {home.size_words} in the house.",
    V("Just me in the house.", "alone", P("household_size_is", household="home", size=1)),
    V("{home.size_words|cap} of us. It's a full house.", "full", P("household_at_capacity", household="home")),
    V("{home.size_words|cap} of us, and that's plenty.", "gloomy", TR("gloomy")),
], [T("family"), R("npc")], {"home": {"source": "npc_household"}},
   [F("home", ["residents", "bed_capacity"])], people=["__none__"], family="household_answer",
   effects=[{"op": "set_reply_purpose", "purpose": "open"}], reveals=["How many live in their household"],
   key="household_size:{npc.id}:{player.id}")
npc_family("household_refuse", [P("ring_is", person="npc", towards="player", ring="public")], [
    "Enough of us. Ask me another time.",
    "That's for us to know, for now.",
    "Ask me that another day.",
    "Never you mind, for now.",
], [R("npc")], {}, [F("relationship", ["ring"])], people=["__none__"], family="household_answer",
   effects=[{"op": "set_reply_purpose", "purpose": "open"}], reveals=["That they do not trust you yet"],
   key="household_refusal:{npc.id}:{player.id}:{context.encounter_number}")

# --- relative news: answers about a relative the player already knows ---
RN_B = {"link": {"source": "player_known_kin_link_of_npc"}, "relative": {"source": "link_relative", "link": "link"}}
def relative_news(sit, base, variants, facts, bindings=None, people=(), icons=None):
    situation(
        "relative_news", sit, "npc",
        base_all=[PHASE_REPLY, TRUST_SOCIAL] + base, base_none=NOT_PRACTICAL,
        bindings={**RN_B, **(bindings or {})}, facts=facts, icons=icons or [T("family"), R("relative")],
        use_key="relative_news:{npc.id}:{player.id}:{relative.id}:" + sit,
        risks=["Family or the relative's portrait can land badly with them."],
        reveals=["A current fact about that relative"],
        effects=[{"op": "set_subject", "person": "relative"}], disc_people=list(people),
        variants=variants)

relative_news("trade", [P("has_profession", person="relative")], [
    "{relative.first_name}'s the {relative.trade} now.", "{relative.first_name} keeps the {relative.workplace_name}."],
    [F("relative", ["profession"])])
relative_news("married", [P("has_living_spouse", person="relative"), P("kinship_not_in", link="link", kinds=["spouse"])], [
    "{relative.first_name}'s married to {spouse.first_name}.", "{relative.first_name} wed {spouse.first_name}."],
    [F("relative", ["spouse"])], bindings={"spouse": {"source": "spouse_of", "person": "relative"}}, people=["spouse"],
    icons=[T("family"), R("relative"), R("spouse")])
relative_news("children", [P("living_child_count_at_least", person="relative", count=1),
                           P("kinship_not_in", link="link", kinds=["spouse", "parent", "grandparent"])], [
    "{relative.first_name} has {relative.children_words} children now.",
    "{relative.first_name}'s got {relative.children_words} of their own."],
    [F("relative", ["children_living_count"])])
relative_news("young", [P("age_below", person="relative", age=18)], [
    "{relative.first_name}'s {relative.age_words}, and growing fast.", "{relative.age_words|cap} now. Shooting up."],
    [F("relative", ["age"])])
relative_news("away", [P("different_village", a="npc", b="relative")], [
    "{relative.first_name} lives in {relative.village_name} now.", "Over in {relative.village_name}, these days."],
    [F("relative", ["village"])])
relative_news("dead", [P("person_dead", person="relative"), P("event_known_to", person="npc", event="death")], [
    "{relative.first_name} died {death.when}.", "We lost {relative.first_name} {death.when}."],
    [F("death", ["id", "day", "cause"], "past")], bindings={"death": {"source": "death_event_of", "person": "relative"}})
relative_news("same_house", [P("same_household", a="npc", b="relative"), P("person_alive", person="relative")], [
    "{relative.first_name}'s at home with us.", "Under the same roof as me."],
    [F("relative", ["household"])])

# --- residence history ---
def residence(sit, base, variants, bindings, facts, people=(), events=(), icons=None):
    situation(
        "residence_answer", sit, "npc",
        base_all=[PHASE_REPLY] + base, base_none=NOT_PRACTICAL,
        bindings=bindings, facts=facts, icons=icons or [T("village"), R("npc")],
        use_key="residence:{npc.id}:{player.id}",
        risks=["Village or the speaker's portrait can land badly with them."],
        reveals=["Where the speaker comes from, from real records"],
        effects=[{"op": "set_reply_purpose", "purpose": "open"}],
        disc_people=list(people), disc_events=list(events), variants=variants)

residence("born_here", [P("event_type_is", event="born", type="birth"),
                        P("event_village_is", event="born", village="npc.village")], [
    "I was born here in {npc.village_name}.",
    V("Born here, and never left.", "stayed", P("no_move_events", person="npc")),
    V("Born and bred in {npc.village_name}.", "stayed", P("no_move_events", person="npc"))],
    {"born": {"source": "birth_event_of", "person": "npc"}}, [F("born", ["id", "day", "villageId"], "past")], events=["born"])
residence("founder", [P("event_type_is", event="founding", type="founding"),
                      P("event_participant", event="founding", person="npc")], [
    "I helped found {npc.village_name}, {founding.when_exact}.",
    "We founded this place, {founding.when_exact}. I was there."],
    {"founding": {"source": "founding_event_with", "person": "npc"}},
    [F("founding", ["id", "day", "people", "villageId"], "past")], events=["founding"])
residence("moved_in", [P("event_type_is", event="move", type="move"), P("event_villages_differ", event="move"),
                       P("event_detail_is", event="move", field="toVillage", value="npc.village")], [
    "I moved here {move.when}.",
    "I came to {npc.village_name} {move.when}, from {move.from_village_name}."],
    {"move": {"source": "latest_move_event_of", "person": "npc"}}, [F("move", ["id", "day", "fromVillage", "toVillage"], "past")],
    events=["move"])
residence("married_in", [P("event_type_is", event="move", type="move"),
                         P("event_type_is", event="wedding", type="marriage"),
                         P("same_day", a="move", b="wedding")], [
    "I came here when I married {spouse.first_name}, {wedding.when}.",
    "Marriage brought me here. {spouse.first_name}, {wedding.when}."],
    {"move": {"source": "latest_move_event_of", "person": "npc"},
     "wedding": {"source": "marriage_event_of", "person": "npc"},
     "spouse": {"source": "spouse_of", "person": "npc"}},
    [F("move", ["id", "day"], "past"), F("wedding", ["id", "day", "people"], "past")],
    people=["spouse"], events=["move", "wedding"], icons=[T("village"), R("spouse")])
residence("unrecorded", [P("no_residence_record", person="npc")], [
    "Long enough.", "A good while."],
    {}, [F("npc", ["residence_records_absent"])])

# --- NPC asks about the player's family; player answers ---
situation(
    "family_question", "npc_asks", "npc",
    base_all=[PHASE_REPLY, RING_MIN("social")], base_none=NOT_PRACTICAL,
    forbid=["npc_asked:family"], add=["npc_asked:family"],
    facts=[F("relationship", ["ring"])], icons=[T("family"), R("player")],
    use_key="npc_ask_family:{npc.id}:{player.id}:{context.encounter_number}",
    risks=["Family can land badly with them, and your portrait costs 1 of their goodwill if it pops."], reveals=["Nothing beyond the question"],
    effects=[{"op": "set_reply_purpose", "purpose": "player_family_answer"}],
    variants=["Have you family of your own?", "Have you people somewhere?", "Are you on your own, then?",
              V("And you? Is there someone waiting at home?", "warm", RING_MIN("personal"))])

def player_family(sit, base, variants, icons, bindings, facts, people=(), reveals=None):
    situation(
        "player_family", sit, "player",
        base_all=[PHASE_PLAYER] + base, base_none=NOT_PRACTICAL,
        bindings=bindings, facts=facts, icons=icons,
        use_key="own_family:{player.id}:{npc.id}:" + sit,
        risks=["Your portrait costs 1 of their goodwill if it pops; a relative's portrait scores by how they regard that relative.",
               "A disclosed relationship can rule out a later courtship."],
        reveals=reveals or ["One fact about your own family"],
        effects=[{"op": "set_reply_purpose", "purpose": "open"}],
        disc_people=list(people), variants=variants)

player_family("no_kin", [P("has_no_living_kin", person="player")], [
    "I've no family here.", "There's just me.",
    V("I came on my own.", "arrived", P("arrived_within_days", person="player", days=24))],
    [T("family"), R("player")], {}, [F("player", ["kinship_living_count", "arrived_at"])],
    reveals=["That you have no living kin"])
player_family("spouse", [P("has_living_spouse", person="player")], [
    "I'm married to {spouse.first_name}.", "{spouse.first_name}'s my {spouse.kin_term}."],
    [T("family"), R("spouse")], {"spouse": {"source": "spouse_of", "person": "player"}},
    [F("spouse", ["identity", "kinship"])], people=["spouse"])
player_family("child", [P("living_child_count_at_least", person="player", count=1)], [
    "I've a {child.kin_term}, {child.first_name}.", "{child.first_name}'s my {child.kin_term}. {child.age_words|cap} now."],
    [T("family"), R("child")], {"child": {"source": "player_child"}},
    [F("child", ["identity", "kinship", "age"])], people=["child"])
player_family("parent", [P("has_living_parent", person="player")], [
    "My {parent.kin_term} is {parent.first_name}.", "{parent.first_name}'s my {parent.kin_term}."],
    [T("family"), R("parent")], {"parent": {"source": "player_parent"}},
    [F("parent", ["identity", "kinship"])], people=["parent"])

# =====================================================================
# GOSSIP
# =====================================================================
SUBJ_B = {"subject": {"source": "current_subject_known_to_player"}}
def gossip_q(sit, variants, icons, base=(), bindings=None, purpose="event_news", key=None, people_subject=True):
    situation(
        "gossip_question", sit, "player",
        base_all=[PHASE_PLAYER, P("knows_identity", viewer="player", person="npc")] + list(base),
        base_none=NOT_PRACTICAL + [P("same_person", a="subject", b="npc")] if people_subject else NOT_PRACTICAL,
        bindings=bindings if bindings is not None else SUBJ_B,
        add=["asked:gossip"], facts=[F("subject", ["identity_known_to_player"])] if people_subject else [F("player_knowledge", ["npc_village_name"])],
        icons=icons, use_key=key or ("ask_about:{player.id}:{npc.id}:{subject.id}:{context.game_hour}"),
        risks=["Gossip or the subject's portrait can land badly with them.", "They need to trust you (Familiar or closer) to tell you anything."],
        reveals=["That you are interested in this person"] if people_subject else ["Nothing beyond the question"],
        effects=([{"op": "set_subject", "person": "subject"}] if people_subject else [{"op": "clear_subject"}]) +
                [{"op": "set_reply_purpose", "purpose": purpose}],
        variants=variants)

gossip_q("news_of", ["What news of {subject.first_name}?", "Heard anything of {subject.first_name}?",
                     "How's {subject.first_name} getting on?", "Any word of {subject.first_name}?"],
         [T("gossip"), R("subject")])
gossip_q("opinion_of", ["Do you know {subject.first_name} well?", "What do you make of {subject.first_name}?"],
         [T("gossip"), R("subject")], purpose="relationship_answer",
         key="ask_opinion:{player.id}:{npc.id}:{subject.id}")
gossip_q("village_news", ["Any news in {npc.village_name}?", "What's the news hereabouts?",
                          "Anything happening in {npc.village_name}?"],
         [T("gossip"), T("village")], bindings={}, purpose="event_news",
         key="ask_village_news:{player.id}:{npc.id}:{context.game_hour}", people_subject=False)

def npc_refusal(family, sit, base, variants, reveals, key, icons=None, bindings=None, facts=None):
    situation(
        family, sit, "npc",
        base_all=[PHASE_REPLY] + base, base_none=NOT_PRACTICAL,
        bindings=bindings or {}, facts=facts or [F("relationship", ["ring"])],
        icons=icons or [R("npc")], use_key=key,
        risks=["The speaker's portrait stays in the row."], reveals=reveals,
        effects=[{"op": "set_reply_purpose", "purpose": "open"}], variants=variants)

npc_refusal("event_news", "refuse_trust", [P("ring_is", person="npc", towards="player", ring="public")], [
    "I don't carry tales to folk I hardly know.",
    "I don't pass news to folk I hardly know.",
    "Not my place. Not yet.",
    "I keep other people's business to myself. For now.",
    "You'll get no gossip out of me. Not yet.",
    "Ask me that when we know each other better.",
    V("I'm not one for idle talk. Not with you, yet.", "proud", TR("proud")),
    V("Oh, you'll not get me gossiping that easily.", "cheerful", TR("cheerful")),
    V("News is worth something. You'll have to earn it.", "worldly", TR("worldly")),
    V("It's not my place to talk about others.", "humble", TR("humble")),
], ["That they do not trust you yet; nothing about whether they have news"],
   "gossip_refusal:{npc.id}:{player.id}:{context.encounter_number}")
npc_refusal("event_news", "unknown_subject", [P("subject_is_set"), P("does_not_know_person", viewer="npc", person="subject")], [
    "I don't know {subject.first_name}.",
    "{subject.first_name}? Never met them.",
    "Can't say I know {subject.first_name}.",
    "Who's {subject.first_name}?",
], ["That the speaker has never met this person"], "unknown_subject:{npc.id}:{subject.id}",
   bindings=SUBJ_B, facts=[F("npc_relationships", ["has_no_record_of_subject"])])
for fam in ("relationship_answer",):
    npc_refusal(fam, "refuse_trust", [P("ring_is", person="npc", towards="player", ring="public")], [
        "I'd sooner not say.", "That's between me and them.", "Ask me when I know you better.",
        "I don't talk about folk behind their backs. Not to you, yet."],
        ["That they do not trust you yet"], "opinion_refusal:{npc.id}:{player.id}:{context.encounter_number}")
    npc_refusal(fam, "unknown_subject", [P("does_not_know_person", viewer="npc", person="subject")], [
        "I don't know {subject.first_name} at all.", "Never met {subject.first_name}.",
        "{subject.first_name}? Not someone I know.", "I couldn't tell you. I don't know them."],
        ["That the speaker has never met this person"], "unknown_subject:{npc.id}:{subject.id}",
        bindings=SUBJ_B, facts=[F("npc_relationships", ["has_no_record_of_subject"])])

# --- what the speaker thinks of the subject (askAbout already discloses the ring) ---
BOND_B = {**SUBJ_B, "bond": {"source": "npc_bond_with_subject"}}
def opinion(sit, base, variants):
    situation(
        "relationship_answer", sit, "npc",
        base_all=[PHASE_REPLY, TRUST_SOCIAL, P("knows_person", viewer="npc", person="subject")] + base,
        base_none=NOT_PRACTICAL, bindings=BOND_B,
        facts=[F("bond", ["ring", "disposition", "goodwill_sign"])], icons=[T("gossip"), R("subject")],
        use_key="opinion:{npc.id}:{player.id}:{subject.id}:{bond.ring}",
        risks=["Gossip or the subject's portrait can land badly with them."],
        reveals=["How the speaker regards this person, from their real ring and disposition"],
        effects=[{"op": "record_feeling_disclosure", "viewer": "player", "speaker": "npc", "about": "subject"}],
        disc_facts=[{"ref": "bond", "fields": ["ring"]}], variants=variants)

opinion("close", [P("bond_ring_is", bond="bond", ring="intimate")], [
    "{subject.first_name}? We're as close as can be.", "{subject.first_name}'s dearest to me.",
    V("{subject.first_name}! There's nobody better.", "cheerful", TR("cheerful"))])
opinion("friend", [P("bond_ring_is", bond="bond", ring="personal")], [
    "{subject.first_name}'s a good friend of mine.", "I count {subject.first_name} a friend.",
    "We're friends, {subject.first_name} and me."])
opinion("familiar", [P("bond_ring_is", bond="bond", ring="social")], [
    "I know {subject.first_name} well enough.", "I've time for {subject.first_name}.",
    "{subject.first_name}? Decent enough."])
opinion("passing", [P("bond_ring_is", bond="bond", ring="public"), P("bond_goodwill_at_least", bond="bond", value=0)],
        ["I know {subject.first_name} a little.", "Only to nod to.", "Not well, I'll admit."])
opinion("dislike", [P("bond_dislikes", bond="bond")], [
    "I've no liking for {subject.first_name}.", "I'd rather not talk about {subject.first_name}.",
    V("{subject.first_name}? Don't start me.", "gloomy", TR("gloomy")),
    V("I keep clear of {subject.first_name}.", "timid", TR("timid"))])

# --- NPC tells a real event the player does not know ---
def ev_binding(src="npc_known_unheard_event_about_subject", **people):
    b = {"event": {"source": src}}
    for name, idx in people.items():
        b[name] = {"source": "event_person", "event": "event", "index": idx}
    return b

def gossip_report(sit, etype, variants, icons, people, extra_base=(), family="event_news",
                  src="npc_known_unheard_event_for_question", fields=("id", "type", "people", "day", "season"),
                  extra_bindings=None, risks_extra=()):
    b = ev_binding(src, **people)
    if extra_bindings:
        b.update(extra_bindings)
    situation(
        family, sit, "npc",
        base_all=[PHASE_REPLY, P("event_type_is", event="event", type=etype),
                  P("event_known_to", person="npc", event="event"),
                  P("event_unknown_to", person="player", event="event"),
                  P("can_disclose_event", speaker="npc", viewer="player", event="event")] + list(extra_base),
        base_none=NOT_PRACTICAL, bindings=b,
        facts=[F("event", list(fields), "past")], icons=icons,
        use_key="tell_event:{npc.id}:{player.id}:{event.id}",
        risks=["Gossip, Family or a named person can land badly with them."] + list(risks_extra),
        reveals=["One real event you did not know"],
        effects=[{"op": "set_subject", "person": list(people)[0]}] if people else [],
        disc_people=list(people), disc_events=["event"], variants=variants)

def SPEAKER_IS(idx):
    return P("event_participant_is", event="event", index=idx, person="npc")
def SPEAKER_NOT_IN():
    return P("not_event_participant", event="event", person="npc")

for fam, src in (("event_news", "npc_known_unheard_event_for_question"),):
    tag = ""
    gossip_report(tag + "quarrel", "quarrel", [
        V("{a.first_name} and {b.first_name} had words {event.when}.", "third", SPEAKER_NOT_IN()),
        V("{a.first_name} fell out with {b.first_name} {event.when}.", "third", SPEAKER_NOT_IN()),
        V("There was a quarrel between {a.first_name} and {b.first_name} {event.when}.", "third", SPEAKER_NOT_IN()),
        V("{a.first_name} and {b.first_name} quarrelled {event.when}. It happens.", "gloomy", SPEAKER_NOT_IN(), TR("gloomy")),
    ], [T("gossip"), R("a"), R("b")], {"a": 0, "b": 1}, family=fam, src=src,
        risks_extra=["If either is your close kin, hearing this costs your goodwill towards the other."])
    gossip_report(tag + "quarrel_self", "quarrel", [
        V("{other.first_name} and I quarrelled {event.when}.", "self"),
        V("I fell out with {other.first_name} {event.when}.", "self"),
        V("{other.first_name} and I had words {event.when}. I'll say no more.", "proud", TR("proud")),
    ], [T("gossip"), R("other")], {"other": "other_participant"}, extra_base=[P("event_participant", event="event", person="npc")],
        family=fam, src=src, extra_bindings={"other": {"source": "event_other_participant", "event": "event", "person": "npc"}})
    gossip_report(tag + "reconciliation", "reconciliation", [
        V("{a.first_name} and {b.first_name} made it up {event.when}.", "third", SPEAKER_NOT_IN()),
        V("{a.first_name} made peace with {b.first_name} {event.when}.", "third", SPEAKER_NOT_IN()),
        V("{a.first_name} and {b.first_name} are speaking again. Since {event.when}.", "cheerful", SPEAKER_NOT_IN(), TR("cheerful"),
          P("no_later_quarrel", event="event")),
    ], [T("gossip"), R("a"), R("b")], {"a": 0, "b": 1}, family=fam, src=src)
    gossip_report(tag + "reconciliation_self", "reconciliation", [
        V("{other.first_name} and I made our peace {event.when}.", "self"),
        V("I made it up with {other.first_name} {event.when}.", "self"),
    ], [T("gossip"), R("other")], {"other": "other_participant"}, extra_base=[P("event_participant", event="event", person="npc")],
        family=fam, src=src, extra_bindings={"other": {"source": "event_other_participant", "event": "event", "person": "npc"}})
    gossip_report(tag + "gift", "gift", [
        V("{a.first_name} gave {b.first_name} {event.item_phrase} {event.when}.", "third", SPEAKER_NOT_IN()),
        V("{b.first_name} had {event.item_phrase} from {a.first_name} {event.when}.", "third", SPEAKER_NOT_IN()),
        V("I gave {b.first_name} {event.item_phrase} {event.when}.", "giver", SPEAKER_IS(0)),
        V("{a.first_name} gave me {event.item_phrase} {event.when}.", "recipient", SPEAKER_IS(1)),
    ], [T("gossip"), R("a"), R("b")], {"a": 0, "b": 1}, family=fam, src=src,
        fields=("id", "type", "people", "day", "items", "gifts"))
    gossip_report(tag + "marriage", "marriage", [
        V("{a.first_name} and {b.first_name} were married {event.when}.", "third", SPEAKER_NOT_IN()),
        V("{a.first_name} wed {b.first_name} {event.when}.", "third", SPEAKER_NOT_IN()),
        V("There was a wedding {event.when}. {a.first_name} and {b.first_name}.", "cheerful", SPEAKER_NOT_IN(), TR("cheerful")),
    ], [T("family"), R("a"), R("b")], {"a": 0, "b": 1}, family=fam, src=src)
    gossip_report(tag + "celebration", "celebration", [
        V("{a.first_name} and {b.first_name} celebrated their wedding {event.when}.", "third", SPEAKER_NOT_IN()),
        V("There was a wedding party for {a.first_name} and {b.first_name} {event.when}.", "third", SPEAKER_NOT_IN()),
    ], [T("family"), R("a"), R("b")], {"a": 0, "b": 1}, family=fam, src=src)
    gossip_report(tag + "birth", "birth", [
        V("{a.first_name} and {b.first_name} had a {child.boy_girl} {event.when}. {child.first_name}, they named {child.him_her}.",
          "third", SPEAKER_NOT_IN()),
        V("{child.first_name} was born to {a.first_name} and {b.first_name} {event.when}.", "third", SPEAKER_NOT_IN()),
        V("Our {child.son_daughter}, {child.first_name}, was born {event.when}.", "parent",
          P("event_participant_in", event="event", indices=[1, 2], person="npc")),
    ], [T("family"), R("child"), R("a")], {"child": 0, "a": 1, "b": 2}, family=fam, src=src)
    gossip_report(tag + "death", "death", [
        V("{a.first_name} died {event.when}.", "base"),
        V("We lost {a.first_name} {event.when}. Old age.", "old_age", P("event_detail_is", event="event", field="cause", value="old age")),
        V("{a.first_name} died of old age, {event.when}.", "old_age", P("event_detail_is", event="event", field="cause", value="old age")),
        V("{a.first_name} died for want of food, {event.when}.", "starved", P("event_detail_is", event="event", field="cause", value="starvation")),
        V("{a.first_name} went hungry too long. Died {event.when}.", "starved", P("event_detail_is", event="event", field="cause", value="starvation")),
    ], [T("family"), R("a")], {"a": 0}, family=fam, src=src, fields=("id", "type", "people", "day", "cause"))
    gossip_report(tag + "inheritance", "inheritance", [
        V("{b.first_name} came into {a.first_name}'s house {event.when}.", "house", SPEAKER_NOT_IN(), P("event_items_are_houses", event="event")),
        V("{a.first_name}'s house went to {b.first_name} {event.when}.", "house", SPEAKER_NOT_IN(), P("event_items_are_houses", event="event")),
        V("{b.first_name} has {a.first_name}'s {event.item_name} now. Inherited it {event.when}.", "item", SPEAKER_NOT_IN(),
          P("event_items_are_possessions", event="event")),
        V("When {a.first_name} died, {b.first_name} had the {event.item_name}.", "item", SPEAKER_NOT_IN(), P("event_items_are_possessions", event="event")),
        V("I came into {a.first_name}'s house {event.when}.", "self_house", SPEAKER_IS(1), P("event_items_are_houses", event="event")),
        V("This {event.item_name} was {a.first_name}'s. It came to me {event.when}.", "self_item", SPEAKER_IS(1),
          P("event_items_are_possessions", event="event"), P("item_carried_by", event="event", person="npc")),
    ], [T("family"), R("b"), R("a")], {"a": 0, "b": 1}, family=fam, src=src, fields=("id", "type", "people", "day", "items"))
    gossip_report(tag + "move", "move", [
        V("{a.first_name} moved to {event.to_village_name} {event.when}.", "away", SPEAKER_NOT_IN(), P("event_villages_differ", event="event")),
        V("{a.first_name} left {event.from_village_name} for {event.to_village_name} {event.when}.", "away", SPEAKER_NOT_IN(),
          P("event_villages_differ", event="event")),
        V("{a.first_name} moved house {event.when}.", "same", SPEAKER_NOT_IN(), P("event_villages_same", event="event")),
        V("{a.first_name} moved to another house {event.when}.", "same", SPEAKER_NOT_IN(), P("event_villages_same", event="event")),
    ], [T("village"), R("a")], {"a": 0}, family=fam, src=src,
        fields=("id", "type", "people", "day", "fromHouse", "toHouse", "fromVillage", "toVillage"))
    gossip_report(tag + "household_join", "household_join", [
        V("{a.first_name} joined {b.first_name}'s household {event.when}.", "base", SPEAKER_NOT_IN()),
        V("{a.first_name} went to live with {b.first_name} {event.when}.", "base", SPEAKER_NOT_IN()),
        V("I joined {b.first_name}'s household {event.when}.", "self", SPEAKER_IS(0)),
        V("{a.first_name} came to live with us {event.when}.", "host", SPEAKER_IS(1)),
    ], [T("family"), R("a"), R("b")], {"a": 0, "b": 1}, family=fam, src=src)
    gossip_report(tag + "building", "building_built", [
        V("{a.first_name} built the {event.building_name} {event.when}.", "base", SPEAKER_NOT_IN()),
        V("The {event.building_name}? {a.first_name} put that up, {event.when}.", "base", SPEAKER_NOT_IN()),
        V("I built the {event.building_name} myself, {event.when}.", "self", SPEAKER_IS(0)),
    ], [T("work"), R("a")], {"a": 0}, family=fam, src=src, fields=("id", "type", "people", "day", "kind", "timber"))
    gossip_report(tag + "house", "house_built", [
        V("{a.first_name} built a house {event.when}.", "base", SPEAKER_NOT_IN()),
        V("{a.first_name}'s house went up {event.when}.", "base", SPEAKER_NOT_IN()),
        V("Our house went up {event.when}.", "self", P("event_participant", event="event", person="npc")),
    ], [T("village"), R("a")], {"a": 0}, family=fam, src=src, fields=("id", "type", "people", "day", "houseId"))
    gossip_report(tag + "expansion", "expansion", [
        V("{a.first_name} added {event.addition_phrase} to the house {event.when}.", "base"),
        V("{a.first_name}'s house got {event.addition_phrase} {event.when}.", "base"),
    ], [T("work"), R("a")], {"a": 0}, family=fam, src=src, fields=("id", "type", "people", "day", "addition"))
    gossip_report(tag + "oath", "village_oath", [
        V("{a.first_name} swore the oath before {b.first_name} {event.when}.", "base", SPEAKER_NOT_IN()),
        V("{a.first_name} gave {b.first_name} their word and joined {event.village_name}, {event.when}.", "base", SPEAKER_NOT_IN()),
        V("{a.first_name} swore the oath before me {event.when}.", "elder", SPEAKER_IS(1)),
    ], [T("village"), R("a"), R("b")], {"a": 0, "b": 1}, family=fam, src=src, fields=("id", "type", "people", "day", "villageId"))
    gossip_report(tag + "leave", "village_leave", [
        V("{a.first_name} gave up {event.village_name} {event.when}.", "base", SPEAKER_NOT_IN()),
        V("{a.first_name} left the village before {b.first_name}, {event.when}.", "base", SPEAKER_NOT_IN()),
        V("{a.first_name} came to me {event.when} and gave up the village.", "elder", SPEAKER_IS(1)),
    ], [T("village"), R("a")], {"a": 0, "b": 1}, family=fam, src=src, fields=("id", "type", "people", "day", "villageId"))
    gossip_report(tag + "commons_cut", "commons_cut", [
        V("{a.first_name} cut wood on the common without leave, {event.when}.", "base", SPEAKER_NOT_IN()),
        V("{a.first_name} took wood from the common {event.when}, and had no right.", "base", SPEAKER_NOT_IN()),
        V("{a.first_name} was cutting the common woodland {event.when}. No right to.", "proud", SPEAKER_NOT_IN(), TR("proud")),
    ], [T("village"), R("a")], {"a": 0}, family=fam, src=src, fields=("id", "type", "people", "day", "villageId"))
    gossip_report(tag + "commons_warning", "commons_warning", [
        V("{a.first_name} caught {b.first_name} cutting on the common {event.when}, and said so.", "base", SPEAKER_NOT_IN()),
        V("{a.first_name} warned {b.first_name} off the common woodland {event.when}.", "base", SPEAKER_NOT_IN()),
        V("I caught {b.first_name} cutting on the common {event.when}. I said my piece.", "self", SPEAKER_IS(0)),
    ], [T("village"), R("a"), R("b")], {"a": 0, "b": 1}, family=fam, src=src, fields=("id", "type", "people", "day", "response"))
    gossip_report(tag + "departure", "departure", [
        V("{a.first_name} went off on the road {event.when}, looking for company.", "company", SPEAKER_NOT_IN(),
          P("event_detail_is", event="event", field="reason", value="seeking company")),
        V("{a.first_name} took to the road {event.when}, to find company.", "company", SPEAKER_NOT_IN(),
          P("event_detail_is", event="event", field="reason", value="seeking company")),
        V("{a.first_name} went home {event.when}.", "home", SPEAKER_NOT_IN(), P("event_detail_is", event="event", field="reason", value="returning home")),
        V("{a.first_name} set off for home {event.when}.", "home", SPEAKER_NOT_IN(), P("event_detail_is", event="event", field="reason", value="returning home")),
        V("{a.first_name} left for the {event.to_direction} {event.when}.", "base", SPEAKER_NOT_IN()),
    ], [T("village"), R("a")], {"a": 0}, family=fam, src=src, fields=("id", "type", "people", "day", "toWorld", "reason"))
    gossip_report(tag + "world_move", "world_move", [
        V("{a.first_name} married away and settled in the {event.to_direction}, {event.when}.", "base", SPEAKER_NOT_IN()),
        V("{a.first_name} wed and went to live in the {event.to_direction}, {event.when}.", "base", SPEAKER_NOT_IN()),
    ], [T("family"), R("a")], {"a": 0}, family=fam, src=src, fields=("id", "type", "people", "day", "toWorld"))

gossip_report("village_green", "green_moved", [
    V("We moved the green {event.when}, to give more room.", "base", P("same_village", a="npc", b="event")),
    V("The green was moved {event.when}. More space for everyone.", "base"),
], [T("village")], {}, family="event_news", src="npc_known_unheard_event_for_question", extra_base=[P("question_is_village")],
    fields=("id", "type", "day", "villageId"))

npc_refusal("event_news", "nothing_more", [TRUST_SOCIAL, P("subject_is_set"), P("no_permitted_unheard_event_about", speaker="npc", viewer="player", subject="subject")], [
    "That's all I know of {subject.first_name}.",
    "Nothing more to tell about {subject.first_name}.",
    "That's all I'll say of {subject.first_name}.",
    "I've no more news of {subject.first_name}.",
    V("You know as much as I do now.", "exhausted", P("no_unheard_event_about", speaker="npc", viewer="player", subject="subject")),
], ["That the speaker has no more news they will tell about this person"],
   "nothing_more:{npc.id}:{player.id}:{subject.id}:{context.encounter_number}", bindings=SUBJ_B,
   facts=[F("npc_knowledge", ["no_permitted_unheard_event_about_subject"])])
npc_refusal("event_news", "nothing_more_village", [TRUST_SOCIAL, P("question_is_village"), P("no_permitted_unheard_event_in_village", speaker="npc", viewer="player")], [
    "Nothing I can tell you.", "Nothing much that I know of.", "No news. None I'd pass on, anyway.",
    "Quiet, as far as I can tell you."],
    ["That the speaker has no more village news they will tell"],
    "village_nothing:{npc.id}:{player.id}:{context.encounter_number}",
    facts=[F("npc_knowledge", ["no_permitted_unheard_event_in_village"])])

# --- the player retells a real event ---
def player_tell(sit, etype, variants, icons, people, extra_base=(), fields=("id", "type", "people", "day"),
                risks_extra=(), bindings_extra=None, src="player_known_permitted_event"):
    b = ev_binding(src, **{k: v for k, v in people.items() if isinstance(v, int)})
    if bindings_extra:
        b.update(bindings_extra)
    situation(
        "gossip_tell", sit, "player",
        base_all=[PHASE_PLAYER, P("event_type_is", event="event", type=etype),
                  P("event_known_to", person="player", event="event"),
                  P("can_disclose_event", speaker="player", viewer="npc", event="event")] + list(extra_base),
        base_none=NOT_PRACTICAL, bindings=b,
        facts=[F("event", list(fields), "past")], icons=icons,
        use_key="tell_event:{player.id}:{npc.id}:{event.id}",
        risks=["Gossip, Family or a named person can land badly with them.",
               "They may tell someone else, including the people involved."] + list(risks_extra),
        reveals=["One real event you know"],
        effects=[{"op": "set_subject", "person": list(people)[0]},
                 {"op": "set_reply_purpose", "purpose": "gossip_reaction"}],
        disc_people=list(people), disc_events=["event"], variants=variants)

player_tell("quarrel", "quarrel", [
    "{a.first_name} and {b.first_name} had words {event.when}.",
    "Did you know {a.first_name} and {b.first_name} quarrelled?"],
    [T("gossip"), R("a"), R("b")], {"a": 0, "b": 1},
    risks_extra=["If either is their close kin, they lose 3 goodwill towards the other."])
player_tell("reconciliation", "reconciliation", [
    "{a.first_name} and {b.first_name} made it up {event.when}.",
    "{a.first_name} made peace with {b.first_name}."], [T("gossip"), R("a"), R("b")], {"a": 0, "b": 1},
    risks_extra=["If the second is their close kin, they gain 1 goodwill towards the first."])
player_tell("gift", "gift", [
    "{a.first_name} gave {b.first_name} {event.item_phrase}.",
    "{b.first_name} had {event.item_phrase} from {a.first_name}."], [T("gossip"), R("a"), R("b")], {"a": 0, "b": 1},
    fields=("id", "type", "people", "day", "items", "gifts"),
    risks_extra=["If the recipient is their close kin, they gain 1 goodwill towards the giver."])
player_tell("own_gift", "gift", [
    "I gave {b.first_name} {event.item_phrase} {event.when}.", "{b.first_name} has {event.item_phrase} from me."], [T("help"), R("b")], {"b": 1},
    extra_base=[P("event_participant_is", event="event", index=0, person="player")],
    fields=("id", "type", "people", "day", "items"))
player_tell("marriage", "marriage", [
    "{a.first_name} and {b.first_name} were married {event.when}.", "{a.first_name} wed {b.first_name}."],
    [T("family"), R("a"), R("b")], {"a": 0, "b": 1})
player_tell("birth", "birth", [
    "{a.first_name} and {b.first_name} had a {child.boy_girl}.", "{child.first_name} was born {event.when}."],
    [T("family"), R("child"), R("a")], {"child": 0, "a": 1, "b": 2})
player_tell("death", "death", [
    "{a.first_name} died {event.when}.", "Did you hear {a.first_name} died?"], [T("family"), R("a")], {"a": 0},
    fields=("id", "type", "people", "day", "cause"))
player_tell("move", "move", [
    "{a.first_name} moved to {event.to_village_name}.", "{a.first_name} moved house {event.when}."],
    [T("village"), R("a")], {"a": 0}, fields=("id", "type", "people", "day", "toVillage"))
player_tell("own_favour_harvest", "favour", [
    "I helped {b.first_name} with the harvest {event.when}.", "I brought in {b.first_name}'s grain."],
    [T("help"), R("player"), R("b")], {"b": 1},
    extra_base=[P("event_participant_is", event="event", index=0, person="player"),
                P("event_detail_is", event="event", field="kind", value="harvest")],
    fields=("id", "type", "people", "day", "kind", "quantity"))
player_tell("own_favour_wood", "favour", [
    "I brought {b.first_name} a log {event.when}.", "I fetched fuel for {b.first_name}."],
    [T("help"), R("player"), R("b")], {"b": 1},
    extra_base=[P("event_participant_is", event="event", index=0, person="player"),
                P("event_detail_is", event="event", field="kind", value="wood")],
    fields=("id", "type", "people", "day", "kind"))
player_tell("own_favour_food", "favour", [
    "I took food to {b.first_name}'s house {event.when}.", "I brought {b.first_name}'s household food."],
    [T("help"), R("player"), R("b")], {"b": 1},
    extra_base=[P("event_participant_is", event="event", index=0, person="player"),
                P("event_detail_is", event="event", field="kind", value="food")],
    fields=("id", "type", "people", "day", "kind", "quantity"))
player_tell("visit", "visit", [
    "{a.first_name} visited {b.first_name} {event.when}.", "{a.first_name} was over at {b.first_name}'s."],
    [T("village"), R("a")], {"a": 0, "b": 1}, fields=("id", "type", "people", "day", "fromVillage", "toVillage"),
    extra_base=[P("player_heard_event_spoken", event="event")])

# --- NPC reaction to a retelling: the truth of whether they already knew ---
def reaction(sit, base, variants, icons=None, facts=None, effects=None, bindings=None, people=()):
    situation(
        "gossip_reaction", sit, "npc",
        base_all=[PHASE_REPLY] + base, base_none=NOT_PRACTICAL,
        bindings=bindings or {"event": {"source": "event_just_told_by_player"}},
        facts=facts or [F("npc_knowledge", ["knew_event_before_this_line"])],
        icons=icons or [T("gossip")], use_key="react:{npc.id}:{event.id}",
        risks=["Gossip can land badly with them."], reveals=["Whether they already knew"],
        effects=effects or [{"op": "set_reply_purpose", "purpose": "open"}], disc_people=list(people),
        variants=variants)

reaction("new", [P("npc_knew_event_before_line", event="event", value=False)], [
    "I hadn't heard that.", "Well, I never.", "Is that so? I didn't know.",
    V("Doesn't surprise me.", "gloomy", TR("gloomy")),
    V("Oh! Well, there's news.", "cheerful", TR("cheerful"))])
reaction("known", [P("npc_knew_event_before_line", event="event", value=True)], [
    "So I'd heard.", "Yes, I knew of that.", "Old news, that.",
    V("I know. Everyone knows.", "worldly", TR("worldly"))])
reaction("kin_quarrel", [P("npc_knew_event_before_line", event="event", value=False),
                         P("event_type_is", event="event", type="quarrel"),
                         P("event_has_close_kin_of", event="event", person="npc")], [
    "{other.first_name} quarrelled with my {kin.kin_term}? I'll remember that.",
    "{other.first_name} and my {kin.kin_term}? Well. That changes things."],
    icons=[T("gossip"), R("other")],
    bindings={"event": {"source": "event_just_told_by_player"},
              "kin": {"source": "event_participant_who_is_close_kin_of", "event": "event", "person": "npc"},
              "other": {"source": "event_other_participant", "event": "event", "person": "kin"}},
    facts=[F("event", ["id", "people", "type"], "past"), F("kin", ["kinship"])])
reaction("kin_gift", [P("npc_knew_event_before_line", event="event", value=False),
                      P("event_type_is", event="event", type="gift"),
                      P("event_recipient_is_close_kin_of", event="event", person="npc")], [
    "{giver.first_name} did that for my {kin.kin_term}? That was good of {giver.him_her}.",
    "Good of {giver.first_name}. I'll not forget it."],
    icons=[T("help"), R("giver")],
    bindings={"event": {"source": "event_just_told_by_player"},
              "giver": {"source": "event_person", "event": "event", "index": 0},
              "kin": {"source": "event_person", "event": "event", "index": 1}},
    facts=[F("event", ["id", "people", "type"], "past"), F("kin", ["kinship"])])

# =====================================================================
# VISIT NEWS
# =====================================================================
situation(
    "visit_question", "general", "player",
    base_all=[PHASE_PLAYER, P("knows_identity", viewer="player", person="npc")], base_none=NOT_PRACTICAL,
    forbid=["asked:visits"], add=["asked:visits"], icons=[T("village")],
    facts=[F("player_knowledge", ["npc_identity"])],
    use_key="ask_visits:{player.id}:{npc.id}:{context.game_hour}",
    risks=["Village can land badly with them."], reveals=["Nothing beyond the question"],
    effects=[{"op": "set_reply_purpose", "purpose": "visit_news"}],
    variants=["Seen anyone I know lately?", "Any visitors of late?", "Who's been by lately?",
              "Anyone come through {npc.village_name} lately?"])

VISIT_BASE = [P("event_known_to", person="npc", event="event"), P("event_unknown_to", person="player", event="event"),
              P("visit_is_relevant_to_player", event="event", speaker="npc")]
def visit_news(sit, etype, base, variants, icons=None, people=("visitor",), bindings_extra=None, fields=None):
    b = {"event": {"source": "npc_known_relevant_unheard_visit"},
         "visitor": {"source": "event_person", "event": "event", "index": 0}}
    if bindings_extra:
        b.update(bindings_extra)
    for phase, label, pv in (("reply", "", PHASE_REPLY), ("opening", "_opening", PHASE_OPEN)):
        vs = [v for v in variants if (v.get("phase", "reply") if isinstance(v, dict) else "reply") == phase]
        if not vs:
            continue
        if phase == "opening":
            # "Did you hear?" openings also lay down Gossip, when five cells are free.
            for v in vs:
                if v["text"].startswith("Did you hear?"):
                    v["icons"] = [T("gossip")] + list(icons or [T("village"), R("visitor")])
                    v["add"] = list(v.get("add", [])) + [FREE5]
        situation(
            "visit_news", sit + label, "npc",
            base_all=[pv, P("event_type_is", event="event", type=etype)] + VISIT_BASE + list(base) +
                     ([CONTACT] if phase == "opening" else []),
            base_none=NOT_PRACTICAL + [HATE], bindings=b,
            forbid=["greeting_spoken"] if phase == "opening" else [],
            add=["greeting_spoken", "visit_news_told"] if phase == "opening" else ["visit_news_told"],
            facts=[F("event", fields or ["id", "type", "people", "day", "fromVillage", "toVillage"], "past")],
            icons=icons or [T("village"), R("visitor")],
            use_key="tell_event:{npc.id}:{player.id}:{event.id}",
            risks=["Village, Gossip or the visitor's portrait can land badly with them."],
            reveals=["One real visit you did not know, with the speaker recorded as your source"],
            effects=[{"op": "set_subject", "person": "visitor"},
                     {"op": "record_spoken_source", "viewer": "player", "event": "event", "speaker": "npc"}],
            disc_people=list(people), disc_events=["event"], variants=vs)

def VP(text, voice="base", *add, phase="reply", **kw):
    d = V(text, voice, *add, **kw)
    d["phase"] = phase
    return d

HOST_SELF = P("event_participant_is", event="event", index=1, person="npc")
VIS_KNOWN = P("knows_identity", viewer="player", person="visitor")
visit_news("visit_to_me", "visit", [HOST_SELF, VIS_KNOWN], [
    VP("{visitor.first_name} came over from {event.from_village_name} to see me {event.when}.", "away", P("event_villages_differ", event="event")),
    VP("I had {visitor.first_name} over from {event.from_village_name} {event.when}.", "away", P("event_villages_differ", event="event")),
    VP("{visitor.first_name} walked over from {event.from_village_name} to see me {event.when}.", "away", P("event_villages_differ", event="event")),
    VP("{visitor.first_name} called round to see me {event.when}.", "local", P("event_villages_same", event="event")),
    VP("{visitor.first_name} was round at mine {event.when}.", "local", P("event_villages_same", event="event")),
    VP("{visitor.first_name} looked in on me {event.when}.", "local", P("event_villages_same", event="event")),
    VP("Here's news for you. {visitor.first_name} came to see me {event.when}.", "base", phase="opening"),
    VP("Did you hear? {visitor.first_name} was here to see me {event.when}.", "base", phase="opening"),
    VP("You know {visitor.first_name}? Came over to see me {event.when}.", "cheerful", TR("cheerful"), phase="opening"),
])
visit_news("visit_known_host", "visit", [VIS_KNOWN, P("knows_identity", viewer="player", person="host"),
                                         P("not_event_participant", event="event", person="npc")], [
    VP("{visitor.first_name} called on {host.first_name} {event.when}.", "base"),
    VP("{visitor.first_name} was over at {host.first_name}'s {event.when}.", "base"),
    VP("{visitor.first_name} came all the way from {event.from_village_name} to see {host.first_name}, {event.when}.", "away",
       P("event_villages_differ", event="event")),
    VP("{visitor.first_name} went to see {host.first_name} {event.when}.", "base"),
    VP("Did you hear? {visitor.first_name} was over at {host.first_name}'s {event.when}.", "base", phase="opening"),
    VP("Here's news. {visitor.first_name} called on {host.first_name} {event.when}.", "base", phase="opening"),
], bindings_extra={"host": {"source": "event_person", "event": "event", "index": 1}})
visit_news("visit_unknown_host", "visit", [VIS_KNOWN, P("does_not_know_identity", viewer="player", person="host"),
                                           P("not_event_participant", event="event", person="npc")], [
    VP("{visitor.first_name} was visiting in {event.to_village_name} {event.when}.", "base"),
    VP("{visitor.first_name} came to {event.to_village_name} {event.when}, visiting.", "base"),
])
NOTABLE = P("does_not_know_identity", viewer="player", person="visitor")
TO_HERE = P("event_detail_is", event="event", field="toVillage", value="npc.village")
visit_news("notable_elder", "visit", [NOTABLE, TO_HERE, P("is_current_elder", person="visitor")], [
    VP("{visitor.name}, the elder over at {visitor.village_name}, came by {event.when}.", "base"),
    VP("We had {visitor.village_name}'s elder here {event.when}. {visitor.name}.", "base"),
    VP("Here's news. {visitor.name}, elder at {visitor.village_name}, came by {event.when}.", "base", phase="opening"),
    VP("Did you hear? {visitor.village_name}'s elder came by {event.when}. {visitor.name}.", "base", phase="opening"),
], fields=["id", "type", "people", "day", "fromVillage", "toVillage", "visitor_current_role"])
visit_news("notable_head", "visit", [NOTABLE, TO_HERE, P("is_household_head", person="visitor")], [
    VP("{visitor.name} came over {event.when}. Heads a household in {visitor.village_name}.", "base"),
    VP("{visitor.name}, from {visitor.village_name}, was here {event.when}. Head of a house there.", "base"),
], fields=["id", "type", "people", "day", "fromVillage", "toVillage", "visitor_current_role"])
visit_news("notable_trade", "visit", [NOTABLE, TO_HERE, P("has_profession", person="visitor")], [
    VP("{visitor.name}, the {visitor.trade} from {visitor.village_name}, came by {event.when}.", "base"),
    VP("We had the {visitor.trade} from {visitor.village_name} here {event.when}. {visitor.name}, that is.", "base"),
    VP("Did you hear? The {visitor.trade} from {visitor.village_name} was here {event.when}. {visitor.name}.", "base", phase="opening"),
    VP("Here's news. {visitor.name}, the {visitor.trade} from {visitor.village_name}, was here {event.when}.", "base", phase="opening"),
], fields=["id", "type", "people", "day", "fromVillage", "toVillage", "visitor_current_role"])
visit_news("arrived_from_reach", "world_visit", [P("event_detail_is", event="event", field="toWorld", value="context.world_key")], [
    VP("{visitor.first_name} came in from the {event.from_direction} {event.when}.", "known", VIS_KNOWN),
    VP("{visitor.first_name} arrived from the {event.from_direction}, {event.when}.", "known", VIS_KNOWN),
    VP("{visitor.name}, the {visitor.trade}, came in from the {event.from_direction} {event.when}.", "notable_trade",
       NOTABLE, P("has_profession", person="visitor")),
    VP("Here's news. {visitor.first_name} came in from the {event.from_direction} {event.when}.", "known", VIS_KNOWN, phase="opening"),
    VP("Did you hear? {visitor.first_name} arrived from the {event.from_direction} {event.when}.", "known", VIS_KNOWN, phase="opening"),
], fields=["id", "type", "people", "day", "fromWorld", "toWorld"])
visit_news("went_visiting", "world_visit", [P("event_detail_is", event="event", field="fromWorld", value="context.world_key"), VIS_KNOWN], [
    VP("{visitor.first_name} went off visiting in the {event.to_direction} {event.when}.", "base"),
    VP("{visitor.first_name} took the road {event.to_direction} {event.when}, to see folk there.", "base"),
], fields=["id", "type", "people", "day", "fromWorld", "toWorld"])
visit_news("returned", "return", [VIS_KNOWN], [
    VP("{visitor.first_name} came home from the {event.from_direction} {event.when}.", "base"),
    VP("{visitor.first_name}'s back from the road. Came home {event.when}.", "base"),
    VP("Did you hear? {visitor.first_name}'s home again. Came back {event.when}.", "base", phase="opening"),
    VP("Here's news. {visitor.first_name}'s home from the {event.from_direction}. Came back {event.when}.", "base", phase="opening"),
    VP("{visitor.first_name}'s back! Came home from the {event.from_direction} {event.when}.", "cheerful", TR("cheerful"), phase="opening"),
], fields=["id", "type", "people", "day", "fromWorld", "toWorld"])

npc_refusal("visit_news", "none", [P("no_relevant_unheard_visit", speaker="npc", viewer="player")], [
    "No one you'd know.", "No one I can think of.", "Not that I know of.", "No one, that I've heard.",
    V("Nobody. It's been a quiet {context.season}.", "quiet",
      P("no_visit_events_known_this_season", speaker="npc"), facts=[F("npc_knowledge", ["no_visits_this_season"])]),
], ["That the speaker knows no visit you would care about"],
   "visits_none:{npc.id}:{player.id}:{context.game_hour}",
   facts=[F("npc_knowledge", ["no_relevant_unheard_visit"])])

# =====================================================================
# NEEDS AND FAVOURS
# =====================================================================
# --- overheard hints above unacquainted adults (world speech bubble, not a chat row) ---
def hint(sit, base, variants):
    situation(
        "overheard_hint", sit, "npc",
        base_all=[PHASE_BUBBLE, NPC_ADULT, P("request_status_is", request="request", status="offered"),
                  P("request_reason_still_holds", request="request"),
                  P("resident_of_request_household", person="npc", request="request"),
                  P("within_encounter_distance", a="player", b="npc", units=300),
                  P("on_explored_ground", viewer="player", person="npc")] + list(base),
        base_none=[CONTACT],
        bindings={"request": {"source": "live_request_for_npc_household"}},
        facts=[F("request", ["kind", "status", "reason"])], icons=[],
        use_key="hint:{request.id}:{npc.id}",
        risks=["None: a bubble costs no slots."],
        reveals=["That this household has this kind of need; no name, traits or request"],
        effects=[{"op": "record_noticed_need", "viewer": "player", "request": "request", "speaker": "npc"}],
        variants=variants)

KIND = lambda k: P("request_kind_is", request="request", kind=k)
hint("harvest", [KIND("harvest")], [
    "Could do with a hand at the harvest.",
    "All this grain to cut.",
    "Field's ripe. Wish I'd more hands.",
    "Grain's ready, and so much of it.",
    V("Many hands make light work!", "cheerful", TR("cheerful")),
    V("Grain's ripe! Who's for cutting?", "cheerful", TR("cheerful")),
    V("Ripe grain, and nobody to help.", "gloomy", TR("gloomy")),
    V("Ripe, and it'll not cut itself.", "gloomy", TR("gloomy")),
    V("We'll manage the harvest. Somehow.", "proud", TR("proud")),
    V("Our grain's ripe. We'll see to it.", "proud", TR("proud")),
])
hint("wood_oven", [KIND("wood"), P("request_workplace_trade_is", request="request", trade="baker")], [
    "Oven's cold. Not a stick left.",
    "Can't bake without a log.",
    "No fuel for the oven.",
    V("Cold oven, empty woodpile.", "gloomy", TR("gloomy")),
    V("No log, no baking.", "gloomy", TR("gloomy")),
    V("One log and I'm baking again!", "cheerful", TR("cheerful")),
])
hint("wood_forge", [KIND("wood"), P("request_workplace_trade_is", request="request", trade="smith")], [
    "Forge is out. No wood.",
    "Can't work a cold forge.",
    "Not a log for the forge.",
    V("One log and I'm back at it!", "cheerful", TR("cheerful")),
    V("Cold forge, and not a stick.", "gloomy", TR("gloomy")),
])
hint("food", [KIND("food")], [
    "Pantry's nearly bare.",
    "Not enough put by for us all.",
    "We're short of food at ours.",
    "Need more in the larder.",
    V("Thin times in this house.", "gloomy", TR("gloomy")),
    V("Not enough to go round.", "gloomy", TR("gloomy")),
    V("We'll make do somehow.", "proud", TR("proud")),
    V("We'll not go begging.", "proud", TR("proud")),
])
hint("any", [P("household_offered_request_count_at_least", household="npc.household", count=2)], [
    "Loads to do.",
    "So much to do.",
    "Never enough hands.",
])

# --- player offers help ---
situation(
    "help_offer", "generic", "player",
    base_all=[PHASE_PLAYER, PLAYER_ADULT, P("knows_identity", viewer="player", person="npc")],
    forbid=["offered_help"], add=["offered_help"], icons=[T("help"), R("npc")],
    facts=[F("player_knowledge", ["npc_identity"])],
    use_key="offer_help:{player.id}:{npc.id}:{context.encounter_number}",
    risks=["Help or their portrait can land badly with them."], reveals=["That you are willing to help"],
    effects=[{"op": "set_reply_purpose", "purpose": "favour_ask"}],
    variants=["Can I lend a hand with anything?", "Is there anything wants doing?",
              "Need any help?", "Anything I can do for you?"])

def offer_noticed(sit, kind, variants, topic):
    situation(
        "help_offer", sit, "player",
        base_all=[PHASE_PLAYER, PLAYER_ADULT, P("player_noticed_need", household="npc.household", kind=kind, speaker="npc")],
        forbid=["offered_help"], add=["offered_help"], icons=[T("help"), T(topic)],
        bindings={"noticed": {"source": "player_noticed_need_from_npc"}},
        facts=[F("noticed", ["household_id", "kind", "workplace_kind", "day"])],
        use_key="offer_help:{player.id}:{npc.id}:{context.encounter_number}",
        risks=["Help or the topic can land badly with them.", "Shows you overheard them."],
        reveals=["That you overheard their need"],
        effects=[{"op": "set_reply_purpose", "purpose": "favour_ask"}], variants=variants)

offer_noticed("noticed_harvest", "harvest", [
    "I heard you could use a hand with the harvest.", "You said the grain wants cutting?"], "harvest")
offer_noticed("noticed_wood", "wood", [
    "I heard the {noticed.workplace_name} wants fuel.", "You're short of wood, I think?"], "work")
offer_noticed("noticed_food", "food", [
    "I heard you're short of food.", "Are you short in the larder?"], "food")

# --- NPC asks for a real favour (only after a completed first exchange) ---
ASK_BASE = [PHASE_REPLY, CONTACT, NPC_ADULT, P("can_request_for_household", request="request", person="npc"),
            P("request_status_is", request="request", status="offered"), P("request_reason_still_holds", request="request")]
def favour_ask(sit, kind, base, variants, icons, facts):
    situation(
        "favour_ask", sit, "npc",
        base_all=ASK_BASE + [KIND(kind)] + list(base),
        base_none=[P("player_declined_offer_without_reoffer", request="request")],
        bindings={"request": {"source": "live_request_for_npc_household"}, "home": {"source": "npc_household"}},
        forbid=["favour_asked"], add=["favour_asked"],
        facts=facts, icons=icons, use_key="ask_favour:{npc.id}:{player.id}:{request.id}",
        risks=["The topic or their portrait can land badly with them."],
        reveals=["A real household need and the request itself"],
        commitment="None yet. You can accept or decline.",
        effects=[{"op": "set_pending_offer", "request": "request", "requester": "npc"},
                 {"op": "set_reply_purpose", "purpose": "favour_choice"}],
        disc_requests=["request"],
        disc_facts=[{"ref": "request", "fields": ["kind", "quantity", "reason", "receiver"]}],
        variants=variants)

REQ_F = [F("request", ["id", "kind", "quantity", "status", "householdId", "reason", "goodwill"])]
favour_ask("harvest", "harvest", [], [
    "Our grain's ripe. Would you cut {request.quantity_words} {request.unit} and bring it to our store?",
    "The field's ready. I'd be glad of a hand with {request.quantity_words} {request.unit}.",
    "Could you help with our harvest? {request.quantity_words|cap} {request.unit}, carried to the store.",
    "Cut {request.quantity_words} {request.unit} for us and I'll not forget it.",
    V("I'll not beg. But the grain's ripe, and {request.quantity_words} {request.unit} would help.", "proud", TR("proud")),
    V("I hate to ask. Could you cut {request.quantity_words} {request.unit} of our grain?", "humble", TR("humble")),
    V("The grain's come good! Help me bring in {request.quantity_words} {request.unit}?", "cheerful", TR("cheerful")),
    V("The grain's ripe and it won't cut itself. {request.quantity_words|cap} {request.unit}, if you would.", "gloomy", TR("gloomy")),
    V("I'd sooner not cut it all myself. Take {request.quantity_words} {request.unit}?", "lazy", TR("lazy")),
], [T("harvest"), R("npc")], REQ_F + [F("field", ["ripe_count"])])
favour_ask("wood_oven", "wood", [P("request_workplace_trade_is", request="request", trade="baker")], [
    "The oven's cold and there's not a stick in the store. Could you bring a log?",
    "One log would give me four hours at the oven. Could you fetch one?",
    V("Sorry to ask. Could you bring us a log? The oven's out.", "humble", TR("humble")),
    V("The oven's out of fuel. A log, if you're going that way.", "proud", TR("proud")),
], [T("work"), R("npc")], REQ_F + [F("workplace", ["trade", "fuelHours"]), F("store", ["wood"])])
favour_ask("wood_forge", "wood", [P("request_workplace_trade_is", request="request", trade="smith")], [
    "The forge is out and the woodpile's empty. Would you bring me a log?",
    "I can't work a cold forge. One log would do it.",
    V("Bring me one log and I'm back at work.", "cheerful", TR("cheerful")),
    V("A log for the forge. I'd fetch it myself, but there it is.", "lazy", TR("lazy")),
], [T("work"), R("npc")], REQ_F + [F("workplace", ["trade", "fuelHours"]), F("store", ["wood"])])
favour_ask("food", "food", [], [
    "We're short. Less than two meals each in the house. Could you bring {request.quantity_words} {request.unit} of your own?",
    "There's {home.size_words} of us and not enough put by. {request.quantity_words|cap} {request.unit} would help.",
    V("{request.quantity_words|cap} {request.unit} would see us right. Could you bring them?", "whole",
      P("request_covers_whole_need", request="request")),
    V("I don't like to ask. Could you bring us {request.quantity_words} {request.unit}?", "humble", TR("humble")),
    V("I'd not ask if it weren't needed. {request.quantity_words|cap} {request.unit}?", "proud", TR("proud")),
    V("The larder's near empty. {request.quantity_words|cap} {request.unit}, if you can find them.", "gloomy", TR("gloomy")),
], [T("food"), R("npc")], REQ_F + [F("home", ["residents", "food_portions"])])

# --- no favour to ask ---
npc_refusal("favour_ask", "no_need", [P("no_live_request_for_household", person="npc")], [
    "Not just now, but thank you.",
    "We're managing, thanks.",
    "That's kind. Nothing at present.",
    "No, we're all right.",
    V("We manage well enough.", "proud", TR("proud")),
    V("No.", "cool", GW_BELOW(0)),
], ["That their household has no need you can help with"], "no_need:{npc.id}:{player.id}:{context.encounter_number}",
   icons=[T("help")], facts=[F("favours", ["no_offered_request_for_household"])])
npc_refusal("favour_ask", "child", [P("age_below", person="npc", age=18)], [
    "You'd best ask the grown-ups.", "Ask at home. Not me."],
    ["That children cannot ask favours"], "child_no_ask:{npc.id}:{player.id}",
    icons=[T("help")], facts=[F("npc", ["age"])])
npc_refusal("favour_ask", "not_yet", [P("no_completed_contact_before_this_line", actor="player", person="npc")], [
    "Let's know each other a bit first.", "Ask me again once we've talked."],
    ["That they ask favours only of people they have spoken with"], "too_soon:{npc.id}:{player.id}",
    icons=[T("help")], facts=[F("contact", ["completed_contact"])])

# --- player accepts (acceptance also authorises delivery in v1) ---
def accept(sit, kind, variants, topic):
    situation(
        "favour_accept", sit, "player",
        base_all=[PHASE_PLAYER, PLAYER_ADULT, CONTACT, P("request_heard_from", request="request", person="npc"),
                  P("request_status_is", request="request", status="offered"), KIND(kind)],
        forbid=["favour_resolved"], add=["favour_resolved"],
        bindings={"request": {"source": "player_heard_live_offer_from_npc"}},
        facts=[F("request", ["id", "kind", "quantity", "status", "householdId"])],
        icons=[T("help"), T(topic), R("npc")],
        use_key="accept_favour:{player.id}:{request.id}",
        risks=["Three icons: more chances to match, but more slots.", "Help, the topic or their portrait can land badly with them."],
        reveals=["Your acceptance, if the game accepts it"],
        commitment="Queues the real work and its delivery to their household. Goodwill comes only on completion.",
        resolve={"rule": "accept_and_authorise_favour", "args": {"actor": "player", "requester": "npc", "request": "request"},
                 "success_reply": "favour_accepted", "failure_reply": "favour_unavailable"},
        effects=[], variants=variants)

accept("harvest", "harvest", [
    "I'll cut {request.quantity_words} {request.unit} and bring them in.",
    "Leave it to me. {request.quantity_words|cap} {request.unit}.",
    "Yes, I'll help with the harvest."], "harvest")
accept("wood", "wood", [
    "I'll bring you a log.", "One log. I'll see to it.", "I'll fetch a log for the {request.workplace_name}."], "work")
accept("food", "food", [
    "I'll bring {request.quantity_words} {request.unit}.", "I'll find {request.quantity_words} {request.unit} for you.",
    V("I can spare {request.quantity_words} {request.unit}.", "has_supply", P("player_has_favour_supply", request="request"),
      facts=[F("player_goods", ["eligible_food_outside_household_reserve"])])], "food")

# --- player declines ---
situation(
    "favour_decline", "decline", "player",
    base_all=[PHASE_PLAYER, P("request_heard_from", request="request", person="npc"),
              P("request_status_is", request="request", status="offered")],
    forbid=["favour_resolved"], add=["favour_resolved"],
    bindings={"request": {"source": "player_heard_live_offer_from_npc"}},
    facts=[F("request", ["id", "status"])], icons=[T("help"), R("npc")],
    use_key="decline_favour:{player.id}:{request.id}",
    risks=["Help or their portrait can land badly with them."], reveals=["That you will not take this on"],
    commitment="Records a declined offer. Their need stays real; no extra penalty.",
    effects=[{"op": "record_declined_offer", "request": "request"},
             {"op": "set_reply_purpose", "purpose": "favour_declined"}],
    variants=["I can't take that on just now.", "Not this time, I'm sorry.", "I'd best not promise what I can't do.",
              V("I've too much on already.", "busy", P("player_queue_length_at_least", count=2),
                facts=[F("player_queue", ["length"])])])

# --- NPC acknowledges an accepted favour (only after the resolver succeeds) ---
def accepted(sit, base, variants):
    situation(
        "favour_accepted", sit, "npc",
        base_all=[PHASE_REPLY, P("result_is", result="result", value="favour_accepted")] + list(base),
        bindings={"result": {"source": "pending_favour_result"}, "request": {"source": "result_request", "result": "result"}},
        facts=[F("result", ["request_id", "accepted", "delivery_authorised"], "performed")], icons=[T("help")],
        use_key="favour_ack:{request.id}",
        risks=["Help can land badly with them."], reveals=["That the request is now yours"],
        effects=[{"op": "set_reply_purpose", "purpose": "open"}], variants=variants)

accepted("harvest", [KIND("harvest")], [
    "Thank you kindly. Bring it all to our store, mind.",
    "That's good of you. Every patch counts.",
    "You're a help. We'll be glad of every patch.",
    V("Bless you for that.", "pious", TR("pious")),
    V("I'm obliged.", "proud", TR("proud"))])
accepted("wood", [KIND("wood")], [
    "Thank you. Straight to the store, or to the {request.workplace_name} if the store's full.",
    "That's good of you. One log's all it wants.",
    "You're a help. We'll have the {request.workplace_name} going again.",
    V("I'm obliged.", "proud", TR("proud"))])
accepted("food", [KIND("food")], [
    "Thank you. It must be your own, mind, not from our store.",
    "That's kind. We'll be glad of it.",
    "Thank you kindly. Bring it to the store.",
    V("Oh, thank you. Thank you.", "humble", TR("humble"))])

def unavailable(sit, base, variants, reveals):
    situation(
        "favour_unavailable", sit, "npc",
        base_all=[PHASE_REPLY, P("result_is", result="result", value="favour_unavailable")] + list(base),
        bindings={"result": {"source": "pending_favour_result"}, "request": {"source": "result_request", "result": "result"}},
        facts=[F("result", ["request_id", "failure_reason"], "performed")], icons=[R("npc")],
        use_key="favour_fail:{request.id}",
        risks=["The portrait stays in the row."], reveals=reveals,
        effects=[{"op": "set_reply_purpose", "purpose": "open"}], variants=variants)

unavailable("need_met", [P("result_reason_in", result="result", reasons=[
    "The harvest need is already met", "The fuel need is already met", "The food need is already met"])], [
    "No need now. It's been seen to.", "Too late, I'm afraid. It's done.", "We're all right now, as it happens."],
    ["That the need was met before you accepted"])
unavailable("moved", [P("result_reason_in", result="result", reasons=["The requester moved home"])], [
    "We've moved since. It doesn't matter now.", "We're in a different house now. No need."],
    ["That the requester's household changed"])
unavailable("target_gone", [P("result_reason_in", result="result", reasons=["The household target is gone", "The family field is gone"])], [
    "There's nothing left to do it for, now.", "It's gone. No help for it."], ["That the field or store no longer exists"])

def declined(variants):
    situation(
        "favour_declined", "reply", "npc",
        base_all=[PHASE_REPLY], facts=[F("request", ["id", "declined_by_player"])], icons=[T("help")],
        bindings={"request": {"source": "request_just_declined"}},
        use_key="decline_ack:{request.id}",
        risks=["Help can land badly with them."], reveals=["How they take it"],
        effects=[{"op": "set_reply_purpose", "purpose": "open"}], variants=variants)

declined(["Fair enough.", "Another time, then.", "No matter. We'll manage.",
          V("Suit yourself.", "cool", GW_BELOW(0)),
          V("Then I'll see to it myself.", "proud", TR("proud")),
          V("I thought as much.", "gloomy", TR("gloomy"))])

# --- the player mentions their accepted favour to the requester ---
situation(
    "favour_progress", "player_mentions", "player",
    base_all=[PHASE_PLAYER, P("request_status_is", request="request", status="accepted"),
              P("request_accepted_by", request="request", actor="player"),
              P("request_household_is_npc_household", request="request")],
    bindings={"request": {"source": "player_accepted_request_for_npc_household"}},
    facts=[F("request", ["id", "kind", "status", "progress", "quantity"]), F("task", ["waiting_reason"])],
    icons=[T("help"), R("npc")], use_key="mention_favour:{player.id}:{request.id}:{context.encounter_number}",
    risks=["Help or their portrait can land badly with them."], reveals=["Nothing new: they already know you agreed"],
    effects=[{"op": "set_reply_purpose", "purpose": "favour_progress"}],
    variants=[
        V("I'm still after a log for you.", "wood_wait", KIND("wood"), P("favour_waiting_for_supply", request="request")),
        V("I've not forgotten your food.", "food_wait", KIND("food")),
        V("I've not forgotten your harvest.", "harvest", KIND("harvest")),
        V("Your log's coming.", "wood", KIND("wood")),
    ])
situation(
    "favour_progress", "npc_reply", "npc",
    base_all=[PHASE_REPLY, P("request_status_is", request="request", status="accepted")],
    bindings={"request": {"source": "player_accepted_request_for_npc_household"}},
    facts=[F("request", ["id", "kind", "status"]), F("workplace", ["fuelHours"]), F("home", ["food_portions", "residents"])],
    icons=[T("help")], use_key="favour_progress_reply:{request.id}:{context.encounter_number}",
    risks=["Help can land badly with them."], reveals=["The need is still real"],
    effects=[{"op": "set_reply_purpose", "purpose": "open"}],
    variants=[
        V("Good. The {request.workplace_name}'s still cold.", "wood", KIND("wood"), P("request_reason_still_holds", request="request")),
        V("Good. We're still short, mind.", "food", KIND("food"), P("request_reason_still_holds", request="request")),
        V("Good. The grain's still standing.", "harvest", KIND("harvest"), P("request_reason_still_holds", request="request")),
        V("Thank you. Whenever you can.", "base"),
    ])

# --- the player asks who else needs a hand: the answer names a real open request ---
# Being told of a need records a heard need for the hint system. It does not teach
# the request itself: only the asker, in their own chat, can offer it.
situation(
    "need_question", "anyone", "player",
    base_all=[PHASE_PLAYER, PLAYER_ADULT], base_none=[],
    forbid=["asked:need"], add=["asked:need", "offered_help"], icons=[T("help")],
    facts=[F("player", ["age"])],
    use_key="ask_need:{player.id}:{npc.id}:{context.encounter_number}",
    risks=["Help can land badly with them."], reveals=["That you are looking for work to do"],
    effects=[{"op": "set_reply_purpose", "purpose": "need_news"}],
    variants=[
        "Anyone hereabouts need a hand?",
        "Is there work going anywhere?",
        "Know anyone who could use help?",
        "Who could use a hand round here?",
        V("Anyone in {npc.village_name} need a hand?", "village", icons=[T("help"), T("village")],
          risks=["Village can land badly with them."]),
        V("I'm new here. Who could use a hand?", "new", ARRIVED, facts=[F("player", ["arrived_at"])]),
        V("I've nothing on just now. Anyone need help?", "idle", P("player_queue_empty", actor="player"),
          facts=[F("player_queue", ["length"])]),
        V("I'd sooner be working. Who needs a hand?", "hardworking", PTR("hard-working")),
        V("If anyone's in need, I'd like to help.", "generous", PTR("generous")),
        V("I'll do any work going. Is there any?", "humble", PTR("humble")),
        V("Who'd be glad of my help, and remember it?", "greedy", PTR("greedy")),
    ])

NEED_B = {"request": {"source": "npc_known_live_request_elsewhere"},
          "asker": {"source": "request_giver", "request": "request"}}
NEED_BASE = [PHASE_REPLY, P("request_status_is", request="request", status="offered"),
             P("request_reason_still_holds", request="request"),
             P("npc_knows_of_request", speaker="npc", request="request")]
NEED_NONE = NOT_PRACTICAL + [P("request_household_is_npc_household", request="request"),
             P("request_household_is_player_household", request="request"),
             P("request_heard_from", request="request", person="asker")]
KNOWN_ASKER = P("knows_identity", viewer="player", person="asker")
UNKNOWN_ASKER = P("does_not_know_identity", viewer="player", person="asker")
AWAY = P("different_village", a="asker", b="npc")
def need_news(sit, kind, base, variants, topic, facts):
    situation(
        "need_news", sit, "npc",
        base_all=NEED_BASE + [KIND(kind)] + list(base), base_none=NEED_NONE,
        bindings=NEED_B, facts=REQ_F + facts + [F("asker", ["identity", "household", "village"])],
        icons=[T(topic), R("asker")], use_key="tell_need:{player.id}:{request.id}",
        risks=[topic.capitalize() + " can land badly with them; the asker's portrait scores by how they regard that person."],
        reveals=["A real need in another household, and who to ask"],
        effects=[{"op": "record_heard_need", "viewer": "player", "request": "request", "asker": "asker", "speaker": "npc"},
                 {"op": "set_subject", "person": "asker"}],
        disc_people=["asker"], disc_facts=[{"ref": "request", "fields": ["kind", "householdId", "house_direction"]}],
        variants=variants)

need_news("harvest", "harvest", [], [
    V("{asker.first_name}'s grain is ripe. Ask {asker.him_her}.", "known", KNOWN_ASKER),
    V("Try {asker.first_name}. Their field's ripe and standing.", "known", KNOWN_ASKER),
    V("{asker.first_name} has grain wants cutting. Off to the {request.house_direction}.", "known", KNOWN_ASKER),
    V("{asker.name}'s grain is ripe. Their house is off to the {request.house_direction}.", "unknown", UNKNOWN_ASKER),
    V("Try {asker.name}, to the {request.house_direction}. Ripe grain, wanting cutting.", "unknown", UNKNOWN_ASKER),
    V("{asker.first_name}, over in {asker.village_name}. Their grain's ripe.", "away", KNOWN_ASKER, AWAY),
    V("{asker.name}, over in {asker.village_name}. Their grain's ripe.", "away", UNKNOWN_ASKER, AWAY),
    V("{asker.first_name}'s grain is ripe, and nobody's taken it on.", "gloomy", KNOWN_ASKER, TR("gloomy")),
    V("Oh, {asker.first_name}'s grain is ripe! Go and ask.", "cheerful", KNOWN_ASKER, TR("cheerful")),
    V("{asker.first_name} could use you. Their grain's ripe.", "generous", KNOWN_ASKER, TR("generous")),
    V("There's {asker.first_name}'s grain. Help there, and {asker.he_she}'ll think well of you.", "greedy",
      KNOWN_ASKER, TR("greedy"), facts=[F("request", ["goodwill"])]),
], "harvest", [F("field", ["ripe_count"])])
need_news("wood_oven", "wood", [P("request_workplace_trade_is", request="request", trade="baker")], [
    V("{asker.first_name}'s oven is cold, and not a log in the store.", "known", KNOWN_ASKER),
    V("Try {asker.first_name}. The oven's out for want of a log.", "known", KNOWN_ASKER),
    V("{asker.name} bakes, off to the {request.house_direction}. The oven's out of wood.", "unknown", UNKNOWN_ASKER),
    V("Try {asker.name}, to the {request.house_direction}. A cold oven, and no log.", "unknown", UNKNOWN_ASKER),
    V("{asker.first_name}'s oven, over in {asker.village_name}. It wants a log.", "away", KNOWN_ASKER, AWAY),
    V("No baking at {asker.first_name}'s. One log would do it.", "cheerful", KNOWN_ASKER, TR("cheerful")),
], "work", [F("workplace", ["trade", "fuelHours"]), F("store", ["wood"])])
need_news("wood_forge", "wood", [P("request_workplace_trade_is", request="request", trade="smith")], [
    V("{asker.first_name}'s forge is cold, and not a log in the store.", "known", KNOWN_ASKER),
    V("Try {asker.first_name}. The forge is out for want of a log.", "known", KNOWN_ASKER),
    V("{asker.name} keeps the forge, off to the {request.house_direction}. It's out of wood.", "unknown", UNKNOWN_ASKER),
    V("Try {asker.name}, to the {request.house_direction}. A cold forge, and no log.", "unknown", UNKNOWN_ASKER),
    V("{asker.first_name}'s forge, over in {asker.village_name}. It wants a log.", "away", KNOWN_ASKER, AWAY),
    V("{asker.first_name} can't work a cold forge. A log, that's all.", "hardworking", KNOWN_ASKER, TR("hard-working")),
], "work", [F("workplace", ["trade", "fuelHours"]), F("store", ["wood"])])
need_news("food", "food", [], [
    V("{asker.first_name}'s house is short of food. Less than two meals each.", "known", KNOWN_ASKER),
    V("Try {asker.first_name}. They're short in the larder.", "known", KNOWN_ASKER),
    V("{asker.name}'s house, off to the {request.house_direction}. They're short of food.", "unknown", UNKNOWN_ASKER),
    V("Try {asker.name}, to the {request.house_direction}. Not enough put by.", "unknown", UNKNOWN_ASKER),
    V("{asker.first_name}, over in {asker.village_name}. They're short of food.", "away", KNOWN_ASKER, AWAY),
    V("{asker.first_name}'s house is short. I'd take them something, if I were you.", "generous", KNOWN_ASKER,
      TR("generous")),
    V("Thin times at {asker.first_name}'s. They're short of food.", "gloomy", KNOWN_ASKER, TR("gloomy")),
], "food", [F("home", ["residents", "food_portions"])])

npc_refusal("need_news", "own_need", [P("no_known_live_request_elsewhere", speaker="npc"),
                                      P("household_has_live_request", household="npc.household")], [
    "Well, there's us, as it happens.",
    "Only us, as it happens.",
    V("Us, if I'm honest.", "humble", TR("humble")),
    V("We could, but we'll manage.", "proud", TR("proud")),
], ["That their own household has a need, and nobody else's that they know of"],
   "need_own:{npc.id}:{player.id}:{context.encounter_number}", icons=[T("help"), R("npc")],
   bindings={"request": {"source": "live_request_for_npc_household"}},
   facts=[F("request", ["kind", "status", "reason"]), F("npc_knowledge", ["no_live_request_elsewhere"])])
npc_refusal("need_news", "none_known", [P("no_known_live_request_elsewhere", speaker="npc"),
                                        P("household_has_no_live_request", household="npc.household")], [
    "Not that I know of.",
    "Everyone's managing, far as I know.",
    "I've not heard of anyone wanting help.",
    "Nobody's said so to me.",
    V("Nobody. You'd best ask about.", "brave", TR("brave")),
    V("Not that I've heard. Ask me again another day.", "cheerful", TR("cheerful")),
    V("Not that I know of, and I'd know.", "proud", TR("proud")),
    V("No.", "cool", COLD),
], ["That the speaker knows of no open need"], "need_none:{npc.id}:{player.id}:{context.encounter_number}",
   icons=[R("npc")], facts=[F("npc_knowledge", ["no_live_request_elsewhere"]), F("favours", ["no_offered_request_for_household"])])

# =====================================================================
# LEAVE-TAKING (closing lines carry no icons: the row has closed)
# =====================================================================
situation(
    "leave_taking", "fallback_goodbye", "player",
    base_all=[PHASE_PLAYER], icons=[],
    facts=[F("chat", ["phase"])],
    use_key="goodbye:{npc.id}:{player.id}:{context.encounter_number}",
    risks=["None: end the conversation politely."], reveals=["Nothing new"],
    variants=["I'll let you get on.", "I'd best be going. Goodbye."])

def leave(sit, speaker, base, variants, facts=None, use_key=None, effects=None, none=()):
    situation(
        "leave_taking", sit, speaker,
        base_all=[PHASE_CLOSE] + list(base), base_none=list(none), bindings={**ACTIVITY_BINDING} if speaker == "npc" else {},
        facts=facts or [F("chat", ["end_reason"])], icons=[],
        use_key=use_key or ("leave:{npc.id}:{player.id}:{context.encounter_number}"),
        risks=["None: spoken after the row closes."], reveals=["Why the chat ended"],
        effects=effects or [], variants=variants)

END = lambda r: P("chat_end_reason_is", reason=r)
leave("row_full", "npc", [END("row_full")], [
    "That's me talked out. Off you go.",
    "I've said all I've breath for.",
    "Right. That'll do for now.",
    "I've talked enough for one day.",
    V("Enough talk for now. I've work to get back to.", "working", P("activity_snapshot_was_work", person="npc"), facts=[ACT_FACT]),
    V("I'd talk longer if I could, but there it is.", "friend", RING_MIN("personal")),
    V("Come back soon. I mean it.", "close", RING("intimate")),
    V("That's enough.", "cool", GW_BELOW(0)),
    V("Well. That's that.", "gloomy", TR("gloomy")),
    V("Well! My head's full. Another time.", "cheerful", TR("cheerful")),
])
leave("faded", "npc", [END("all_faded")], [
    "Well. I'll get on.",
    "I'd best be getting on.",
    "Right, then.",
    "Well, then. I've things to do.",
    V("*Turning back to the {activity.work_noun}.*", "working", P("activity_snapshot_was_work", person="npc"), facts=[ACT_FACT]),
    V("I suppose I'd better get back to it.", "lazy", TR("lazy")),
    V("Was there something else? No? Then I'll get on.", "brave", TR("brave")),
])
leave("player_farewell", "player", [END("player_ended")], [
    "I'll let you get on.",
    "I'd best be going.",
    "I'll be on my way.",
    V("Good day to you.", "day", TOD(["morning", "afternoon"])),
    V("Good night.", "night", TOD(["evening", "night"])),
    "Till next time.",
    V("Take care, {npc.first_name}.", "friend", RING_MIN("personal", person="player", towards="npc")),
], use_key="farewell:{player.id}:{npc.id}:{context.encounter_number}")
leave("npc_farewell_cold", "npc", [END("player_ended"), COLD], [
    "Hm.", "Off you go, then.", "Right.",
    V("Go on, then.", "proud", TR("proud")),
], use_key="farewell_reply:{npc.id}:{player.id}:{context.encounter_number}")
leave("npc_farewell", "npc", [END("player_ended")], [
    "Mind how you go.",
    "Go well.",
    "Till next time.",
    "Safe home.",
    V("Come by again, {player.first_name}.", "friend", RING("personal")),
    V("Don't be long away.", "close", RING("intimate")),
    V("Get home before it's dark.", "evening", TOD("evening")),
    V("Get yourself home. It's late.", "night", TOD("night")),
    V("Keep dry, if you can.", "wet", P("weather_in", types=["rain", "storm"])),
    V("Peace go with you.", "pious", TR("pious")),
], use_key="farewell_reply:{npc.id}:{player.id}:{context.encounter_number}", none=[COLD])

# ---------- "day" wording is spoken only by day ----------
DAY = P("time_of_day_in", values=["morning", "afternoon"])
for r in rows:
    if r["family"] in ("greeting", "season_talk") and re.search(r"\bday\b", r["text"].lower()) \
            and not any(p["test"] == "time_of_day_in" for p in r["when"]["all"]):
        r["when"]["all"].append(DAY)

# ---------- weather and family truth ----------
# Fair seasonal observations give way to weather-specific lines in bad weather.
for r in rows:
    if r["family"] in ("greeting", "season_talk"):
        low = r["text"].lower()
        if (any(p["test"] in ("season_is", "season_part_is", "season_part_in") for p in r["when"]["all"])
                or "lovely {context.season}" in low or "fine day" in low or "lovely day" in low):
            r["when"]["all"].append(P("weather_in", types=["clear", "cloudy"]))
    if r["family"] == "relationship_answer" and r["situation"] == "passing":
        r["when"]["none"].append(P("subject_is_close_kin_of", person="npc"))

opinion("kin_public", [P("bond_ring_is", bond="bond", ring="public"),
        P("subject_is_close_kin_of", person="npc")],
        ["{subject.first_name} is family. That does not mean we're close."])

situation("help_refusal", "before_introduction", "npc",
    base_all=[PHASE_REPLY], icons=[T("help")],
    use_key="early_help_refusal:{npc.id}:{player.id}:{context.encounter_number}",
    facts=[F("npc", ["traits"])], risks=["Asking before an introduction costs two goodwill."],
    reveals=["They want an introduction first"],
    effects=[{"op": "set_reply_purpose", "purpose": "open"}],
    variants=[V("Your name first, if you please. Then we can speak of work.", "proud", TR("proud")),
              V("I don't even know your name. Introduce yourself first.", "timid", TR("timid"))])

# Specific questions always have an honest, on-topic reply after factual rows
# or refusals have been spent. These rows reveal no new facts.
for r in rows:
    if r["speaker"] == "player" and r["family"] == "family_question" and r["situation"] == "known_relative":
        r["when"]["none"].append(P("relative_known_dead", viewer="player", person="relative"))

player_family_q("bereaved_relative", ["I'm sorry about {relative.first_name}.", "You must miss {relative.first_name}."],
    icons=[T("family"), R("relative")],
    base=[P("relative_known_dead", viewer="player", person="relative")],
    bindings={"link": {"source": "player_known_kin_link_of_npc"}, "relative": {"source": "link_relative", "link": "link"}},
    purpose="relative_news", key="condolence:{player.id}:{npc.id}:{relative.id}:{context.encounter_number}")
situation("family_answer", "refuse_children", "npc", base_all=[PHASE_REPLY,RING("public"),
    P("question_is",family="family_question",situation="children")], icons=[T("family")],
    use_key="children_refusal:{npc.id}:{player.id}:{context.encounter_number}",
    variants=["I'm not talking about children with a stranger.", "Children are private business. Ask when we know each other."])
situation("family_answer", "no_children", "npc", base_all=[PHASE_REPLY, TRUST_SOCIAL,
    P("has_no_children", person="npc"), P("question_is", family="family_question", situation="children")],
    icons=[T("family")], facts=[F("npc", ["children"])],
    use_key="no_children:{npc.id}:{player.id}:{context.game_hour}", variants=["I've no children.", "No little ones of mine."])

fallbacks = {
    "work_question": {"general": "I've no more work to tell you of.", "personal": "That's all I'm doing today.",
        "workplace_age": "I couldn't tell you how old the workplace is.", "field": "I've nothing more to tell you about our grain."},
    "village_question": {"general": "I've nothing more to tell you about the village.", "elder": "I can't tell you more about the elder."},
    "lands_question": {"villages": "I know no more places to tell you of.", "roads": "That's all I know of the roads.",
        "beyond": "I can't tell you any more about the lands beyond.", "country": "That's all I can tell you about this country.", "known_village": "I know nothing more about that place."},
    "family_question": {"general": "I've no more family to speak of today.", "household": "I can't tell you more about my household.",
        "spouse": "I've nothing more to say about marriage.", "children": "I've no more to say about children today.",
        "parents": "I've nothing more to tell you about my parents.", "residence": "I've no more to tell you about living here.",
        "known_relative": "I've no more news of them.", "bereaved_relative": "Thank you. I remember them often."},
    "gossip_question": {"news_of": "I've no more news of them.", "opinion_of": "I've nothing more to say about them.", "village_news": "I've no more village news."},
    "visit_question": {"general": "I've no more visits to tell you of."},
    "help_offer": {"generic": "There's no work I can offer you just now.", "noticed_harvest": "I've no harvest work to offer you now.",
        "noticed_wood": "I've no fuel delivery to ask of you now.", "noticed_food": "I've no food delivery to ask of you now."},
    "need_question": {"anyone": "I know of nobody else needing help just now."},
    "introduction": {"player_asks_name": "You've heard my name already."}
}
questions = {(r["family"],r["situation"]):r for r in rows if r["speaker"]=="player" and r["situation"] in fallbacks.get(r["family"],{})}
for (fam,sit), q in questions.items():
    purpose = next(e["purpose"] for e in q["effects"] if e["op"]=="set_reply_purpose")
    topic = {"work_question":"work", "village_question":"village", "lands_question":"village", "family_question":"family",
             "gossip_question":"gossip", "visit_question":"gossip", "help_offer":"help", "need_question":"help", "introduction":"village"}[fam]
    situation(purpose, "fallback_"+sit, "npc", base_all=[PHASE_REPLY,P("question_is",family=fam,situation=sit)],
        icons=[T(topic)], use_key="topic_reply:"+fam+":"+sit+":{context.encounter_number}",
        variants=[fallbacks[fam][sit]])
situation("referral_reply", "thanks", "player", base_all=[PHASE_PLAYER,P("closing_reply_is",value="referral")], icons=[T("help")],
    use_key="referral_reply:{context.encounter_number}", variants=["Thank you. I'll look for them."],
    effects=[{"op":"set_reply_purpose","purpose":"open"}])

# Many field voices: usable by all plus trait-specific replies. Truth remains in
# the original situation predicates, with no unearned needs or history invented.
voices={
'field_growing': ['The shoots are up. Now we wait.', 'Still green, as you can see.', 'Our grain has taken root.', 'Growing, though it takes its time.', 'The field is sown. It is growing.', 'A green field today; grain later.', 'The crop is making its way.', 'There is life in the field.', 'Seed is in and shoots are showing.', 'It is growing. No cutting yet.', 'The grain is getting taller.', 'We have a growing crop to watch.', 'The field has greened up.', 'Sown grain, still growing.'],
'no_field':['We have no ground under grain.', 'No field here. Other work keeps us.', 'We do without a field.', 'No crops of our own to watch.', 'There is no grain field in our household.', 'We have no sowing to see to.', 'No land under the plough here.', 'We have no crop to bring in.', 'We are a household without a field.']}
for sit, texts in voices.items():
    model=next(r for r in rows if r['family']=='field_talk' and r['situation']==sit)
    for i,text in enumerate(texts,1):
        import copy
        r=copy.deepcopy(model);r['id']=f"npc.field_talk.{sit}.extra.{i:02d}";r['text']=text;rows.append(r)
# Disposition changes the voice of facts, without changing their truth.
voiced = {
    "field_growing": {
        "hate": ["It is growing. You can see that.", "The grain is sown. Leave it be.", "Growing. Was there something else?", "No harvest yet. Be on your way."],
        "like": ["The grain is up; we keep an eye on it.", "Sown and growing. How goes your work?", "A little taller when we look again.", "Still growing. There is time before cutting."],
        "love": ["Come and look at the shoots with me.", "Our grain is growing. Good to see you too.", "A growing field and a visitor. A good day.", "We have shoots coming through. Have a look!"]},
    "field_ripe": {
        "hate": ["Ripe. Keep your hands off it.", "The grain is ours, and ready to cut."],
        "like": ["The grain is ready. Cutting time now.", "Our ripe patches will keep us occupied."],
        "love": ["You've come at cutting time. Look at our grain!", "Ripe at last. I am glad you came to see it."]},
    "field_ploughed": {
        "hate": ["We have ploughed. We don't need advice."],
        "like": ["The ground is turned. Sowing is next."],
        "love": ["Ploughed and ready. Come and see our work."]},
    "field_bare": {
        "hate": ["Bare ground. Nothing for you there."],
        "like": ["The field is bare. We will sow again."],
        "love": ["Nothing growing to show you yet. Come again."]},
    "no_field": {
        "hate": ["No field. Why do you ask?"],
        "like": ["No field of our own. We have other work."],
        "love": ["No field to show you, but you are welcome."]},
    "idle": {
        "hate": ["My time is my own.", "Nothing I need discuss with you."],
        "like": ["A moment between tasks. What of you?", "Nothing pressing. I can stop a moment."],
        "love": ["Free for a moment, and here you are.", "I've time to hear how you are getting on."]},
    "trade_baker": {
        "hate": ["Bread. What else would I be making?"],
        "like": ["The oven keeps us occupied. Bread is our trade."],
        "love": ["Bread is our work. Come and see the oven."]},
    "trade_smith": {
        "hate": ["I work iron. Stand clear of the forge."],
        "like": ["Ironwork keeps me at the forge."],
        "love": ["Working iron. You are welcome to watch."]},
    "trade_carpenter": {
        "hate": ["Woodwork. Do you need something made?"],
        "like": ["Wood is my trade. There is always shaping to do."],
        "love": ["Working wood. Come and have a look."]},
}
for sit, dispositions in voiced.items():
    model=next(r for r in rows if r["speaker"]=="npc" and r["family"] in ("field_talk","work_talk") and r["situation"]==sit)
    for voice,texts in dispositions.items():
        for i,text in enumerate(texts,1):
            import copy
            r=copy.deepcopy(model);r["id"]=f"npc.{model['family']}.{sit}.{voice}.{i:02d}";r["text"]=text
            r["when"]["all"].append(P("disposition_is",person="npc",towards="player",value=voice));rows.append(r)

# The arrival family's names are knowledge, not faces or map discoveries.
situation("maternal_search", "named_relative", "player", base_all=[PHASE_PLAYER],
    bindings={"relative":{"source":"maternal_search"}}, icons=[T("family")],
    use_key="maternal_search:{relative.id}:{npc.id}",
    effects=[{"op":"ask_maternal_relative"},{"op":"set_reply_purpose","purpose":"maternal_whereabouts"}],
    variants=["Do you know my {relative.term}, {relative.name}?"])
for answer, text in [
    ("known", "I know {relative.name}. The household lives in {relative.village_name}, {relative.where_phrase}."),
    ("referral", "I cannot place {relative.name}, but {relative.contact_name} knows the family. Ask there."),
    ("unknown", "I do not know {relative.name}, I am afraid. Try another neighbour.")]:
    situation("maternal_whereabouts", answer, "npc", base_all=[PHASE_REPLY,P("family_search_answer",value=answer)],
        bindings={"relative":{"source":"maternal_search_question"}}, icons=[T("family")],
        use_key="maternal_whereabouts:{relative.id}:{npc.id}",
        effects=[{"op":"learn_family_whereabouts"}] if answer=="known" else [], variants=[text])
situation("maternal_introduction", "mothers_child", "player", base_all=[PHASE_PLAYER],
    bindings={"relative":{"source":"maternal_introduction"}}, icons=[T("family")],
    use_key="maternal_introduction:{player.id}:{npc.id}",
    effects=[{"op":"recognise_maternal_kin"},{"op":"set_reply_purpose","purpose":"maternal_recognition"}],
    variants=["I am {relative.mother_name}'s child."])
situation("maternal_recognition", "welcome_kin", "npc", base_all=[PHASE_REPLY],
    bindings={"relative":{"source":"maternal_recognised"}}, icons=[T("family")],
    use_key="maternal_recognition:{player.id}:{npc.id}",
    disc_people=["npc"], variants=["Then you are my {relative.inverse}! Your mother is my own kin. Welcome, child; you have found family here."])

# Village customs are ordinary authored openings and responses. Their icons
# seed the row; these consequential exchanges retain their exact fixed costs.
for kind,text in [
    ("warning", "Please leave our woodland alone. These trees belong to our village. You need our leave to cut them. Speak to our elder if you want to settle here."),
    ("oath", "Will you swear our local oath? {customs.rights}"),
    ("leave", "Do you wish to leave? {customs.rights} Your past help and offences stay in people's memories.")]:
    situation("village_"+kind, "opening", "npc",
        base_all=[P("customs_chat_kind_is",value=kind)],
        bindings={"customs":{"source":"customs_chat"}}, icons=[T("village"),T("woodland")],
        use_key="customs:"+kind+":{context.encounter_number}", variants=[text])
    rows[-1]["expects"]=kind;rows[-1]["score"]=False
    if kind=="warning": rows[-1]["effects"]=[{"op":"begin_woodland_warning"}]
for kind,choice,text in [
    ("warning","acknowledge","Fair enough. I'll stop."), ("warning","refuse","I don't agree."),
    ("oath","accept","I swear the local oath."), ("oath","decline","I'd rather not swear it."),
    ("leave","leave","I'll leave the village."), ("leave","decline","I'll stay in the village.")]:
    situation("customs_answer", "fallback_"+choice+"_"+kind, "player",
        base_all=[PHASE_PLAYER,P("answer_expected_is",value=kind)], icons=[T("village")],
        use_key="customs_answer:"+kind+":"+choice+":{context.encounter_number}",
        effects=[{"op":"customs_response","choice":choice},{"op":"set_reply_purpose","purpose":"customs_acknowledged"}],variants=[text])
    rows[-1]["answers"]=[kind];rows[-1]["score"]=False
situation("customs_acknowledged", "fallback_result", "npc", base_all=[PHASE_REPLY],
    bindings={"customs":{"source":"customs_chat"}}, icons=[T("village")],
    use_key="customs_result:{context.encounter_number}", variants=["{customs.result}"])
rows[-1]["score"]=False
for kind,text in [("oath","I would like to swear the local oath."),("leave","I wish to discuss leaving the village.")]:
    situation("customs_question",kind,"player",base_all=[PHASE_PLAYER,P("customs_eligible",kind=kind)],icons=[T("village")],
        use_key="customs_question:"+kind+":{context.encounter_number}",
        effects=[{"op":"begin_customs_chat","kind":kind},{"op":"set_reply_purpose","purpose":"village_"+kind}],variants=[text])
    rows[-1]["score"]=False

# Explicit response contracts. These always-available answers also let a player
# decline to disclose something; they never invent family, news or travel facts.
for answer, text, topic in [
    ("name", "I'm {player.first_name}. Pleased to meet you.", "village"),
    ("weather", "A day for a short chat, I think.", "season"),
    ("wellbeing", "I'll manage. Thank you for asking.", "season"),
    ("origin", "I'd rather not speak of where I've been.", "village"),
    ("village_impression", "I'm still getting to know the place.", "village"),
    ("purpose", "I came to talk, if you've a moment.", "village"),
    ("news", "I've no news I wish to share.", "gossip"),
    ("family", "I'd rather keep my family to myself.", "family"),
    ("work", "I'd rather talk of something besides my work.", "work"),
    ("subject", "I'd rather leave their story for another day.", "gossip"),
    ("referral", "Thank you. I'll ask there.", "help"),
    ("offer", "I can't take that on just now.", "help"),
    ("acknowledgement", "I see. Thank you for telling me.", "village"),
    ("invitation", "Thank you. I'll have a look.", "work"),
]:
    situation("introduction" if answer=="name" else "direct_answer", "fallback_answer_"+answer, "player",
        base_all=[PHASE_PLAYER, P("answer_expected_is", value=answer)], icons=[T(topic)],
        use_key="answer:"+answer+":{context.encounter_number}",
        effects=([{"op":"learn_identity", "viewer":"npc", "person":"player"}] if answer=="name" else [])+
            [{"op":"set_reply_purpose", "purpose":"answer_acknowledged"}], variants=[text])
    rows[-1]["answers"]=[answer]
situation("answer_acknowledged", "fallback_answer", "npc", base_all=[PHASE_REPLY], icons=[T("village")],
    use_key="answer_ack:{context.encounter_number}", variants=["All right, then.", "Very well."])

# Authoring rules for the existing voices. The generated catalogue carries the
# contract, so the runtime never guesses what a question means from its text.
for r in rows:
    if r["speaker"]=="player":
        if r["family"] in ("favour_accept", "favour_decline"): r["answers"]=["offer"]
        if r["family"]=="referral_reply": r["answers"]=["referral"]
        if r["family"]=="introduction" and r["situation"].startswith("player_name"): r["answers"]=["name"]
        if r["family"]=="player_family": r["answers"]=["family"]
        if r["family"]=="help_offer": r["answers"]=["purpose"]
        continue
    if r["family"]=="overheard_hint" and "?" in r["text"]: r["expects"]="offer"
    if r["family"] in ("leave_taking", "overheard_hint") or r.get("expects"): continue
    low=r["text"].lower()
    if r["family"]=="help_refusal": r["expects"]="name"
    elif r["family"]=="favour_ask" and any(e["op"]=="set_pending_offer" for e in r["effects"]): r["expects"]="offer"
    elif any(e["op"]=="record_heard_need" for e in r["effects"]) or (r["family"],r["situation"])==("maternal_whereabouts","referral"): r["expects"]="referral"
    elif r["family"]=="family_question": r["expects"]="family"
    elif r["family"]=="visit_news" and "?" in low: r["expects"]="acknowledgement"
    elif "how do you find" in low: r["expects"]="village_impression"
    elif any(t in low for t in ("come and look", "come and see", "have a look", "welcome to watch")): r["expects"]="invitation"
    elif any(t in low for t in ("mind the common woods", "mind which of it is common", "keep your hands off", "leave it be", "bring it all to our store", "bring it to the store")): r["expects"]="acknowledgement"
    elif low.startswith("mind ") or "stand clear of the forge" in low: r["expects"]="acknowledgement"
    elif r["family"]=="greeting" and r["situation"] in ("first_meeting_hostile","hostile_known"): r["expects"]="purpose"
    elif "out with your news" in low: r["expects"]="news"
    elif "out with it" in low: r["expects"]="purpose"
    elif r["family"]=="elder_answer" and low.startswith("ask "): r["expects"]="referral"
    elif r["family"]=="maternal_whereabouts" and r["situation"]=="unknown": r["expects"]="referral"
    elif r["family"]=="need_news" and "ask about" in low: r["expects"]="referral"
    elif "?" in low or "say your piece" in low or "say what you want" in low:
        if any(t in low for t in ("who are you", "you'd be", "it's {player.first_name}, isn't it?")): r["expects"]="name"
        elif "who's {subject" in low: r["expects"]="subject"
        elif any(t in low for t in ("keeping", "how are", "how's", "how’s")): r["expects"]="wellbeing"
        elif any(t in low for t in ("news",)): r["expects"]="news"
        elif any(t in low for t in ("not from", "new to", "somewhere else", "what's it like out")): r["expects"]="origin"
        elif any(t in low for t in ("wet", "weather", "lovely", "grey old", "you're out", "out in")): r["expects"]="weather"
        elif any(t in low for t in ("your work", "what of you")): r["expects"]="work"
        elif r["family"]=="greeting" or "why do you ask" in low or "something else" in low or "need something made" in low: r["expects"]="purpose"
        else: r["expects"]="acknowledgement"
    elif r["family"]=="favour_ask" and r["situation"]=="child": r["expects"]="referral"
    elif r["family"]=="favour_ask" and r["situation"]=="not_yet": r["expects"]="name"

# ---------- weights ----------
groups = {}
for r in rows:
    groups.setdefault((r["speaker"], r["family"], r["situation"]), []).append(r)
def conds(r):
    out = set()
    for p in r["when"]["all"]:
        if p["test"] == "free_cells_at_least":
            continue
        out.add("all:" + json.dumps(p, sort_keys=True))
    for p in r["when"]["none"]:
        out.add("none:" + json.dumps(p, sort_keys=True))
    for t in r["tags"]["require"]:
        out.add("req:" + t)
    for t in r["tags"]["forbid"]:
        out.add("forbid:" + t)
    return out
for key, members in groups.items():
    common = set.intersection(*[conds(m) for m in members])
    for m in members:
        m["weight"] = 1 + 2 * len(conds(m) - common)

# ---------- write ----------
ordered = []
for r in rows:
    o = OrderedDict()
    for k, v in r.items():
        o[k] = v
        if k == "situation":
            o["weight"] = r["weight"]
    ordered.append(o)
rows[:] = ordered
for r in rows:
    # tidy refusal people placeholder
    if r["disclosure"]["people"] == ["__none__"]:
        r["disclosure"]["people"] = []
with open(OUT, "w") as f:
    json.dump(rows, f, indent=1, ensure_ascii=False)
    f.write("\n")
print(len(rows), "rows")
