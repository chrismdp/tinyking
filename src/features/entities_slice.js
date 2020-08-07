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
    }
  }
});

export const getNextEntity = state => state.entities.next;

export const getAllComponents = (...types) => createSelector(
  types.map(t => state => ([ t, state.entities.components[t] || {} ])),
  (...pairs) => Object.values(pairs.reduce((result, pair) => {
    const [type, components] = pair;
    Object.values(components).forEach(e => {
      if (type == types[0]) { // Inner join only
        result[e.id] = result[e.id] || {};
      }
      if (e.id in result) {
        result[e.id][type] = e;
      }
    });
    return result;
  }, {}))
);

export const getEntity = id => state => (
  Object.keys(state.entities.components).reduce((result, name) => (
    {...result, [name]: Object.values(state.entities.components[name]).filter(c => c.id == id)[0]}), {}));

export const getPlayerId = state => {
  if (state.entities.components.playable) {
    return Object.values(state.entities.components.playable)[0].id;
  } else {
    return null;
  }
};

export const { clearEntities, newEntities, discoverTiles, assign } = entitiesSlice.actions;
export default entitiesSlice.reducer;
