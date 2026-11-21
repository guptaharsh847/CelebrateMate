import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackend, sampleContact } from './harness.js';

const ONESIGNAL = { ONESIGNAL_APP_ID: 'app-123', ONESIGNAL_REST_API_KEY: 'test-key', APP_URL: 'https://example.github.io/CelebrateMate/' };
const SUB_A = 'aaaaaaaa-1111-4a2b-9c3d-123456789abc';
const SUB_B = 'bbbbbbbb-2222-4a2b-9c3d-123456789abc';

/** 2026-11-20 10:05 IST; Priya (birthday) + Iyers (anniversary) today, Meera tomorrow. */
function scenario({ props = ONESIGNAL, devices = [SUB_A], oneSignal } = {}) {
  const b = createBackend({ now: '2026-11-20T04:35:00Z', props, oneSignal });
  b.setup();
  const add = (o) => b.api('contacts.create', { contact: sampleContact(o) }).data;
  const people = {
    priya: add({ fullName: 'Priya Sharma', birthday: '1996-11-20' }),
    iyers: add({ fullName: 'Ramesh & Sunita Iyer', mobileNumber: '9812345678', birthday: '', anniversary: '2001-11-20' }),
    meera: add({ fullName: 'Meera Nair', mobileNumber: '9845098450', birthday: '1992-11-21' }),
  };
  devices.forEach((subscriptionId) => b.api('devices.register', { device: { subscriptionId, platform: 'ANDROID' } }));
  return { b, people };
}

const dispatch = (b) => b.run('dispatchReminders()');
const logs = (b) => b.ss.getSheetByName('NotificationLogs').objects();

