import { describe, expect, test } from 'vitest';
import reducer, { inputChanged, scanSubmitted } from './scanSlice';

describe('scanSlice', () => {
  test('tracks the typed address', () => {
    expect(reducer(undefined, inputChanged('example.com')).input).toBe('example.com');
  });

  test('remembers whether the last answer came from the cache', () => {
    const state = reducer(undefined, scanSubmitted({ id: 'abc', cached: true }));
    expect(state.lastResponse).toEqual({ id: 'abc', cached: true, deduplicated: false });
  });
});
