import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrontendTemplates } from '../scripts/sync-default-templates.mjs';
import { createBackend, sampleContact, STRANGER_TOKEN, VALID_TOKEN } from './harness.js';

const SHEETS = ['Contacts', 'Templates', 'NotificationLogs', 'Devices', 'Settings', 'History', 'Categories'];

function ready(options) {
  const b = createBackend(options);
  b.setup();
  return b;
}

function create(b, overrides) {
  const res = b.api('contacts.create', { contact: sampleContact(overrides) });
  assert.equal(res.ok, true, JSON.stringify(res.error));
  return res.data;
}

describe('setup / sheet initialisation', () => {
  test('creates all seven sheets with headers and seeds defaults', () => {
    const b = createBackend();
    const report = b.setup();
    assert.deepEqual(report.sheets.map((s) => s.sheet).sort(), [...SHEETS].sort());
    assert.ok(report.sheets.every((s) => s.created));
    for (const name of SHEETS) {
      const sheet = b.ss.getSheetByName(name);
      assert.ok(sheet, name);
      assert.equal(sheet.frozen, 1);
    }
    assert.deepEqual(b.ss.getSheetByName('Contacts').headers(), [
      'contactId', 'fullName', 'mobileNumber', 'whatsappNumber', 'birthday', 'anniversary', 'category', 'notes', 'isActive', 'createdAt', 'updatedAt',
    ]);
    assert.deepEqual(report.seeded, { categories: 3, templates: 18, settings: 7 });
    assert.equal(report.configuration.googleClientId, true);
    assert.equal(report.configuration.oneSignalConfigured, false);
  });

  test('is idempotent and never overwrites data', () => {
    const b = ready();
    const edited = b.api('templates.update', {
      templateId: 'TPL_GENERAL_BIRTHDAY_1',
      template: { name: 'My edit', body: 'Edited body {name}!', category: 'GENERAL', occasion: 'BIRTHDAY' },
    });
    assert.equal(edited.ok, true);
    const again = b.setup();
    assert.deepEqual(again.seeded, { categories: 0, templates: 0, settings: 0 });
    assert.ok(again.sheets.every((s) => !s.created));
    const list = b.api('templates.list').data;
    assert.equal(list.length, 18);
    assert.equal(list.find((t) => t.templateId === 'TPL_GENERAL_BIRTHDAY_1').name, 'My edit');
  });

  test('repairs missing columns and keeps extra user columns', () => {
    const b = createBackend();
    const sheet = b.ss.insertSheet('Contacts');
    sheet.rows = [['contactId', 'fullName', 'MyColumn']];
    const report = b.setup();
    const contacts = report.sheets.find((s) => s.sheet === 'Contacts');
    assert.equal(contacts.created, false);
    assert.ok(contacts.addedColumns.includes('birthday'));
    assert.equal(sheet.headers()[2], 'MyColumn');
    create(b);
    assert.equal(sheet.objects()[0].MyColumn, '');
  });

  test('uses SPREADSHEET_ID when set and reports missing sheets clearly', () => {
    const b = createBackend({ props: { SPREADSHEET_ID: 'abc' } });
    const res = b.api('contacts.list', {});
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'NOT_CONFIGURED');
    assert.match(res.error.message, /setup\(\)/);
  });
});

