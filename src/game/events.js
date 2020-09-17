import selectn from "selectn";

import { Grid, Hex } from "game/map";
import { entitiesAtLocations } from "game/spatial";
import { topController, directlyControlledBy } from "game/playable";

function mergeSupplies(target, incoming) {
  if (incoming && target) {
    Object.keys(incoming).filter(k => k != "id").forEach(k => {
      target[k] = (target[k] || 0) + incoming[k];
    });
  }
}

const handlers = {
  die: (key, param, payload) => {
    payload.personable.dead = true;
    return [ payload.id ];
  },
  add: (key, param, payload, context, state) => {
    if (typeof param !== "object") {
      throw "Add event must be passed an object" + JSON.stringify(param);
    }
    const a = selectn(key, payload);
    for (const k in param) {
      a[k] = (param[k] === true) ? true : param[k] + state.clock;
    }
    return [ payload.id ];
  },
  remove: (key, param, payload) => {
    const a = selectn(key, payload);
    delete a[param];
    return [ payload.id ];
  },
  set: (key, param, payload) => {
    for (const k in param) {
      selectn(key, payload)[k] = param[k];
    }
    return [ payload.id ];
  },
  gain: (key, param, payload) => {
    for (const k in param) {
      const thing = selectn(key, payload);
      if (key == "attributes") {
        thing[k] = Math.min(10, (thing[k] || 0) + param[k]);
      } else {
        thing[k] = (thing[k] || 0) + param[k];
      }
    }
    return [ payload.id ];
  },
  lose: (key, param, payload) => {
    for (const k in param) {
      const thing = selectn(key, payload);
      thing[k] = Math.max(0, (thing[k] || 0) - param[k]);
    }
    return [ payload.id ];
  },
  explore: (key, param, payload, context, state) => {
    const neighbours = Grid.hexagon({
      radius: param.radius,
      center: Hex(payload.spatial.x, payload.spatial.y)
    });
    const playable = state.ecs.playable[topController(state.ecs, payload.id)];
    const newTiles = neighbours.filter(hex => !playable.known.find(k => hex.x === k.x && hex.y === k.y));
    playable.known = [ ...playable.known, ...newTiles ];
    return [ payload.id, ...entitiesAtLocations(state.ecs, newTiles) ];
  },
  recruited: (key, param, payload, context, state) => {
    const thing = selectn(key, payload);
    const controllerId = context[param].id;
    [thing, ...directlyControlledBy(state.ecs, thing.id)].forEach(p => {
      p.controller = controllerId;
      mergeSupplies(state.ecs.supplies[controllerId], state.ecs.supplies[p.id]);
    });
    return [ payload.id, context[param].id ];
  }
};

export default function handleEvent(target, payload, context, state) {
  return [ ...Object.keys(target).reduce((redraws, key) => {
    if (key != "conditions") {
      const actions = target[key];
      for (const action in actions) {
        if (!(action in handlers)) {
          throw "Don't know how to process action: " + JSON.stringify([ action, target ]);
        }
        handlers[action](key, actions[action], payload, context, state).forEach(id => redraws.add(id));
      }
    }
    return redraws;
  }, new Set()) ];
}
