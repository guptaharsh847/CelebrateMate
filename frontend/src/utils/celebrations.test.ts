import { describe, expect, it } from 'vitest';
import type { Contact } from '@/types';
import {
  celebrationKey,
  dedupeCelebrations,
  getCategoryStats,
  getCelebrationsForMonth,
  getNextCelebrations,
  getUpcomingCelebrations,
  notificationDedupeKey,
} from './celebrations';

function contact(overrides: Partial<Contact> & Pick<Contact, 'contactId' | 'fullName'>): Contact {
  return {
    mobileNumber: '+919876543210',
    whatsappNumber: '+919876543210',
    birthday: null,
    anniversary: null,
    category: 'GENERAL',
    notes: '',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const TODAY = '2026-12-30';

describe('getNextCelebrations', () => {
  it('returns both birthday and anniversary for the same contact', () => {
    const c = contact({ contactId: 'C1', fullName: 'Asha', birthday: '1990-12-30', anniversary: '2015-01-02' });
    const result = getNextCelebrations(c, TODAY, 'FEB_28');
    expect(result.map((r) => [r.occasion, r.eventDate, r.daysUntil, r.years])).toEqual([
      ['BIRTHDAY', '2026-12-30', 0, 36],
      ['ANNIVERSARY', '2027-01-02', 3, 12],
    ]);
  });

  it('skips missing dates', () => {
    expect(getNextCelebrations(contact({ contactId: 'C2', fullName: 'No dates' }), TODAY, 'FEB_28')).toEqual([]);
  });
});

describe('getUpcomingCelebrations', () => {
  const contacts = [
    contact({ contactId: 'A', fullName: 'Today', birthday: '1990-12-30' }),
    contact({ contactId: 'B', fullName: 'New year', birthday: '1980-01-01' }),
    contact({ contactId: 'C', fullName: 'Inactive', birthday: '1990-12-30', isActive: false }),
    contact({ contactId: 'D', fullName: 'Far', birthday: '1990-03-15' }),
    contact({ contactId: 'E', fullName: 'Donor', anniversary: '2010-12-31', category: 'HELP_DONOR' }),
  ];

  it('excludes inactive contacts and dates outside the window, crossing the year boundary', () => {
    const result = getUpcomingCelebrations(contacts, { today: TODAY, days: 7, policy: 'FEB_28' });
    expect(result.map((r) => `${r.contact.contactId}:${r.eventDate}`)).toEqual(['A:2026-12-30', 'E:2026-12-31', 'B:2027-01-01']);
  });

  it('filters by category and occasion', () => {
    expect(
      getUpcomingCelebrations(contacts, { today: TODAY, days: 7, policy: 'FEB_28', categories: ['HELP_DONOR'] }).map((r) => r.contact.contactId),
    ).toEqual(['E']);
    expect(
      getUpcomingCelebrations(contacts, { today: TODAY, days: 7, policy: 'FEB_28', occasions: ['BIRTHDAY'] }).map((r) => r.contact.contactId),
    ).toEqual(['A', 'B']);
  });

  it('does not duplicate a contact that appears twice', () => {
    const dup = contact({ contactId: 'A', fullName: 'Today', birthday: '1990-12-30' });
    const result = getUpcomingCelebrations([dup, dup], { today: TODAY, days: 0, policy: 'FEB_28' });
    expect(result).toHaveLength(1);
  });
});

describe('getCelebrationsForMonth', () => {
  const leapling = contact({ contactId: 'L', fullName: 'Leapling', birthday: '2000-02-29' });

  it('places Feb 29 birthdays per policy in non-leap years', () => {
    const feb = getCelebrationsForMonth([leapling], { year: 2027, month: 2, today: TODAY, policy: 'FEB_28' });
    expect([...feb.keys()]).toEqual(['2027-02-28']);
    const febMar1 = getCelebrationsForMonth([leapling], { year: 2027, month: 2, today: TODAY, policy: 'MAR_1' });
    expect(febMar1.size).toBe(0);
    const mar = getCelebrationsForMonth([leapling], { year: 2027, month: 3, today: TODAY, policy: 'MAR_1' });
    expect([...mar.keys()]).toEqual(['2027-03-01']);
  });

  it('groups same-day events and never shows events before the original date', () => {
    const couple = contact({ contactId: 'X', fullName: 'Couple', birthday: '1990-06-10', anniversary: '2020-06-10' });
    const june2026 = getCelebrationsForMonth([couple], { year: 2026, month: 6, today: TODAY, policy: 'FEB_28' });
    expect(june2026.get('2026-06-10')?.map((c) => c.occasion)).toEqual(['ANNIVERSARY', 'BIRTHDAY']);
    const june2019 = getCelebrationsForMonth([couple], { year: 2019, month: 6, today: TODAY, policy: 'FEB_28' });
    expect(june2019.get('2019-06-10')?.map((c) => c.occasion)).toEqual(['BIRTHDAY']);
  });
});

describe('duplicate prevention keys', () => {
  it('builds stable keys from date, contact, occasion and reminder type', () => {
    expect(celebrationKey('2026-12-30', 'C1', 'BIRTHDAY')).toBe('2026-12-30|C1|BIRTHDAY');
    expect(notificationDedupeKey('2026-12-30', 'C1', 'BIRTHDAY', 'SAME_DAY')).toBe('2026-12-30|C1|BIRTHDAY|SAME_DAY');
  });

  it('distinguishes reminder types and occasions', () => {
    const keys = new Set([
      notificationDedupeKey('2026-12-30', 'C1', 'BIRTHDAY', 'SAME_DAY'),
      notificationDedupeKey('2026-12-30', 'C1', 'BIRTHDAY', 'NEXT_DAY'),
      notificationDedupeKey('2026-12-30', 'C1', 'ANNIVERSARY', 'SAME_DAY'),
      notificationDedupeKey('2026-12-30', 'C1', 'BIRTHDAY', 'SAME_DAY'),
    ]);
    expect(keys.size).toBe(3);
  });

  it('dedupeCelebrations keeps the first occurrence of each key', () => {
    const c = contact({ contactId: 'A', fullName: 'A', birthday: '1990-12-30' });
    const [first] = getNextCelebrations(c, TODAY, 'FEB_28');
    expect(first).toBeDefined();
    expect(dedupeCelebrations([first!, { ...first! }, first!])).toHaveLength(1);
  });
});

describe('getCategoryStats', () => {
  it('counts active contacts per category', () => {
    const stats = getCategoryStats([
      contact({ contactId: '1', fullName: 'a', category: 'DEVOTEE', birthday: '1990-01-01' }),
      contact({ contactId: '2', fullName: 'b', category: 'DEVOTEE', anniversary: '2010-01-01' }),
      contact({ contactId: '3', fullName: 'c', category: 'DEVOTEE', isActive: false }),
    ]);
    expect(stats.find((s) => s.category === 'DEVOTEE')).toEqual({ category: 'DEVOTEE', total: 2, withBirthday: 1, withAnniversary: 1 });
    expect(stats.find((s) => s.category === 'GENERAL')?.total).toBe(0);
  });
});
