import { describe, expect, test } from 'vitest';
import { isFinished, shortUrl, timeAgo } from './format';

describe('format helpers', () => {
  test('shortUrl drops the scheme and a bare slash', () => {
    expect(shortUrl('https://example.com/')).toBe('example.com');
    expect(shortUrl('https://example.com/login?a=1')).toBe('example.com/login?a=1');
  });

  test('timeAgo', () => {
    const now = Date.parse('2026-10-13T10:00:00Z');
    expect(timeAgo('2026-10-13T09:59:30Z', now)).toBe('30s ago');
    expect(timeAgo('2026-10-13T09:15:00Z', now)).toBe('45m ago');
    expect(timeAgo('2026-10-13T07:00:00Z', now)).toBe('3h ago');
  });

  test('isFinished', () => {
    expect(['queued', 'running', 'completed', 'failed'].map(isFinished)).toEqual([false, false, true, true]);
  });
});
