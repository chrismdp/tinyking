import { fork, takeEvery, call, all } from "redux-saga/effects";
import { generate, generateMap } from "features/map_slice";
import { familySaga } from "features/families_slice";

export default function* baseSaga() {
  yield all([
    takeEvery(generate, generateMap),
    fork(familySaga)
  ]);

  // Get the map generating each time we reload for now
  var seed = Math.round((yield call(Math.random)) * 10000000);
  yield call(generateMap, generate({ seed }));
}
