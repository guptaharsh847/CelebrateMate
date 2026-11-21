/**
 * Response.gs — error type and the JSON envelope returned by every endpoint.
 *
 * Success: { ok: true,  data: <any>, meta: { requestId, serverTime, version } }
 * Failure: { ok: false, error: { code, message, details? }, meta: { ... } }
 *
 * Apps Script web apps always answer HTTP 200, so clients must check `ok`.
 */

class AppError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details || null;
  }
}

const ERROR_CODES = Object.freeze([
  'BAD_REQUEST',
  'VALIDATION',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'BUSY',
  'NOT_CONFIGURED',
  'UPSTREAM_ERROR',
  'INTERNAL',
]);

const ApiResponse = {
  meta: function (requestId) {
    return {
      requestId: requestId || Utilities.getUuid(),
      serverTime: Clock.now().toISOString(),
      version: APP.VERSION,
    };
  },

  success: function (data, meta) {
    return { ok: true, data: data === undefined ? null : data, meta: meta || ApiResponse.meta() };
  },

  failure: function (err, meta) {
    const m = meta || ApiResponse.meta();
    if (err instanceof AppError && ERROR_CODES.indexOf(err.code) !== -1) {
      const error = { code: err.code, message: err.message };
      if (err.details) error.details = err.details;
      return { ok: false, error: error, meta: m };
    }
    // Unexpected error: log details server-side, return a generic message.
    console.error('Unhandled error [' + m.requestId + ']: ' + (err && err.stack ? err.stack : err));
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Unexpected server error. Reference: ' + m.requestId },
      meta: m,
    };
  },

  toOutput: function (envelope) {
    return ContentService.createTextOutput(JSON.stringify(envelope)).setMimeType(ContentService.MimeType.JSON);
  },
};
