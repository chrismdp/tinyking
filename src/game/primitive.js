import { nothing } from "immer";

export function chop_tree() {}

export function walk_to(world, expected, targetId) {
  if (!targetId && !world.targetId) {
    console.log("WT", targetId, world.targetId);
    return nothing;
  }
  world.loc.me = { ...world.loc[targetId] };
}

export function complete_job(world, expected, jobKey) {
  const idx = world.jobs.findIndex(j => j.job.key == jobKey);
  world.jobs.splice(idx, 1);
}

export function find_place(world, expected, type) {
  // NOTE: Prevent AI from looking again this hour
  if (world.no_place_for == world.hour) {
    return nothing;
  }
  if (expected) {
    world.places[type] = type;
  }
}

export function pick_up(world, expected, thing) {
  world.holding[thing] = true;
}

export function idle() {}

export function sleep(world) {
  world.feeling.tired = false;
}

export function eat(world, expected, thing) {
  if (!world.holding[thing]) {
    return nothing;
  }
  world.holding[thing] = false;
  world.feeling.hungry = false;
}