describe('scheduled reminders', () => {
  test('sends ONE aggregated same-day notification with names and occasions', () => {
    const { b, people } = scenario();
    const result = dispatch(b);
    assert.equal(result.results.SAME_DAY.status, 'SENT');
    assert.equal(result.results.SAME_DAY.sent, 2);
    assert.equal(result.results.NEXT_DAY.status, 'OUTSIDE_WINDOW');

    const calls = b.oneSignalCalls();
    assert.equal(calls.length, 1, 'one aggregated push, not one per contact');
    const body = calls[0].body;
    assert.equal(calls[0].opts.headers.Authorization, 'Key test-key');
    assert.equal(body.app_id, 'app-123');
    assert.equal(body.target_channel, 'push');
    assert.deepEqual(body.include_subscription_ids, [SUB_A]);
    assert.equal(body.headings.en, '🎉 Today: 2 celebrations · 20 November');
    assert.equal(body.contents.en, 'Priya Sharma · Birthday (turns 30)\nRamesh & Sunita Iyer · Anniversary (25th)');
    assert.equal(body.web_url, 'https://example.github.io/CelebrateMate/#/');
    assert.match(body.idempotency_key, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);

    const rows = logs(b);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((r) => r.dedupeKey).sort(), [
      `2026-11-20|${people.iyers.contactId}|ANNIVERSARY|SAME_DAY`,
      `2026-11-20|${people.priya.contactId}|BIRTHDAY|SAME_DAY`,
    ].sort());
    assert.ok(rows.every((r) => r.status === 'SENT' && r.attempts === '1' && r.recipients === '1' && r.oneSignalId));
  });

  test('never sends duplicates on later runs or manual re-runs', () => {
    const { b } = scenario();
    dispatch(b);
    b.setNow('2026-11-20T04:50:00Z'); // 10:20 IST
    assert.equal(dispatch(b).results.SAME_DAY.status, 'ALREADY_PROCESSED');
    assert.equal(b.run('runSameDayReminderNow()').status, 'ALREADY_PROCESSED');
    assert.equal(b.oneSignalCalls().length, 1);
    assert.equal(logs(b).length, 2);
  });

  test('a contact added later in the window gets its own reminder without repeating others', () => {
    const { b } = scenario();
    dispatch(b);
    b.api('contacts.create', { contact: sampleContact({ fullName: 'Late Addition', mobileNumber: '9877777777', birthday: '2000-11-20' }) });
    b.setNow('2026-11-20T05:00:00Z');
    const r = dispatch(b).results.SAME_DAY;
    assert.equal(r.status, 'SENT');
    assert.equal(r.sent, 1);
    assert.equal(b.oneSignalCalls()[1].body.contents.en, 'Late Addition · Birthday (turns 26)');
  });

  test('next-day reminder at 22:00 IST covers tomorrow', () => {
    const { b, people } = scenario();
    b.setNow('2026-11-20T16:35:00Z'); // 22:05 IST
    const r = dispatch(b);
    assert.equal(r.results.SAME_DAY.status, 'OUTSIDE_WINDOW');
    assert.equal(r.results.NEXT_DAY.status, 'SENT');
    const body = b.oneSignalCalls()[0].body;
    assert.equal(body.headings.en, '🎉 Tomorrow: 1 celebration · 21 November');
    assert.equal(body.contents.en, 'Meera Nair · Birthday (turns 34)');
    assert.equal(logs(b)[0].dedupeKey, `2026-11-21|${people.meera.contactId}|BIRTHDAY|NEXT_DAY`);
  });

  test('does nothing outside the window (before the time or after the retry window)', () => {
    const { b } = scenario();
    b.setNow('2026-11-20T04:15:00Z'); // 09:45 IST
    assert.equal(dispatch(b).results.SAME_DAY.status, 'OUTSIDE_WINDOW');
    b.setNow('2026-11-20T07:35:00Z'); // 13:05 IST (window 10:00–13:00)
    assert.equal(dispatch(b).results.SAME_DAY.status, 'OUTSIDE_WINDOW');
    assert.equal(b.oneSignalCalls().length, 0);
  });

  test('honours custom reminder times from Settings', () => {
    const { b } = scenario();
    b.api('settings.update', { settings: { sameDayReminderTime: '08:00' } });
    b.setNow('2026-11-20T02:35:00Z'); // 08:05 IST
    assert.equal(dispatch(b).results.SAME_DAY.status, 'SENT');
  });

  test('retries failures within the window, up to MAX_SEND_ATTEMPTS', () => {
    let calls = 0;
    const { b } = scenario({ oneSignal: () => (++calls === 1 ? { status: 500, body: { errors: ['Internal error'] } } : { status: 200, body: { id: 'notif-ok' } }) });
    const first = dispatch(b).results.SAME_DAY;
    assert.equal(first.status, 'FAILED');
    assert.ok(logs(b).every((r) => r.status === 'FAILED' && r.attempts === '1'));

    b.setNow('2026-11-20T04:50:00Z');
    const second = dispatch(b).results.SAME_DAY;
    assert.equal(second.status, 'SENT');
    const rows = logs(b);
    assert.equal(rows.length, 2, 'log rows are updated in place');
    assert.ok(rows.every((r) => r.status === 'SENT' && r.attempts === '2' && r.oneSignalId === 'notif-ok'));
    // Retry reuses the same idempotency key so OneSignal can de-duplicate.
    const [a, c] = b.oneSignalCalls();
    assert.equal(a.body.idempotency_key, c.body.idempotency_key);
  });

  test('stops retrying after the maximum attempts', () => {
    const { b } = scenario({ oneSignal: () => ({ status: 503, body: {} }) });
    for (let i = 0; i < 4; i++) {
      b.setNow(new Date(Date.parse('2026-11-20T04:35:00Z') + i * 15 * 60000).toISOString());
      dispatch(b);
    }
    assert.equal(b.oneSignalCalls().length, 3);
    assert.ok(logs(b).every((r) => r.status === 'FAILED' && r.attempts === '3'));
    assert.match(logs(b)[0].detail, /HTTP 503/);
  });

  test('network errors are logged as failures', () => {
    const { b } = scenario({ oneSignal: () => new Error('DNS error') });
    const r = dispatch(b).results.SAME_DAY;
    assert.equal(r.status, 'FAILED');
    assert.match(logs(b)[0].detail, /Could not reach OneSignal/);
  });

  test('disabled occasions are logged as SKIPPED and not sent', () => {
    const { b } = scenario();
    b.api('settings.update', { settings: { birthdayRemindersEnabled: false } });
    const r = dispatch(b).results.SAME_DAY;
    assert.equal(r.status, 'SENT');
    assert.equal(r.sent, 1);
    assert.equal(r.skipped, 1);
    assert.equal(b.oneSignalCalls()[0].body.contents.en, 'Ramesh & Sunita Iyer · Anniversary (25th)');
    const skipped = logs(b).find((l) => l.status === 'SKIPPED');
    assert.equal(skipped.occasion, 'BIRTHDAY');
    assert.match(skipped.detail, /turned off/);
  });

  test('no registered devices → SKIPPED, nothing sent', () => {
    const { b } = scenario({ devices: [] });
    assert.equal(dispatch(b).results.SAME_DAY.status, 'SKIPPED');
    assert.equal(b.oneSignalCalls().length, 0);
    assert.ok(logs(b).every((r) => r.status === 'SKIPPED' && r.detail === 'No registered devices'));
  });

  test('OneSignal not configured → nothing logged, so it can still send once configured', () => {
    const { b } = scenario({ props: {} });
    assert.equal(dispatch(b).results.SAME_DAY.status, 'NOT_CONFIGURED');
    assert.equal(logs(b).length, 0);
    Object.assign(b.props, ONESIGNAL);
    b.setNow('2026-11-20T04:50:00Z');
    assert.equal(dispatch(b).results.SAME_DAY.status, 'SENT');
  });

  test('sends to all active devices and deactivates ones OneSignal reports invalid', () => {
    const { b } = scenario({
      devices: [SUB_A, SUB_B],
      oneSignal: () => ({ status: 200, body: { id: 'n1', errors: { invalid_player_ids: [SUB_B] } } }),
    });
    dispatch(b);
    assert.deepEqual(b.oneSignalCalls()[0].body.include_subscription_ids.sort(), [SUB_A, SUB_B]);
    const devices = b.api('devices.list').data;
    assert.equal(devices.find((d) => d.subscriptionId === SUB_B).isActive, false);
    assert.equal(devices.find((d) => d.subscriptionId === SUB_A).isActive, true);
  });

  test('inactive contacts are excluded from reminders', () => {
    const { b, people } = scenario();
    b.api('contacts.deactivate', { contactId: people.priya.contactId });
    const r = dispatch(b).results.SAME_DAY;
    assert.equal(r.sent, 1);
    assert.doesNotMatch(b.oneSignalCalls()[0].body.contents.en, /Priya/);
  });

  test('long lists are truncated with "…and N more"', () => {
    const b = createBackend();
    const many = Array.from({ length: 60 }, (_, i) => ({ contact: { fullName: `Contact Number ${i + 1}` }, occasion: 'BIRTHDAY', years: 40 }));
    b.context.__many = many;
    const msg = b.run("NotificationService.compose(__many, 'SAME_DAY', '2026-11-20')");
    assert.ok(msg.message.length <= 900);
    assert.match(msg.message, /…and \d+ more$/);
    assert.equal(msg.title, '🎉 Today: 60 celebrations · 20 November');
  });
});

