/**
 * Validation.gs — input validation and normalisation for every endpoint.
 * Each validator returns a clean object or throws AppError('VALIDATION', …, { field: message }).
 * Rules mirror frontend/src/utils/schemas.ts and phone.ts.
 */
const Validation = (function () {
  const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  const SUBSCRIPTION_RE = /^[A-Za-z0-9-]{8,128}$/;

  function collector_() {
    const errors = {};
    return {
      add: function (field, message) {
        if (!errors[field]) errors[field] = message;
      },
      throwIfAny: function () {
        if (Object.keys(errors).length) throw new AppError('VALIDATION', 'Some fields are invalid.', errors);
      },
    };
  }

  function object(value, name) {
    if (value === undefined || value === null) return {};
    if (typeof value !== 'object' || Array.isArray(value)) throw new AppError('BAD_REQUEST', (name || 'payload') + ' must be an object.');
    return value;
  }

  function requireObject_(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('BAD_REQUEST', name + ' is required.');
    return value;
  }

  function string_(input, field, opts, errs) {
    const raw = input[field];
    if (raw === undefined || raw === null || raw === '') {
      if (opts.required) errs.add(field, 'Required');
      return '';
    }
    if (typeof raw !== 'string') {
      errs.add(field, 'Must be text');
      return '';
    }
    const value = opts.collapse ? raw.trim().replace(/\s+/g, ' ') : raw.trim();
    if (opts.required && !value) errs.add(field, 'Required');
    else if (value && opts.min && value.length < opts.min) errs.add(field, 'Must be at least ' + opts.min + ' characters');
    else if (opts.max && value.length > opts.max) errs.add(field, 'Must be at most ' + opts.max + ' characters');
    return value;
  }

  function enum_(input, field, allowed, errs, opts) {
    const raw = input[field];
    if ((raw === undefined || raw === null || raw === '') && opts && opts.default !== undefined) return opts.default;
    if (allowed.indexOf(raw) === -1) {
      errs.add(field, 'Must be one of ' + allowed.join(', '));
      return null;
    }
    return raw;
  }

  function bool_(input, field, errs) {
    const raw = input[field];
    if (typeof raw !== 'boolean') {
      errs.add(field, 'Must be true or false');
      return false;
    }
    return raw;
  }

  function int_(input, field, min, max, fallback, errs) {
    const raw = input[field];
    if (raw === undefined || raw === null || raw === '') return fallback;
    const n = Number(raw);
    if (!isFinite(n) || Math.floor(n) !== n || n < min || n > max) {
      errs.add(field, 'Must be a whole number from ' + min + ' to ' + max);
      return fallback;
    }
    return n;
  }

  function date_(input, field, errs, opts) {
    const raw = input[field];
    if (raw === undefined || raw === null || raw === '') {
      if (opts.required) errs.add(field, 'Required');
      return null;
    }
    if (typeof raw !== 'string' || !DateUtils.isValid(raw)) {
      errs.add(field, 'Use a valid date in YYYY-MM-DD format');
      return null;
    }
    if (opts.notFuture && raw > DateUtils.today()) {
      errs.add(field, 'Date cannot be in the future');
      return null;
    }
    return raw;
  }

  function enumList_(input, field, allowed, errs) {
    const raw = input[field];
    if (raw === undefined || raw === null) return null;
    if (!Array.isArray(raw) || raw.some(function (v) { return allowed.indexOf(v) === -1; })) {
      errs.add(field, 'Must be a list of ' + allowed.join(', '));
      return null;
    }
    return raw.filter(function (v, i) { return raw.indexOf(v) === i; });
  }

  /**
   * Digits-only international number, or null. Same rules as the frontend:
   * "+"/"00" prefix → international; 10 digits → default country code;
   * 11–15 digits → assumed to include a country code; result 8–15 digits.
   */
  function normalizePhone(raw, defaultCountryCode) {
    if (raw === null || raw === undefined) return null;
    const trimmed = String(raw).trim();
    if (!trimmed || /[^\d+\s().-]/.test(trimmed)) return null;
    let international = trimmed.charAt(0) === '+';
    let digits = trimmed.replace(/\D/g, '');
    if (!international && digits.indexOf('00') === 0) {
      digits = digits.slice(2);
      international = true;
    }
    if (!international) {
      digits = digits.replace(/^0+/, '');
      const cc = String(defaultCountryCode || '91').replace(/\D/g, '');
      if (digits.length === 10) digits = cc + digits;
      else if (digits.length < 10) return null;
    }
    if (digits.length < 8 || digits.length > 15 || digits.charAt(0) === '0') return null;
    return digits;
  }

  function phone_(input, field, cc, errs, required) {
    const raw = input[field];
    if (raw === undefined || raw === null || raw === '') {
      if (required) errs.add(field, 'Required');
      return null;
    }
    const digits = typeof raw === 'string' ? normalizePhone(raw, cc) : null;
    if (!digits) {
      errs.add(field, 'Enter a valid phone number');
      return null;
    }
    return '+' + digits;
  }

  function requireId(payload, field) {
    const value = object(payload)[field];
    if (typeof value !== 'string' || !ID_RE.test(value)) {
      throw new AppError('VALIDATION', 'Some fields are invalid.', (function () { const d = {}; d[field] = 'A valid ID is required'; return d; })());
    }
    return value;
  }

  function contactInput(payload, defaultCountryCode) {
    const input = requireObject_(object(payload).contact, 'contact');
    const errs = collector_();
    const mobileNumber = phone_(input, 'mobileNumber', defaultCountryCode, errs, true);
    const whatsappNumber = phone_(input, 'whatsappNumber', defaultCountryCode, errs, false);
    const result = {
      fullName: string_(input, 'fullName', { required: true, min: 2, max: 100, collapse: true }, errs),
      mobileNumber: mobileNumber,
      whatsappNumber: whatsappNumber || mobileNumber,
      birthday: date_(input, 'birthday', errs, { notFuture: true }),
      anniversary: date_(input, 'anniversary', errs, { notFuture: true }),
      category: enum_(input, 'category', ENUMS.CATEGORIES, errs),
      notes: string_(input, 'notes', { max: 1000 }, errs),
    };
    errs.throwIfAny();
    return result;
  }

  function contactQuery(payload) {
    const input = object(payload);
    const errs = collector_();
    const result = {
      search: string_(input, 'search', { max: 100 }, errs),
      category: enum_(input, 'category', ['ALL'].concat(ENUMS.CATEGORIES), errs, { default: 'ALL' }),
      status: enum_(input, 'status', ENUMS.CONTACT_STATUS, errs, { default: 'ACTIVE' }),
    };
    errs.throwIfAny();
    return result;
  }

  function templateInput(payload) {
    const input = requireObject_(object(payload).template, 'template');
    const errs = collector_();
    const result = {
      name: string_(input, 'name', { required: true, min: 2, max: 60, collapse: true }, errs),
      body: string_(input, 'body', { required: true, min: 10, max: 1000 }, errs),
      category: enum_(input, 'category', ENUMS.CATEGORIES, errs),
      occasion: enum_(input, 'occasion', ENUMS.OCCASIONS, errs),
    };
    errs.throwIfAny();
    return result;
  }

  function settingsPatch(payload) {
    const input = requireObject_(object(payload).settings, 'settings');
    const errs = collector_();
    const patch = {};
    const known = Object.keys(DEFAULT_SETTINGS);
    Object.keys(input).forEach(function (key) {
      if (known.indexOf(key) === -1) errs.add(key, 'Unknown setting');
    });
    if (input.timezone !== undefined && input.timezone !== APP.TIMEZONE) errs.add('timezone', 'Timezone is fixed to ' + APP.TIMEZONE);
    ['sameDayReminderTime', 'nextDayReminderTime'].forEach(function (key) {
      if (input[key] === undefined) return;
      if (!DateUtils.isValidTime(input[key])) errs.add(key, 'Use HH:mm (24-hour)');
      else patch[key] = input[key];
    });
    ['birthdayRemindersEnabled', 'anniversaryRemindersEnabled'].forEach(function (key) {
      if (input[key] !== undefined) patch[key] = bool_(input, key, errs);
    });
    if (input.feb29Policy !== undefined) patch.feb29Policy = enum_(input, 'feb29Policy', ENUMS.FEB29_POLICIES, errs);
    if (input.defaultCountryCode !== undefined) {
      if (typeof input.defaultCountryCode !== 'string' || !/^\d{1,3}$/.test(input.defaultCountryCode.trim())) {
        errs.add('defaultCountryCode', 'Use 1–3 digits, e.g. 91');
      } else {
        patch.defaultCountryCode = input.defaultCountryCode.trim();
      }
    }
    errs.throwIfAny();
    if (!Object.keys(patch).length) throw new AppError('VALIDATION', 'Nothing to update.');
    return patch;
  }

  function historyOpenedInput(payload) {
    const input = requireObject_(object(payload).entry, 'entry');
    const errs = collector_();
    const templateId = input.templateId === undefined || input.templateId === null || input.templateId === '' ? '' : input.templateId;
    if (templateId && (typeof templateId !== 'string' || !ID_RE.test(templateId))) errs.add('templateId', 'Invalid template ID');
    if (typeof input.contactId !== 'string' || !ID_RE.test(input.contactId)) errs.add('contactId', 'A valid contact ID is required');
    const result = {
      contactId: input.contactId,
      occasion: enum_(input, 'occasion', ENUMS.OCCASIONS, errs),
      eventDate: date_(input, 'eventDate', errs, { required: true }),
      templateId: templateId,
      finalMessage: string_(input, 'finalMessage', { required: true, min: 1, max: 2000 }, errs),
    };
    errs.throwIfAny();
    return result;
  }

  function historyQuery(payload) {
    const input = object(payload);
    const errs = collector_();
    if (input.contactId !== undefined && (typeof input.contactId !== 'string' || !ID_RE.test(input.contactId))) errs.add('contactId', 'Invalid contact ID');
    const result = {
      contactId: input.contactId || '',
      limit: int_(input, 'limit', 1, LIMITS.MAX_PAGE_SIZE, 100, errs),
    };
    errs.throwIfAny();
    return result;
  }

  function deviceInput(payload) {
    const input = requireObject_(object(payload).device, 'device');
    const errs = collector_();
    if (typeof input.subscriptionId !== 'string' || !SUBSCRIPTION_RE.test(input.subscriptionId)) {
      errs.add('subscriptionId', 'A valid OneSignal subscription ID is required');
    }
    const result = {
      subscriptionId: input.subscriptionId,
      platform: enum_(input, 'platform', ENUMS.PLATFORMS, errs, { default: 'OTHER' }),
      label: string_(input, 'label', { max: 60, collapse: true }, errs),
      userAgent: string_(input, 'userAgent', { max: 300 }, errs),
    };
    errs.throwIfAny();
    return result;
  }

  function upcomingQuery(payload) {
    const input = object(payload);
    const errs = collector_();
    const result = {
      days: int_(input, 'days', 0, LIMITS.MAX_UPCOMING_DAYS, 30, errs),
      categories: enumList_(input, 'categories', ENUMS.CATEGORIES, errs),
      occasions: enumList_(input, 'occasions', ENUMS.OCCASIONS, errs),
    };
    errs.throwIfAny();
    return result;
  }

  function monthQuery(payload) {
    const input = object(payload);
    const errs = collector_();
    const today = DateUtils.parse(DateUtils.today());
    const result = {
      year: int_(input, 'year', 1900, 2200, today.year, errs),
      month: int_(input, 'month', 1, 12, today.month, errs),
      categories: enumList_(input, 'categories', ENUMS.CATEGORIES, errs),
      occasions: enumList_(input, 'occasions', ENUMS.OCCASIONS, errs),
    };
    errs.throwIfAny();
    return result;
  }

  function limitQuery(payload) {
    const errs = collector_();
    const limit = int_(object(payload), 'limit', 1, LIMITS.MAX_PAGE_SIZE, 100, errs);
    errs.throwIfAny();
    return limit;
  }

  function optionalId(payload, field) {
    const value = object(payload)[field];
    if (value === undefined || value === null || value === '') return '';
    return requireId(payload, field);
  }

  function booleanField(payload, field) {
    const errs = collector_();
    const value = bool_(object(payload), field, errs);
    errs.throwIfAny();
    return value;
  }

  return {
    object: object,
    normalizePhone: normalizePhone,
    requireId: requireId,
    optionalId: optionalId,
    booleanField: booleanField,
    contactInput: contactInput,
    contactQuery: contactQuery,
    templateInput: templateInput,
    settingsPatch: settingsPatch,
    historyOpenedInput: historyOpenedInput,
    historyQuery: historyQuery,
    deviceInput: deviceInput,
    upcomingQuery: upcomingQuery,
    monthQuery: monthQuery,
    limitQuery: limitQuery,
  };
})();
