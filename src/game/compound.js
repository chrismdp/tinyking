import * as time from "game/time";
import { firstFreeJob } from "game/manager";

const always = () => true;

export const person = () => [
  [
    world => world.capturedAttentionOf,
    targetId => [
      [ "release_attention", targetId ],
      [ "person" ]
    ]
  ],
  [
    world => world.currentJob,
    job => [
      [ "release_job", job ],
      [ "person" ]
    ]
  ],
  [
    world => world.claimedFarmable,
    farmableId => [
      [ "release_farmable", farmableId ],
      [ "person" ]
    ]
  ],
  [
    world => world.capturedBy,
    () => [
      [ "set_label", "waiting_for" ],
      [ "wait_for", time.HOUR * 0.5 ]
    ]
  ],
  [
    always,
    () => [ [ "store_held" ] ]
  ],
  [
    world => world.feeling.tired && (time.hour_of_day(world.days) >= 21 || time.hour_of_day(world.days) < 9),
    () => [
      [ "set_label" ],
      [ "move_to_place", "sleep", "allows_sleep" ],
      [ "go_to_sleep"]
    ],
  ],
  [
    world => world.feeling.hungry && time.hour_of_day(world.days) >= 6 && time.hour_of_day(world.days) < 21,
    () => [
      [ "set_label" ],
      [ "find_food" ]
    ]
  ],
  [
    always,
    () => [
      [ "set_label" ],
      [ "check_jobs" ]
    ]
  ],
  [
    world => time.hour_of_day(world.hour) < 18,
    () => [
      [ "set_label" ],
      [ "farm" ]
    ]
  ],
  [
    always,
    () => [ [ "haul", "wood" ] ]
  ],
  [
    always,
    () => [
      [ "set_label" ],
      [ "move_to_place", "meet", "space" ],
      [ "forget_place", "meet" ], // TODO: Idle animations
      [ "wait_for", time.HOUR + Math.random() * time.HOUR ]
    ]
  ]
];

export const check_jobs = () => [
  [
    (_, jobs) => firstFreeJob(jobs, "move_to_here"),
    entry => [
      ["take_job", entry.job.key],
      ["walk_to", entry.targetId],
      ["complete_job", entry.job.key]
    ]
  ],
  [
    (_, jobs) => firstFreeJob(jobs, "recruit"),
    entry => [
      ["take_job", entry.job.key],
      ["recruit", entry.targetId],
      ["complete_job", entry.job.key]
    ]
  ],
  [
    (_, jobs) => firstFreeJob(jobs, "create_field"),
    entry => [
      ["take_job", entry.job.key],
      ["set_label", "create_field"],
      ["walk_to", entry.targetId],
      ["create_field", entry.targetId ],
      ["complete_job", entry.job.key]
    ]
  ],
  [
    (_, jobs) => firstFreeJob(jobs, "create_stockpile"),
    entry => [
      ["take_job", entry.job.key],
      ["set_label", "create_stockpile"],
      ["walk_to", entry.targetId],
      ["create_stockpile", entry.targetId],
      ["complete_job", entry.job.key]
    ]
  ],
  [
    (_, jobs) => firstFreeJob(jobs, "cut_tree_down"),
    entry => [
      ["take_job", entry.job.key],
      ["set_label", "cut_tree_down"],
      ["walk_to", entry.targetId],
      ["chop_tree", entry.targetId],
      ["complete_job", entry.job.key]
    ]
  ]
];

export const farm = () => [
  [
    always,
    () => [ [ "haul", "grain" ] ]
  ],
  [
    always,
    () => [ [ "harvest_any_field" ] ]
  ],
  [
    always,
    () => [ [ "sow_any_field" ] ]
  ],
  [
    always,
    () => [ [ "plough_any_field" ] ]
  ],
];

export const recruit = (targetId) => [
  [
    always,
    () => [
      ["set_label", "recruiting"],
      ["get_attention", targetId],
      ["walk_to", targetId],
      ["wait_for", time.HOUR * 0.5 + time.HOUR * Math.random()],
      ["set_controller_to_me", targetId],
      ["release_attention", targetId]
    ]
  ]
];

