import { topController } from "game/playable";

export const firstFreeJob = (jobs, key) => jobs.find(j => !j.assignedId && j.job.key == key);

export const jobQueueFor = (ecs, id) => ecs.manager[topController(ecs, id)].jobs;
