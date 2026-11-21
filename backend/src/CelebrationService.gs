/**
 * CelebrationService.gs — birthdays/anniversaries for today, tomorrow, upcoming
 * windows and calendar months. Mirrors frontend/src/utils/celebrations.ts.
 *
 * Rules: inactive contacts and missing/invalid dates are skipped; month/day
 * matching with the configured Feb-29 policy; results de-duplicated by
 * eventDate|contactId|occasion.
 */
const CelebrationService = (function () {
  const OCCASION_FIELD = { BIRTHDAY: 'birthday', ANNIVERSARY: 'anniversary' };

  function key(eventDate, contactId, occasion) {
    return eventDate + '|' + contactId + '|' + occasion;
  }

  function dedupeKey(eventDate, contactId, occasion, reminderType) {
    return key(eventDate, contactId, occasion) + '|' + reminderType;
  }

  function build_(contact, occasion, originalDate, eventDate, today) {
    return {
      key: key(eventDate, contact.contactId, occasion),
      contact: contact,
      occasion: occasion,
      originalDate: originalDate,
      eventDate: eventDate,
      daysUntil: DateUtils.diffInDays(today, eventDate),
      years: DateUtils.yearsAtOccurrence(originalDate, eventDate),
    };
  }

  function sort_(a, b) {
    return a.daysUntil - b.daysUntil || a.contact.fullName.localeCompare(b.contact.fullName) || a.occasion.localeCompare(b.occasion);
  }

  function dedupe(list) {
    const seen = {};
    return list.filter(function (c) {
      if (seen[c.key]) return false;
      seen[c.key] = true;
      return true;
    });
  }

  function passesFilters_(contact, occasion, opts) {
    if (!contact.isActive) return false;
    if (opts.categories && opts.categories.indexOf(contact.category) === -1) return false;
    if (opts.occasions && opts.occasions.indexOf(occasion) === -1) return false;
    return true;
  }

  /**
   * Celebrations within [from, from + days] (inclusive). `today` is used for daysUntil.
   * opts: { from, today, days, policy, categories?, occasions? }
   */
  function between(contacts, opts) {
    const from = opts.from || opts.today;
    const result = [];
    contacts.forEach(function (contact) {
      ENUMS.OCCASIONS.forEach(function (occasion) {
        if (!passesFilters_(contact, occasion, opts)) return;
        const original = contact[OCCASION_FIELD[occasion]];
        const eventDate = DateUtils.nextOccurrence(original, from, opts.policy);
        if (!eventDate) return;
        const offset = DateUtils.diffInDays(from, eventDate);
        if (offset < 0 || offset > opts.days) return;
        result.push(build_(contact, occasion, original, eventDate, opts.today));
      });
    });
    return dedupe(result).sort(sort_);
  }

  function forDate(contacts, date, today, policy) {
    return between(contacts, { from: date, today: today, days: 0, policy: policy });
  }

  function forMonth(contacts, opts) {
    const result = [];
    contacts.forEach(function (contact) {
      ENUMS.OCCASIONS.forEach(function (occasion) {
        if (!passesFilters_(contact, occasion, opts)) return;
        const originalIso = contact[OCCASION_FIELD[occasion]];
        const original = DateUtils.parse(originalIso);
        if (!original) return;
        const occ = DateUtils.occurrenceInYear(original, opts.year, opts.policy);
        if (occ.month !== opts.month) return;
        if (DateUtils.toEpochDay(occ) < DateUtils.toEpochDay(original)) return;
        result.push(build_(contact, occasion, originalIso, DateUtils.format(occ), opts.today));
      });
    });
    return dedupe(result).sort(function (a, b) {
      return a.eventDate.localeCompare(b.eventDate) || a.contact.fullName.localeCompare(b.contact.fullName) || a.occasion.localeCompare(b.occasion);
    });
  }

  function categoryStats(contacts) {
    return ENUMS.CATEGORIES.map(function (category) {
      const inCategory = contacts.filter(function (c) { return c.isActive && c.category === category; });
      return {
        category: category,
        total: inCategory.length,
        withBirthday: inCategory.filter(function (c) { return c.birthday; }).length,
        withAnniversary: inCategory.filter(function (c) { return c.anniversary; }).length,
      };
    });
  }

  function context_() {
    return { today: DateUtils.today(), policy: SettingsService.get().feb29Policy, contacts: ContactService.activeContacts() };
  }

  // ── API handlers ─────────────────────────────────────────────────────────
  function today() {
    const ctx = context_();
    return { date: ctx.today, celebrations: forDate(ctx.contacts, ctx.today, ctx.today, ctx.policy) };
  }

  function tomorrow() {
    const ctx = context_();
    const date = DateUtils.addDays(ctx.today, 1);
    return { date: date, celebrations: forDate(ctx.contacts, date, ctx.today, ctx.policy) };
  }

  function upcoming(payload) {
    const q = Validation.upcomingQuery(payload);
    const ctx = context_();
    return {
      from: ctx.today,
      to: DateUtils.addDays(ctx.today, q.days),
      celebrations: between(ctx.contacts, { today: ctx.today, days: q.days, policy: ctx.policy, categories: q.categories, occasions: q.occasions }),
    };
  }

  function month(payload) {
    const q = Validation.monthQuery(payload);
    const ctx = context_();
    return {
      year: q.year,
      month: q.month,
      celebrations: forMonth(ctx.contacts, { year: q.year, month: q.month, today: ctx.today, policy: ctx.policy, categories: q.categories, occasions: q.occasions }),
    };
  }

  function dashboard() {
    const ctx = context_();
    const next30 = between(ctx.contacts, { today: ctx.today, days: 30, policy: ctx.policy });
    const todays = next30.filter(function (c) { return c.daysUntil === 0; });
    const tomorrows = next30.filter(function (c) { return c.daysUntil === 1; });
    return {
      today: ctx.today,
      timezone: APP.TIMEZONE,
      totals: {
        activeContacts: ctx.contacts.length,
        todayBirthdays: todays.filter(function (c) { return c.occasion === 'BIRTHDAY'; }).length,
        todayAnniversaries: todays.filter(function (c) { return c.occasion === 'ANNIVERSARY'; }).length,
        tomorrow: tomorrows.length,
        next7Days: next30.filter(function (c) { return c.daysUntil <= 7; }).length,
        next30Days: next30.length,
      },
      todayCelebrations: todays,
      tomorrowCelebrations: tomorrows,
      upcoming30: next30.filter(function (c) { return c.daysUntil >= 2; }),
      categoryStats: categoryStats(ctx.contacts),
    };
  }

  return {
    key: key,
    dedupeKey: dedupeKey,
    dedupe: dedupe,
    between: between,
    forDate: forDate,
    forMonth: forMonth,
    categoryStats: categoryStats,
    today: today,
    tomorrow: tomorrow,
    upcoming: upcoming,
    month: month,
    dashboard: dashboard,
  };
})();
