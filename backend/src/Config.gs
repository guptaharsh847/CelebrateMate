/**
 * Config.gs — application constants, sheet schema and Script Property access.
 *
 * SECRETS: spreadsheet ID, OAuth client ID, email allowlist and OneSignal keys
 * are read ONLY from Script Properties (Project Settings → Script properties).
 * Nothing secret is hard-coded here or anywhere in the repository.
 *
 * Load-order note: Apps Script evaluates files in an unspecified order, so no
 * file may reference another file's globals at load time — only inside functions.
 */

const APP = Object.freeze({
  NAME: 'CelebrateMate',
  VERSION: '1.0.0',
  TIMEZONE: 'Asia/Kolkata',
  SCHEMA_VERSION: 1,
});

/** Script Property names (values are never logged or returned). */
const PROPS = Object.freeze({
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  GOOGLE_CLIENT_ID: 'GOOGLE_CLIENT_ID',
  ALLOWED_EMAILS: 'ALLOWED_EMAILS',
  ONESIGNAL_APP_ID: 'ONESIGNAL_APP_ID',
  ONESIGNAL_REST_API_KEY: 'ONESIGNAL_REST_API_KEY',
  APP_URL: 'APP_URL',
});

const ENUMS = Object.freeze({
  CATEGORIES: ['DEVOTEE', 'GENERAL', 'HELP_DONOR'],
  OCCASIONS: ['BIRTHDAY', 'ANNIVERSARY'],
  FEB29_POLICIES: ['FEB_28', 'MAR_1'],
  REMINDER_TYPES: ['SAME_DAY', 'NEXT_DAY'],
  NOTIFICATION_STATUS: ['SENT', 'FAILED', 'SKIPPED'],
  HISTORY_STATUS: ['OPENED', 'MARKED_SENT'],
  PLATFORMS: ['ANDROID', 'IOS', 'DESKTOP', 'OTHER'],
  CONTACT_STATUS: ['ACTIVE', 'INACTIVE', 'ALL'],
});

const LIMITS = Object.freeze({
  /** After the configured reminder time, keep trying (incl. retries) for this long. */
  RETRY_WINDOW_MINUTES: 180,
  MAX_SEND_ATTEMPTS: 3,
  DISPATCH_EVERY_MINUTES: 15,
  AUTH_CACHE_SECONDS: 300,
  SETTINGS_CACHE_SECONDS: 300,
  LOCK_TIMEOUT_MS: 15000,
  MAX_BODY_CHARS: 100000,
  MAX_UPCOMING_DAYS: 366,
  MAX_PAGE_SIZE: 500,
  NOTIFICATION_BODY_MAX: 900,
});

const SHEET_NAMES = Object.freeze({
  CONTACTS: 'Contacts',
  TEMPLATES: 'Templates',
  NOTIFICATION_LOGS: 'NotificationLogs',
  DEVICES: 'Devices',
  SETTINGS: 'Settings',
  HISTORY: 'History',
  CATEGORIES: 'Categories',
});

/**
 * Sheet schema. `key` is the unique ID column. Column types:
 * string | bool | int | date (YYYY-MM-DD) | datetime (ISO-8601 UTC).
 * Columns are located by header name, so their order in the sheet may change
 * and extra user columns are preserved.
 */
const SCHEMA = Object.freeze({
  Contacts: {
    key: 'contactId',
    columns: {
      contactId: 'string',
      fullName: 'string',
      mobileNumber: 'string',
      whatsappNumber: 'string',
      birthday: 'date',
      anniversary: 'date',
      category: 'string',
      notes: 'string',
      isActive: 'bool',
      createdAt: 'datetime',
      updatedAt: 'datetime',
    },
  },
  Templates: {
    key: 'templateId',
    columns: {
      templateId: 'string',
      category: 'string',
      occasion: 'string',
      name: 'string',
      body: 'string',
      isActive: 'bool',
      isDefault: 'bool',
      sortOrder: 'int',
      createdAt: 'datetime',
      updatedAt: 'datetime',
    },
  },
  NotificationLogs: {
    key: 'logId',
    columns: {
      logId: 'string',
      dedupeKey: 'string',
      reminderType: 'string',
      eventDate: 'date',
      contactId: 'string',
      contactName: 'string',
      occasion: 'string',
      status: 'string',
      attempts: 'int',
      recipients: 'int',
      oneSignalId: 'string',
      detail: 'string',
      createdAt: 'datetime',
      updatedAt: 'datetime',
    },
  },
  Devices: {
    key: 'deviceId',
    columns: {
      deviceId: 'string',
      subscriptionId: 'string',
      platform: 'string',
      label: 'string',
      userAgent: 'string',
      isActive: 'bool',
      createdAt: 'datetime',
      updatedAt: 'datetime',
      lastSeenAt: 'datetime',
    },
  },
  Settings: {
    key: 'key',
    columns: {
      key: 'string',
      value: 'string',
      updatedAt: 'datetime',
    },
  },
  History: {
    key: 'historyId',
    columns: {
      historyId: 'string',
      contactId: 'string',
      contactName: 'string',
      category: 'string',
      occasion: 'string',
      eventDate: 'date',
      templateId: 'string',
      templateName: 'string',
      finalMessage: 'string',
      whatsappNumber: 'string',
      status: 'string',
      openedAt: 'datetime',
      markedSentAt: 'datetime',
      createdAt: 'datetime',
      updatedAt: 'datetime',
    },
  },
  Categories: {
    key: 'categoryId',
    columns: {
      categoryId: 'string',
      label: 'string',
      description: 'string',
      sortOrder: 'int',
      isActive: 'bool',
    },
  },
});

const DEFAULT_SETTINGS = Object.freeze({
  timezone: 'Asia/Kolkata',
  sameDayReminderTime: '10:00',
  nextDayReminderTime: '22:00',
  birthdayRemindersEnabled: true,
  anniversaryRemindersEnabled: true,
  feb29Policy: 'FEB_28',
  defaultCountryCode: '91',
});

/** Injectable clock (tests replace Clock.now). */
const Clock = {
  now: function () {
    return new Date();
  },
};

function getScriptProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  return value ? String(value).trim() : '';
}

function requireScriptProperty_(name) {
  const value = getScriptProperty_(name);
  if (!value) throw new AppError('NOT_CONFIGURED', 'Server is missing the Script Property ' + name + '.');
  return value;
}
