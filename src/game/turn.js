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

export async function startJob(state, actorId, task) {
  const assignable = state.ecs.assignable[actorId];
  delete assignable.task;
  if (task.action.turns > 0) {
    assignable.task = task;
    assignable.endTime = state.clock + task.action.turns;
    state.redraws.push(actorId);
  } else {
    await finishJob(state, actorId, task);
  }
}

export async function finishJob(state, actorId, task) {
  const actor = fullEntity(state.ecs, actorId);
  const target = fullEntity(state.ecs, task.id);
  const controller = fullEntity(state.ecs, actor.personable.controller);

  const payload = { actor, target, controller };

  state.redraws = [...new Set([
    ...state.redraws,
    ...await applyActionRules(task.action.rules.me, actor, payload, state),
    ...await applyActionRules(task.action.rules.target, target, payload, state),
    ...await applyActionRules(task.action.rules.controller, controller, payload, state),
    target.id,
    actor.id
  ])];

  const spatial = state.ecs.spatial[actorId];
  const other = Object.values(state.ecs.spatial).filter(o => spatial.x == o.x && spatial.y == o.y && o.id != actor.id && o.id != target.id);
  for (const o of other) {
    state.redraws.push(o.id);
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

function tickAssignedJobs(state) {
  for (const id in state.ecs.assignable) {
    const assignable = state.ecs.assignable[id];
    if (assignable.task && state.clock >= assignable.endTime) {
      finishJob(state, id, assignable.task);
      delete assignable.task;
    }
  }
}

export async function endTurn(state) {
  await doEndTurnEffects(state);
  state.clock++;
  tickAssignedJobs(state);
  removeExpiredTraits(state.ecs.traits, state.clock);
}
