import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { formatTime } from './utils';

describe('formatTime', () => {
  // Fixed "now": Wednesday, Jan 10, 2024, 12:00:00 UTC
  // We use a fixed date to ensure deterministic calculations for "days ago".
  const NOW_ISO = '2024-01-10T12:00:00Z';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns time format for messages within 24 hours (days === 0)', () => {
    // 1 hour ago: 2024-01-10T11:00:00Z
    const date = new Date('2024-01-10T11:00:00Z');
    const result = formatTime(date.getTime());

    // The output depends on the execution environment's timezone and locale.
    // We expect a time string like "11:00 AM" or "11:00".
    // Since we can't easily guarantee the timezone of the test runner,
    // we verify the format roughly (digits and colon).
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('returns "Yesterday" for messages between 24 and 48 hours ago (days === 1)', () => {
    // 25 hours ago: 2024-01-09T11:00:00Z
    const date = new Date('2024-01-09T11:00:00Z');
    const result = formatTime(date.getTime());
    expect(result).toBe('Yesterday');
  });

  it('returns weekday for messages between 48 hours and 7 days ago (days < 7)', () => {
    // 3 days ago: 2024-01-07T12:00:00Z (Sunday)
    // 10th is Wed. 9th is Tue. 8th is Mon. 7th is Sun.
    const date = new Date('2024-01-07T12:00:00Z');
    const result = formatTime(date.getTime());

    // { weekday: "long" } -> "Sunday"
    expect(result).toBe('Sunday');
  });

  it('returns date for messages 7 days or older', () => {
    // 7 days ago: 2024-01-03T12:00:00Z
    // 10 - 7 = 3. Jan 3.
    const date = new Date('2024-01-03T12:00:00Z');
    const result = formatTime(date.getTime());

    // { month: "short", day: "numeric" } -> "Jan 3"
    expect(result).toBe('Jan 3');
  });

  it('handles future dates by falling back to weekday (days < 0 which is < 7)', () => {
    // 1 day in the future: 2024-01-11T12:00:00Z (Thursday)
    const date = new Date('2024-01-11T12:00:00Z');
    const result = formatTime(date.getTime());

    // Current logic: diff is negative, days is -1.
    // -1 < 7 is true. Returns weekday.
    expect(result).toBe('Thursday');
  });
});
