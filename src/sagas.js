import { fork, takeEvery, select, call, all } from "redux-saga/effects";
import { generate, generateMap, getMapSeed } from "features/map_slice";
import { familySaga } from "features/families_slice";

export default function* baseSaga() {
  yield all([
    takeEvery(generate, generateMap),
    fork(familySaga)
  ]);

  // Get the map generating each time we reload for now
  var seed = yield select(getMapSeed);
  yield call(generateMap, generate({ seed }));
}
