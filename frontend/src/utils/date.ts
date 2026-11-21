import { format } from 'date-fns';
import type { Feb29Policy, ISODate } from '@/types';
import { APP_TIMEZONE } from './constants';

/**
 * All celebration maths works on plain calendar dates (year/month/day) and
 * UTC epoch days. Nothing here depends on the browser's timezone; "today" is
 * always derived explicitly for the app timezone (Asia/Kolkata).
 */
export interface DateParts {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseISODate(value: string | null | undefined): DateParts | null {
  if (!value) return null;
  const match = ISO_DATE_RE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  if (day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isValidISODate(value: string | null | undefined): boolean {
  return parseISODate(value) !== null;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function toISODate(parts: DateParts): ISODate {
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function toEpochDay(parts: DateParts): number {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return Math.floor(date.getTime() / MS_PER_DAY);
}

export function fromEpochDay(epochDay: number): DateParts {
  const d = new Date(epochDay * MS_PER_DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function requireDate(iso: ISODate): DateParts {
  const parts = parseISODate(iso);
  if (!parts) throw new RangeError(`Invalid ISO date: ${iso}`);
  return parts;
}

export function addDays(iso: ISODate, days: number): ISODate {
  return toISODate(fromEpochDay(toEpochDay(requireDate(iso)) + days));
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffInDays(from: ISODate, to: ISODate): number {
  return toEpochDay(requireDate(to)) - toEpochDay(requireDate(from));
}

/** Current calendar date in the given IANA timezone (default Asia/Kolkata). */
export function todayInTimeZone(timeZone: string = APP_TIMEZONE, now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * The date on which an annual celebration falls in `year`.
 * Feb 29 originals are moved according to `policy` in non-leap years.
 */
export function occurrenceInYear(original: DateParts, year: number, policy: Feb29Policy): DateParts {
  if (original.month === 2 && original.day === 29 && !isLeapYear(year)) {
    return policy === 'FEB_28' ? { year, month: 2, day: 28 } : { year, month: 3, day: 1 };
  }
  return { year, month: original.month, day: original.day };
}

/**
 * Next occurrence of an annual date on or after `from` (inclusive).
 * Returns null if either date is invalid.
 */
export function nextOccurrence(originalIso: ISODate, fromIso: ISODate, policy: Feb29Policy): ISODate | null {
  const original = parseISODate(originalIso);
  const from = parseISODate(fromIso);
  if (!original || !from) return null;

  const fromDay = toEpochDay(from);
  const originalDay = toEpochDay(original);
  // An original date in the future is its own first occurrence.
  if (originalDay >= fromDay) return toISODate(original);

  let occ = occurrenceInYear(original, from.year, policy);
  if (toEpochDay(occ) < fromDay) occ = occurrenceInYear(original, from.year + 1, policy);
  return toISODate(occ);
}

/**
 * Years completed at the given occurrence (age turning, anniversary number).
 * Returns null for the original date itself or invalid input.
 */
export function yearsAtOccurrence(originalIso: ISODate, eventIso: ISODate): number | null {
  const original = parseISODate(originalIso);
  const event = parseISODate(eventIso);
  if (!original || !event) return null;
  const years = event.year - original.year;
  return years > 0 ? years : null;
}

/** Local Date built from calendar parts — for display formatting only. */
export function toDisplayDate(iso: ISODate): Date {
  const p = requireDate(iso);
  const d = new Date(2000, 0, 1);
  d.setFullYear(p.year, p.month - 1, p.day);
  return d;
}

export function formatDate(iso: ISODate | null | undefined, pattern = 'd MMM yyyy'): string {
  if (!iso || !isValidISODate(iso)) return '—';
  return format(toDisplayDate(iso), pattern);
}

export function formatDateTime(isoDateTime: string | null | undefined): string {
  if (!isoDateTime) return '—';
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function relativeDayLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil < 0) return `${Math.abs(daysUntil)} days ago`;
  return `In ${daysUntil} days`;
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
