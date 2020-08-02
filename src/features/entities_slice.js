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
    discoverTiles(state, action) {
      const { id, tiles } = action.payload;
      state.components.playable[id].known.push(...tiles);
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
    state => state.entities.components.renderable
  ],
  (components, renderables) => {
    const keys = Object.keys(components || {});

    var result = [];
    for (var i = 0; i < keys.length; i++) {
      var e = { ...components[keys[i]] };
      const r = renderables[keys[i]];
      if (r) {
        e.x = r.x;
        e.y = r.y;
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

export const { clearEntities, newEntities, discoverTiles } = entitiesSlice.actions;
export default entitiesSlice.reducer;
