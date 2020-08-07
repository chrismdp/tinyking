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
export const getAllComponents = type => createSelector(
  state => state.entities.components[type],
  components => {
    return Object.values(components || {});
  });
export const getAllComponentsWithXY = type => createSelector(
  [
    state => state.entities.components[type],
    state => state.entities.components.spatial
  ],
  (components, spatials) => {
    const keys = Object.keys(components || {});

    var result = [];
    for (var i = 0; i < keys.length; i++) {
      var e = { ...components[keys[i]] };
      const s = spatials[keys[i]];
      if (s) {
        e.x = s.x;
        e.y = s.y;
      }
      result.push(e);
    }
    return result;
  });

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
