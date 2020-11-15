import { nothing } from "immer";

export function chop_tree() {}
export function wait_for() {}
export function set_controller_to_me() {}

export function claim_farmable(world, expected, farmableId) {
  world.claimedFarmable = farmableId;
}

export function release_farmable(world) {
  world.claimedFarmable = null;
  world.subtasks = null;
}

export function create_stockpile(world) {
  world.no_place_for.slot = null;
}

export function create_field(world) {
  world.no_place_for.ploughable_field = null;
}

export function clear_subtasks(world) {
  world.subtasks = null;
}

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

export function drop_entity_into_stockpile_slot(world, expected, place, thing) {
  world.holding[thing] = false;
}

export function drop_entity_into_container(world, expected, place, thing) {
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

export function create_subtasks(world, expected, targetId, result) {
  if (expected) {
    world.subtasks = Array.from({length: 19}, i => ({ x: i, y: i, result, id: targetId }));
  }
}

export function perform_subtask_in_slot(world, expeced, targetId, place, lose) {
  world.holding[lose] = false;
}

export function find_next_subtask(world, expected, place) {
  if (!world.subtasks || world.subtasks.length == 0) {
    return nothing;
  }
  world.places[place] = world.subtasks[0];
}

export function complete_subtask(world, expected, place) {
  const slot = world.places[place];
  const idx = world.subtasks.findIndex(st => st.x == slot.x && st.y == slot.y);
  if (idx != -1) {
    world.subtasks.splice(idx, 1);
  }
}
