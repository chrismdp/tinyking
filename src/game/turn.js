import { fullEntity } from "game/entities";
import Engine from "json-rules-engine-simplified";
import selectn from "selectn";

export async function validEventsFor(rules, payload) {
  return rules ? await new Engine(rules.map(r => ({ conditions: {}, ...r }))).run(payload) : [];
}

async function applyActionRules(rules, payload) {
  const events = await validEventsFor(rules, payload);
  events.forEach(event => {
    for (const key in event) {
      if (event[key].add) {
        const a = selectn(key, payload);
        if (!a.includes(event[key].add)) {
          a.push(event[key].add);
        }
      } else if (event[key].remove) {
        const a = selectn(key, payload);
        for (let i = a.length - 1; i >= 0; i--) {
          if (event[key].remove === a[i]) {
            a.splice(i, 1);
          }
        }
      } else if (event[key].change) {
        const a = selectn(key, payload);
        for (let i = a.length - 1; i >= 0; i--) {
          if (event[key].change[0] === a[i]) {
            a[i] = event[key].change[1];
          }
        }
      } else if (event[key].set) {
        for (const k in event[key].set) {
          selectn(key, payload)[k] = event[key].set[k];
        }
      } else if (event[key].gain) {
        for (const k in event[key].gain) {
          const thing = selectn(key, payload);
          thing[k] = (thing[k] || 0) + event[key].gain[k];
        }
      } else if (event[key].lose) {
        for (const k in event[key].lose) {
          const thing = selectn(key, payload);
          thing[k] = (thing[k] || 0) - event[key].lose[k];
        }
      } else {
        throw "Don't know how to process event: " + JSON.stringify([ key, event[key] ]);
      }
    }
  });
}

async function doAssignableJobs(state) {
  for (const actorId in state.ecs.assignable) {
    const assignable = state.ecs.assignable[actorId];
    if (!assignable.task) {
      // TODO: AI to pick a random eligible task?
    }

    const actor = fullEntity(state.ecs, actorId);
    const target = fullEntity(state.ecs, assignable.task.id);

    applyActionRules(assignable.task.action.rules.me, actor);
    applyActionRules(assignable.task.action.rules.target, target);

    state.redraws.push(assignable.task.id);
    state.redraws.push(actorId);

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
}

export async function endTurn(state) {
  state.clock++;
  await doAssignableJobs(state);
  await doEndTurnEffects(state);
}
