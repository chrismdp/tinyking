import Engine from "json-rules-engine-simplified";

import * as time from "game/time";
import turnRules from "data/turn.json";
import { fullEntity } from "game/entities";
import handleEvent from "game/events";

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

async function applyActionRules(rules, payload) {
  const events = await validEventsFor(rules, payload);
  events.forEach(event => handleEvent(event, payload));
}

async function doAssignableJobs(state, known) {
  for (const actorId in state.ecs.assignable) {
    const assignable = state.ecs.assignable[actorId];
    if (!assignable.task) {
      // TODO: AI to pick a random eligible task?
      continue;
    }

    const actor = fullEntity(state.ecs, actorId);
    const target = fullEntity(state.ecs, assignable.task.id);

    applyActionRules(assignable.task.action.rules.me, actor);
    applyActionRules(assignable.task.action.rules.target, target);

    if (known.includes(assignable.task.id)) {
      state.redraws.push(assignable.task.id);
    }
    if (known.includes(actorId)) {
      state.redraws.push(actorId);
    }

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

async function doEndTurnEffects(state, known) {
  const season = time.season(state.clock);
  const time_of_day = time.time(state.clock);
  for (const tickableId in state.ecs.tickable) {
    const payload = { target: fullEntity(state.ecs, tickableId), season, time_of_day };
    const events = await validEventsFor(turnRules, payload);
    for (const event of events) {
      if (event.rules) {
        applyActionRules(event.rules.target, payload.target);
      }
      if (known.includes(tickableId)) {
        state.redraws.push(tickableId);
      }
    }
  }
}

export async function endTurn(state, known) {
  await doEndTurnEffects(state, known);
  await doAssignableJobs(state, known);
  state.clock++;
}
