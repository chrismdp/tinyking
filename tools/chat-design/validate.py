import json, re, sys, collections
from pathlib import Path
catalogue=json.loads((Path(__file__).resolve().parents[2] / "src/data/event_types.json").read_text())
moods={"guarded","grumbling","cheerful","joking"}
rows = json.load(open(sys.argv[1]))
COMMON = {"player", "npc", "contact", "context"}
problems = []
ids = collections.Counter(r["id"] for r in rows)
for k, v in ids.items():
    if v > 1: problems.append(("dup id", k))
for r in rows:
    level=r.get("level",{})
    if level.get("ring") not in ("public","social","personal","intimate") or level.get("below") not in ("hide","risk"):
        problems.append(("invalid level",r["id"],level))
    if level.get("standing","stranger") not in ("stranger","oath-sworn"):
        problems.append(("invalid standing",r["id"],level))
    if level.get("below")=="risk" and not any(x["family"]==level.get("rebuff","level_rebuff") and x["speaker"]=="npc" for x in rows):
        problems.append(("missing rebuff",r["id"]))
    if r.get("defiant") and r["speaker"]!="player": problems.append(("non-player defiance",r["id"]))
    bound = COMMON | set(r["bindings"])
    # nested refs like activity.partner, event.x are fields of a bound root
    for ph in re.findall(r"\{([^}]+)\}", r["text"]):
        root = ph.split("|")[0].split(".")[0]
        if root not in bound: problems.append(("unbound placeholder", r["id"], ph))
    for ic in r["icons"]:
        if ic["kind"] not in ("topic","person","mood","event"): problems.append(("invalid icon kind",r["id"],ic))
        if ic["kind"]=="mood" and ic.get("key") not in moods: problems.append(("invalid mood",r["id"],ic))
        if ic["kind"] in ("person","event"):
            root = ic["ref"].split(".")[0]
            if root not in bound: problems.append(("unbound icon", r["id"], ic["ref"]))
    keys = [ic.get("key") or ic.get("ref") for ic in r["icons"]]
    if len(keys) != len(set(keys)): problems.append(("duplicate icon", r["id"], keys))
    for p in r["disclosure"]["people"] + r["disclosure"]["events"] + r["disclosure"]["requests"]:
        if p.split(".")[0] not in bound: problems.append(("unbound disclosure", r["id"], p))
    for ph in re.findall(r"\{([^}]+)\}", r["use_key"]):
        if ph.split(".")[0] not in bound: problems.append(("unbound use_key", r["id"], ph))
    words = len(re.sub(r"\*[^*]*\*", "", r["text"]).split())
    if r["speaker"] == "player" and words > 10: problems.append(("long player line", r["id"], words, r["text"]))
    if r["family"] == "overheard_hint" and words > 8: problems.append(("long hint", r["id"], words, r["text"]))
    if r["family"] != "leave_taking" and r["family"] != "overheard_hint" and not r["icons"]:
        problems.append(("no icons", r["id"]))
    low = r["text"].lower()
    # whole words only, so "thought" is not read as "thou"
    for bad in ["thee", "thou", "thy", "ye", "forsooth", "'tis", "okay", "ok", "yeah", "awesome", "guys",
                "color", "favor", "neighbor", "gray", "plow", "center"]:
        if re.search(r"(?<![\w'])" + re.escape(bad) + r"(?![\w'])", low): problems.append(("voice/spelling", r["id"], bad, r["text"]))
    # every NPC opening lays down two or three icons; three need five free cells
    if any(p["test"] == "phase_is" and p["args"].get("phase") == "opening" for p in r["when"]["all"]):
        n = len(r["icons"])
        if not 2 <= n <= 3: problems.append(("opening icon count", r["id"], n))
        if n == 3 and not any(p["test"] == "free_cells_at_least" and p["args"].get("count", 0) >= 5 for p in r["when"]["all"]):
            problems.append(("three-icon opening without room", r["id"]))
for etype, definition in catalogue.items():
    if not definition.get("sentence") or not definition.get("topic") or not isinstance(definition.get("roles"),list) or definition.get("disclosure",{}).get("ring") not in ("public","social","personal","intimate"):
        problems.append(("invalid event definition",etype))
    for family in ("event_news","gossip_tell"):
        generated=[r for r in rows if r["family"]==family and r["situation"]=="catalogue_"+etype]
        if len(generated)!=1: problems.append(("missing catalogue account",etype,family))
        elif generated[0]["icons"] != [{"kind":"event","ref":"event"}]: problems.append(("catalogue icons",etype,family))
answers={a for r in rows if r["speaker"]=="player" for a in r.get("answers",[])}
for r in rows:
    if r.get("expects") and r["expects"] not in answers: problems.append(("unanswerable expectation",r["id"],r["expects"]))
    if r["speaker"]=="npc" and r["family"]!="leave_taking" and "?" in r["text"] and not r.get("expects"):
        problems.append(("question without expectation",r["id"]))
for p in problems: print(p)
print(len(problems), "problems;", len(rows), "rows")

sys.exit(1 if problems else 0)
