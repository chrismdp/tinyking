/* eslint-disable no-undef */
const { run, initial, nm, eventKey, write, OUT } = require("./week-levers.cjs");
const fs = require("node:fs"), path = require("node:path");
const { enqueueTask, canReachTask } = require("../../src/game/manager");
const { forageAvailable } = require("../../src/game/ecology");
const { Hex } = require("../../src/game/hex");
const { path: routeTo } = require("../../src/game/pathfinding");
const { giftOptions } = require("../../src/game/people");
const { chatChoices, chooseLine, previewLine } = require("../../src/game/chat");
const { FOODS } = require("../../src/game/goods");

function policy(spec) {
  let started = false, giftOrdered = false, chatDone = false;
  return (s, log) => {
    const player = s.ui.playerId;
    const id = Object.keys(s.residents).find(id => !s.ecs.personable[id].dead && nm(s, id) == spec.person);
    if (!id) throw new Error("Unknown target " + spec.person);
    if (s.days >= spec.day && s.chat?.active && s.chat.active.npcId == id) {
      started = true;
      for (let turn = 0; turn < 16 && !s.chat.active.endReason; turn++) {
        s.chat.active.focus = spec.kind == "favour" ? "help" : spec.kind == "news" ? "tell" : "season";
        let choices = chatChoices(s).filter(line => previewLine(s, line).fits);
        const answer = choices.find(line => line.answers?.includes(s.chat.active.expectation));
        const practical = choices.find(line => ["favour_accept", "need_question"].includes(line.family));
        choices = choices.sort((a, b) => previewLine(s, b).matches - previewLine(s, a).matches);
        const line = answer || practical || choices[0];
        if (!line) { log.push({ day: s.days, kind: "no-available-line", focus: s.chat.active.focus }); break; }
        const ok = chooseLine(s, line.key);
        log.push({ day: s.days, kind: "line", target: id, id: line.id, text: line.text, ok });
        if (!ok) break;
      }
      chatDone = true;
    }
    if (!started && spec.kind != "respond" && s.days >= spec.day) {
      started = true;
      const key = spec.kind == "food" ? "forage" : "chat";
      const target = key == "chat" ? id : forageTarget(s);
      const order = target && enqueueTask(s, { key }, target);
      log.push({ day: s.days, kind: "order", key, target: id, order: structuredClone(order) });
    }
    if (started && spec.kind == "food" && !giftOrdered) {
      const food = giftOptions(s, player).find(g => FOODS.includes(g.type) && s.ecs.haulable[g.sourceId]?.heldBy == player);
      if (food) {
        giftOrdered = true;
        const order = enqueueTask(s, { key: "give_gift" }, id, { gift: food });
        log.push({ day: s.days, kind: "order", key: "give_gift", food, target: id, order: structuredClone(order) });
      }
    }
    if (chatDone && spec.kind == "favour" && !giftOrdered) {
      const accepted = Object.values(s.favours?.requests || {}).find(r => r.status == "accepted" && r.actorId == player);
      if (accepted) {
        giftOrdered = true;
        const target = accepted.kind == "food" ? forageTarget(s) : null;
        const order = target && enqueueTask(s, { key: "forage" }, target);
        log.push({ day: s.days, kind: "gather-favour", requestId: accepted.id, order: structuredClone(order) });
      }
    }
  };
}
function forageTarget(s) {
  const player = s.ui.playerId, pos = s.ecs.spatial[player], known = s.ecs.playable[player].known;
  return Object.keys(s.ecs.forageable).filter(id => {
    const tile = Hex().fromPoint(s.ecs.spatial[id]);
    return forageAvailable(s, s.ecs.forageable[id]) && known.some(h => h.x == tile.x && h.y == tile.y) && canReachTask(s, player, id);
  }).sort((a, b) => Math.hypot(pos.x - s.ecs.spatial[a].x, pos.y - s.ecs.spatial[a].y) - Math.hypot(pos.x - s.ecs.spatial[b].x, pos.y - s.ecs.spatial[b].y))[0];
}
// A repeat player can remember the house. Walk there through ordinary terrain
// orders, then require an actually discovered, outdoor body before selecting it.
function visiblePolicy(spec) {
  const interact = policy(spec);
  let destination, lastTarget, found = false;
  return (s, log) => {
    if (s.days < spec.day) return;
    const id = Object.keys(s.residents).find(id => !s.ecs.personable[id].dead && nm(s, id) == spec.person);
    if (!id) throw new Error("Unknown target " + spec.person);
    const at = Hex().fromPoint(s.ecs.spatial[id]);
    const visible = !s.ecs.interior?.[id] && s.ecs.playable[s.ui.playerId].known.some(h => h.x == at.x && h.y == at.y);
    if (visible || s.chat?.active?.npcId == id) {
      found = true;
      const prior = log.length;
      interact(s, log);
      for (const row of log.slice(prior)) if (row.kind == "order") row.selection = { discovered: true, outdoors: !s.ecs.interior?.[id], tile: { x: at.x, y: at.y } };
      return;
    }
    if (found || s.days < spec.day) return;
    if (lastTarget && s.ecs.manager[s.ui.playerId].jobs.some(j => j.job.key == "move_to_here" && j.targetId == lastTarget)) return;
    const home = s.ecs.spatial[s.ecs.household[id].houseId];
    destination ||= Object.keys(s.ecs.walkable).sort((a, b) =>
      Math.hypot(home.x - s.ecs.spatial[a].x, home.y - s.ecs.spatial[a].y) -
      Math.hypot(home.x - s.ecs.spatial[b].x, home.y - s.ecs.spatial[b].y))
      .find(tile => !s.ecs.mappable[tile]?.buildingPlot && canReachTask(s, s.ui.playerId, tile));
    if (!destination) throw new Error("No approach to the remembered home");
    if (lastTarget == destination) return;
    const from = (s.space[Hex().fromPoint(s.ecs.spatial[s.ui.playerId])] || []).find(tile => s.ecs.walkable[tile]);
    const route = from && routeTo(s, from, destination);
    if (!route) throw new Error("No route to the remembered home");
    const known = new Set(s.ecs.playable[s.ui.playerId].known.map(h => h.x + "," + h.y));
    let target;
    for (const step of route) {
      if (!known.has(Hex().fromPoint(s.ecs.spatial[step.id]).toString())) break;
      target = step.id;
    }
    if (!target || target == lastTarget) return;
    lastTarget = target;
    const order = enqueueTask(s, { key: "move_to_here" }, target);
    const tile = Hex().fromPoint(s.ecs.spatial[target]);
    log.push({ day: s.days, kind: "walk-to-remembered-house", target, personId: id, rememberedDestination: destination,
      selection: { discovered: true, tile: { x: tile.x, y: tile.y } }, order: structuredClone(order) });
  };
}
const specs = [
  { id: "food-juliana", kind: "food", person: "Juliana Thuho", day: .375 },
  { id: "food-margaret", kind: "food", person: "Margaret Seesi", day: .375 },
  { id: "chat-sybil", kind: "chat", person: "Sybil Bobarin", day: .375 },
  { id: "chat-edgar", kind: "chat", person: "Edgar Thuson", day: 1.375 },
  { id: "favour-mabel", kind: "favour", person: "Mabel Frifoblo", day: .375 },
  { id: "news-hugh", kind: "news", person: "Hugh Jobari", day: 3.375 }
];
const visibleSpecs = [
  { id: "visible-food-juliana", kind: "food", person: "Juliana Thuho", day: .375, visible: true },
  { id: "visible-food-margaret", kind: "food", person: "Margaret Seesi", day: .375, visible: true },
  { id: "visible-chat-mabel", kind: "chat", person: "Mabel Frifoblo", day: .375, visible: true },
  { id: "visible-favour-mabel", kind: "favour", person: "Mabel Frifoblo", day: .375, visible: true },
  { id: "visible-news-hugh", kind: "news", person: "Hugh Jobari", day: 3.375, visible: true }
];
const nativeSpecs = [{ id: "respond-hughseesi", kind: "respond", person: "Hugh Seesi", day: .375, nativeChat: true }];
function compare(before, after, spec) {
  const target = before.initialPeople.find(p => p.name == spec.person)?.id;
  const selected = result => result.events.filter(e => e.people.includes(target) && ["visit", "quarrel", "reconciliation", "marriage", "move"].includes(e.type));
  const b = selected(before), a = selected(after);
  const differences = b.map(e => ({ before: e, after: a.find(f => eventKey(e) == eventKey(f)) || null }));
  return { spec, baselineHash: before.hash, treatmentHash: after.hash, target, actions: after.actions,
    hungerBefore: before.hunger.filter(p => p.id == target), hungerAfter: after.hunger.filter(p => p.id == target),
    before: b, after: a, differences,
    newEvents: after.events.filter(e => !before.events.some(f => eventKey(e) == eventKey(f))),
    quarrelsBefore: before.events.filter(e => e.type == "quarrel"), quarrelsAfter: after.events.filter(e => e.type == "quarrel"),
    reconciliationsBefore: before.events.filter(e => e.type == "reconciliation"), reconciliationsAfter: after.events.filter(e => e.type == "reconciliation") };
}
async function main() {
  let initialState = await initial(13);
  write("people-13.json", Object.keys(initialState.residents).map(id => ({ id, name: nm(initialState, id),
    person: initialState.ecs.personable[id], kin: initialState.ecs.kinship[id], home: initialState.ecs.household[id],
    relationships: initialState.ecs.relationships[id], personality: initialState.ecs.personality[id] })));
  initialState = null;
  const args = process.argv.slice(2);
  const selected = args.filter(arg => !arg.startsWith("--"));
  const frame = Number(args.find(arg => arg.startsWith("--frame="))?.split("=")[1] || 60);
  const prefix = args.find(arg => arg.startsWith("--prefix="))?.split("=")[1] || "";
  const receiptName = args.find(arg => arg.startsWith("--receipt="))?.split("=")[1] || "experiments.json";
  const receipt = path.join(OUT, receiptName);
  const results = selected.length && fs.existsSync(receipt) ? JSON.parse(fs.readFileSync(receipt, "utf8")) : [];
  for (const chosen of [...specs, ...visibleSpecs, ...nativeSpecs].filter(spec => selected.length ? selected.includes(spec.id) : !spec.visible && !spec.nativeChat)) {
    const spec = { ...chosen, id: prefix + chosen.id, live: frame <= 6 };
    const before = await run(13, spec.id + "-control", undefined, frame);
    const after = await run(13, spec.id, spec.visible ? visiblePolicy(spec) : policy(spec), frame);
    const result = compare(before, after, spec);
    const index = results.findIndex(row => row.spec.id == spec.id);
    if (index >= 0) results[index] = result; else results.push(result);
    write(receiptName, results);
    console.log("PAIR " + JSON.stringify({ id: spec.id, identical: before.hash == after.hash,
      actions: after.actions.length, newEvents: result.newEvents.map(e => [e.type, e.names, e.day]) }));
  }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { specs, visibleSpecs, nativeSpecs, policy, visiblePolicy, compare };
