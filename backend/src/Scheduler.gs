/**
 * Scheduler.gs — installs the time-driven trigger for reminders.
 *
 * Design: a single dispatcher trigger runs every 15 minutes. Each run checks
 * (in Asia/Kolkata) whether it is inside the same-day (default 10:00) or
 * next-day (default 22:00) window, and sends/retries only then. This:
 *   - honours reminder times changed in Settings without reinstalling triggers,
 *   - tolerates Apps Script's approximate trigger timing,
 *   - provides controlled retries inside a bounded window.
 * Expect a reminder within ~15 minutes after the configured time; not exact.
 */
const Scheduler = (function () {
  const HANDLER = 'dispatchReminders';

  function triggers_() {
    return ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === HANDLER; });
  }

  function remove() {
    const existing = triggers_();
    existing.forEach(function (t) { ScriptApp.deleteTrigger(t); });
    return existing.length;
  }

  function install() {
    remove();
    ScriptApp.newTrigger(HANDLER).timeBased().everyMinutes(LIMITS.DISPATCH_EVERY_MINUTES).create();
    return status();
  }

  function status() {
    const count = triggers_().length;
    return { handler: HANDLER, installed: count > 0, count: count, everyMinutes: LIMITS.DISPATCH_EVERY_MINUTES, timezone: APP.TIMEZONE };
  }

  return { HANDLER: HANDLER, install: install, remove: remove, status: status };
})();
