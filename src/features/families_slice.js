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
  red: 0x8D3633,
  brown: 0x292021,
  black: 0x20232A,
  blonde: 0x957E3C
};
const hair = Object.values(HAIR);

const BODY_MALE = 0x4E3F30;
const BODY_FEMALE = 0x3B6071;

function generateFamily(size, x, y, generator) {
  var result = [];
  for (var p = 0; p < size; p++) {
    result.push({
      nameable: { type: "person", seed: generator.random_int() },
      renderable: {
        x, y,
        type: "person",
        familyIndex: p / (size * 1.5),
        size: p > 1 ? 12 : 20,
        hair: hair[generator.random_int() % hair.length],
        body: generator.random_int() % 2 == 0 ? BODY_MALE : BODY_FEMALE
      }
    });
  }
  return result;
}

function* generateFamiliesSaga(action) {
  const { seed, playerStart } = action.payload;
  var people = [];
  var generator = new MersenneTwister(seed);
  var habitables = yield select(getAllComponentsWithXY("habitable"));
  for (var i = 0; i < habitables.length; i++) {
    var habitable = habitables[i];
    if (habitable.x == playerStart.x && habitable.y == playerStart.y) {
      const player = { ...generateFamily(1, habitable.x, habitable.y, generator)[0],
        playable: { known: [] },
      };
      people = [ ...people, player ];
    } else {
      const familySize = 1 + (generator.random_int() % 5);
      people = [ ...people, ...generateFamily(familySize, habitable.x, habitable.y, generator) ];
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
