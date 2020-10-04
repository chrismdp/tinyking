import produce, { setAutoFreeze, nothing } from "immer";

// NOTE: We do not want our source world rep to be frozen - we want to be able
// to modify it outside of the solve call. Otherwise as soon as the world rep
// has gone through solve once, it can never be modified.
setAutoFreeze(false);

const debug = false;

const library = {
  primitive: {
    chop_tree: () => {},
    walk_to: (world, targetId) => {
      world.loc[world.id] = { ...world.loc[targetId] };
    },
    complete_job: (world, jobKey) => {
      const idx = world.jobs.findIndex(j => j.job.key == jobKey);
      world.jobs.splice(idx, 1);
    },
    idle: () => {}
  },
  compound: {
    person: (world) => {
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
    },
    cut_tree_down: (world, targetId) => {
      // Method 1 (only method!)
      return [
        ["walk_to", targetId],
        ["chop_tree", targetId]
      ];
    }
  }
};

export function execute(world, task) {
  const [name, ...args] = task;
  return library.primitive[name](world, args) != nothing;
}

const isPrimitive = task => library.primitive[task];

export function solve(world, tasks, plan = []) {
  if (debug) { console.log("SOLVE", world, "TASKS", tasks, "PLAN", plan); }
  if (tasks.length == 0) {
    if (debug) { console.log("RETURNING PLAN", plan); }
    return plan;
  }

  const [task, ...rest] = tasks;
  const [name, ...args] = task;
  if (debug) { console.log("HTN: CONSIDERING", task); }

  if (!library.primitive[name] && !library.compound[name]) {
    throw "Cannot find task " + name;
  }

  if (isPrimitive(name)) {
    const newWorld = produce(library.primitive[name])(world, ...args);
    if (newWorld) {
      const solution = solve(newWorld, rest, [ ...plan, task ]);
      if (solution) {
        return solution;
      }
      if (debug) { console.log("NO SOLN FOUND FOR REST OF TASKS", rest); }
    }
    if (debug) { console.log("PRECOND FAILED FOR ", name); }
  } else {
    const subTasks = library.compound[name](world, ...args);
    if (debug) { console.log("ST", subTasks); }
    if (subTasks) {
      const solution = solve(world, subTasks, plan);
      if (solution) {
        return solution;
      }
      if (debug) { console.log("NO SOLN FOUND FOR COMPOUND TASK", name); }
    }
  }
}