export const store_held = () => [
  [
    world => Object.keys(world.holding).filter(h => world.holding[h]),
    held => [
      [ "move_to_place", "container_with_space", "container_with_space", held ],
      [ "drop_entity_into_container", "container_with_space", held ],
      [ "forget_place", "container_with_space" ]
    ]
  ],
  [
    world => Object.keys(world.holding).filter(h => world.holding[h]),
    held => [
      [ "move_to_place", "stockpile_open_slot", "stockpile_open_slot", held ],
      [ "drop_entity_into_stockpile_slot", "stockpile_open_slot", held ],
      [ "forget_place", "stockpile_open_slot" ]
    ]
  ]
];

export const plough_any_field = () => [
  [
    world => world.places.ploughable_field,
    field => [
      [ "forget_place", "ploughable_field" ],
      [ "claim_farmable", field ],
      [ "walk_to", field ],
      [ "set_label", "plough_field" ],
      [ "plough_field", field ],
      [ "release_farmable", field ],
    ]
  ],
  [
    world => !world.places.ploughable_field,
    () => [
      [ "find_place", "ploughable_field", "farmable_slot_with", ["empty", "harvested", "rotten"] ],
    ]
  ]
];

export const harvest_any_field = () => [
  [
    world => world.places.harvestable_field,
    field => [
      [ "forget_place", "harvestable_field" ],
      [ "claim_farmable", field ],
      [ "walk_to", field ],
      [ "set_label", "harvest_field" ],
      [ "harvest_field", field ],
      [ "release_farmable", field ],
    ]
  ],
  [
    world => !world.places.harvestable_field,
    () => [
      [ "find_place", "harvestable_field", "farmable_slot_with", ["harvestable"] ],
    ]
  ]
];

export const sow_any_field = () => [
  [
    world => world.places.sowable_field,
    field => [
      [ "forget_place", "sowable_field" ],
      [ "claim_farmable", field ],
      [ "walk_to", field ],
      [ "set_label", "sow_field" ],
      [ "sow_field", field ],
      [ "release_farmable", field ],
    ]
  ],
  [
    world => !world.places.sowable_field,
    () => [
      [ "find_place", "sowable_field", "farmable_slot_with", ["ploughed"] ],
    ]
  ]
];

export const haul = (thing) => [
  [
    always,
    () => [
      [ "find_place", "container_with_space", "container_with_space", thing ],
      [ "find_place", "haulable_with " + thing, "haulable_with_good", thing ],
      [ "set_label" ],
      [ "walk_to", "haulable_with " + thing ],
      [ "pick_up_entity_with_good", "haulable_with " + thing ],
      [ "forget_place", "haulable_with " + thing ],
      [ "store_held" ],
    ]
  ],
  [
    always,
    () => [
      [ "find_place", "stockpile_open_slot", "stockpile_open_slot", thing ],
      [ "find_place", "haulable_with " + thing, "haulable_with_good", thing ],
      [ "set_label" ],
      [ "walk_to", "haulable_with " + thing ],
      [ "pick_up_entity_with_good", "haulable_with " + thing ],
      [ "forget_place", "haulable_with " + thing ],
      [ "store_held" ],
    ]
  ]
];

export const go_to_sleep = () => [
  [
    always,
    () => [
      ["set_label", "sleeping"],
      ["sleep"]
    ]
  ]
];

export const move_to_place = (type, filter, param) => [
  [
    world => world.places[type],
    () => [
      ["walk_to", type]
    ]
  ],
  [
    always,
    () => [
      [ "find_place", type, filter, param ],
      [ "move_to_place", type, filter, param ]
    ],
  ]
];

export const find_food = () => [
  [
    world => !world.holding.gruel,
    () => [
      [ "pick_up", "gruel" ],
      [ "find_food" ]
    ]
  ],
  [
    world => world.holding.gruel,
    () => [
      [ "set_label" ],
      [ "move_to_place", "meet", "space" ],
      [ "set_label", "eating"],
      [ "eat", "gruel" ]
    ]
  ]
];

