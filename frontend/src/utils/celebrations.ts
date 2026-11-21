import type {
  Category,
  Celebration,
  Contact,
  Feb29Policy,
  ISODate,
  Occasion,
  ReminderType,
} from '@/types';
import { CATEGORIES } from '@/types';
import {
  diffInDays,
  nextOccurrence,
  occurrenceInYear,
  parseISODate,
  toEpochDay,
  toISODate,
  yearsAtOccurrence,
} from './date';

export function celebrationKey(eventDate: ISODate, contactId: string, occasion: Occasion): string {
  return `${eventDate}|${contactId}|${occasion}`;
}

/**
 * Key used to prevent duplicate push notifications:
 * event date + contact ID + occasion + reminder type.
 */
export function notificationDedupeKey(
  eventDate: ISODate,
  contactId: string,
  occasion: Occasion,
  reminderType: ReminderType,
): string {
  return `${celebrationKey(eventDate, contactId, occasion)}|${reminderType}`;
}

export function getContactDate(contact: Contact, occasion: Occasion): ISODate | null {
  return occasion === 'BIRTHDAY' ? contact.birthday : contact.anniversary;
}

function buildCelebration(contact: Contact, occasion: Occasion, originalDate: ISODate, eventDate: ISODate, today: ISODate): Celebration {
  return {
    key: celebrationKey(eventDate, contact.contactId, occasion),
    contact,
    occasion,
    originalDate,
    eventDate,
    daysUntil: diffInDays(today, eventDate),
    years: yearsAtOccurrence(originalDate, eventDate),
  };
}

/** Next upcoming celebration of each occasion for one contact (ignores active status). */
export function getNextCelebrations(contact: Contact, today: ISODate, policy: Feb29Policy): Celebration[] {
  const result: Celebration[] = [];
  for (const occasion of ['BIRTHDAY', 'ANNIVERSARY'] as const) {
    const original = getContactDate(contact, occasion);
    if (!original) continue;
    const eventDate = nextOccurrence(original, today, policy);
    if (!eventDate) continue;
    result.push(buildCelebration(contact, occasion, original, eventDate, today));
  }
  return result.sort((a, b) => a.daysUntil - b.daysUntil);
}

function sortCelebrations(a: Celebration, b: Celebration): number {
  return (
    a.daysUntil - b.daysUntil ||
    a.contact.fullName.localeCompare(b.contact.fullName) ||
    a.occasion.localeCompare(b.occasion)
  );
}

/** Keeps the first celebration for each key; drops repeats (e.g. duplicated contact rows). */
export function dedupeCelebrations(celebrations: Celebration[]): Celebration[] {
  const seen = new Map<string, Celebration>();
  for (const c of celebrations) {
    if (!seen.has(c.key)) seen.set(c.key, c);
  }
  return [...seen.values()];
}

export interface UpcomingOptions {
  today: ISODate;
  /** Inclusive window: 0 = today only, 7 = today plus next 7 days. */
  days: number;
  policy: Feb29Policy;
  categories?: readonly Category[];
  occasions?: readonly Occasion[];
}

/** Active contacts' celebrations within [today, today + days], sorted and de-duplicated. */
export function getUpcomingCelebrations(contacts: Contact[], options: UpcomingOptions): Celebration[] {
  const { today, days, policy, categories, occasions } = options;
  const all: Celebration[] = [];
  for (const contact of contacts) {
    if (!contact.isActive) continue;
    if (categories && !categories.includes(contact.category)) continue;
    for (const c of getNextCelebrations(contact, today, policy)) {
      if (occasions && !occasions.includes(c.occasion)) continue;
      if (c.daysUntil >= 0 && c.daysUntil <= days) all.push(c);
    }
  }
  return dedupeCelebrations(all).sort(sortCelebrations);
}

export interface MonthOptions {
  year: number;
  /** 1–12 */
  month: number;
  today: ISODate;
  policy: Feb29Policy;
  categories?: readonly Category[];
  occasions?: readonly Occasion[];
}

/** Celebrations of active contacts falling in a given month, grouped by ISO date. */
export function getCelebrationsForMonth(contacts: Contact[], options: MonthOptions): Map<ISODate, Celebration[]> {
  const { year, month, today, policy, categories, occasions } = options;
  const all: Celebration[] = [];

  for (const contact of contacts) {
    if (!contact.isActive) continue;
    if (categories && !categories.includes(contact.category)) continue;
    for (const occasion of ['BIRTHDAY', 'ANNIVERSARY'] as const) {
      if (occasions && !occasions.includes(occasion)) continue;
      const originalIso = getContactDate(contact, occasion);
      const original = parseISODate(originalIso);
      if (!originalIso || !original) continue;

      // Feb 29 may shift into March, so check this year's occurrence only.
      const occ = occurrenceInYear(original, year, policy);
      if (occ.month !== month) continue;
      // Never show a celebration before the original event happened.
      if (toEpochDay(occ) < toEpochDay(original)) continue;

      all.push(buildCelebration(contact, occasion, originalIso, toISODate(occ), today));
    }
  }

  const byDate = new Map<ISODate, Celebration[]>();
  for (const c of dedupeCelebrations(all).sort(sortCelebrations)) {
    const list = byDate.get(c.eventDate);
    if (list) list.push(c);
    else byDate.set(c.eventDate, [c]);
  }
  return byDate;
}

export interface CategoryStat {
  category: Category;
  total: number;
  withBirthday: number;
  withAnniversary: number;
}

export function getCategoryStats(contacts: Contact[]): CategoryStat[] {
  return CATEGORIES.map((category) => {
    const inCategory = contacts.filter((c) => c.isActive && c.category === category);
    return {
      category,
      total: inCategory.length,
      withBirthday: inCategory.filter((c) => c.birthday).length,
      withAnniversary: inCategory.filter((c) => c.anniversary).length,
    };
  });
}
