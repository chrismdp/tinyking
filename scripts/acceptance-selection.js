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
function shelterCandidates(s) {
  const camp = s.ecs.spatial[Object.keys(s.ecs.camp)[0]];
  const known = new Set(s.ecs.playable[s.ui.playerId].known.map(k => k.x + "," + k.y));
  return Object.keys(s.ecs.mappable).filter(id => known.has(String(Hex().fromPoint(s.ecs.spatial[id]))))
    .filter(id => Hex().fromPoint(camp).distance(Hex().fromPoint(s.ecs.spatial[id])) <= 3)
    .filter(id => canPlaceShelter(s, id))
    .sort((a, b) => Math.hypot(s.ecs.spatial[a].x - camp.x, s.ecs.spatial[a].y - camp.y) - Math.hypot(s.ecs.spatial[b].x - camp.x, s.ecs.spatial[b].y - camp.y));
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
