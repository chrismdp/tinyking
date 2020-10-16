import * as time from "game/time";

const always = () => true;

export const person = () => [
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
    world => world.jobs && world.jobs.find(j => j.job.key == "move_to_here"),
    move => [ ["walk_to", move.targetId], ["complete_job", move.job.key] ]
  ],
  [
    world => world.jobs && world.jobs.find(j => j.job.key == "recruit"),
    action => [ ["recruit", action.targetId], ["complete_job", action.job.key] ]
  ],
  [
    world => world.jobs && world.jobs.find(j => j.job.key == "create_stockpile"),
    action => [
      ["set_label", "create_stockpile"],
      ["walk_to", action.targetId],
      ["create_stockpile", action.targetId],
      ["complete_job", action.job.key]
    ]
  ],
  [
    world => world.jobs && world.jobs.find(j => j.job.key == "cut_tree_down"),
    cut => [
      ["set_label", "cut_tree_down"],
      ["walk_to", cut.targetId],
      ["chop_tree", cut.targetId],
      ["complete_job", cut.job.key]
    ]
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
      [ "move_to_place", thing, "haulable_with_good", thing ],
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
      [ "move_to_place", "food", "has", "grain" ],
      [ "get_from_container", "grain", "food" ],
      [ "find_food" ]
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
