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
