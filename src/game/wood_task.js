import { Hex, HEX_SIZE } from "game/hex";
import { path } from "game/pathfinding";
import { hungerSpeed } from "game/hunger";

// Estimate only the current journey, using walk_to's route, side midpoints,
// terrain speed and actual load. Further collection trips are labelled separately.
function routeMinutes(state, playerId, targetId) {
  const { ecs } = state;
  const planner = ecs.planner[playerId];
  let from = ecs.spatial[playerId];
  const destination = ecs.spatial[targetId];
  if (!from || !destination) return null;
  const tileAt = point => (state.space?.[Hex().fromPoint(point)] || []).find(id => ecs.walkable?.[id]);
  let route = planner.world.carryTarget == targetId && planner.world.route;
  if (!route?.length) {
    const start = tileAt(from), end = tileAt(destination);
    if (!start || !end) return null;
    route = path(state, start, end);
  }
  if (!route) return null;
  const load = (ecs.holder?.[playerId]?.held || []).reduce((speed, id) => speed * (ecs.haulable?.[id]?.speedModifier || 1), 1);
  let minutes = 0;
  for (const step of route) {
    let to = destination;
    if (step.exit != null) {
      const corners = Hex().corners().map(c => c.add(ecs.spatial[step.id]));
      const a = corners[step.exit], b = corners[(step.exit + 1) % 6];
      to = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    minutes += Math.hypot(to.x - from.x, to.y - from.y) /
      (20 * HEX_SIZE * (ecs.walkable[step.id].speed || 1) * load * hungerSpeed(ecs.personable[playerId])) * 60;
    from = to;
  }
  return Math.max(1, Math.ceil(minutes));
}

// Both the queue and the character label read these same planner facts.
export function woodPhase(ecs, id, job, active = true) {
  if (job.job.key != "cut_tree_down" || job.waiting) return null;
  if (job.gatheredDone) {
    const remaining = job.gathered || [];
    const held = (ecs.holder?.[id]?.held || []).some(log => remaining.includes(log));
    return !active ? "Wood delivery paused" : held ? "Carrying wood home" : remaining.length ? "Collecting wood" : "Wood delivered";
  }
  if (!active) return "Chopping and delivery";
  const task = ecs.planner[id].task?.[0];
  return task == "chop_tree" ? "Chopping" : task == "walk_to" ? "Walking to tree" : null;
}

export function woodTask(state, job, active) {
  if (job.job.key != "cut_tree_down" || job.waiting) return null;
  const { ecs } = state, id = state.ui.playerId;
  const phase = woodPhase(ecs, id, job, active);
  if (job.gatheredDone) {
    const remaining = job.gathered || [];
    const total = job.gatheredTotal;
    const delivered = total == null ? null : total - remaining.length;
    const held = (ecs.holder?.[id]?.held || []).find(log => remaining.includes(log));
    const home = Object.keys(ecs.shelter || {}).find(id => ecs.shelter[id].stage) || Object.keys(ecs.camp || {})[0];
    const target = held ? home : remaining.find(log => ecs.haulable?.[log] && !ecs.haulable[log].heldBy);
    const minutes = active && target ? routeMinutes(state, id, target) : null;
    const next = remaining.length > 1 ? " · more wood to collect" : "";
    return { phase, detail: delivered == null ? `${remaining.length} ${remaining.length == 1 ? "log" : "logs"} still to deliver` : `${delivered} of ${total} ${total == 1 ? "log" : "logs"} delivered`,
      progress: total ? Math.round(delivered / total * 100) : null,
      time: minutes == null ? "" : `~${minutes}m ${held ? "to home" : "to wood"}${held ? next : " · delivery follows"}` };
  }
  if (phase == "Chopping") {
    const minutes = job.workRemaining == null ? null : Math.max(1, Math.ceil(job.workRemaining * 1440 / hungerSpeed(ecs.personable[id])));
    return { phase, detail: `Chopping${job.detail ? " · " + job.detail : ""} · delivery follows`, progress: Math.round((job.progress || 0) * 100),
      time: minutes == null ? "" : `~${minutes}m chopping left`, progressLabel: " chopped" };
  }
  if (phase == "Walking to tree") {
    return { phase, detail: "Walking to tree · chopping and delivery follow", progress: null, time: "" };
  }
  if (!active) return { phase, detail: "Chopping and delivery", progress: null, time: "" };
  return null;
}