describe('scheduler and test notification', () => {
  test('installTriggers creates exactly one 15-minute dispatcher', () => {
    const { b } = scenario();
    b.run('installTriggers()');
    b.run('installTriggers()');
    assert.equal(b.triggers.length, 1);
    assert.equal(b.triggers[0].spec.handler, 'dispatchReminders');
    assert.equal(b.triggers[0].spec.everyMinutes, 15);
    assert.deepEqual(b.api('notifications.status').data, {
      oneSignalConfigured: true,
      scheduler: { handler: 'dispatchReminders', installed: true, count: 1, everyMinutes: 15, timezone: 'Asia/Kolkata' },
    });
    assert.equal(b.run('removeTriggers()'), 1);
  });

  test('notifications.test sends to registered devices and logs the result', () => {
    const { b } = scenario();
    const res = b.api('notifications.test', {});
    assert.equal(res.ok, true);
    assert.equal(res.data.recipients, 1);
    assert.match(res.data.note, /not guaranteed/);
    assert.equal(b.oneSignalCalls()[0].body.headings.en, '🔔 CelebrateMate test');
    assert.equal(b.api('notifications.logs', { limit: 5 }).data[0].reminderType, 'TEST');
  });

  test('notifications.test reports configuration and device problems', () => {
    assert.equal(scenario({ props: {} }).b.api('notifications.test', {}).error.code, 'NOT_CONFIGURED');
    assert.equal(scenario({ devices: [] }).b.api('notifications.test', {}).error.code, 'VALIDATION');
    const failing = scenario({ oneSignal: () => ({ status: 400, body: { errors: ['Invalid app_id'] } }) }).b;
    const res = failing.api('notifications.test', {});
    assert.equal(res.error.code, 'UPSTREAM_ERROR');
    assert.equal(failing.api('notifications.logs', {}).data[0].status, 'FAILED');
  });

  test('the REST API key is never returned to clients', () => {
    const { b } = scenario();
    for (const action of ['notifications.status', 'settings.get', 'devices.list', 'notifications.logs', 'dashboard.get']) {
      assert.doesNotMatch(JSON.stringify(b.api(action, {})), /test-key/, action);
    }
    assert.doesNotMatch(JSON.stringify(b.run('checkConfiguration()')), /test-key|app-123/);
  });
});