// TODO: Not yet complete. A number of these tasks don't yet exist: not quite
// ready to do crafting.
export const make_gruel = () => [
  [
    world => world.places.workshop && world.places.workshop.amounts.grain >= 5,
    () => [
      [ "move_to_place", "workshop", "workshop_with", "stove", { grain: 5 } ],
      [ "craft", "gruel" ],
    ]
  ],
  [
    world => !world.holding.grain,
    () => [
      [ "pick_up", "grain" ],
      [ "make_gruel" ],
    ]
  ],
  [
    world => world.holding.grain,
    () => [
      [ "move_to_place", "workshop", "workshop_with", "stove" ],
      [ "drop_entity_into_workshop", "workshop", "grain" ],
      [ "make_gruel" ]
    ]
  ],
];

export const pick_up = (good) => [
  [
    always,
    () => [
      [ "move_to_place", "haulable_with " + good, "haulable_with_good", good ],
      [ "pick_up_entity_with_good", good ],
      [ "forget_place", good ],
    ]
  ],
  [
    always,
    () => [
      [ "move_to_place", "stockpile_with " + good, "stockpile_slot_with", good ],
      [ "pick_up_from_stockpile", good, "stockpile_with " + good ],
      [ "forget_place", "stockpile_with " + good ],
    ]
  ],
  [
    always,
    () => [
      [ "move_to_place", "container_with " + good, "container_with", good ],
      [ "forget_place", "container_with " + good ],
      [ "get_from_container", good ],
    ]
  ]
];

export const plough_field = (targetId) => [
  [
    world => !world.subtasks || world.subtasks.some(t => t.id != targetId || t.result != "ploughed"),
    () => [
      [ "create_subtasks", targetId, "ploughed", ["empty", "harvested"] ],
      [ "plough_field", targetId ]
    ]
  ],
  [
    world => world.subtasks && world.subtasks.length == 0,
    () => [
      [ "clear_subtasks" ],
    ]
  ],
  [
    always,
    () => [
      [ "find_next_subtask", "subtask_slot" ],
      [ "walk_to", "subtask_slot" ],
      [ "perform_subtask_in_slot", targetId, "subtask_slot" ],
      [ "complete_subtask", "subtask_slot" ],
      [ "plough_field", targetId ]
    ]
  ]
];

export const harvest_field = (targetId) => [
  [
    world => !world.subtasks || world.subtasks.some(t => t.id != targetId || t.result != "harvested"),
    () => [
      [ "create_subtasks", targetId, "harvested", ["harvestable"] ],
      [ "harvest_field", targetId ]
    ]
  ],
  [
    world => world.subtasks && world.subtasks.length == 0,
    () => [
      [ "clear_subtasks" ],
    ]
  ],
  [
    always,
    () => [
      [ "find_next_subtask", "subtask_slot" ],
      [ "walk_to", "subtask_slot" ],
      [ "perform_subtask_in_slot", targetId, "subtask_slot" ],
      [ "complete_subtask", "subtask_slot" ],
      [ "harvest_field", targetId ]
    ]
  ]
];

export const sow_field = (targetId) => [
  [
    world => !world.subtasks || world.subtasks.some(t => t.id != targetId || t.result != "sown"),
    () => [
      [ "create_subtasks", targetId, "sown", ["ploughed"], "grain" ],
      [ "sow_field", targetId ]
    ]
  ],
  [
    world => world.subtasks && world.subtasks.length == 0,
    () => [
      [ "clear_subtasks" ],
    ]
  ],
  [
    world => !world.holding.grain,
    () => [
      [ "pick_up", "grain" ],
      [ "sow_field", targetId ]
    ]
  ],
  [
    world => world.holding.grain,
    () => [
      [ "find_next_subtask", "subtask_slot" ],
      [ "walk_to", "subtask_slot" ],
      [ "perform_subtask_in_slot", targetId, "subtask_slot", "grain" ],
      [ "complete_subtask", "subtask_slot" ],
      [ "sow_field", targetId ]
    ]
  ]
];
