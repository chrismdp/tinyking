import produce, { setAutoFreeze, nothing } from "immer";

// NOTE: We do not want our source world rep to be frozen - we want to be able
// to modify it outside of the solve call. Otherwise as soon as the world rep
// has gone through solve once, it can never be modified.
setAutoFreeze(false);

const debug = false;

const library = {
  primitive: {
    chop_tree: () => {},
    walk_to: (rep, targetId) => {
      rep.loc[rep.id] = { ...rep.loc[targetId] };
    },
    complete_job: (rep, jobKey) => {
      const idx = rep.jobs.findIndex(j => j.job.key == jobKey);
      rep.jobs.splice(idx, 1);
    },
    idle: () => {}
  },
  compound: {
    person: (rep) => {
      const move = rep.jobs && rep.jobs.find(j => j.job.key == "move_to_here");
      if (move) {
        return [
          ["walk_to", move.targetId],
          ["complete_job", move.job.key]
        ];
      }
      const cut = rep.jobs && rep.jobs.find(j => j.job.key == "cut_tree_down");
      if (cut) {
        return [
          ["walk_to", cut.targetId],
          ["chop_tree", cut.targetId],
          ["complete_job", cut.job.key]
        ];
      }
      return [ ["idle"] ];
    },
    cut_tree_down: (rep, targetId) => {
      // Method 1 (only method!)
      return [
        ["walk_to", targetId],
        ["chop_tree", targetId]
      ];
    }
  }
};

export function execute(rep, task) {
  const [name, ...args] = task;
  return library.primitive[name](rep, args) != nothing;
}

const isPrimitive = task => library.primitive[task];

export function solve(rep, tasks, plan = []) {
  if (debug) { console.log("SOLVE", rep, "TASKS", tasks, "PLAN", plan); }
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
    const newRep = produce(library.primitive[name])(rep, ...args);
    if (newRep) {
      const solution = solve(newRep, rest, [ ...plan, task ]);
      if (solution) {
        return solution;
      }
      if (debug) { console.log("NO SOLN FOUND FOR REST OF TASKS", rest); }
    }
    if (debug) { console.log("PRECOND FAILED FOR ", name); }
  } else {
    const subTasks = library.compound[name](rep, ...args);
    if (debug) { console.log("ST", subTasks); }
    if (subTasks) {
      const solution = solve(rep, subTasks, plan);
      if (solution) {
        return solution;
      }
      if (debug) { console.log("NO SOLN FOUND FOR COMPOUND TASK", name); }
    }
  }
}
