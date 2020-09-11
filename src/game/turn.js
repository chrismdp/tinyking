import Engine from "json-rules-engine-simplified";

import * as time from "game/time";
import turnRules from "data/turn.json";
import { fullEntity } from "game/entities";
import handleEvent from "game/events";
import removeExpiredTraits from "game/traits";

export async function validEventsFor(rules, payload) {
  if (!rules) {
    return [];
  }
  const rulesWithConditions = rules.map(r => ({ conditions: {}, ...{...r, event: {
    conditions: r.conditions || {},
    ...r.event
  } } }));
  return await new Engine(rulesWithConditions).run(payload);
}

async function applyActionRules(rules, payload, state) {
  const events = await validEventsFor(rules, payload);
  return events.map(event => handleEvent(event, payload, state)).flat();
}

async function doAssignableJobs(state) {
  for (const actorId in state.ecs.assignable) {
    const assignable = state.ecs.assignable[actorId];
    if (!assignable.task) {
      // TODO: AI to pick a random eligible task?
      continue;
    }

    const actor = fullEntity(state.ecs, actorId);
    const target = fullEntity(state.ecs, assignable.task.id);

    state.redraws = [...new Set([
      ...state.redraws,
      ...await applyActionRules(assignable.task.action.rules.me, actor, state),
      ...await applyActionRules(assignable.task.action.rules.target, target, state),
      target.id,
      actor.id
    ])];

    const spatial = state.ecs.spatial[actorId];
    const other = Object.values(state.ecs.spatial).filter(o => spatial.x == o.x && spatial.y == o.y && o.id != actor.id && o.id != target.id);
    for (const o of other) {
      state.redraws.push(o.id);
    }

    // Clear action
    actor.assignable.task = null;
    // Return home
    actor.spatial.x = state.ecs.spatial[actor.homeable.home].x;
    actor.spatial.y = state.ecs.spatial[actor.homeable.home].y;
  }
}

async function doEndTurnEffects(state) {
  const season = time.season(state.clock);
  const time_of_day = time.time(state.clock);
  for (const tickableId in state.ecs.tickable) {
    const payload = { target: fullEntity(state.ecs, tickableId), season, time_of_day };
    const events = await validEventsFor(turnRules, payload);
    for (const event of events) {
      if (event.rules) {
        state.redraws = [
          ...state.redraws,
          await applyActionRules(event.rules.target, payload.target, state)
        ];
      }
    }
  }
}

export async function endTurn(state) {
  await doAssignableJobs(state);
  await doEndTurnEffects(state);
  state.clock++;
  removeExpiredTraits(state.ecs.traits, state.clock);
}
