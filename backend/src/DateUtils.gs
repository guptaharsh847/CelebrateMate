/**
 * DateUtils.gs — calendar-date maths that never depends on the server's or
 * browser's timezone. Mirrors frontend/src/utils/date.ts (same rules, same tests).
 *
 * Dates are 'YYYY-MM-DD' strings. Arithmetic uses UTC epoch days.
 * "Now" is always read explicitly in Asia/Kolkata.
 */
const DateUtils = (function () {
  const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const MS_PER_DAY = 86400000;

  function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function parse(value) {
    if (value === null || value === undefined || value === '') return null;
    const match = ISO_RE.exec(String(value).trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1 || month < 1 || month > 12 || day < 1) return null;
    if (day > daysInMonth(year, month)) return null;
    return { year: year, month: month, day: day };
  }

  function isValid(value) {
    return parse(value) !== null;
  }

  function pad(n, width) {
    let s = String(n);
    while (s.length < (width || 2)) s = '0' + s;
    return s;
  }

  function format(parts) {
    return pad(parts.year, 4) + '-' + pad(parts.month) + '-' + pad(parts.day);
  }

  function toEpochDay(parts) {
    const d = new Date(0);
    d.setUTCFullYear(parts.year, parts.month - 1, parts.day);
    return Math.floor(d.getTime() / MS_PER_DAY);
  }

  function fromEpochDay(epochDay) {
    const d = new Date(epochDay * MS_PER_DAY);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }

  function require_(iso) {
    const p = parse(iso);
    if (!p) throw new Error('Invalid ISO date: ' + iso);
    return p;
  }

  function addDays(iso, days) {
    return format(fromEpochDay(toEpochDay(require_(iso)) + days));
  }

  function diffInDays(fromIso, toIso) {
    return toEpochDay(require_(toIso)) - toEpochDay(require_(fromIso));
  }

  /** { date: 'YYYY-MM-DD', minutes: minutes since midnight } in the app timezone. */
  function nowParts(now) {
    const s = Utilities.formatDate(now || Clock.now(), APP.TIMEZONE, 'yyyy-MM-dd HH:mm');
    return { date: s.slice(0, 10), minutes: Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16)) };
  }

  function today(now) {
    return nowParts(now).date;
  }

  function occurrenceInYear(original, year, policy) {
    if (original.month === 2 && original.day === 29 && !isLeapYear(year)) {
      return policy === 'MAR_1' ? { year: year, month: 3, day: 1 } : { year: year, month: 2, day: 28 };
    }
    return { year: year, month: original.month, day: original.day };
  }

  /** Next occurrence on or after fromIso (inclusive), or null for invalid input. */
  function nextOccurrence(originalIso, fromIso, policy) {
    const original = parse(originalIso);
    const from = parse(fromIso);
    if (!original || !from) return null;
    const fromDay = toEpochDay(from);
    if (toEpochDay(original) >= fromDay) return format(original);
    let occ = occurrenceInYear(original, from.year, policy);
    if (toEpochDay(occ) < fromDay) occ = occurrenceInYear(original, from.year + 1, policy);
    return format(occ);
  }

  function yearsAtOccurrence(originalIso, eventIso) {
    const original = parse(originalIso);
    const event = parse(eventIso);
    if (!original || !event) return null;
    const years = event.year - original.year;
    return years > 0 ? years : null;
  }

  function isValidTime(value) {
    return typeof value === 'string' && TIME_RE.test(value);
  }

  function timeToMinutes(value) {
    const m = TIME_RE.exec(value || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  function ordinal(n) {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return n + 'th';
    const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10];
    return n + (suffix || 'th');
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /** e.g. '21 November' */
  function formatDayMonth(iso) {
    const p = parse(iso);
    return p ? p.day + ' ' + MONTHS[p.month - 1] : '';
  }

  return {
    isLeapYear: isLeapYear,
    daysInMonth: daysInMonth,
    parse: parse,
    isValid: isValid,
    format: format,
    toEpochDay: toEpochDay,
    fromEpochDay: fromEpochDay,
    addDays: addDays,
    diffInDays: diffInDays,
    nowParts: nowParts,
    today: today,
    occurrenceInYear: occurrenceInYear,
    nextOccurrence: nextOccurrence,
    yearsAtOccurrence: yearsAtOccurrence,
    isValidTime: isValidTime,
    timeToMinutes: timeToMinutes,
    ordinal: ordinal,
    formatDayMonth: formatDayMonth,
  };
})();
