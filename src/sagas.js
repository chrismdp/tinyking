import { debounce, call, all } from "redux-saga/effects";
import { generate, generateMap } from "features/map_slice";
import { tutorial, startGame } from "features/ui_slice";
import { handleEndTurn, endTurn } from "features/turn_slice";

export default function* baseSaga() {
  yield all([
    debounce(200, generate, generateMap),
    debounce(200, startGame, tutorial),
    debounce(200, endTurn, handleEndTurn)
  ]);

  // Get the map generating each time we reload for now
  var seed = Math.round((yield call(Math.random)) * 10000000);
  yield call(generateMap, generate({ seed }));
}
