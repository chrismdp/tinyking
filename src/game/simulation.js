import { socialHour } from "game/social";
import { die } from "game/possessions";
import * as htn from "game/htn";
import { introActive, updateIntro } from "game/intro";
import * as time from "game/time";
import { updateWeather } from "game/weather";
import { drift } from "game/people";
import { topController } from "game/playable";
import { jobQueueFor, readyPlayerTasks, deferPlayerTask } from "game/manager";

import { updateVillageLife } from "game/villages";
import { updateEcology } from "game/ecology";

import crops from "data/crops.json";

export const SPEED = {
  paused: 0,
  normal: 360,
  fast: 3600
};

const SECONDS_PER_FRAME = 1 / 60;
const DAYS = 86400;

export const deltaTime = (frameMod, speed) => frameMod * SECONDS_PER_FRAME * (speed || 0) / DAYS;

const IDLE_PLAN = () => [["wait_for", time.HOUR * 0.5]];

function updatePlanners(state, frameMod) {
  if (SPEED[state.game_speed] == 0) {
    return;
  }

  for (const id in state.ecs.planner) {
    const planner = state.ecs.planner[id];
    if (state.ecs.personable[id] && state.ecs.personable[id].dead) continue;

    planner.world.actorId = id;
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

    if (planner.world.ordered && planner.world.currentJob) {
      const job = jobQueueFor(state.ecs, id).find(j => j.assignedId == id);
      if (job && !job.gatheredDone && !state.ecs.spatial[job.targetId]) deferPlayerTask(state);
    }
    if (planner.world.ordered && !planner.world.currentJob && planner.plan &&
      !planner.world.feeling.hungry && !planner.world.feeling.tired &&
      !["eat", "sleep", "forage"].includes(planner.task?.[0]) && readyPlayerTasks(state).length) {
      planner.task = null;
      planner.plan = null;
    }

    // Re-plan
    if (!planner.plan) {
      if (planner.task) {
        htn.finishTask(planner, planner.task);
      }
      const queue = jobQueueFor(state.ecs, planner.id);
      const jobs = state.ecs.manager[state.ui.playerId]?.ordered ?
        (id == state.ui.playerId ? readyPlayerTasks(state) : (topController(state.ecs, id) == state.ui.playerId ? [] : queue)) : queue;
      const [ plan ] = htn.solve(planner.world, jobs, [ [ planner.world.ordered ? "player" : "person" ] ]);
      planner.plan = plan;
      if (topController(state.ecs, planner.id) == state.ui.playerId) {
        // console.log("PLANNER:" , planner.id, JSON.stringify(planner.plan));
        if (!planner.plan) {
          console.warn("No plan for", planner.id, "- idling");
          planner.plan = IDLE_PLAN();
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

function starve(state, id) {
  die(state, id, "starvation");
}

// NOTE: The game itself, one frame at a time. Knows nothing about rendering:
// it changes ECS state and lists changed entities in state.redraws.
export function createSimulation(state, { onHour } = {}) {
  let hour = 0;
  let winter = time.season(state.days) == "winter";
  if (!state.weather) updateWeather(state, 0);

  const advanceTime = frameMod => {
    if (SPEED[state.game_speed]) {
      const toAdd = deltaTime(frameMod, SPEED[state.game_speed]);
      state.days += toAdd;
      hour += toAdd;
      while (hour + 1e-12 >= time.HOUR) {
        hour -= time.HOUR;
        const end = state.days;
        state.days = end - hour;

        // FIXME: This potentially leads to frame spikes each hour
        for (const id in state.ecs.planner) {
          const planner = state.ecs.planner[id];
          planner.world.days = state.days;
        }

        for (const id in state.ecs.personable) {
          const person = state.ecs.personable[id];
          if (person.dead) continue;
          person.tiredness += time.HOUR;
          person.hunger += time.HOUR;
          person.starving = person.hunger > 2.5;
          if (person.hunger > 6 + 1e-12) starve(state, id);
        }

        if (state.ecs.farmable) {
          for (const id in state.ecs.farmable) {
            for (const slot of state.ecs.farmable[id].slots) {
              if (slot.content && slot.state == "sown" && time.season(state.days) != "winter") {
                state.redraws.push(id);

                slot.growth = (slot.growth || 0) + time.HOUR;
                if (slot.growth + 1e-12 >= crops[slot.content].growingTime) {
                  slot.state = "harvestable";
                  slot.amount = crops[slot.content].harvestableAmount;
                }
              }
            }
          }
        }
        const nowWinter = time.season(state.days) == "winter";
        if (winter != nowWinter) {
          state.redraws.push(...Object.keys(state.ecs.forageable || {}));
          winter = nowWinter;
        }
        // Sample every crossed hour, including season boundaries.
        updateEcology(state);
        updateWeather(state);
        drift(state, 1);
        socialHour(state);
        if (onHour) {
          onHour();
        }
        state.days = end;
      }
    }
  };

  return {
    step(frameMod, realSeconds = frameMod / 60) {
      const arriving = introActive(state);
      updateIntro(state, realSeconds);
      if (arriving) return;
      updatePlanners(state, frameMod);
      advanceTime(frameMod);
      if (SPEED[state.game_speed]) updateVillageLife(state);
    }
  };
}
