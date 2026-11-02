import { updatePersonCell } from "game/people_space";
import { updateFestival, seasonTurnAt } from "game/seasons";
import { DAYS_IN_SEASON } from "game/time";
import { playerDay, daylight } from "game/energy";
import { updateOverhearing } from "game/chat_bubbles";
import { updateCampfireVisits } from "game/campfire_visits";
import { updateNeeds } from "game/needs";
import { updateCustoms } from "game/village_customs";
import { actualHome, nightTime, validateHome, leaveHome } from "game/home";
import { updateEnvironment } from "game/environment";
import { withFenceCache } from "game/fences";
import { gardenHelp, withGardenHelpIndex, refreshGardenHelpIndex } from "game/household_routines";
import { advanceWorldClock, completeTravel, departNpc, updateJourney } from "game/travel";
import { isResident } from "game/residents";
import { updateFavours, fuelReady, requestForTask } from "game/favours";
import { friendWork, friendEligible, friendWorkWanted, releaseFriendWork } from "game/friend_help";
import { socialHour } from "game/social_visits";
import { resolveSuccession } from "game/succession";
import * as htn from "game/htn";
import { introActive, updateIntro } from "game/intro";
import * as time from "game/time";
import { updateWeather } from "game/weather";
import { drift } from "game/people";
import { topController } from "game/playable";
import { jobQueueFor, readyPlayerTasks, deferPlayerTask, expireChatApproach, cancelTask } from "game/manager";

import { updateVillageLife } from "game/villages";




export const SPEED = {
  paused: 0,
  normal: 360
};

const SECONDS_PER_FRAME = 1 / 60;
const DAYS = 86400;

export const deltaTime = (frameMod, speed) => frameMod * SECONDS_PER_FRAME * (speed || 0) / DAYS;

const playerDied = state => {
  const id=state.ui?.playerId;
  return state.ecs.playable?.[id]?.arrivedAt != null && state.ecs.personable?.[id]?.dead && state.ecs.personable[id].deathProcessed;
};
const IDLE_PLAN = () => [["wait_for", time.HOUR * 0.5]];

