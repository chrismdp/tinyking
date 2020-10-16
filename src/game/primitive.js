import { nothing } from "immer";

export function chop_tree() {}
export function wait_for() {}
export function get_attention() {}
export function set_controller_to_me() {}
export function create_stockpile() {}
export function release_attention() {}

export function walk_to(world, expected, targetId) {
  if (!targetId) {
    return nothing;
  }
}

export function complete_job(world, expected, jobKey) {
  const idx = world.jobs.findIndex(j => j.job.key == jobKey);
  world.jobs.splice(idx, 1);
}

export function set_label(world, expected, label) {
  world.label = label;
}

export function find_place(world, expected, type) {
  // NOTE: Prevent AI from looking again this hour
  if (world.no_place_for[type] != null && world.no_place_for[type] == (world.hour || 0)) {
    return nothing;
  }
  if (expected) {
    world.places[type] = type;
  }
}

export function pick_up_entity_with_good(world, expected, thing) {
  world.holding[thing] = true;
}

export function drop_entity_into_stockpile_slot(world, expected, thing) {
  world.holding[thing] = false;
}

export function get_from_container(world, expected, thing) {
  world.holding[thing] = true;
}

export function forget_place(world, expected, type) {
  delete world.places[type];
}

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