describe('request handling and authentication', () => {
  test('doGet health check and system.ping need no auth', () => {
    const b = ready();
    assert.equal(JSON.parse(b.run('doGet().getContent()')).data.status, 'ok');
    const ping = b.api('system.ping', {}, { token: '' });
    assert.equal(ping.ok, true);
    assert.ok(ping.meta.requestId && ping.meta.serverTime && ping.meta.version);
  });

  test('rejects malformed requests', () => {
    const b = ready();
    assert.equal(b.api(null, null, { raw: '{not json' }).error.code, 'BAD_REQUEST');
    assert.equal(b.api(null, null, { raw: '' }).error.code, 'BAD_REQUEST');
    assert.equal(b.api(null, null, { raw: '[]' }).error.code, 'BAD_REQUEST');
    assert.equal(b.api('nope.nothing', {}).error.code, 'NOT_FOUND');
    assert.equal(b.api('constructor', {}).error.code, 'NOT_FOUND');
    assert.equal(b.api('contacts.list', 'string payload').error.code, 'BAD_REQUEST');
  });

  test('requires a valid, allowlisted Google ID token', () => {
    const b = ready();
    assert.equal(b.api('contacts.list', {}, { token: '' }).error.code, 'UNAUTHORIZED');
    assert.equal(b.api('contacts.list', {}, { token: 'not-a-jwt' }).error.code, 'UNAUTHORIZED');
    assert.equal(b.api('contacts.list', {}, { token: 'a.unknown.token' }).error.code, 'UNAUTHORIZED');
    assert.equal(b.api('contacts.list', {}, { token: STRANGER_TOKEN }).error.code, 'FORBIDDEN');
    assert.equal(b.api('contacts.list', {}, { token: VALID_TOKEN }).ok, true);
    assert.equal(b.api('auth.me', {}).data.email, 'owner@example.com');
  });

  test('checks audience, issuer, expiry and email verification', () => {
    const now = () => Math.floor(Date.parse('2026-11-20T04:30:00Z') / 1000);
    const base = { iss: 'accounts.google.com', email: 'owner@example.com', email_verified: 'true' };
    const b = ready({
      tokens: {
        'a.wrongaud.c': () => ({ ...base, aud: 'other-app', exp: String(now() + 600) }),
        'a.wrongiss.c': () => ({ ...base, aud: 'test-client.apps.googleusercontent.com', iss: 'evil.com', exp: String(now() + 600) }),
        'a.expired.c': () => ({ ...base, aud: 'test-client.apps.googleusercontent.com', exp: String(now() - 1) }),
        'a.unverified.c': () => ({ ...base, aud: 'test-client.apps.googleusercontent.com', email_verified: 'false', exp: String(now() + 600) }),
      },
    });
    for (const token of ['a.wrongaud.c', 'a.wrongiss.c', 'a.expired.c', 'a.unverified.c']) {
      assert.equal(b.api('contacts.list', {}, { token }).error.code, 'UNAUTHORIZED', token);
    }
  });

  test('caches verified tokens but re-checks the allowlist', () => {
    const b = ready();
    b.api('contacts.list', {});
    b.api('contacts.list', {});
    assert.equal(b.fetchCalls.filter((c) => c.url.includes('tokeninfo')).length, 1);
    b.props.ALLOWED_EMAILS = 'someone-else@example.com';
    assert.equal(b.api('contacts.list', {}).error.code, 'FORBIDDEN');
  });

  test('fails closed when auth is not configured', () => {
    const b = ready({ props: { GOOGLE_CLIENT_ID: '' } });
    assert.equal(b.api('contacts.list', {}).error.code, 'NOT_CONFIGURED');
  });

  test('never leaks internal error details', () => {
    const b = ready();
    b.run("ContactService.list = function () { throw new Error('secret internal detail'); }");
    const res = b.api('contacts.list', {});
    assert.equal(res.error.code, 'INTERNAL');
    assert.doesNotMatch(res.error.message, /secret/);
    assert.match(res.error.message, new RegExp(res.meta.requestId));
  });
});

