import { takeEvery } from "redux-saga/effects";
import { generate, generateMap } from "features/map_slice";

export default function* baseSaga() {
  console.log("Hello saga");
  yield takeEvery(generate, generateMap);
}
