import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatMinutes,
  fromManilaInput,
  manilaDate,
  manilaDayStart,
  toManilaInput,
  weekStart,
} from '@/lib/manilaTime';

describe('manilaTime', () => {
  it('uses the Manila calendar day, not UTC', () => {
    // 17:30 UTC on Nov 22 is 01:30 on Nov 23 in Manila.
    expect(manilaDate(new Date('2026-11-22T17:30:00Z'))).toBe('2026-11-23');
  });

  it('round-trips datetime-local values as Manila time', () => {
    const d = fromManilaInput('2026-11-23T08:05');
    expect(d.toISOString()).toBe('2026-11-23T00:05:00.000Z');
    expect(toManilaInput(d)).toBe('2026-11-23T08:05');
  });

  it('starts a Manila day at 16:00 UTC the day before', () => {
    expect(manilaDayStart('2026-11-23').toISOString()).toBe('2026-11-22T16:00:00.000Z');
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-01', -1)).toBe('2026-11-30');
  });

  it('finds the Monday of the week', () => {
    expect(weekStart('2026-11-23')).toBe('2026-11-23'); // Monday
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // Sunday belongs to the previous week
  });

  it('formats minutes as hours', () => {
    expect(formatMinutes(485)).toBe('8h 05m');
    expect(formatMinutes(0)).toBe('0h 00m');
  });
});
