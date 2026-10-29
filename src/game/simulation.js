import * as htn from "game/htn";
import * as time from "game/time";
import { topController } from "game/playable";
import { jobQueueFor } from "game/manager";

import crops from "data/crops.json";

export const SPEED = {
  paused: 0,
  normal: 360,
  fast: 3600
};

const SECONDS_PER_FRAME = 1 / 60;
const DAYS = 86400;

export const deltaTime = (frameMod, speed) => frameMod * SECONDS_PER_FRAME * (speed || 0) / DAYS;

function updatePlanners(state, frameMod) {
  if (SPEED[state.game_speed] == 0) {
    return;
  }

  for (const id in state.ecs.planner) {
    const planner = state.ecs.planner[id];

    // Update sensors
    if (state.ecs.personable[id]) {
      const person = state.ecs.personable[id];
      if (!planner.world.feeling.tired && person.tiredness > 0.9) {
        planner.world.feeling.tired = true;
        htn.replan(planner);
      }
      if (!planner.world.feeling.hungry && person.hunger > 0.9) {
        planner.world.feeling.hungry = true;
        htn.replan(planner);
      }
    }

    // Re-plan
    if (!planner.plan) {
      if (planner.task) {
        htn.finishTask(planner, planner.task);
      }
      const jobs = jobQueueFor(state.ecs, planner.id);
      const [ plan ] = htn.solve(planner.world, jobs, [ [ "person" ] ]);
      planner.plan = plan;
      if (topController(state.ecs, planner.id) == state.ui.playerId) {
        // console.log("PLANNER:" , planner.id, JSON.stringify(planner.plan));
        if (!planner.plan) {
          throw "no plan";
        }
      }
    }
    // Process tasks
    const dt = deltaTime(frameMod, SPEED[state.game_speed]);
    if (planner.task) {
      htn.runTask(state, planner, dt, false);
    }
    while (!planner.task && planner.plan) {
      if (planner.plan.length > 0) {
        planner.task = planner.plan.shift();
        if (topController(state.ecs, planner.id) == state.ui.playerId) {
          // console.log("NEW TASK", planner.id, planner.task);
        }
        htn.runTask(state, planner, dt, true);
        // TODO: Make sure this happens only once
        state.redraws.push(planner.id);
      } else {
        htn.replan(planner);
      }
    }
  }
}

// NOTE: The game itself, one frame at a time. Knows nothing about rendering:
// it changes ECS state and lists changed entities in state.redraws.
export function createSimulation(state, { onHour } = {}) {
  let hour = 0;

  const advanceTime = frameMod => {
    if (SPEED[state.game_speed]) {
      const toAdd = deltaTime(frameMod, SPEED[state.game_speed]);
      state.days += toAdd;
      hour += toAdd;
      if (hour > time.HOUR) {
        hour -= time.HOUR;

        // FIXME: This potentially leads to frame spikes each hour
        for (const id in state.ecs.planner) {
          const planner = state.ecs.planner[id];
          planner.world.days = state.days;
        }

        for (const id in state.ecs.personable) {
          const person = state.ecs.personable[id];
          person.tiredness += time.HOUR;
          person.hunger += time.HOUR;
        }

        if (state.ecs.farmable) {
          for (const id in state.ecs.farmable) {
            for (const slot of state.ecs.farmable[id].slots) {
              if (slot.content) {
                state.redraws.push(id);

                const age = state.days - slot.updated;
                if (age > crops[slot.content].growingTime) {
                  slot.state = "harvestable";
                  slot.amount = crops[slot.content].harvestableAmount;
                }
              }
            }
          }
        }
        if (onHour) {
          onHour();
        }
      }
    }
  };

  return {
    step(frameMod) {
      updatePlanners(state, frameMod);
      advanceTime(frameMod);
    }
  };
}
