import { takeEvery } from "redux-saga/effects";
import { generate } from "features/map_slice";

import { generateMap } from "sagas/map";

export default function* baseSaga() {
  console.log("Hello saga");
  yield takeEvery(generate, generateMap);
}
