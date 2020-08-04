import { takeEvery, call, all } from "redux-saga/effects";
import { generate, generateMap } from "features/map_slice";
import { tutorial } from "features/ui_slice";
import { startGame } from "features/ui_slice";

export default function* baseSaga() {
  yield all([
    takeEvery(generate, generateMap),
    takeEvery(startGame, tutorial),
  ]);

  // Get the map generating each time we reload for now
  var seed = Math.round((yield call(Math.random)) * 10000000);
  yield call(generateMap, generate({ seed }));
}
