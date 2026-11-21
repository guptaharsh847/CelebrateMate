/**
 * NotificationService.gs — aggregated celebration reminders.
 *
 * - SAME_DAY reminder (default 10:00 IST) covers today's celebrations.
 * - NEXT_DAY reminder (default 22:00 IST) covers tomorrow's celebrations.
 * - One aggregated push per run, never one per contact.
 * - Each contact/occasion is tracked in NotificationLogs by
 *   dedupeKey = eventDate|contactId|occasion|reminderType (one row, updated in place):
 *     SENT    — accepted by OneSignal (delivery is NOT guaranteed); never re-sent.
 *     FAILED  — retried by later dispatcher runs inside the window, up to MAX_SEND_ATTEMPTS.
 *     SKIPPED — reminders disabled or no registered devices; terminal.
 * - Apps Script triggers are approximate; the dispatcher runs every 15 minutes and
 *   acts only inside [reminderTime, reminderTime + RETRY_WINDOW_MINUTES] IST.
 */
const NotificationService = (function () {
  function logsTable_() {
    return SHEET_NAMES.NOTIFICATION_LOGS;
  }

  function occasionLabel_(occasion) {
    return occasion === 'BIRTHDAY' ? 'Birthday' : 'Anniversary';
  }

  function describe_(c) {
    let extra = '';
    if (c.years) extra = c.occasion === 'BIRTHDAY' ? ' (turns ' + c.years + ')' : ' (' + DateUtils.ordinal(c.years) + ')';
    return c.contact.fullName + ' · ' + occasionLabel_(c.occasion) + extra;
  }

  /** Builds one aggregated title/message for a list of celebrations. */
  function compose(celebrations, reminderType, eventDate) {
    const count = celebrations.length;
    const when = reminderType === 'SAME_DAY' ? 'Today' : 'Tomorrow';
    const title = '🎉 ' + when + ': ' + count + ' celebration' + (count === 1 ? '' : 's') + ' · ' + DateUtils.formatDayMonth(eventDate);
    const lines = [];
    let length = 0;
    for (let i = 0; i < celebrations.length; i++) {
      const line = describe_(celebrations[i]);
      const remaining = celebrations.length - i;
      if (length + line.length + 1 > LIMITS.NOTIFICATION_BODY_MAX - 20 && remaining > 0) {
        lines.push('…and ' + remaining + ' more');
        break;
      }
      lines.push(line);
      length += line.length + 1;
    }
    return { title: title, message: lines.join('\n') };
  }

  function logsByKey_() {
    const index = {};
    Database.list(logsTable_()).forEach(function (log) {
      if (log.dedupeKey) index[log.dedupeKey] = log;
    });
    return index;
  }

  function upsertLog_(existing, fields) {
    const now = Clock.now().toISOString();
    if (existing) return Database.update(logsTable_(), existing.logId, Object.assign({}, fields, { updatedAt: now }));
    return Database.insert(logsTable_(), Object.assign({ logId: Database.newId('LOG'), attempts: 0, recipients: 0, oneSignalId: '', detail: '', createdAt: now, updatedAt: now }, fields));
  }

  function logFields_(item, reminderType) {
    return {
      dedupeKey: item.dedupeKey,
      reminderType: reminderType,
      eventDate: item.celebration.eventDate,
      contactId: item.celebration.contact.contactId,
      contactName: item.celebration.contact.fullName,
      occasion: item.celebration.occasion,
    };
  }

  function appUrl_() {
    const url = getScriptProperty_(PROPS.APP_URL);
    return url ? url.replace(/\/+$/, '') + '/#/' : '';
  }

  /**
   * Runs one reminder type now. Safe to call repeatedly: already SENT/SKIPPED
   * keys are never re-sent, FAILED keys are retried up to MAX_SEND_ATTEMPTS.
   */
  function runReminder(reminderType, nowParts) {
    if (ENUMS.REMINDER_TYPES.indexOf(reminderType) === -1) throw new AppError('BAD_REQUEST', 'Unknown reminder type.');
    const now = nowParts || DateUtils.nowParts();
    const settings = SettingsService.get();
    const eventDate = reminderType === 'SAME_DAY' ? now.date : DateUtils.addDays(now.date, 1);
    const celebrations = CelebrationService.forDate(ContactService.activeContacts(), eventDate, now.date, settings.feb29Policy);
    const result = { reminderType: reminderType, eventDate: eventDate, total: celebrations.length, sent: 0, failed: 0, skipped: 0, status: '' };
    if (!celebrations.length) {
      result.status = 'NO_CELEBRATIONS';
      return result;
    }

    const logs = logsByKey_();
    const enabled = { BIRTHDAY: settings.birthdayRemindersEnabled, ANNIVERSARY: settings.anniversaryRemindersEnabled };
    const pending = [];
    const disabled = [];
    celebrations.forEach(function (c) {
      const dk = CelebrationService.dedupeKey(c.eventDate, c.contact.contactId, c.occasion, reminderType);
      const log = logs[dk];
      if (log && (log.status === 'SENT' || log.status === 'SKIPPED')) return;
      if (log && log.status === 'FAILED' && log.attempts >= LIMITS.MAX_SEND_ATTEMPTS) return;
      const item = { celebration: c, dedupeKey: dk, log: log };
      if (enabled[c.occasion]) pending.push(item);
      else disabled.push(item);
    });

    disabled.forEach(function (item) {
      upsertLog_(item.log, Object.assign(logFields_(item, reminderType), { status: 'SKIPPED', detail: occasionLabel_(item.celebration.occasion) + ' reminders are turned off' }));
    });
    result.skipped = disabled.length;

    if (!pending.length) {
      result.status = disabled.length ? 'SKIPPED' : 'ALREADY_PROCESSED';
      return result;
    }
    if (!OneSignalService.isConfigured()) {
      // Not logged: once OneSignal is configured, pending reminders in the window still go out.
      result.status = 'NOT_CONFIGURED';
      return result;
    }

    const devices = DeviceService.activeDevices();
    if (!devices.length) {
      pending.forEach(function (item) {
        upsertLog_(item.log, Object.assign(logFields_(item, reminderType), { status: 'SKIPPED', detail: 'No registered devices' }));
      });
      result.skipped += pending.length;
      result.status = 'SKIPPED';
      return result;
    }

    const content = compose(pending.map(function (i) { return i.celebration; }), reminderType, eventDate);
    const keys = pending.map(function (i) { return i.dedupeKey; }).sort();
    try {
      const sent = OneSignalService.send({
        subscriptionIds: devices.map(function (d) { return d.subscriptionId; }),
        title: content.title,
        message: content.message,
        url: appUrl_(),
        idempotencyKey: OneSignalService.idempotencyKey(keys.join(',')),
        data: { type: 'CELEBRATION_REMINDER', reminderType: reminderType, eventDate: eventDate },
      });
      pending.forEach(function (item) {
        upsertLog_(item.log, Object.assign(logFields_(item, reminderType), {
          status: 'SENT',
          attempts: (item.log ? item.log.attempts : 0) + 1,
          recipients: devices.length,
          oneSignalId: sent.id,
          detail: 'Accepted by OneSignal (delivery not guaranteed)',
        }));
      });
      DeviceService.deactivateBySubscriptionIds(sent.invalidSubscriptionIds);
      result.sent = pending.length;
      result.status = 'SENT';
      result.oneSignalId = sent.id;
    } catch (err) {
      if (err && err.invalidSubscriptionIds) DeviceService.deactivateBySubscriptionIds(err.invalidSubscriptionIds);
      const message = String(err && err.message ? err.message : err).slice(0, 500);
      pending.forEach(function (item) {
        upsertLog_(item.log, Object.assign(logFields_(item, reminderType), {
          status: 'FAILED',
          attempts: (item.log ? item.log.attempts : 0) + 1,
          recipients: 0,
          detail: message,
        }));
      });
      result.failed = pending.length;
      result.status = 'FAILED';
      result.error = message;
    }
    return result;
  }

  /** Is `minutes` inside the send window that starts at reminder time HH:mm? */
  function inWindow(reminderTime, minutes) {
    const start = DateUtils.timeToMinutes(reminderTime);
    if (start === null) return false;
    const end = Math.min(start + LIMITS.RETRY_WINDOW_MINUTES, 24 * 60 - 1);
    return minutes >= start && minutes <= end;
  }

  /** Trigger entry point: decides which reminder types are due right now. */
  function dispatch() {
    const now = DateUtils.nowParts();
    const settings = SettingsService.get();
    const results = {};
    [
      ['SAME_DAY', settings.sameDayReminderTime],
      ['NEXT_DAY', settings.nextDayReminderTime],
    ].forEach(function (pair) {
      results[pair[0]] = inWindow(pair[1], now.minutes) ? runReminder(pair[0], now) : { reminderType: pair[0], status: 'OUTSIDE_WINDOW' };
    });
    return { at: now, results: results };
  }

  function sendTest(payload) {
    const deviceId = Validation.optionalId(payload, 'deviceId');
    if (!OneSignalService.isConfigured()) throw new AppError('NOT_CONFIGURED', 'OneSignal is not configured on the server.');
    let devices = DeviceService.activeDevices();
    if (deviceId) devices = devices.filter(function (d) { return d.deviceId === deviceId; });
    if (!devices.length) throw new AppError('VALIDATION', deviceId ? 'That device is not registered or inactive.' : 'No registered devices. Enable notifications on a device first.');

    const now = Clock.now();
    const base = { dedupeKey: 'TEST|' + Utilities.getUuid(), reminderType: 'TEST', eventDate: DateUtils.today(now), contactId: '', contactName: '', occasion: '' };
    try {
      const sent = OneSignalService.send({
        subscriptionIds: devices.map(function (d) { return d.subscriptionId; }),
        title: '🔔 CelebrateMate test',
        message: 'Notifications are working on this device.',
        url: appUrl_(),
        data: { type: 'TEST' },
      });
      DeviceService.deactivateBySubscriptionIds(sent.invalidSubscriptionIds);
      upsertLog_(null, Object.assign(base, { status: 'SENT', attempts: 1, recipients: devices.length, oneSignalId: sent.id, detail: 'Test accepted by OneSignal (delivery not guaranteed)' }));
      return { oneSignalId: sent.id, recipients: devices.length, note: 'Accepted by OneSignal. Delivery to the device is not guaranteed.' };
    } catch (err) {
      upsertLog_(null, Object.assign(base, { status: 'FAILED', attempts: 1, detail: String(err && err.message ? err.message : err).slice(0, 500) }));
      throw err;
    }
  }

  function listLogs(payload) {
    const limit = Validation.limitQuery(payload);
    return Database.list(logsTable_())
      .sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); })
      .slice(0, limit);
  }

  return { compose: compose, runReminder: runReminder, inWindow: inWindow, dispatch: dispatch, sendTest: sendTest, listLogs: listLogs };
})();
