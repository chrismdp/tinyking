import { updateCustoms } from "game/village_customs";
import { actualHome, nightTime, validateHome, leaveHome } from "game/home";
import { updateEnvironment } from "game/environment";
import { stationarySupplies } from "game/stationary_care";
import { gardenHelp } from "game/household_routines";
import { advanceWorldClock, completeTravel, departNpc } from "game/travel";
import { isResident } from "game/residents";
import { updateFavours, fuelReady, requestForTask } from "game/favours";
import { friendWork, friendEligible, friendWorkWanted, releaseFriendWork } from "game/friend_help";
import { socialHour } from "game/social_visits";
import { die } from "game/possessions";
import * as htn from "game/htn";
import { introActive, updateIntro } from "game/intro";
import * as time from "game/time";
import { updateWeather } from "game/weather";
import { drift } from "game/people";
import { topController } from "game/playable";
import { jobQueueFor, readyPlayerTasks, deferPlayerTask } from "game/manager";

import { updateVillageLife } from "game/villages";




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

  const childrenByHome = new Map();
  for (const [id, child] of Object.entries(state.ecs.personable || {})) if (!child.dead && child.age >= 6 && child.age < 18 && isResident(state, id)) {
    const home = state.ecs.household?.[id]?.houseId;
    if (!childrenByHome.has(home)) childrenByHome.set(home, []);
    childrenByHome.get(home).push(id);
  }
  for (const id in state.ecs.planner) {
    const planner = state.ecs.planner[id];
    validateHome(state, id);
    if (state.ecs.personable[id] && (state.ecs.personable[id].dead || !isResident(state,id))) continue;

    planner.world.actorId = id;
    planner.world.stationaryPlayer = id == state.ui.playerId;
    if (planner.world.ordered && planner.world.stationaryPlayer) {
      const wasWorking = planner.world.playerWorking;
      planner.world.playerWorking = !!planner.world.currentJob || readyPlayerTasks(state).length > 0;
      if (wasWorking && !planner.world.playerWorking && !["eat", "sleep"].includes(planner.task?.[0])) {
        planner.task = null; planner.plan = null;
      }
      if (!planner.world.playerWorking) {
        const care = stationarySupplies(state, id);
        planner.world.careMeal = care.meal; planner.world.careBed = care.bed;
        if (care.bed) planner.world.places.sleep = care.bed;
        planner.world.places.idleFoodSource = care.meal?.source;
        if (care.meal?.kind == "held") planner.world.holding[care.meal.type] = true;
      }
    }
    const nightHome = id != state.ui.playerId && nightTime(state.days) ? actualHome(state,id) : null;
    if (planner.world.nightHome != nightHome) {
      planner.world.nightHome = nightHome;
      if (["home_downtime", "wait_for"].includes(planner.task?.[0]) || planner.task?.[0] == "walk_to" && planner.task[1] == "meet") {
        planner.task = null; planner.plan = null;
      }
      if (!nightHome && planner.task?.[0] != "sleep") leaveHome(state,id);
    }
    planner.world.child = state.ecs.personable[id]?.age < 18;
    if (!planner.world.ordered) planner.world.gardenHelp = gardenHelp(state, id, childrenByHome);
    if (id != state.ui.playerId) {
      if (planner.world.helpingFriend && (!friendEligible(state, id) || !friendWorkWanted(state, planner.world.helpingFriend) || planner.world.feeling.hungry || planner.world.feeling.tired)) {
        releaseFriendWork(state, id); planner.task = null; planner.plan = null;
      }
      if (!planner.world.helpingFriend) planner.world.friendOffer = planner.world.child ? null : friendWork(state, id);
      planner.world.tradeReady = !planner.world.profession || fuelReady(state, planner.world.profession.workplaceId);
    }
    // Update sensors
    if (state.ecs.personable[id]) {
      const person = state.ecs.personable[id];
      if (!planner.world.feeling.tired && person.tiredness > 0.9) {
        planner.world.feeling.tired = true;
        if(planner.task?.[0] != "leave_edge") htn.replan(planner);
      }
      if (!planner.world.feeling.hungry && person.hunger > 0.9) {
        planner.world.feeling.hungry = true;
        if(planner.task?.[0] != "leave_edge") htn.replan(planner);
      }
    }

    if (planner.world.customsHold) continue;

    if (planner.world.ordered && planner.world.currentJob) {
      const job = jobQueueFor(state.ecs, id).find(j => j.assignedId == id);
      if (job && (job.favourId ? requestForTask(state, job)?.status != "accepted" : !job.gatheredDone && !state.ecs.spatial[job.targetId])) deferPlayerTask(state);
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
    while (!planner.world.customsHold && !planner.task && planner.plan) {
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
export function createSimulation(state, { onHour, onTravel, onError } = {}) {
  let pending = null;
  const background = fn => {
    state.worldBusy = true;
    if(onHour) onHour();
    pending = fn().then(() => { state.worldBusy=false; pending=null; }).catch(error => { state.worldBusy=false; pending=null; state.travelError=String(error.stack || error); state.game_speed="paused"; if(onError) onError(error); else console.error(error); });
    return pending;
  };
  let hour = 0;
  let requestsStarted = false;
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
          if (person.dead || !isResident(state,id)) continue;
          person.tiredness += time.HOUR;
          person.hunger += time.HOUR;
          person.starving = person.hunger > 2.5;
          if (person.hunger > 6 + 1e-12) starve(state, id);
        }

        const nowWinter = time.season(state.days) == "winter";
        if (winter != nowWinter) {
          state.redraws.push(...Object.keys(state.ecs.forageable || {}));
          winter = nowWinter;
        }
        // Sample every crossed hour, including season boundaries.
        updateEnvironment(state);
        drift(state, 1);
        socialHour(state);
        updateFavours(state);
        if (onHour) {
          onHour();
        }
        state.days = end;
      }
    }
  };

  return {
    get pending() { return pending; },
    step(frameMod, realSeconds = frameMod / 60) {
      if(pending || state.travelError) return pending;
      const arriving = introActive(state);
      updateIntro(state, realSeconds);
      if (arriving) return;
      if (!requestsStarted) { updateFavours(state); requestsStarted = true; }
      updateCustoms(state);
      updatePlanners(state, frameMod);
      if(state.pendingPlayerTravel) {
        const order=state.pendingPlayerTravel;delete state.pendingPlayerTravel;
        return background(async()=>{await completeTravel(state,order);if(onTravel)onTravel();});
      }
      for(const {id,intent} of state.pendingNpcDepartures||[])departNpc(state,id,intent);
      state.pendingNpcDepartures=[];
      advanceTime(frameMod);
      if(state.travel && (state.travel.season < Math.floor(state.days/3) || state.travel.transit.some(t=>t.due<=state.days+1e-9))) {
        return background(()=>advanceWorldClock(state));
      }
      if (SPEED[state.game_speed]) updateVillageLife(state);
    }
  };
}
