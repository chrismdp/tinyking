import { nothing } from "immer";

export function chop_tree() {}
export function wait_for() {}
export function set_controller_to_me() {}
export function create_stockpile() {}

export function get_attention(world, expected, targetId) {
  world.capturedAttentionOf = targetId;
}

export function release_attention(world) {
  world.capturedAttentionOf = null;
}

export function take_job(world, expected, key) {
  world.currentJob = key;
}

export function complete_job(world) {
  world.currentJob = null;
}

export function release_job(world) {
  world.currentJob = null;
}

export function walk_to(world, expected, targetId) {
  if (!targetId) {
    return nothing;
  }
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

export function pick_up_from_stockpile(world, expected, thing) {
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
