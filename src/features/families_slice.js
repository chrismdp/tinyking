import { createSlice } from "@reduxjs/toolkit";
import { delay, takeEvery, select, put } from "redux-saga/effects";
import { newEntities, getAllComponentsWithXY } from "features/entities_slice";

import MersenneTwister from "mersenne-twister";

const familiesSlice = createSlice({
  name: "families",
  initialState: {},
  reducers: {
    generateFamilies() {},
  }
});

const HAIR = {
  red: 0xAA733B,
  brown: 0x292021,
  black: 0x20232A,
  blonde: 0xDEC984
};

const BODY_MALE = 0x4E3F30;
const BODY_FEMALE = 0x3B6071;

function* generateFamiliesSaga(action) {
  const { seed } = action.payload;
  var people = [];
  var generator = new MersenneTwister(seed);
  var habitables = yield select(getAllComponentsWithXY("habitable"));
  var hair = Object.values(HAIR);
  for (var i = 0; i < habitables.length; i++) {
    var habitable = habitables[i];
    const familySize = 1 + (generator.random_int() % 5);
    for (var p = 0; p < familySize; p++) {
      people.push({
        nameable: { type: "person", seed: generator.random_int() },
        renderable: {
          x: habitable.x,
          y: habitable.y,
          type: "person",
          familyIndex: p / (familySize * 1.5),
          size: p > 1 ? 12 : 20,
          hair: hair[generator.random_int() % hair.length],
          body: generator.random_int() % 2 == 0 ? BODY_MALE : BODY_FEMALE
        }
      });
    }
    if (i % 50 == 0) {
      yield delay(10);
    }
  }
  yield put(newEntities(people));
}

export function* familySaga() {
  yield takeEvery(generateFamilies, generateFamiliesSaga);
}

export const { generateFamilies } = familiesSlice.actions;
export default familiesSlice.reducer;
