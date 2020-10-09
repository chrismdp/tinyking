import * as time from "game/time";

const always = () => true;

export const person = () => [
  [
    world => world.feeling.tired && world.time_of_day == "evening" || world.time_of_day == "night",
    () => [ [ "move_to_place", "sleep", "allows_sleep" ], [ "sleep"] ],
  ],
  [
    world => world.feeling.hungry && world.time_of_day != "night",
    () => [ [ "find_food" ] ]
  ],
  [
    world => world.jobs && world.jobs.find(j => j.job.key == "move_to_here"),
    move => [ ["walk_to", move.targetId], ["complete_job", move.job.key] ]
  ],
  [
    world => world.jobs && world.jobs.find(j => j.job.key == "cut_tree_down"),
    cut => [
      ["walk_to", cut.targetId],
      ["chop_tree", cut.targetId],
      ["complete_job", cut.job.key]
    ]
  ],
  [
    always,
    () => [
      [ "move_to_place", "meet", "space" ],
      [ "forget_place", "meet" ], // TODO: Idle animations
      [ "wait_for", time.HOUR + Math.random() * time.HOUR ]
    ]
  ]
];

export const cut_tree_down = (targetId) => [
  [
    always,
    () => [ ["walk_to", targetId], ["chop_tree", targetId] ]
  ]
];

export const move_to_place = (type, filter, param) => [
  [
    world => world.places[type],
    place => [
      ["walk_to", place]
    ]
  ],
  [ always,
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
      [ "pick_up", "grain", "food" ]
    ]
  ],
  [
    always,
    () => [
      [ "move_to_place", "meet", "space" ],
      [ "eat", "grain" ]
    ]
  ]
];
