import type { Category, Contact } from '@/types';
import { addDays, daysInMonth, parseISODate, toISODate, todayInTimeZone } from '@/utils/date';

/**
 * DEVELOPMENT-ONLY demo contacts. Dates are generated relative to "today"
 * (Asia/Kolkata) so the dashboard always has something to show.
 * This module is only reachable through the mock data service.
 */

/** A past date whose month/day is `offsetDays` from today, `yearsAgo` years back. */
function relativeDate(today: string, offsetDays: number, yearsAgo: number): string {
  const shifted = parseISODate(addDays(today, offsetDays));
  if (!shifted) throw new Error('Invalid seed date');
  const year = shifted.year - yearsAgo;
  const day = Math.min(shifted.day, daysInMonth(year, shifted.month));
  return toISODate({ year, month: shifted.month, day });
}

interface SeedRow {
  name: string;
  phone: string;
  category: Category;
  birthday?: [offset: number, yearsAgo: number];
  anniversary?: [offset: number, yearsAgo: number];
  notes?: string;
  inactive?: boolean;
  fixedBirthday?: string;
}

const ROWS: SeedRow[] = [
  { name: 'Priya Sharma', phone: '+919876543210', category: 'GENERAL', birthday: [0, 29], notes: 'College friend, loves chocolate cake.' },
  { name: 'Ramesh & Sunita Iyer', phone: '+919812345678', category: 'DEVOTEE', anniversary: [0, 25], notes: 'Temple committee members.' },
  { name: 'Anil Kapoor', phone: '+919900112233', category: 'HELP_DONOR', birthday: [1, 52], anniversary: [40, 24], notes: 'Sponsors the annual food drive.' },
  { name: 'Meera Nair', phone: '+919845098450', category: 'DEVOTEE', birthday: [1, 34] },
  { name: 'Vikram Singh', phone: '+919811122233', category: 'GENERAL', anniversary: [3, 7] },
  { name: 'Lakshmi Reddy', phone: '+919866001122', category: 'HELP_DONOR', birthday: [6, 61], notes: 'Prefers calls in the evening.' },
  { name: 'Arjun Mehta', phone: '+919820098200', category: 'GENERAL', birthday: [12, 27], anniversary: [12, 2] },
  { name: 'Gopal Das', phone: '+919830011223', category: 'DEVOTEE', birthday: [19, 45], anniversary: [-60, 18] },
  { name: 'Fatima Sheikh', phone: '+919870012345', category: 'HELP_DONOR', anniversary: [26, 12] },
  { name: 'Rohan Gupta', phone: '+919811900119', category: 'GENERAL', birthday: [45, 31] },
  { name: 'Kavita Joshi', phone: '+919822033044', category: 'DEVOTEE', birthday: [-3, 38], notes: 'Leads the Sunday bhajan group.' },
  { name: 'Suresh Patel', phone: '+919898989898', category: 'HELP_DONOR', birthday: [90, 58], anniversary: [150, 30] },
  { name: 'Neha Verma', phone: '+447700900123', category: 'GENERAL', fixedBirthday: '1996-02-29', notes: 'Leap-day birthday; lives in London.' },
  { name: 'Deepak Rao', phone: '+919845500550', category: 'GENERAL', birthday: [2, 40], inactive: true, notes: 'Moved abroad; kept for records.' },
  { name: 'Ananya Bose', phone: '+919831234567', category: 'DEVOTEE' },
];

export function buildSeedContacts(now: Date = new Date()): Contact[] {
  const today = todayInTimeZone('Asia/Kolkata', now);
  const timestamp = now.toISOString();
  return ROWS.map((row, index) => ({
    contactId: `CON_DEMO_${String(index + 1).padStart(3, '0')}`,
    fullName: row.name,
    mobileNumber: row.phone,
    whatsappNumber: row.phone,
    birthday: row.fixedBirthday ?? (row.birthday ? relativeDate(today, row.birthday[0], row.birthday[1]) : null),
    anniversary: row.anniversary ? relativeDate(today, row.anniversary[0], row.anniversary[1]) : null,
    category: row.category,
    notes: row.notes ?? '',
    isActive: !row.inactive,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}
