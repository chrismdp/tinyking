import { topController } from "game/playable";

export const firstFreeJob = (jobs, key) => jobs.find(j => !j.assignedId && j.job.key == key);

export const jobQueueFor = (ecs, id) => ecs.manager[topController(ecs, id)].jobs;

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
  const manager = state.ecs.manager[state.ui.playerId];
  const entry = { ...metadata, id: "task-" + (manager.nextTask = (manager.nextTask || 0) + 1),
    job, targetId, progress: 0 };
  manager.jobs.push(entry);
  if (manager.jobs.length == 1) {
    const planner = state.ecs.planner[state.ui.playerId];
    if (!["eat", "sleep", "forage"].includes(planner.task?.[0]) && !planner.world.feeling.hungry && !planner.world.feeling.tired) interruptOrder(state);
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
    state.ecs.farmable[world.claimedFarmable].claimerId = null;
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
  if (from == 0 || index == 0) interruptOrder(state);
}

export function cancelTask(state, taskId) {
  const jobs = state.ecs.manager[state.ui.playerId].jobs;
  const index = jobs.findIndex(j => j.id == taskId);
  if (index < 0) return;
  if (index == 0) interruptOrder(state);
  jobs.splice(index, 1);
}
