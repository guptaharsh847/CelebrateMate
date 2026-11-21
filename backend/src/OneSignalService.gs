/**
 * OneSignalService.gs — thin client for the OneSignal REST API (Create Notification).
 *
 * The REST API key is read from Script Properties and never leaves the server.
 * A successful response means OneSignal ACCEPTED the notification; it does not
 * guarantee delivery to any device.
 */
const OneSignalService = (function () {
  const ENDPOINT = 'https://api.onesignal.com/notifications?c=push';

  function isConfigured() {
    return !!(getScriptProperty_(PROPS.ONESIGNAL_APP_ID) && getScriptProperty_(PROPS.ONESIGNAL_REST_API_KEY));
  }

  /** Deterministic UUID-shaped key so a retried request is de-duplicated by OneSignal. */
  function idempotencyKey(seed) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed, Utilities.Charset.UTF_8);
    const hex = bytes.map(function (b) { return ((b + 256) % 256).toString(16); }).map(function (h) { return h.length === 1 ? '0' + h : h; }).join('');
    return [hex.slice(0, 8), hex.slice(8, 12), '5' + hex.slice(13, 16), '8' + hex.slice(17, 20), hex.slice(20, 32)].join('-');
  }

  function invalidIds_(errors) {
    if (!errors || Array.isArray(errors)) return [];
    return [].concat(errors.invalid_player_ids || [], errors.invalid_subscription_ids || []);
  }

  /**
   * @param {{subscriptionIds: string[], title: string, message: string, url?: string, idempotencyKey?: string, data?: object}} n
   * @returns {{id: string, invalidSubscriptionIds: string[]}}
   */
  function send(n) {
    if (!isConfigured()) throw new AppError('NOT_CONFIGURED', 'OneSignal is not configured on the server.');
    if (!n.subscriptionIds || !n.subscriptionIds.length) throw new AppError('VALIDATION', 'No registered devices to notify.');

    const body = {
      app_id: getScriptProperty_(PROPS.ONESIGNAL_APP_ID),
      target_channel: 'push',
      include_subscription_ids: n.subscriptionIds,
      headings: { en: n.title },
      contents: { en: n.message },
    };
    if (n.url) body.web_url = n.url;
    if (n.data) body.data = n.data;
    if (n.idempotencyKey) body.idempotency_key = n.idempotencyKey;

    let response;
    try {
      response = UrlFetchApp.fetch(ENDPOINT, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Key ' + getScriptProperty_(PROPS.ONESIGNAL_REST_API_KEY) },
        payload: JSON.stringify(body),
        muteHttpExceptions: true,
      });
    } catch (err) {
      throw new AppError('UPSTREAM_ERROR', 'Could not reach OneSignal: ' + String(err && err.message ? err.message : err).slice(0, 200));
    }

    const status = response.getResponseCode();
    let json = {};
    try {
      json = JSON.parse(response.getContentText() || '{}');
    } catch (e) {
      json = {};
    }

    if (status < 200 || status >= 300) {
      const detail = json.errors ? JSON.stringify(json.errors) : 'HTTP ' + status;
      throw new AppError('UPSTREAM_ERROR', 'OneSignal rejected the notification: ' + detail.slice(0, 300));
    }
    const invalid = invalidIds_(json.errors);
    if (!json.id) {
      const detail = json.errors ? JSON.stringify(json.errors) : 'no notification id returned';
      const error = new AppError('UPSTREAM_ERROR', 'OneSignal did not create a notification: ' + detail.slice(0, 300));
      error.invalidSubscriptionIds = invalid;
      throw error;
    }
    return { id: json.id, invalidSubscriptionIds: invalid };
  }

  return { isConfigured: isConfigured, idempotencyKey: idempotencyKey, send: send };
})();