describe('contacts', () => {
  test('create normalises phone numbers and stores dates as text', () => {
    const b = ready();
    const c = create(b, { fullName: '  Priya   Sharma ', whatsappNumber: '+44 7700 900123', anniversary: '2020-02-29' });
    assert.match(c.contactId, /^CON_[A-F0-9]{20}$/);
    assert.equal(c.fullName, 'Priya Sharma');
    assert.equal(c.mobileNumber, '+919876543210');
    assert.equal(c.whatsappNumber, '+447700900123');
    assert.equal(c.birthday, '1996-11-20');
    assert.equal(c.anniversary, '2020-02-29');
    assert.equal(c.isActive, true);
    const row = b.ss.getSheetByName('Contacts').objects()[0];
    assert.equal(row.mobileNumber, '+919876543210');
    assert.equal(row.birthday, '1996-11-20');
    assert.equal(row.isActive, 'TRUE');
  });

  test('whatsapp defaults to mobile; supports both occasions and missing dates', () => {
    const b = ready();
    const both = create(b, { fullName: 'Both Dates', anniversary: '2015-06-01' });
    assert.equal(both.whatsappNumber, both.mobileNumber);
    const none = create(b, { fullName: 'No Dates', birthday: '', mobileNumber: '9811122233' });
    assert.equal(none.birthday, null);
    assert.equal(none.anniversary, null);
  });

  test('validates every field and reports field errors', () => {
    const b = ready();
    const res = b.api('contacts.create', {
      contact: { fullName: 'A', mobileNumber: '123', category: 'VIP', birthday: '2099-01-01', anniversary: '2020-02-30', notes: 'x'.repeat(1001) },
    });
    assert.equal(res.error.code, 'VALIDATION');
    assert.deepEqual(Object.keys(res.error.details).sort(), ['anniversary', 'birthday', 'category', 'fullName', 'mobileNumber', 'notes']);
    assert.match(res.error.details.birthday, /future/);
    assert.equal(b.api('contacts.create', {}).error.code, 'BAD_REQUEST');
    assert.equal(b.api('contacts.create', { contact: { ...sampleContact(), fullName: 42 } }).error.code, 'VALIDATION');
  });

  test('prevents duplicate active contacts', () => {
    const b = ready();
    create(b);
    const dup = b.api('contacts.create', { contact: sampleContact({ fullName: 'priya sharma', mobileNumber: '+91 98765 43210' }) });
    assert.equal(dup.error.code, 'CONFLICT');
  });

  test('get / update / soft delete / reactivate', () => {
    const b = ready();
    const c = create(b);
    assert.equal(b.api('contacts.get', { contactId: c.contactId }).data.fullName, 'Priya Sharma');
    assert.equal(b.api('contacts.get', { contactId: 'CON_MISSING' }).error.code, 'NOT_FOUND');
    assert.equal(b.api('contacts.get', { contactId: '../etc' }).error.code, 'VALIDATION');

    b.setNow('2026-11-21T04:30:00Z');
    const updated = b.api('contacts.update', { contactId: c.contactId, contact: sampleContact({ notes: 'Loves cake', category: 'DEVOTEE' }) }).data;
    assert.equal(updated.notes, 'Loves cake');
    assert.equal(updated.category, 'DEVOTEE');
    assert.equal(updated.createdAt, c.createdAt);
    assert.notEqual(updated.updatedAt, c.updatedAt);

    const off = b.api('contacts.deactivate', { contactId: c.contactId }).data;
    assert.equal(off.isActive, false);
    assert.equal(b.ss.getSheetByName('Contacts').objects().length, 1, 'soft delete keeps the row');
    assert.equal(b.api('contacts.list', {}).data.length, 0);
    assert.equal(b.api('contacts.list', { status: 'INACTIVE' }).data.length, 1);
    assert.equal(b.api('contacts.reactivate', { contactId: c.contactId }).data.isActive, true);
  });

  test('list filters by search, category and status', () => {
    const b = ready();
    create(b, { fullName: 'Priya Sharma', notes: 'college friend' });
    create(b, { fullName: 'Gopal Das', mobileNumber: '9830011223', category: 'DEVOTEE' });
    create(b, { fullName: 'Anil Kapoor', mobileNumber: '9900112233', category: 'HELP_DONOR' });
    const names = (payload) => b.api('contacts.list', payload).data.map((c) => c.fullName);
    assert.deepEqual(names({}), ['Anil Kapoor', 'Gopal Das', 'Priya Sharma']);
    assert.deepEqual(names({ search: 'gopal' }), ['Gopal Das']);
    assert.deepEqual(names({ search: 'COLLEGE' }), ['Priya Sharma']);
    assert.deepEqual(names({ search: '99001' }), ['Anil Kapoor']);
    assert.deepEqual(names({ search: '+91 98765' }), ['Priya Sharma']);
    assert.deepEqual(names({ category: 'DEVOTEE' }), ['Gopal Das']);
    assert.deepEqual(b.api('contacts.search', { search: 'anil' }).data.map((c) => c.fullName), ['Anil Kapoor']);
    assert.equal(b.api('contacts.list', { category: 'NOPE' }).error.code, 'VALIDATION');
  });

  test('stores formula-like text literally (no formula injection)', () => {
    const b = ready();
    const c = create(b, { notes: '=IMPORTXML("http://evil", "//a")' });
    assert.equal(b.api('contacts.get', { contactId: c.contactId }).data.notes, '=IMPORTXML("http://evil", "//a")');
  });

  test('tolerates hand-edited sheet values (Date cells, numeric phones, duplicate rows)', () => {
    const b = ready();
    const c = create(b);
    const sheet = b.ss.getSheetByName('Contacts');
    const headers = sheet.headers();
    sheet.rows[1][headers.indexOf('birthday')] = new Date('1990-05-14T00:00:00+05:30');
    sheet.rows[1][headers.indexOf('mobileNumber')] = 919876543210;
    sheet.rows[2] = sheet.rows[1].slice(); // duplicate contactId row
    b.run('Database.clearCache()');
    const list = b.api('contacts.list', {}).data;
    assert.equal(list.length, 1);
    assert.equal(list[0].contactId, c.contactId);
    assert.equal(list[0].birthday, '1990-05-14');
    assert.equal(list[0].mobileNumber, '+919876543210');
  });
});

