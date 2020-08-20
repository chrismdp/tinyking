import { fullEntity } from "game/entities";
import Engine from "json-rules-engine-simplified";
import selectn from "selectn";

export async function validEvents(ecs, actorId, targetId, action) {
  const rules = action.rules.map(r => ({ conditions: {}, ...r }));
  const target = fullEntity(ecs, targetId);
  const me = fullEntity(ecs, actorId);
  const spatial = ecs.spatial[actorId];
  const other = Object.values(ecs.spatial).filter(o => spatial.x == o.x && spatial.y == o.y && o.id != me.id && o.id != target.id);
  const payload = { target, me, other };
  const events = await new Engine(rules).run(payload);
  return { events, payload };
}

export async function endTurn(state) {
  state.clock++;
  for (const actorId in state.ecs.assignable) {
    const assignable = state.ecs.assignable[actorId];
    if (!assignable.task) {
      // TODO: AI to pick a random eligible task?
    }

    const { events, payload } = await validEvents(state.ecs, actorId, assignable.task.id, assignable.task.action);

    state.redraws.push(assignable.task.id);
    state.redraws.push(actorId);
    for (const o of payload.other) {
      state.redraws.push(o.id);
    }

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
    payload.me.assignable.task = null;
    payload.me.spatial.x = state.ecs.spatial[payload.me.homeable.home].x;
    payload.me.spatial.y = state.ecs.spatial[payload.me.homeable.home].y;
  }
}
