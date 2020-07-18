import { createSlice } from "@reduxjs/toolkit";
import * as Honeycomb from "honeycomb-grid";
import * as mapgen from "mapgen";

const hexSize = 50;
const mapRadius = 50;

const Hex = Honeycomb.extendHex({
  size: hexSize,
  orientation: "flat"
});
const Grid = Honeycomb.defineGrid(Hex);

const mapSlice = createSlice({
  name: "map",
  initialState: {
    seed: "12345",
    landscape: [],
    pointWidth: 0,
    pointHeight: 0
  },
  reducers: {
    generate(state, action) {
      const { seed } = action.payload;
      console.log("generate", action.payload);
      const grid = Grid.rectangle({width: mapRadius * 2, height: mapRadius * 2});
      const pointWidth = grid.pointWidth();
      const pointHeight = grid.pointHeight();
      const landscape = mapgen.generate(grid, seed);
      return Object.assign({}, state, { seed, landscape, pointWidth, pointHeight });
    }
  }
});

export const { generate } = mapSlice.actions;
export default mapSlice.reducer;
