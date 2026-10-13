import { createSlice } from '@reduxjs/toolkit';

// UI state that is not server data: what is typed in the box and whether
// the last answer came from the cache.
const scanSlice = createSlice({
  name: 'scan',
  initialState: { input: '', lastResponse: null },
  reducers: {
    inputChanged(state, action) {
      state.input = action.payload;
    },
    scanSubmitted(state, action) {
      const { id, cached, deduplicated } = action.payload;
      state.lastResponse = { id, cached: Boolean(cached), deduplicated: Boolean(deduplicated) };
    },
  },
});

export const { inputChanged, scanSubmitted } = scanSlice.actions;
export default scanSlice.reducer;

export const selectInput = (state) => state.scan.input;
export const selectLastResponse = (state) => state.scan.lastResponse;
