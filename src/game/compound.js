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
    world => !world.holding.grain,
    () => [
      [ "pick_up", "grain" ]
    ]
  ],
  [
    always,
    () => [
      [ "set_label" ],
      [ "move_to_place", "meet", "space" ],
      [ "set_label", "eating"],
      [ "eat", "grain" ]
    ]
  ]
];

export const pick_up = () => [
  [
    always,
    () => [
      [ "move_to_place", "stockpile_with_food", "stockpile_slot_with", "grain" ],
      [ "pick_up_from_stockpile", "grain", "stockpile_with_food" ],
      [ "forget_place", "stockpile_with_food" ],
      [ "find_food" ]
    ]
  ],
  [
    always,
    () => [
      [ "move_to_place", "container_with_food", "container_with", "grain" ],
      [ "get_from_container", "grain", "container_with_food" ],
      [ "forget_place", "container_with_food" ],
      [ "find_food" ]
    ]
  ]
];
