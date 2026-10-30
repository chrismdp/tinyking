import { topController } from "game/playable";
import { STAGES } from "game/construction";
import { triangleCenters } from "game/map";

export function friendEligible(s, id) {
  const ecs = s.ecs, player = s.ui?.playerId, person = ecs.personable?.[id];
  return id != player && person && !person.dead && person.age >= 18 && person.hunger <= .9 && person.tiredness <= .9 &&
    ["personal", "intimate"].includes(ecs.relationships?.[id]?.known[player]?.ring);
}
// One extra pair of hands per site. The player keeps their queue; the helper
// keeps their own household, controller and planner. Household needs/work win.
export function friendWork(s, id) {
  if (!friendEligible(s, id)) return null;
  const ecs = s.ecs, player = s.ui.playerId, world = ecs.planner[id]?.world;
  if (!world || world.capturedBy || world.moveHome || world.social || ecs.manager[topController(ecs, id)]?.jobs.length) return null;
  const job = ecs.manager[player]?.jobs.find(j => !j.waiting);
  const site = job?.job.key == "build_shelter" && ecs.construction?.[job.targetId];
  let work;
  if (site && site.delivered >= STAGES[site.stage].logs) {
    const point = ecs.spatial[job.targetId];
    // The friend works beside the frame, leaving the player's centre position
    // clear. One helper needs only one corner within this walkable site tile.
    work = { kind: "build", targetId: job.targetId, x: point.x - 28, y: point.y + 28 };
  }
  if (!work) {
    const field = ecs.planner[player]?.world.claimedFarmable;
    const farm = ecs.farmable?.[field];
    if (farm && ecs.controllable[field] && topController(ecs, field) == player) {
      // Help with clearing/ploughing and harvest. Sowing remains with the
      // player, whose seed and food choice should stay explicit.
      const idx = farm.slots.findIndex(slot => !slot.workerId && ["empty", "harvested", "harvestable"].includes(slot.state));
      if (idx >= 0) work = { kind: "field", targetId: field, idx, result: farm.slots[idx].state == "harvestable" ? "harvested" : "ploughed", ...triangleCenters(ecs.spatial[field])[idx] };
    }
  }
  if (!work) return null;
  const helper = Object.keys(ecs.planner).find(other => other != id && ecs.planner[other].world.helpingFriend?.targetId == work.targetId);
  return helper ? null : work;
}
export function releaseFriendWork(s, id) {
  const world = s.ecs.planner[id]?.world;
  if (!world) return;
  const work = world.helpingFriend;
  if (work?.kind == "field") {
    const slot = s.ecs.farmable?.[work.targetId]?.slots[work.idx];
    if (slot?.workerId == id) delete slot.workerId;
  }
  delete world.helpingFriend;
  delete world.friendOffer;
}

export function friendWorkWanted(s, offer) {
  const ecs = s.ecs, player = s.ui.playerId;
  if (!offer || !ecs.controllable[offer.targetId] || topController(ecs, offer.targetId) != player) return false;
  if (offer.kind == "field") return ecs.planner[player]?.world.claimedFarmable == offer.targetId && !!ecs.farmable?.[offer.targetId];
  return !!ecs.construction?.[offer.targetId] && ecs.manager[player].jobs.some(j => j.job.key == "build_shelter" && j.targetId == offer.targetId);
}
