import { cancelFavour, requestForTask, favourWaiting } from "game/favours";
import { Hex } from "game/hex";
import { path } from "game/pathfinding";
import { STAGES, shelterLogSource, deliveryHome } from "game/construction";
import { forageAvailable } from "game/ecology";
import { topController } from "game/playable";
import { giftOptions } from "game/people";

export const CHILD_ORDERS = ["move_to_here", "chat", "ask_about", "give_gift", "play", "tend_garden", "find_food", "rest", "travel"];
export function playerOrderAllowed(state, key) {
  const p = state.ecs.personable[state.ui.playerId];
  return p && !p.dead && ((p.age ?? 18) >= 18 || CHILD_ORDERS.includes(key));
}

export const firstFreeJob = (jobs, key) => jobs.find(j => !j.assignedId && !j.waiting && j.job.key == key);

export const jobQueueFor = (ecs, id) => ecs.manager[ecs.guest?.[id] ? id : topController(ecs, id)].jobs;

export const pushJob = (ecs, actorId, entry) => {
  const jobs = jobQueueFor(ecs, actorId);
  if (!jobs.some(j => j.job.key == entry.job.key && j.targetId == entry.targetId)) {
    jobs.push(entry);
  }
};

export const removeJob = (ecs, managerId, key, targetId) => {
  const jobs = ecs.manager[managerId].jobs;
  const idx = jobs.findIndex(j => j.job.key == key && j.targetId == targetId);
  if (idx != -1) {
    const assignedId = jobs[idx].assignedId;
    jobs.splice(idx, 1);
    return assignedId;
  }
  return null;
};

// Player orders use stable ids, including duplicate orders and future favours.
export function enqueueTask(state, job, targetId, metadata = {}) {
  if (!playerOrderAllowed(state, job.key)) return null;
  const manager = state.ecs.manager[state.ui.playerId];
  const entry = { ...metadata, id: "task-" + (manager.nextTask = (manager.nextTask || 0) + 1),
    job, targetId, progress: 0, ...(job.key == "build_shelter" ? { buildStage: state.ecs.construction?.[targetId]?.stage } : {}) };
  manager.jobs.push(entry);
  if (manager.jobs.length == 1) {
    const planner = state.ecs.planner[state.ui.playerId];
    if (planner.world.stationaryPlayer && planner.task?.[0] == "wait_for" || !["eat", "sleep", "forage"].includes(planner.task?.[0]) && !planner.world.feeling.hungry && !planner.world.feeling.tired) interruptOrder(state);
  }
  return entry;
}

function interruptOrder(state) {
  const id = state.ui.playerId;
  const planner = state.ecs.planner[id];
  const world = planner.world;
  if (!world.currentJob && ["eat", "sleep", "forage"].includes(planner.task?.[0])) return;
  for (const job of state.ecs.manager[id].jobs) if (job.assignedId == id) job.assignedId = null;
  if (world.capturedAttentionOf && state.ecs.planner[world.capturedAttentionOf]) {
    state.ecs.planner[world.capturedAttentionOf].world.capturedBy = null;
  }
  if (world.claimedFarmable && state.ecs.farmable?.[world.claimedFarmable]) {
    const farm = state.ecs.farmable[world.claimedFarmable];
    if (farm.claimerId == id) farm.claimerId = null;
    for (const slot of farm.slots) if (slot.workerId == id) delete slot.workerId;
  }
  world.currentJob = null;
  world.capturedAttentionOf = null;
  world.claimedFarmable = null;
  world.subtasks = null;
  planner.task = null;
  planner.plan = null;
}

export function reorderTask(state, taskId, index) {
  const jobs = state.ecs.manager[state.ui.playerId].jobs;
  const from = jobs.findIndex(j => j.id == taskId);
  if (from < 0 || index < 0 || index >= jobs.length || from == index) return;
  const [entry] = jobs.splice(from, 1);
  jobs.splice(index, 0, entry);
  if (from == 0 || index == 0 || entry.assignedId == state.ui.playerId) interruptOrder(state);
}

export function cancelTask(state, taskId) {
  const jobs = state.ecs.manager[state.ui.playerId].jobs;
  const index = jobs.findIndex(j => j.id == taskId);
  if (index < 0) return;
  if (jobs[index].assignedId == state.ui.playerId) interruptOrder(state);
  cancelFavour(state, requestForTask(state, jobs[index]));
  jobs.splice(index, 1);
}

export function cancelJob(state, managerId, key, targetId) {
  const manager = state.ecs.manager[managerId];
  const entry = manager.jobs.find(j => j.job.key == key && j.targetId == targetId);
  if (!entry) return;
  if (manager.ordered && managerId == state.ui.playerId) {
    cancelTask(state, entry.id);
  } else {
    const assignedId = removeJob(state.ecs, managerId, key, targetId);
    const planner = state.ecs.planner[assignedId];
    if (planner) {
      planner.world.currentJob = null;
      planner.plan = null;
    }
  }
}