describe('templates and categories', () => {
  test('seeds the 18 default templates identical to the frontend', () => {
    const b = ready();
    const list = b.api('templates.list').data;
    const frontend = loadFrontendTemplates();
    assert.equal(list.length, 18);
    for (const t of frontend) {
      const s = list.find((x) => x.templateId === t.templateId);
      assert.ok(s, t.templateId);
      assert.deepEqual(
        { category: s.category, occasion: s.occasion, name: s.name, body: s.body, sortOrder: s.sortOrder },
        { category: t.category, occasion: t.occasion, name: t.name, body: t.body, sortOrder: t.sortOrder },
      );
      assert.equal(s.isDefault, true);
    }
    assert.deepEqual(b.api('categories.list').data.map((c) => c.categoryId), ['DEVOTEE', 'GENERAL', 'HELP_DONOR']);
  });

  test('create, update and validate templates', () => {
    const b = ready();
    const t = b.api('templates.create', { template: { name: 'Extra', body: 'Hello {first_name}, happy {occasion}!', category: 'GENERAL', occasion: 'ANNIVERSARY' } }).data;
    assert.equal(t.sortOrder, 4);
    assert.equal(t.isDefault, false);
    assert.equal(b.api('templates.create', { template: { name: 'x', body: 'short', category: 'GENERAL', occasion: 'X' } }).error.code, 'VALIDATION');
    assert.equal(b.api('templates.update', { templateId: 'TPL_NOPE', template: { name: 'Valid', body: 'Valid body text', category: 'GENERAL', occasion: 'BIRTHDAY' } }).error.code, 'NOT_FOUND');
  });

  test('keeps at least one active template per category and occasion', () => {
    const b = ready();
    const ids = ['TPL_DEVOTEE_BIRTHDAY_1', 'TPL_DEVOTEE_BIRTHDAY_2', 'TPL_DEVOTEE_BIRTHDAY_3'];
    assert.equal(b.api('templates.setActive', { templateId: ids[0], isActive: false }).data.isActive, false);
    assert.equal(b.api('templates.setActive', { templateId: ids[1], isActive: false }).ok, true);
    assert.equal(b.api('templates.setActive', { templateId: ids[2], isActive: false }).error.code, 'VALIDATION');
    // Moving the last active one to another group is also blocked.
    const move = b.api('templates.update', { templateId: ids[2], template: { name: 'Moved', body: 'Moved body text', category: 'GENERAL', occasion: 'BIRTHDAY' } });
    assert.equal(move.error.code, 'VALIDATION');
    assert.equal(b.api('templates.setActive', { templateId: ids[0], isActive: 'yes' }).error.code, 'VALIDATION');
  });
});

describe('settings', () => {
  test('returns defaults and validates updates', () => {
    const b = ready();
    assert.deepEqual(b.api('settings.get').data, {
      timezone: 'Asia/Kolkata',
      sameDayReminderTime: '10:00',
      nextDayReminderTime: '22:00',
      birthdayRemindersEnabled: true,
      anniversaryRemindersEnabled: true,
      feb29Policy: 'FEB_28',
      defaultCountryCode: '91',
    });
    const updated = b.api('settings.update', { settings: { sameDayReminderTime: '09:30', anniversaryRemindersEnabled: false, feb29Policy: 'MAR_1' } }).data;
    assert.equal(updated.sameDayReminderTime, '09:30');
    assert.equal(updated.anniversaryRemindersEnabled, false);
    assert.equal(updated.feb29Policy, 'MAR_1');

    const bad = b.api('settings.update', { settings: { sameDayReminderTime: '25:00', birthdayRemindersEnabled: 'yes', timezone: 'UTC', hack: 1 } });
    assert.equal(bad.error.code, 'VALIDATION');
    assert.deepEqual(Object.keys(bad.error.details).sort(), ['birthdayRemindersEnabled', 'hack', 'sameDayReminderTime', 'timezone']);
    assert.equal(b.api('settings.update', { settings: {} }).error.code, 'VALIDATION');
  });
});

