import { fullEntity } from "game/entities";
import Engine from "json-rules-engine-simplified";
import selectn from "selectn";

export async function endTurn(state) {
  state.clock++;
  for (const id in state.ecs.assignable) {
    const assignable = state.ecs.assignable[id];
    if (!assignable.task) {
      // TODO: AI to pick a random eligible task?
    }
    const rules = assignable.task.action.rules.map(r => ({ conditions: {}, ...r }));
    const target = fullEntity(state.ecs, assignable.task.id);
    const me = fullEntity(state.ecs, id);
    const spatial = state.ecs.spatial[id];
    const other = Object.values(state.ecs.spatial).filter(o => spatial.x == o.x && spatial.y == o.y && o.id != me.id && o.id != target.id);
    const payload = { target, me, other };
    const events = await new Engine(rules).run(payload);

    state.redraws.push(target.id);
    state.redraws.push(me.id);
    for (const o of other) {
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
    me.assignable.task = null;
    me.spatial.x = state.ecs.spatial[me.homeable.home].x;
    me.spatial.y = state.ecs.spatial[me.homeable.home].y;
  }
}
