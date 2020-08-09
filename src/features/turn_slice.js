import { createSlice } from "@reduxjs/toolkit";

const turnSlice = createSlice({
  name: "turn",
  initialState: {
    turn: 1
  },
  reducers: {
    endTurn(state) {
      state.turn++;
    }
  }
});

export function* handleEndTurn() {
  console.log("END TURN");
}

export const { endTurn } = turnSlice.actions;
export default turnSlice.reducer;
