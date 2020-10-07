export function person(world) {
  if (world.feeling.tired &&
    world.time_of_day == "evening" ||
    world.time_of_day == "night") {
    return [
      [ "move_to_place", "sleep", "allows_sleep" ],
      [ "sleep"]
    ];
  }

  if (world.feeling.hungry && world.time_of_day != "night") {
    return [ [ "find_food" ] ];
  }

  const move = world.jobs && world.jobs.find(j => j.job.key == "move_to_here");
  if (move) {
    return [
      ["walk_to", move.targetId],
      ["complete_job", move.job.key]
    ];
  }
  const cut = world.jobs && world.jobs.find(j => j.job.key == "cut_tree_down");
  if (cut) {
    return [
      ["walk_to", cut.targetId],
      ["chop_tree", cut.targetId],
      ["complete_job", cut.job.key]
    ];
  }
  return [ ["idle"] ];
}

export function cut_tree_down(world, targetId) {
  // Method 1 (only method!)
  return [
    ["walk_to", targetId],
    ["chop_tree", targetId]
  ];
}

export function move_to_place(world, type, filter, param) {
  if (world.places[type]) {
    return [ ["walk_to", world.places[type]] ];
  }
  return [
    [ "find_place", type, filter, param ],
    [ "move_to_place", type, filter, param ]
  ];
}

export function find_food(world) {
  if (!world.holding.grain) {
    return [
      [ "move_to_place", "food", "has", "grain" ],
      [ "pick_up", "grain", "food" ]
    ];
  }
  return [
    [ "move_to_place", "meet", "space" ],
    [ "eat", "grain" ]
  ];
}
