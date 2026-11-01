import json, re, sys, collections
rows = json.load(open(sys.argv[1]))
COMMON = {"player", "npc", "contact", "context"}
problems = []
ids = collections.Counter(r["id"] for r in rows)
for k, v in ids.items():
    if v > 1: problems.append(("dup id", k))
for r in rows:
    bound = COMMON | set(r["bindings"])
    # nested refs like activity.partner, event.x are fields of a bound root
    for ph in re.findall(r"\{([^}]+)\}", r["text"]):
        root = ph.split("|")[0].split(".")[0]
        if root not in bound: problems.append(("unbound placeholder", r["id"], ph))
    for ic in r["icons"]:
        if ic["kind"] == "person":
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
for p in problems: print(p)
print(len(problems), "problems;", len(rows), "rows")
