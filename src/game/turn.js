import Engine from "json-rules-engine-simplified";

import * as time from "game/time";
import turnRules from "data/turn.json";
import { fullEntity } from "game/entities";
import handleEvent from "game/events";
import removeExpiredTraits from "game/traits";
import { topController } from "game/playable";

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

async function applyActionRules(rules, payload, context, state) {
  const events = await validEventsFor(rules, payload);
  return events.map(event => handleEvent(event, payload, context, state)).flat();
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
    const controller = fullEntity(state.ecs, actor.personable.controller);
    const payload = { actor, target, controller };

    state.redraws = [...new Set([
      ...state.redraws,
      ...await applyActionRules(assignable.task.action.rules.me, actor, payload, state),
      ...await applyActionRules(assignable.task.action.rules.target, target, payload, state),
      target.id,
      actor.id
    ])];

    const spatial = state.ecs.spatial[actorId];
    const other = Object.values(state.ecs.spatial).filter(o => spatial.x == o.x && spatial.y == o.y && o.id != actor.id && o.id != target.id);
    for (const o of other) {
      state.redraws.push(o.id);
    }
  }
}

export function endTurnPayload(ecs, target, clock) {
  const topId = topController(ecs, target.id);
  return {
    target: target,
    season: time.season(clock),
    time_of_day: time.time(clock),
    controller: topId && fullEntity(ecs, topId)
  };
}

async function doEndTurnEffects(state) {
  // NOTE: The order of this will become important, as the people who are
  // processed first will be fed first!
  for (const tickableId in state.ecs.tickable) {
    const payload = endTurnPayload(state.ecs, fullEntity(state.ecs, tickableId), state.clock);
    const events = await validEventsFor(turnRules, payload);
    for (const event of events) {
      if (event.rules) {
        const set = new Set(state.redraws);
        for (const affected in event.rules) {
          const changed = await applyActionRules(event.rules[affected], payload[affected], payload, state);
          for (const change of changed) {
            set.add(change);
          }
        }
        state.redraws = [...set];
      }
    }
  }
}

function clearAssignableJobs(assignable) {
  for (const id in assignable) {
    delete assignable[id].task;
    delete assignable[id].base;
  }
}

export async function endTurn(state) {
  await doAssignableJobs(state);
  await doEndTurnEffects(state);
  state.clock++;
  clearAssignableJobs(state.ecs.assignable);
  removeExpiredTraits(state.ecs.traits, state.clock);
}
