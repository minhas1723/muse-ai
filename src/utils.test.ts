import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatTime } from './utils';

describe('formatTime', () => {
  // Set a fixed "now" for all tests: Monday, January 8, 2024, 12:00:00 PM
  const NOW = new Date('2024-01-08T12:00:00');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns formatted time for messages less than 24 hours old', () => {
    // 1 hour ago: 11:00 AM
    const oneHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000);
    const result = formatTime(oneHourAgo.getTime());
    // Expect "11:00 AM" or similar depending on locale.
    // Using loose match for flexibility with locale defaults.
    expect(result).toMatch(/11:00/);

    // 23 hours ago: Still technically "today" in terms of strict 24h window logic
    const twentyThreeHoursAgo = new Date(NOW.getTime() - 23 * 60 * 60 * 1000);
    expect(formatTime(twentyThreeHoursAgo.getTime())).toMatch(/:/); // Just check it looks like time
  });

  it('returns "Yesterday" for messages between 24 and 48 hours old', () => {
    // 25 hours ago: Sunday, Jan 7, 11:00 AM
    const twentyFiveHoursAgo = new Date(NOW.getTime() - 25 * 60 * 60 * 1000);
    expect(formatTime(twentyFiveHoursAgo.getTime())).toBe('Yesterday');
  });

  it('returns weekday for messages between 2 and 7 days old', () => {
    // 3 days ago: Friday, Jan 5
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000);
    // 3 days ago is Friday
    expect(formatTime(threeDaysAgo.getTime())).toBe('Friday');

    // 6 days ago: Tuesday, Jan 2
    const sixDaysAgo = new Date(NOW.getTime() - 6 * 24 * 60 * 60 * 1000);
    expect(formatTime(sixDaysAgo.getTime())).toBe('Tuesday');
  });

  it('returns date for messages 7 days or older', () => {
    // 7 days ago: Monday, Jan 1, 2024
    const sevenDaysAgo = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Expect "Jan 1" or similar
    expect(formatTime(sevenDaysAgo.getTime())).toMatch(/Jan 1/);

    // 30 days ago: Dec 9, 2023
    const thirtyDaysAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(formatTime(thirtyDaysAgo.getTime())).toMatch(/Dec 9/);
  });
});
