import { configureStore } from '@reduxjs/toolkit';
import counterReducer from '../features/counter/counterSlice';
import mapReducer from '../features/map/mapSlice';

export const store = configureStore({
  reducer: {
    counter: counterReducer,
    map: mapReducer,
  },
});
