/**
 * SettingsService.gs — key/value app settings stored in the Settings sheet.
 * Values are stored as text and typed using DEFAULT_SETTINGS. Cached briefly
 * in CacheService because the reminder dispatcher reads them every run.
 */
const SettingsService = (function () {
  const CACHE_KEY = 'settings:v1';

  function parse_(key, raw) {
    const fallback = DEFAULT_SETTINGS[key];
    if (typeof fallback === 'boolean') {
      if (raw === 'TRUE' || raw === 'true') return true;
      if (raw === 'FALSE' || raw === 'false') return false;
      return fallback;
    }
    if (key === 'feb29Policy') return ENUMS.FEB29_POLICIES.indexOf(raw) !== -1 ? raw : fallback;
    if (key === 'sameDayReminderTime' || key === 'nextDayReminderTime') return DateUtils.isValidTime(raw) ? raw : fallback;
    if (key === 'defaultCountryCode') return /^\d{1,3}$/.test(raw) ? raw : fallback;
    return raw || fallback;
  }

  function get() {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const stored = {};
    Database.list(SHEET_NAMES.SETTINGS).forEach(function (row) {
      stored[row.key] = row.value;
    });
    const settings = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
      settings[key] = stored[key] === undefined ? DEFAULT_SETTINGS[key] : parse_(key, stored[key]);
    });
    settings.timezone = APP.TIMEZONE;
    cache.put(CACHE_KEY, JSON.stringify(settings), LIMITS.SETTINGS_CACHE_SECONDS);
    return settings;
  }

  function write_(key, value) {
    const now = Clock.now().toISOString();
    const text = typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value);
    if (Database.get(SHEET_NAMES.SETTINGS, key)) {
      Database.update(SHEET_NAMES.SETTINGS, key, { value: text, updatedAt: now });
    } else {
      Database.insert(SHEET_NAMES.SETTINGS, { key: key, value: text, updatedAt: now });
    }
  }

  function update(payload) {
    const patch = Validation.settingsPatch(payload);
    Object.keys(patch).forEach(function (key) {
      write_(key, patch[key]);
    });
    invalidate();
    return get();
  }

  /** Inserts any missing default keys. Never overwrites existing values. */
  function seedDefaults() {
    let added = 0;
    Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
      if (!Database.get(SHEET_NAMES.SETTINGS, key)) {
        write_(key, DEFAULT_SETTINGS[key]);
        added++;
      }
    });
    if (!Database.get(SHEET_NAMES.SETTINGS, 'schemaVersion')) {
      Database.insert(SHEET_NAMES.SETTINGS, { key: 'schemaVersion', value: String(APP.SCHEMA_VERSION), updatedAt: Clock.now().toISOString() });
    }
    invalidate();
    return added;
  }

  function invalidate() {
    CacheService.getScriptCache().remove(CACHE_KEY);
  }

  return { get: get, update: update, seedDefaults: seedDefaults, invalidate: invalidate };
})();
