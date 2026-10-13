import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from '../services/api';
import scanReducer from '../features/scanSlice';

export function makeStore(preloadedState) {
  const store = configureStore({
    reducer: {
      scan: scanReducer,
      [api.reducerPath]: api.reducer,
    },
    middleware: (getDefault) => getDefault().concat(api.middleware),
    preloadedState,
  });
  setupListeners(store.dispatch);
  return store;
}
