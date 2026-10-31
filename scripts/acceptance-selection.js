/* eslint-disable no-undef */
// Read-only, explicitly assisted selection using the actual application rules.
// Never apply the returned preview/snapshot to the running game.
require("./game-register");
const { canPlaceShelter } = require("../src/game/construction");
const { Hex } = require("../src/game/hex");
const { disposition } = require("../src/game/people");

const snapshot = page => page.evaluate(() => {
  const s = window.tinyking;
  return { ecs: s.ecs, space: s.space, map: s.map, ui: { playerId: s.ui.playerId },
    favours: s.favours, knowledge: s.knowledge, peopleSeed: s.peopleSeed, opinionThresholds: s.opinionThresholds };
});
function shelterCandidates(s, nearId) {
  const camp = s.ecs.spatial[Object.keys(s.ecs.camp)[0]];
  const near = s.ecs.spatial[nearId] || camp;
  const known = new Set(s.ecs.playable[s.ui.playerId].known.map(k => k.x + "," + k.y));
  return Object.keys(s.ecs.mappable).filter(id => known.has(String(Hex().fromPoint(s.ecs.spatial[id]))))
    .filter(id => Hex().fromPoint(camp).distance(Hex().fromPoint(s.ecs.spatial[id])) <= 3)
    .filter(id => canPlaceShelter(s, id))
    .sort((a, b) => Math.hypot(s.ecs.spatial[a].x - near.x, s.ecs.spatial[a].y - near.y) - Math.hypot(s.ecs.spatial[b].x - near.x, s.ecs.spatial[b].y - near.y));
}
function fuelFriend(s) {
  const player = s.ui.playerId, p = s.ecs.spatial[player];
  const candidates = Object.values(s.favours.requests).filter(r => r.kind == "wood" && r.status == "offered")
    .filter(r => !s.ecs.personable[r.giverId].dead && s.ecs.personable[r.giverId].age >= 18 && disposition(s, r.giverId, player) == "love")
    .sort((a, b) => Math.hypot(s.ecs.spatial[a.giverId].x - p.x, s.ecs.spatial[a.giverId].y - p.y) - Math.hypot(s.ecs.spatial[b.giverId].x - p.x, s.ecs.spatial[b.giverId].y - p.y));
  if (!candidates.length) throw new Error("Seed 13 has no attainable local fuel-friend scenario at this time");
  const r = candidates[0];
  return { person: r.giverId, favourId: r.id, home: s.ecs.household[r.giverId].houseId,
    rule: "Assisted read-only selection: nearest living adult fuel requester whose generated disposition towards the player is love (16 initial goodwill); two consenting Chats plus the real +12 fuel favour can reach Personal, allowing ordinary drift. The material-ready third Chat refreshes contact. No seed search or personality edits.",
    candidates: candidates.map(r => ({ person: r.giverId, favourId: r.id })) };
}
module.exports = { snapshot, shelterCandidates, fuelFriend };

// Seed 13 has unclaimed woodland beyond the camp's eastern fog. Walk to a
// currently known edge tile, never reveal terrain or order an undiscovered tree.
// The mechanical driver supplies real map clicks; the storyboard uses ui.actions.
async function discoverTimber(page, required, move) {
  const steps = [];
  for (let step = 0; step < 3; step++) {
    const view = await page.evaluate(() => {
      const s = window.tinyking, e = s.ecs, g = window.tinykingGeography;
      const known = new Set(e.playable[s.ui.playerId].known.map(h => h.x + "," + h.y));
      const camp = e.spatial[Object.keys(e.camp)[0]];
      const trees = Object.keys(e.tree).filter(id => e.good[id]?.amount > 0 &&
        known.has(String(g.Hex().fromPoint(e.spatial[id]))) && window.tinykingCustoms.resourcePermission(s, s.ui.playerId, id).permitted);
      const edge = Object.keys(e.walkable).filter(id => e.walkable[id].speed > 0 &&
        known.has(String(g.Hex().fromPoint(e.spatial[id]))) && Math.abs(e.spatial[id].y - camp.y) < 300 &&
        e.spatial[id].x > camp.x && e.spatial[id].x < camp.x + 850)
        .sort((a,b) => e.spatial[b].x - e.spatial[a].x || Math.abs(e.spatial[a].y - camp.y) - Math.abs(e.spatial[b].y - camp.y))[0];
      return { day: s.days, trees, logs: trees.reduce((n,id) => n + e.good[id].amount, 0), edge, known: known.size,
        position: { ...e.spatial[s.ui.playerId] } };
    });
    steps.push(view);
    if (view.logs >= required) return steps;
    if (!view.edge || step == 2) throw new Error("Exploration did not discover " + required + " real permitted logs: " + JSON.stringify(steps));
    if (move) await move(view.edge);
    else await page.evaluate(id => {
      const s = window.tinyking;
      s.ui.actions.choose_job(s.ui.playerId, { key: "move_to_here" }, id);
    }, view.edge);
    await page.evaluate(() => window.tinyking.ui.actions.set_speed("fast"));
    await page.waitForFunction(() => !window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.some(j => j.job.key == "move_to_here"), null, { timeout: 180000 });
    await page.evaluate(() => window.tinyking.ui.actions.set_speed("paused"));
    console.log("EXPLORE actual Move here to known eastern edge " + view.edge + "; before " + view.logs + " permitted logs");
  }
}
module.exports.discoverTimber = discoverTimber;
