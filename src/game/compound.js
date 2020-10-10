import * as time from "game/time";

const always = () => true;

export const person = () => [
  [
    world => world.feeling.tired && world.time_of_day == "evening" || world.time_of_day == "night",
    () => [
      [ "set_label", "going_to_bed" ],
      [ "move_to_place", "sleep", "allows_sleep" ],
      [ "go_to_sleep"]
    ],
  ],
  [
    world => world.feeling.hungry && world.time_of_day != "night",
    () => [
      [ "set_label", "finding_food"],
      [ "find_food" ]
    ]
  ],
  [
    world => world.jobs && world.jobs.find(j => j.job.key == "move_to_here"),
    move => [ ["walk_to", move.targetId], ["complete_job", move.job.key] ]
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
      [ "set_label", "wandering"],
      [ "move_to_place", "meet", "space" ],
      [ "forget_place", "meet" ], // TODO: Idle animations
      [ "wait_for", time.HOUR + Math.random() * time.HOUR ]
    ]
  ]
];

export const haul_to_stockpile = (thing) => [
  [
    always,
    () => [
      [ "move_to_place", thing, "haulable_with_good", thing ],
      [ "pick_up_entity_with_good", thing ],
      [ "forget_place", thing ],
      [ "move_to_place", "slot", "stockpile_open_slot", thing ],
      [ "drop_entity_with_good", thing ]
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
      [ "move_to_place", "meet", "space" ],
      [ "set_label", "eating"],
      [ "eat", "grain" ]
    ]
  ]
];