describe('celebrations', () => {
  test('dashboard, today, tomorrow and upcoming use IST and skip inactive contacts', () => {
    const b = ready(); // now = 2026-11-20 10:00 IST
    create(b, { fullName: 'Today Birthday', birthday: '1996-11-20' });
    create(b, { fullName: 'Today Anniversary', mobileNumber: '9811111111', birthday: '', anniversary: '2001-11-20' });
    create(b, { fullName: 'Tomorrow', mobileNumber: '9822222222', birthday: '1980-11-21' });
    create(b, { fullName: 'In Five', mobileNumber: '9833333333', birthday: '1980-11-25' });
    const inactive = create(b, { fullName: 'Inactive', mobileNumber: '9844444444', birthday: '1990-11-20' });
    b.api('contacts.deactivate', { contactId: inactive.contactId });

    const d = b.api('dashboard.get').data;
    assert.equal(d.today, '2026-11-20');
    assert.deepEqual(d.totals, { activeContacts: 4, todayBirthdays: 1, todayAnniversaries: 1, tomorrow: 1, next7Days: 4, next30Days: 4 });
    assert.equal(d.todayCelebrations.find((c) => c.occasion === 'BIRTHDAY').years, 30);
    assert.equal(d.todayCelebrations.find((c) => c.occasion === 'ANNIVERSARY').years, 25);
    assert.deepEqual(d.upcoming30.map((c) => [c.contact.fullName, c.daysUntil]), [['In Five', 5]]);
    assert.equal(d.categoryStats.find((s) => s.category === 'GENERAL').total, 4);

    assert.deepEqual(b.api('celebrations.today').data.celebrations.map((c) => c.contact.fullName), ['Today Anniversary', 'Today Birthday']);
    const tomorrow = b.api('celebrations.tomorrow').data;
    assert.equal(tomorrow.date, '2026-11-21');
    assert.deepEqual(tomorrow.celebrations.map((c) => [c.contact.fullName, c.daysUntil]), [['Tomorrow', 1]]);
    assert.equal(b.api('celebrations.upcoming', { days: 3 }).data.celebrations.length, 3);
    assert.equal(b.api('celebrations.upcoming', { days: 400 }).error.code, 'VALIDATION');
  });

  test('IST midnight boundary: 23:59 vs 00:01 IST', () => {
    const b = ready({ now: '2026-11-20T18:29:00Z' }); // 23:59 IST on 20 Nov
    create(b, { fullName: 'Twenty First', birthday: '1990-11-21' });
    assert.equal(b.api('celebrations.today').data.celebrations.length, 0);
    b.setNow('2026-11-20T18:31:00Z'); // 00:01 IST on 21 Nov
    assert.equal(b.api('celebrations.today').data.celebrations.length, 1);
  });

  test('upcoming crosses the year boundary; month view applies Feb 29 policy', () => {
    const b = ready({ now: '2026-12-30T04:30:00Z' });
    create(b, { fullName: 'New Year', birthday: '1980-01-01' });
    create(b, { fullName: 'Leapling', mobileNumber: '9855555555', birthday: '2000-02-29' });
    const up = b.api('celebrations.upcoming', { days: 7 }).data;
    assert.equal(up.to, '2027-01-06');
    assert.deepEqual(up.celebrations.map((c) => [c.contact.fullName, c.eventDate, c.daysUntil, c.years]), [['New Year', '2027-01-01', 2, 47]]);

    const feb = b.api('celebrations.month', { year: 2027, month: 2 }).data.celebrations;
    assert.deepEqual(feb.map((c) => c.eventDate), ['2027-02-28']);
    b.api('settings.update', { settings: { feb29Policy: 'MAR_1' } });
    assert.equal(b.api('celebrations.month', { year: 2027, month: 2 }).data.celebrations.length, 0);
    assert.deepEqual(b.api('celebrations.month', { year: 2027, month: 3 }).data.celebrations.map((c) => c.eventDate), ['2027-03-01']);
    assert.equal(b.api('celebrations.month', { year: 2027, month: 13 }).error.code, 'VALIDATION');
  });

  test('a contact with both occasions on the same day yields two celebrations', () => {
    const b = ready();
    create(b, { fullName: 'Double', birthday: '1990-11-20', anniversary: '2015-11-20' });
    assert.deepEqual(b.api('celebrations.today').data.celebrations.map((c) => c.occasion), ['ANNIVERSARY', 'BIRTHDAY']);
  });
});