function updatePlanners(state, frameMod) {
  if (SPEED[state.game_speed] == 0) return;
  return withFenceCache(state, () => withGardenHelpIndex(state, () => updatePlannerFrame(state, frameMod)));
}
function updatePlannerFrame(state, frameMod) {
  const childrenByHome = new Map();
  for (const [id, child] of Object.entries(state.ecs.personable || {})) if (!child.dead && child.age >= 6 && child.age < 18 && isResident(state, id)) {
    const home = state.ecs.household?.[id]?.houseId;
    if (!childrenByHome.has(home)) childrenByHome.set(home, []);
    childrenByHome.get(home).push(id);
  }
  expireChatApproach(state);
  for (const id in state.ecs.planner) {
    const planner = state.ecs.planner[id];
    validateHome(state, id);
    if (state.ecs.personable[id] && (state.ecs.personable[id].dead || !isResident(state,id))) continue;

    updatePersonCell(state,id);
    planner.world.actorId = id;
    planner.world.stationaryPlayer = id == state.ui.playerId;
    if (planner.world.ordered && planner.world.stationaryPlayer) {
      const wasWorking = planner.world.playerWorking;
      planner.world.playerWorking = !!planner.world.currentJob || readyPlayerTasks(state).length > 0;
      if (wasWorking && !planner.world.playerWorking && !["eat", "sleep"].includes(planner.task?.[0])) {
        planner.task = null; planner.plan = null;
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
    refreshGardenHelpIndex(state, id);
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
      if ((id != state.ui.playerId || !planner.world.ordered) && !planner.world.festivalPlace && !planner.world.feeling.tired && person.tiredness > 0.9) {
        planner.world.feeling.tired = true;
        if(planner.task?.[0] != "leave_edge") htn.replan(planner);
      }
      if ((id != state.ui.playerId || !planner.world.ordered) && !planner.world.festivalPlace && !planner.world.feeling.hungry && person.hunger > 0.9) {
        planner.world.feeling.hungry = true;
        if(planner.task?.[0] != "leave_edge") htn.replan(planner);
      }
    }


    if (planner.world.ordered && planner.world.currentJob) {
      const job = jobQueueFor(state.ecs, id).find(j => j.assignedId == id);
      if (job && (job.favourId ? requestForTask(state, job)?.status != "accepted" : !job.gatheredDone && job.job.key!="eat_food" && !state.ecs.spatial[job.targetId])) deferPlayerTask(state);
    }
    if (planner.world.ordered && !planner.world.forcedRest && !planner.world.currentJob && planner.plan &&
      !planner.world.feeling.hungry && !planner.world.feeling.tired &&
      !["eat", "sleep", "forage"].includes(planner.task?.[0]) && readyPlayerTasks(state).length) {
      planner.task = null;
      planner.plan = null;
    }

    // Re-plan
    if (!planner.plan) {
      if (planner.task) {
        // A player's meal has already consumed real food. A new need must not apply
        // its predicted fed/rested effect before the timed care finishes.
        if (planner.id == state.ui.playerId && ["eat", "sleep", "recover_meal"].includes(planner.task[0])) {
          htn.runTask(state, planner, deltaTime(frameMod, SPEED[state.game_speed]), false);
          if (planner.task) continue;
        } else htn.finishTask(planner, planner.task);
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
    if (state.chat?.active) return;
    const dt = deltaTime(frameMod, SPEED[state.game_speed]);
    if (planner.task) {
      htn.runTask(state, planner, dt, false);
      if(state.chat?.active)return;
    }
    while (!planner.task && planner.plan) {
      if (planner.plan.length > 0) {
        planner.task = planner.plan.shift();
        if (topController(state.ecs, planner.id) == state.ui.playerId) {
          // console.log("NEW TASK", planner.id, planner.task);
        }
        htn.runTask(state, planner, dt, true);
        if(state.chat?.active)return;
        // TODO: Make sure this happens only once
        state.redraws.push(planner.id);
      } else {
        htn.replan(planner);
      }
    }
    refreshGardenHelpIndex(state, id);
  }
}

// NOTE: The game itself, one frame at a time. Knows nothing about rendering:
// it changes ECS state and lists changed entities in state.redraws.
export function createSimulation(state, { onHour, onDay, onTravel, onError, onSleep } = {}) {
  let pending = null;
  // Old saves may contain several orders. Keep the active one and cancel the rest.
  const orders = state.ecs.manager?.[state.ui?.playerId]?.jobs;
  if (orders?.length > 1) {
    const keep = orders.find(j=>j.assignedId == state.ui.playerId) || orders[0];
    for (const order of [...orders]) if (order != keep) cancelTask(state,order.id);
  }
  if (!(state.game_speed in SPEED)) state.game_speed = "normal";
  const clock = state.simulationClock ||= { hour: 0, requestsStarted: false, winter: time.season(state.days) == "winter" };
  let savedDay = Math.floor(state.days);
  const dayChanged = () => {
    const day = Math.floor(state.days);
    if (day !== savedDay) { savedDay = day; if (onDay) onDay(); }
  };
  const background = fn => {
    state.worldBusy = true;
    if(onHour) onHour();
    pending = fn().then(() => { state.worldBusy=false; pending=null; dayChanged(); }).catch(error => { state.worldBusy=false; pending=null; state.travelError=String(error.stack || error); state.game_speed="paused"; if(onError) onError(error); else console.error(error); });
    return pending;
  };
  if (!state.weather) updateWeather(state, 0);

  const advanceTime = frameMod => {
    if (SPEED[state.game_speed]) {
      let toAdd = deltaTime(frameMod, SPEED[state.game_speed]);
      const turn=seasonTurnAt(state,state.days+toAdd);
      if(turn!=null)toAdd=Math.max(0,turn-state.days);
      state.days += toAdd;
      clock.hour += toAdd;
      while (clock.hour + 1e-12 >= time.HOUR) {
        clock.hour -= time.HOUR;
        const end = state.days;
        state.days = end - clock.hour;

        // FIXME: This potentially leads to frame spikes each hour
        for (const id in state.ecs.planner) {
          const planner = state.ecs.planner[id];
          planner.world.days = state.days;
        }

        updateNeeds(state);

        const nowWinter = time.season(state.days) == "winter";
        if (clock.winter != nowWinter) {
          state.redraws.push(...Object.keys(state.ecs.forageable || {}));
          clock.winter = nowWinter;
        }
        // Sample every crossed hour, including season boundaries.
        updateEnvironment(state);
        drift(state, 1);
        socialHour(state);
        updateFestival(state);
        updateFavours(state);
        if (onHour) {
          onHour();
        }
        state.days = end;
      }
    }
  };

  const stepWorld = (frameMod, realSeconds) => {
    if(pending || state.travelError || state.chat?.active || state.seasonTurn) return pending;
    if(playerDied(state))return background(async()=>{await resolveSuccession(state);if(onTravel)onTravel();});
    const arriving = introActive(state);
    updateIntro(state, realSeconds);
    if (arriving) return;
    if (!clock.requestsStarted) { updateFavours(state); clock.requestsStarted = true; }
    playerDay(state);
    updateCustoms(state);
    updateJourney(state);
    updateCampfireVisits(state);
    updatePlanners(state, frameMod);
    updateOverhearing(state);
    if (state.chat?.active) { if(onHour) onHour(); return; }
    // All edge completions belong to the map where planners just ran.
    for(const {id,intent} of state.pendingNpcDepartures||[])departNpc(state,id,intent);
    state.pendingNpcDepartures=[];
    if(state.pendingPlayerTravel) {
      const order=state.pendingPlayerTravel;delete state.pendingPlayerTravel;
      return background(async()=>{await completeTravel(state,order);if(playerDied(state))await resolveSuccession(state);if(onTravel)onTravel();});
    }
    advanceTime(frameMod);
    if(playerDied(state))return background(async()=>{await resolveSuccession(state);if(onTravel)onTravel();});
    if(state.travel && (state.travel.season < Math.floor(state.days/DAYS_IN_SEASON) || state.travel.transit.some(t=>t.due<=state.days+1e-9))) {
      return background(()=>advanceWorldClock(state));
    }
    if (SPEED[state.game_speed]) updateVillageLife(state);
    dayChanged();
  };
  const sleepingAtNight = () => {
    const p = state.ecs.planner?.[state.ui?.playerId];
    return p?.task?.[0] == "sleep" && !daylight(state.days) && !state.ecs.personable?.[state.ui.playerId]?.dead;
  };
  const updateSleep = realSeconds => {
    if (!state.nightSleep && sleepingAtNight()) {
      const dawn = Math.floor(state.days - 6/24) + 1 + 6/24;
      state.nightSleep = { dawn, fadeSeconds: 0 };
      state.ecs.planner[state.ui.playerId].world.sleepDawn = dawn;
      if (onSleep) onSleep();
    }
    const sleep = state.nightSleep;
    if (!sleep) return;
    sleep.fadeSeconds += realSeconds;
    if (state.days >= sleep.dawn - 1e-9 || !sleepingAtNight()) {
      if (state.days >= sleep.dawn - 1e-9) {
        state.ui.dayMessage = "Morning. The village stirs in the first light.";
        // Finish the sleep task at the dawn boundary without advancing the clock.
        updatePlanners(state,0);
      }
      delete state.nightSleep;
      if (onSleep) onSleep();
    }
  };
  return {
    get pending() { return pending; },
    step(frameMod, realSeconds = frameMod / 60) {
      if (state.nightSleep && !sleepingAtNight()) updateSleep(0);
      if (pending || state.chat?.active || state.seasonTurn || state.game_speed == "paused") return stepWorld(frameMod,realSeconds);
      updateSleep(realSeconds);
      if (state.nightSleep?.fadeSeconds >= .5 && sleepingAtNight()) {
        // Twelve game hours per real second, sampled at most a minute at a time.
        // Every sample runs the same planners, hourly needs, weather and festivals.
        let remaining = frameMod * 120;
        while (remaining > 1e-9 && state.nightSleep && !pending && !state.chat?.active && !state.seasonTurn && state.game_speed != "paused") {
          const untilDawn = (state.nightSleep.dawn - state.days) / deltaTime(1,SPEED.normal);
          const slice = Math.min(10,remaining,untilDawn);
          if (slice <= 1e-9) { updateSleep(0); break; }
          stepWorld(slice,0);
          remaining -= slice;
          updateSleep(0);
        }
        return pending;
      }
      const result = stepWorld(frameMod,realSeconds);
      updateSleep(0);
      return result;
    }
  };
}