export function canReachTask(state, actorId, targetId) {
  const tileAt = id => {
    const point = state.ecs.spatial[id];
    return point && (state.space[Hex().fromPoint(point)] || []).find(id => state.ecs.walkable[id]);
  };
  const start = tileAt(actorId), end = tileAt(targetId);
  return !!(start && end && path(state, start, end));
}

function waitingReason(state, actorId, job) {
  const ecs = state.ecs;
  const target = job.targetId;
  if (!playerOrderAllowed(state,job.job.key)) return "This character cannot do adult work";
  if (job.favourId) return favourWaiting(state, job) || (!canReachTask(state, actorId, target) ? "No path there" : null);
  if (job.gatheredDone) {
    const home = deliveryHome(state,actorId);
    if (!home) return "No home for delivery";
    const next = (job.gathered || []).find(id => ecs.haulable[id] && !ecs.haulable[id].heldBy);
    return !canReachTask(state, actorId, home) || (next && !canReachTask(state, actorId, next)) ? "No path there" : null;
  }
  if (!ecs.spatial[target]) return "Target gone";
  if (job.job.key == "cut_tree_down" && !ecs.good[target]) return "Target gone";
  if (["chat", "ask_about", "give_gift", "court", "marry", "play", "invite_home"].includes(job.job.key) && (!ecs.personable[target] || ecs.personable[target].dead || !ecs.planner[target])) return "Target gone";
  if (job.job.key == "give_gift") {
    const gift = job.giftItem ? ecs.good[job.giftItem] && ecs.haulable[job.giftItem]?.heldBy == actorId :
      giftOptions(state, actorId).some(g => g.sourceId == job.gift.sourceId && g.type == job.gift.type);
    if (!gift) return "Gift no longer available";
    if (!job.giftItem && ecs.haulable?.[job.gift.sourceId]?.heldBy != actorId && !canReachTask(state, actorId, job.gift.sourceId)) return "No path to gift";
  }
  if (job.job.key == "forage" && !ecs.forageable?.[target]) return "Target gone";
  if (job.job.key == "build_shelter" && !ecs.construction?.[target]) return "Site gone";
  if (!canReachTask(state, actorId, target)) return "No path there";
  if (job.job.key == "forage" && !forageAvailable(state, ecs.forageable[target])) return "Waiting for food to grow";
  const site = ecs.construction?.[target];
  if (job.job.key == "build_shelter" && site.delivered < STAGES[site.stage].logs) {
    const source = shelterLogSource(state, actorId);
    if (!source) return "Waiting for logs";
    if (!reachableShelterLog(state, actorId)) return "No path to logs";
  }
  return null;
}

function reachableShelterLog(state, actorId) {
  return shelterLogSource(state, actorId, id => state.ecs.haulable?.[id]?.heldBy == actorId || canReachTask(state, actorId, id));
}

// Called at a free planner boundary. Queue order is priority among ready jobs.
export function readyPlayerTasks(state) {
  const id = state.ui.playerId;
  const planner = state.ecs.planner[id];
  const jobs = state.ecs.manager[id].jobs;
  // A friend can finish while the player eats or sleeps. Retire the fulfilled
  // order at this free boundary, rather than showing a vanished site forever.
  for (let i = jobs.length - 1; i >= 0; i--) {
    const job = jobs[i];
    if (!job.assignedId && job.buildStage && !state.ecs.construction?.[job.targetId] && state.ecs.shelter?.[job.targetId]?.stage == job.buildStage) {
      job.progress = 1; job.detail = "Finished with a friend's help"; jobs.splice(i, 1);
    }
  }
  for (const job of jobs) {
    const wasWaiting = job.waiting;
    const reason = waitingReason(state, id, job) || (job.failed ? job.waiting : null);
    job.waiting = reason;
    if (reason) {
      const site = state.ecs.construction?.[job.targetId];
      job.detail = reason == "Waiting for logs" ? `${reason} · ${site.delivered} of ${STAGES[site.stage].logs}` : reason;
    } else if (wasWaiting) {
      job.detail = null;
    }
  }
  const ready = jobs.find(j => !j.waiting && !j.assignedId);
  const site = ready?.job.key == "build_shelter" && state.ecs.construction[ready.targetId];
  planner.world.shelter = site ? { needsLogs: site.delivered < STAGES[site.stage].logs, source: reachableShelterLog(state, id) } : null;
  return ready ? [ready] : [];
}

export function deferPlayerTask(state) {
  const id = state.ui.playerId;
  const job = state.ecs.manager[id].jobs.find(j => j.assignedId == id);
  if (!job) return;
  const reason = waitingReason(state, id, job) || "Can't do this yet";
  interruptOrder(state);
  job.waiting = job.detail = reason;
  job.failed = !job.favourId;
}

// Recheck at the edge for promises/orders added during the walk out. Keep the
// committed journey itself; borrowed cargo is released while still on-map.
export function cancelLocalTasksForTravel(state, keepTaskId) {
  for(const job of [...state.ecs.manager[state.ui.playerId].jobs])if(job.id!=keepTaskId)cancelTask(state,job.id);
  for(const request of Object.values(state.favours?.requests||{}))cancelFavour(state,request);
}