describe('history', () => {
  test('records OPENED and MARKED_SENT as separate states', () => {
    const b = ready();
    const c = create(b);
    const entry = b.api('history.logOpened', {
      entry: { contactId: c.contactId, occasion: 'BIRTHDAY', eventDate: '2026-11-20', templateId: 'TPL_GENERAL_BIRTHDAY_1', finalMessage: 'Happy birthday Priya!' },
    }).data;
    assert.equal(entry.status, 'OPENED');
    assert.ok(entry.openedAt);
    assert.equal(entry.markedSentAt, '');
    assert.equal(entry.templateName, 'Classic wishes');
    assert.equal(entry.whatsappNumber, '+919876543210');

    b.setNow('2026-11-20T05:00:00Z');
    const sent = b.api('history.markSent', { historyId: entry.historyId }).data;
    assert.equal(sent.status, 'MARKED_SENT');
    assert.equal(sent.openedAt, entry.openedAt);
    assert.notEqual(sent.markedSentAt, '');
    // Idempotent
    assert.equal(b.api('history.markSent', { historyId: entry.historyId }).data.markedSentAt, sent.markedSentAt);

    assert.equal(b.api('history.list', { contactId: c.contactId }).data.length, 1);
    assert.equal(b.api('history.list', { limit: 0 }).error.code, 'VALIDATION');
  });

  test('validates history entries', () => {
    const b = ready();
    const c = create(b, { birthday: '1990-01-01', anniversary: '' });
    const base = { contactId: c.contactId, occasion: 'ANNIVERSARY', eventDate: '2026-11-20', finalMessage: 'Hi' };
    assert.equal(b.api('history.logOpened', { entry: base }).error.code, 'VALIDATION'); // contact has no anniversary
    assert.equal(b.api('history.logOpened', { entry: { ...base, occasion: 'BIRTHDAY', eventDate: 'tomorrow' } }).error.code, 'VALIDATION');
    assert.equal(b.api('history.logOpened', { entry: { ...base, occasion: 'BIRTHDAY', contactId: 'CON_NONE' } }).error.code, 'NOT_FOUND');
    assert.equal(b.api('history.logOpened', { entry: { ...base, occasion: 'BIRTHDAY', templateId: 'TPL_NONE' } }).error.code, 'NOT_FOUND');
    assert.equal(b.api('history.markSent', { historyId: 'HIS_NONE' }).error.code, 'NOT_FOUND');
  });
});

describe('devices', () => {
  test('register upserts by subscription ID and can be deactivated', () => {
    const b = ready();
    const sub = '6d2c8a1e-1111-4a2b-9c3d-123456789abc';
    const first = b.api('devices.register', { device: { subscriptionId: sub, platform: 'ANDROID', label: 'Pixel' } }).data;
    b.setNow('2026-11-21T04:30:00Z');
    const again = b.api('devices.register', { device: { subscriptionId: sub, platform: 'ANDROID' } }).data;
    assert.equal(again.deviceId, first.deviceId);
    assert.equal(again.label, 'Pixel');
    assert.notEqual(again.lastSeenAt, first.lastSeenAt);
    assert.equal(b.api('devices.list').data.length, 1);
    assert.equal(b.api('devices.deactivate', { deviceId: first.deviceId }).data.isActive, false);
    assert.equal(b.api('devices.register', { device: { subscriptionId: 'bad id!' } }).error.code, 'VALIDATION');
    assert.equal(b.api('devices.register', { device: { subscriptionId: sub, platform: 'TOASTER' } }).error.code, 'VALIDATION');
  });
});

describe('route coverage', () => {
  test('every documented action exists', () => {
    const b = ready();
    const actions = b.run('Router.actions()');
    for (const a of [
      'system.ping', 'auth.me', 'dashboard.get', 'celebrations.today', 'celebrations.tomorrow', 'celebrations.upcoming', 'celebrations.month',
      'contacts.list', 'contacts.search', 'contacts.get', 'contacts.create', 'contacts.update', 'contacts.deactivate', 'contacts.reactivate',
      'categories.list', 'templates.list', 'templates.create', 'templates.update', 'templates.setActive', 'settings.get', 'settings.update',
      'history.list', 'history.logOpened', 'history.markSent', 'devices.list', 'devices.register', 'devices.deactivate',
      'notifications.test', 'notifications.logs', 'notifications.status',
    ]) {
      assert.ok(actions.includes(a), a);
    }
  });
});
