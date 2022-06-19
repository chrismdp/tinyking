import { configureStore } from '@reduxjs/toolkit';
import counterReducer from '../features/counter/counterSlice';
import mapReducer from '../features/map/mapSlice';
import uiReducer from '../features/ui/uiSlice';

export const store = configureStore({
  reducer: {
    counter: counterReducer,
    map: mapReducer,
    ui: uiReducer
  },
});
