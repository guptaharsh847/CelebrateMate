/**
 * Code.gs — web app entry points and editor/trigger functions.
 *
 * Run once from the Apps Script editor:  setup()
 * Then (Phase 6) install reminders with:  installTriggers()
 */

/** HTTP POST: the JSON API. */
function doPost(e) {
  let request;
  try {
    const body = e && e.postData ? e.postData.contents : '';
    if (!body) throw new AppError('BAD_REQUEST', 'Empty request body.');
    if (body.length > LIMITS.MAX_BODY_CHARS) throw new AppError('BAD_REQUEST', 'Request is too large.');
    try {
      request = JSON.parse(body);
    } catch (parseError) {
      throw new AppError('BAD_REQUEST', 'Request body must be valid JSON.');
    }
  } catch (err) {
    return ApiResponse.toOutput(ApiResponse.failure(err));
  }
  return ApiResponse.toOutput(Router.handle(request));
}

/** HTTP GET: health check only. No data is ever served over GET. */
function doGet() {
  return ApiResponse.toOutput(ApiResponse.success({ status: 'ok', name: APP.NAME, version: APP.VERSION }));
}

/**
 * Creates/repairs all seven sheets and seeds categories, the 18 default
 * templates and default settings. Safe to run repeatedly; never overwrites data.
 */
function setup() {
  const lock = LockService.getScriptLock();
  lock.waitLock(LIMITS.LOCK_TIMEOUT_MS);
  try {
    Database.clearCache();
    const sheets = Database.initialize();
    const seeded = {
      categories: CategoryService.seedDefaults(),
      templates: TemplateService.seedDefaults(),
      settings: SettingsService.seedDefaults(),
    };
    const report = { sheets: sheets, seeded: seeded, configuration: checkConfiguration() };
    console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    lock.releaseLock();
  }
}

/** Reports which Script Properties are set — never their values. */
function checkConfiguration() {
  let spreadsheet = 'missing';
  try {
    spreadsheet = Database.spreadsheet() ? 'ok' : 'missing';
  } catch (err) {
    spreadsheet = 'error: ' + err.message;
  }
  const report = {
    spreadsheet: spreadsheet,
    googleClientId: !!getScriptProperty_(PROPS.GOOGLE_CLIENT_ID),
    allowedEmailCount: Auth.allowedEmails().length,
    oneSignalConfigured: OneSignalService.isConfigured(),
    appUrl: !!getScriptProperty_(PROPS.APP_URL),
    scheduler: Scheduler.status(),
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

/** Installs the 15-minute reminder dispatcher trigger (Phase 6). */
function installTriggers() {
  const status = Scheduler.install();
  console.log(JSON.stringify(status));
  return status;
}

function removeTriggers() {
  const removed = Scheduler.remove();
  console.log('Removed ' + removed + ' trigger(s).');
  return removed;
}

/** Time-driven trigger target. */
function dispatchReminders() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LIMITS.LOCK_TIMEOUT_MS)) {
    console.warn('dispatchReminders: previous run still active, skipping.');
    return { status: 'BUSY' };
  }
  try {
    Database.clearCache();
    const result = NotificationService.dispatch();
    console.log(JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Read-only smoke test against the real spreadsheet. Run from the editor only
 * (it is not reachable through the web app). Writes nothing.
 */
function runSmokeTest() {
  Database.clearCache();
  const dashboard = CelebrationService.dashboard();
  const report = {
    today: dashboard.today,
    timezone: dashboard.timezone,
    totals: dashboard.totals,
    todayNames: dashboard.todayCelebrations.map(function (c) { return c.contact.fullName + ' (' + c.occasion + ')'; }),
    templates: TemplateService.list().length,
    categories: CategoryService.list().map(function (c) { return c.categoryId; }),
    settings: SettingsService.get(),
    devices: DeviceService.activeDevices().length,
    configuration: checkConfiguration(),
    ping: JSON.parse(doGet().getContent()).ok,
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

/** Manual runs from the editor (ignore the time window, still de-duplicated). */
function runSameDayReminderNow() {
  return runReminderNow_('SAME_DAY');
}

function runNextDayReminderNow() {
  return runReminderNow_('NEXT_DAY');
}

function runReminderNow_(type) {
  const lock = LockService.getScriptLock();
  lock.waitLock(LIMITS.LOCK_TIMEOUT_MS);
  try {
    Database.clearCache();
    const result = NotificationService.runReminder(type);
    console.log(JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}
