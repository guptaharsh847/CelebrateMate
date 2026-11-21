import { describe, expect, it } from 'vitest';
import {
  addDays,
  diffInDays,
  isLeapYear,
  isValidISODate,
  nextOccurrence,
  occurrenceInYear,
  ordinal,
  parseISODate,
  todayInTimeZone,
  yearsAtOccurrence,
} from './date';

describe('parseISODate / isValidISODate', () => {
  it('parses valid dates', () => {
    expect(parseISODate('1990-11-20')).toEqual({ year: 1990, month: 11, day: 20 });
  });

  it('rejects malformed and impossible dates', () => {
    expect(isValidISODate('1990-13-01')).toBe(false);
    expect(isValidISODate('1990-02-30')).toBe(false);
    expect(isValidISODate('1990-2-3')).toBe(false);
    expect(isValidISODate('2023-02-29')).toBe(false);
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('')).toBe(false);
    expect(isValidISODate(null)).toBe(false);
  });
});

describe('isLeapYear', () => {
  it('follows Gregorian rules', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });
});

describe('addDays / diffInDays across boundaries', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between dates', () => {
    expect(diffInDays('2026-12-30', '2027-01-02')).toBe(3);
    expect(diffInDays('2026-11-20', '2026-11-20')).toBe(0);
    expect(diffInDays('2026-11-21', '2026-11-20')).toBe(-1);
  });
});

describe('todayInTimeZone', () => {
  it('uses Asia/Kolkata, not the runtime timezone', () => {
    // 19:00 UTC on 20 Nov is 00:30 IST on 21 Nov.
    expect(todayInTimeZone('Asia/Kolkata', new Date('2026-11-20T19:00:00Z'))).toBe('2026-11-21');
    // 18:29 UTC is still 23:59 IST on the same day.
    expect(todayInTimeZone('Asia/Kolkata', new Date('2026-11-20T18:29:00Z'))).toBe('2026-11-20');
  });
});

describe('February 29 policy', () => {
  const leap = { year: 2000, month: 2, day: 29 };

  it('keeps Feb 29 in leap years', () => {
    expect(occurrenceInYear(leap, 2028, 'FEB_28')).toEqual({ year: 2028, month: 2, day: 29 });
    expect(occurrenceInYear(leap, 2028, 'MAR_1')).toEqual({ year: 2028, month: 2, day: 29 });
  });

  it('moves to Feb 28 or Mar 1 in non-leap years', () => {
    expect(occurrenceInYear(leap, 2027, 'FEB_28')).toEqual({ year: 2027, month: 2, day: 28 });
    expect(occurrenceInYear(leap, 2027, 'MAR_1')).toEqual({ year: 2027, month: 3, day: 1 });
  });

  it('computes next occurrence with the policy', () => {
    expect(nextOccurrence('2000-02-29', '2027-01-10', 'FEB_28')).toBe('2027-02-28');
    expect(nextOccurrence('2000-02-29', '2027-01-10', 'MAR_1')).toBe('2027-03-01');
    // On 1 March of a non-leap year with MAR_1 policy, it's today.
    expect(nextOccurrence('2000-02-29', '2027-03-01', 'MAR_1')).toBe('2027-03-01');
    // After it has passed, jump to the next leap year occurrence.
    expect(nextOccurrence('2000-02-29', '2027-03-02', 'FEB_28')).toBe('2028-02-29');
  });
});

describe('nextOccurrence', () => {
  it('is inclusive of today', () => {
    expect(nextOccurrence('1990-11-20', '2026-11-20', 'FEB_28')).toBe('2026-11-20');
  });

  it('rolls to next year after the date has passed', () => {
    expect(nextOccurrence('1990-11-19', '2026-11-20', 'FEB_28')).toBe('2027-11-19');
  });

  it('handles the December → January boundary', () => {
    expect(nextOccurrence('1985-01-01', '2026-12-31', 'FEB_28')).toBe('2027-01-01');
    expect(nextOccurrence('1985-12-31', '2026-12-31', 'FEB_28')).toBe('2026-12-31');
  });

  it('returns null for invalid or missing input', () => {
    expect(nextOccurrence('', '2026-11-20', 'FEB_28')).toBeNull();
    expect(nextOccurrence('1990-02-31', '2026-11-20', 'FEB_28')).toBeNull();
  });
});

describe('yearsAtOccurrence', () => {
  it('preserves the original year', () => {
    expect(yearsAtOccurrence('1996-11-21', '2026-11-21')).toBe(30);
    expect(yearsAtOccurrence('2001-12-31', '2027-12-31')).toBe(26);
  });

  it('returns null for year zero', () => {
    expect(yearsAtOccurrence('2026-05-01', '2026-05-01')).toBeNull();
  });
});

describe('ordinal', () => {
  it('formats English ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th',
    ]);
  });
});
