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
    world => world.feeling.tired && world.time_of_day == "evening" || world.time_of_day == "night",
    () => [
      [ "set_label" ],
      [ "move_to_place", "sleep", "allows_sleep" ],
      [ "go_to_sleep"]
    ],
  ],
  [
    world => world.feeling.hungry && world.time_of_day != "night",
    () => [
      [ "set_label" ],
      [ "find_food" ]
    ]
  ],
  [
    always,
    () => [ [ "check_jobs" ] ]
  ],
  [
    always,
    () => [ [ "haul_to_stockpile", "wood" ] ]
  ],
  [
    always,
    () => [
      [ "set_label" ],
      [ "wait_for", Math.random() * time.HOUR ],
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
    (_, jobs) => firstFreeJob(jobs, "plough_field"),
    entry => [
      ["take_job", entry.job.key],
      ["set_label", "plough_field"],
      ["plough_field", entry.targetId ]
    ]
  ],
  [
    (_, jobs) => firstFreeJob(jobs, "sow_field"),
    entry => [
      ["take_job", entry.job.key],
      ["set_label", "sow_field"],
      ["sow_field", entry.targetId ]
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
      [ "move_to_place", "slot", "stockpile_open_slot", held ],
      [ "drop_entity_into_stockpile_slot", held ],
      [ "forget_place", "slot" ]
    ]
  ]
];

export const haul_to_stockpile = (thing) => [
  [
    always,
    () => [
      [ "find_place", "slot", "stockpile_open_slot", thing ],
      [ "find_place", thing, "haulable_with_good", thing ],
      [ "set_label" ],
      [ "walk_to", thing ],
      [ "pick_up_entity_with_good", thing ],
      [ "forget_place", thing ],
      [ "walk_to", "slot" ],
      [ "drop_entity_into_stockpile_slot", thing ],
      [ "forget_place", "slot" ]
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
    place => [
      ["walk_to", place]
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
      [ "pick_up", "gruel", [ "find_food" ] ],
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
      [ "pick_up", "grain", [ "make_gruel" ] ],
    ]
  ],
  [
    always,
    () => [
      [ "move_to_place", "workshop", "workshop_with", "stove" ],
      [ "drop_entity_into_workshop", "workshop", "grain" ],
      [ "make_gruel" ]
    ]
  ],
];

export const pick_up = (good, recursiveTask) => [
  [
    always,
    () => [
      [ "move_to_place", good, "haulable_with_good", good ],
      [ "pick_up_entity_with_good", good ],
      [ "forget_place", good ],
      recursiveTask
    ]
  ],
  [
    always,
    () => [
      [ "move_to_place", "stockpile_with", "stockpile_slot_with", good ],
      [ "pick_up_from_stockpile", good, "stockpile_with" ],
      [ "forget_place", "stockpile_with" ],
      recursiveTask
    ]
  ],
  [
    always,
    () => [
      [ "move_to_place", "container_with", "container_with", good ],
      [ "forget_place", "container_with" ],
      [ "get_from_container", good ],
      recursiveTask
    ]
  ]
];

export const plough_field = (targetId) => [
  [
    world => !world.subtasks || world.subtasks.some(t => t.id != targetId || t.result != "ploughed"),
    () => [
      [ "create_subtasks", targetId, "ploughed" ],
      [ "plough_field", targetId ]
    ]
  ],
  [
    world => world.subtasks && world.subtasks.length == 0,
    () => [
      [ "clear_subtasks" ],
      [ "complete_job", "plough_field" ]
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

export const sow_field = (targetId) => [
  [
    world => !world.subtasks || world.subtasks.some(t => t.id != targetId || t.result != "sown"),
    () => [
      [ "create_subtasks", targetId, "sown", "grain" ],
      [ "sow_field", targetId ]
    ]
  ],
  [
    world => world.subtasks && world.subtasks.length == 0,
    () => [
      [ "clear_subtasks" ],
      [ "complete_job", "sow_field" ]
    ]
  ],
  [
    world => !world.holding.grain,
    () => [
      [ "pick_up", "grain", [ "sow_field", targetId ] ]
    ]
  ],
  [
    always,
    () => [
      [ "find_next_subtask", "subtask_slot" ],
      [ "walk_to", "subtask_slot" ],
      [ "perform_subtask_in_slot", targetId, "subtask_slot" ],
      [ "complete_subtask", "subtask_slot" ],
      [ "sow_field", targetId ]
    ]
  ]
];
