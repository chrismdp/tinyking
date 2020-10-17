import produce, { setAutoFreeze, nothing } from "immer";
import * as tasks from "game/tasks";
import * as primitive from "game/primitive";
import * as compound from "game/compound";

// NOTE: We do not want our source world rep to be frozen - we want to be able
// to modify it outside of the solve call. Otherwise as soon as the world rep
// has gone through solve once, it can never be modified.
setAutoFreeze(false);

const debug = false;

export function solve(world, jobs, tasks, plan = []) {
  if (debug) { console.log("SOLVE", world, "JOBS", jobs, "TASKS", tasks, "PLAN", plan); }
  if (tasks.length == 0) {
    return plan;
  }

  const [task, ...rest] = tasks;
  const [name, ...args] = task;
  if (debug) { console.log("HTN: CONSIDERING", task); }

  if (primitive[name]) {
    const newWorld = produce(primitive[name])(world, true, ...args);
    if (newWorld) {
      const solution = solve(newWorld, jobs, rest, [ ...plan, task ]);
      if (solution) {
        return solution;
      }
      if (debug) { console.log("NO SOLN FOUND FOR REST OF TASKS", rest); }
    }
    if (debug) { console.log("PRECOND FAILED FOR ", name); }
  } else if (compound[name]) {
    const methods = compound[name](...args);
    for (const method of methods) {
      let conditions = method[0](world, jobs);
      if (!Array.isArray(conditions)) {
        conditions = [ conditions ];
      }
      for (const condition of conditions.filter(c => c)) {
        if (debug) { console.log("COMPOUND: condition for ", name, " : ", condition); }
        const solution = solve(world, jobs, method[1](condition), plan);
        if (solution) {
          return solve(world, jobs, rest, solution);
        }
        if (debug) { console.log("NO SOLN FOUND FOR COMPOUND TASK", name); }
      }
    }
  } else {
    throw "Cannot find task " + name + " (plan: " + JSON.stringify(plan) + ")";
  }
}

export function runTask(state, planner, dt, firstRun) {
  const [name, ...args] = planner.task;
  if (!tasks[name]) {
    throw "Cannot find task to run " + name;
  }

  const newWorld = produce(primitive[name])(planner.world, false, ...args);
  if (newWorld) {
    const result = tasks[name](state, planner.id, planner.world, dt, firstRun, ...args);
    if (result == nothing) {
      replan(planner);
    } else if (!result) {
      const pResult = primitive[name](planner.world, false, ...args);
      if (pResult == nothing) {
        throw "primitive returned 'nothing', second time around after task!";
      }
      planner.task = null;
    }
  } else {
    replan(planner);
  }
}

export function replan(planner) {
  planner.plan = null;
  planner.task = null;
  // console.trace("replan", planner);
}
