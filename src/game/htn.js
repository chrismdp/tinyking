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
    throw "Cannot find either primitive or compound task " + name + " (plan: " + JSON.stringify(plan) + ")";
  }
}

export function finishTask(planner, task) {
  const [name, ...args] = task;
  // NOTE: Ensure we apply any effects of the plan when the task is done
  primitive[name](planner.world, false, ...args);
  planner.task = null;
}

export function runTask(state, planner, dt, firstRun) {
  const [name, ...args] = planner.task;
  if (!tasks[name]) {
    throw "Cannot find task to run " + name;
  }

  if (!firstRun || produce(primitive[name])(planner.world, false, ...args)) {
    const result = tasks[name](state, planner.id, planner.world, dt, firstRun, ...args);
    if (result == nothing) {
      // NOTE: This is an abort situation: we _don't_ finish the task
      planner.task = null;
      replan(planner);
    } else if (!result) {
      finishTask(planner, planner.task);
    }
  } else {
    replan(planner);
  }
}

export function replan(planner) {
  planner.plan = null;
  // console.trace("replan", planner);
}
