import { takeEvery, all } from "redux-saga/effects";
import { generate, generateMap } from "features/map_slice";

export default function* baseSaga() {
  console.log("Hello saga");
  yield all([
    takeEvery(generate, generateMap),
  ]);
}
