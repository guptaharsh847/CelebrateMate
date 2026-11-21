/**
 * Router.gs — maps `action` names to handlers.
 *
 * Request body (POST, JSON sent as text/plain to avoid a CORS preflight):
 *   { "action": "contacts.list", "payload": { ... }, "idToken": "<Google ID token>", "requestId": "optional" }
 *
 * Every route requires authentication unless `auth: false`.
 * Routes with `write: true` run under the script lock.
 */
const ROUTES = {
  'system.ping': { auth: false, handler: function () { return { status: 'ok', name: APP.NAME, version: APP.VERSION }; } },
  'auth.me': { handler: function (p, ctx) { return { email: ctx.email }; } },

  'dashboard.get': { handler: function () { return CelebrationService.dashboard(); } },
  'celebrations.today': { handler: function () { return CelebrationService.today(); } },
  'celebrations.tomorrow': { handler: function () { return CelebrationService.tomorrow(); } },
  'celebrations.upcoming': { handler: function (p) { return CelebrationService.upcoming(p); } },
  'celebrations.month': { handler: function (p) { return CelebrationService.month(p); } },

  'contacts.list': { handler: function (p) { return ContactService.list(p); } },
  'contacts.search': { handler: function (p) { return ContactService.list(p); } },
  'contacts.get': { handler: function (p) { return ContactService.get(p); } },
  'contacts.create': { write: true, handler: function (p) { return ContactService.create(p); } },
  'contacts.update': { write: true, handler: function (p) { return ContactService.update(p); } },
  'contacts.deactivate': { write: true, handler: function (p) { return ContactService.deactivate(p); } },
  'contacts.reactivate': { write: true, handler: function (p) { return ContactService.reactivate(p); } },

  'categories.list': { handler: function () { return CategoryService.list(); } },

  'templates.list': { handler: function () { return TemplateService.list(); } },
  'templates.create': { write: true, handler: function (p) { return TemplateService.create(p); } },
  'templates.update': { write: true, handler: function (p) { return TemplateService.update(p); } },
  'templates.setActive': { write: true, handler: function (p) { return TemplateService.setActive(p); } },

  'settings.get': { handler: function () { return SettingsService.get(); } },
  'settings.update': { write: true, handler: function (p) { return SettingsService.update(p); } },

  'history.list': { handler: function (p) { return HistoryService.list(p); } },
  'history.logOpened': { write: true, handler: function (p) { return HistoryService.logOpened(p); } },
  'history.markSent': { write: true, handler: function (p) { return HistoryService.markSent(p); } },

  'devices.list': { handler: function () { return DeviceService.list(); } },
  'devices.register': { write: true, handler: function (p) { return DeviceService.register(p); } },
  'devices.deactivate': { write: true, handler: function (p) { return DeviceService.deactivate(p); } },

  'notifications.test': { write: true, handler: function (p) { return NotificationService.sendTest(p); } },
  'notifications.logs': { handler: function (p) { return NotificationService.listLogs(p); } },
  'notifications.status': { handler: function () { return { oneSignalConfigured: OneSignalService.isConfigured(), scheduler: Scheduler.status() }; } },
};

const Router = (function () {
  const REQUEST_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

  function withLock_(fn) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(LIMITS.LOCK_TIMEOUT_MS)) throw new AppError('BUSY', 'The server is busy. Please try again in a moment.');
    try {
      Database.clearCache(); // read fresh data inside the lock
      return fn();
    } finally {
      lock.releaseLock();
    }
  }

  /** @returns the response envelope (plain object). Never throws. */
  function handle(request) {
    const requestId = request && typeof request.requestId === 'string' && REQUEST_ID_RE.test(request.requestId) ? request.requestId : null;
    const meta = ApiResponse.meta(requestId);
    try {
      if (!request || typeof request !== 'object' || Array.isArray(request)) throw new AppError('BAD_REQUEST', 'Request must be a JSON object.');
      if (typeof request.action !== 'string' || !Object.prototype.hasOwnProperty.call(ROUTES, request.action)) {
        throw new AppError('NOT_FOUND', 'Unknown action.');
      }
      const route = ROUTES[request.action];
      const payload = Validation.object(request.payload, 'payload');
      const ctx = route.auth === false ? {} : Auth.authenticate(request.idToken);
      const run = function () { return route.handler(payload, ctx); };
      return ApiResponse.success(route.write ? withLock_(run) : run(), meta);
    } catch (err) {
      return ApiResponse.failure(err, meta);
    }
  }

  return { handle: handle, actions: function () { return Object.keys(ROUTES); } };
})();
