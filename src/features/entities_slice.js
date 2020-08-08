import { createSelector, createSlice } from "@reduxjs/toolkit";

const blankEntities = { nextId: 1, components: {} };

const entitiesSlice = createSlice({
  name: "entities",
  initialState: blankEntities,
  reducers: {
    clearEntities() {
      return blankEntities;
    },
    newEntities(state, action) {
      var nextId = state.nextId;
      const entities = action.payload;
      for (var i = 0; i < entities.length; i++) {
        const entity = entities[i];
        const components = Object.keys(entity);
        for (var c = 0; c < components.length; c++) {
          const name = components[c];
          if (!(name in state.components)) {
            state.components[name] = {};
          }
          if (entity[name]) {
            state.components[name][nextId] = { ...entity[name], id: nextId };
          }
        }
        nextId++;
      }
      state.nextId = nextId;
    },
    // TODO: This probably belongs in a "playable slice" below this slice
    discoverTiles(state, action) {
      const { id, tiles } = action.payload;
      state.components.playable[id].known.push(...tiles);
    },
    assign(state, action) {
      const { id, task } = action.payload;
      state.components.assignable[id].task = task;
      state.components.spatial[id].x = task.hex.x;
      state.components.spatial[id].y = task.hex.y;
    },
    moveIn(state, action) {
      action.payload.forEach(m => {
        state.components.habitable[m.habitable].owners =
          [ ...state.components.habitable[m.habitable].owners, m.personable];
      });
    }
  }
});

export const getNextEntity = state => state.entities.next;

export const getAllComponents = (...types) => createSelector(
  types.map(t => state => state.entities.components[t]),
  (...components) => Object.values(components.filter(c => !!c).reduce((result, c, i) => {
    Object.values(c).forEach(e => {
      if (i == 0) { // Only first component gets all ids
        result[e.id] = result[e.id] || {};
      }
      if (e.id in result) {
        result[e.id][types[i]] = e;
      }
    });
    return result;
  }, {}))
);

export const getEntitiesByTile = (...types) => createSelector(
  ["spatial", ...types].map(t => state => state.entities.components[t]),
  (spatials, ...components) => components.filter(c => !!c).reduce((result, c, i) => {
    Object.values(c).forEach(e => {
      const s = spatials[e.id];
      const key = s.x + "," + s.y;
      result[key] = result[key] || {};
      if (i == 0) { // Only first component gets all ids
        result[key][e.id] = result[key][e.id] || { id: e.id };
      }
      if (e.id in result[key]) {
        result[key][e.id][types[i]] = e;
      }
    });
    return result;
  }, {})
);

export const getEntity = id => state => (
  Object.keys(state.entities.components).reduce((result, name) => (
    {...result, [name]: Object.values(state.entities.components[name]).filter(c => c.id == id)[0]}), {id: id}));

export const getPlayerId = state => {
  if (state.entities.components.playable) {
    return Object.values(state.entities.components.playable)[0].id;
  } else {
    return null;
  }
};

export const { moveIn, clearEntities, newEntities, discoverTiles, assign } = entitiesSlice.actions;
export default entitiesSlice.reducer;
