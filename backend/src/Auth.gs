/**
 * Auth.gs — verifies the caller's Google ID token on every request.
 *
 * The frontend (Phase 3) signs in with Google Identity Services and sends the
 * ID token in the request body (Apps Script web apps cannot read headers).
 * Verification uses Google's tokeninfo endpoint and then checks:
 *   aud === GOOGLE_CLIENT_ID, iss is Google, exp in the future,
 *   email_verified === true, email ∈ ALLOWED_EMAILS.
 * Positive results are cached for ≤ 5 minutes keyed by a SHA-256 of the token.
 * Fails closed if GOOGLE_CLIENT_ID or ALLOWED_EMAILS is not configured.
 */
const Auth = (function () {
  const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo?id_token=';
  const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
  const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

  function allowedEmails() {
    return getScriptProperty_(PROPS.ALLOWED_EMAILS)
      .split(/[,\s]+/)
      .map(function (e) { return e.trim().toLowerCase(); })
      .filter(Boolean);
  }

  function hash_(value) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
    return bytes.map(function (b) { const h = ((b + 256) % 256).toString(16); return h.length === 1 ? '0' + h : h; }).join('');
  }

  function verifyWithGoogle_(idToken) {
    let response;
    try {
      response = UrlFetchApp.fetch(TOKENINFO_URL + encodeURIComponent(idToken), { method: 'get', muteHttpExceptions: true });
    } catch (err) {
      throw new AppError('UPSTREAM_ERROR', 'Could not verify sign-in right now. Please try again.');
    }
    if (response.getResponseCode() !== 200) throw new AppError('UNAUTHORIZED', 'Your sign-in is invalid or has expired. Please sign in again.');
    try {
      return JSON.parse(response.getContentText());
    } catch (err) {
      throw new AppError('UPSTREAM_ERROR', 'Could not verify sign-in right now. Please try again.');
    }
  }

  /** @returns {{ email: string }} */
  function authenticate(idToken) {
    const clientId = getScriptProperty_(PROPS.GOOGLE_CLIENT_ID);
    const allowlist = allowedEmails();
    if (!clientId || !allowlist.length) {
      throw new AppError('NOT_CONFIGURED', 'Authentication is not configured on the server (GOOGLE_CLIENT_ID / ALLOWED_EMAILS).');
    }
    if (typeof idToken !== 'string' || !idToken || idToken.length > 4096 || !JWT_RE.test(idToken)) {
      throw new AppError('UNAUTHORIZED', 'Sign in to continue.');
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = 'auth:' + hash_(idToken);
    const cached = cache.get(cacheKey);
    if (cached) {
      const identity = JSON.parse(cached);
      if (allowlist.indexOf(identity.email) !== -1) return identity;
    }

    const info = verifyWithGoogle_(idToken);
    const nowSec = Math.floor(Clock.now().getTime() / 1000);
    const exp = Number(info.exp);
    if (info.aud !== clientId) throw new AppError('UNAUTHORIZED', 'Sign-in was issued for a different app.');
    if (ISSUERS.indexOf(info.iss) === -1) throw new AppError('UNAUTHORIZED', 'Sign-in issuer is not trusted.');
    if (!isFinite(exp) || exp <= nowSec) throw new AppError('UNAUTHORIZED', 'Your sign-in has expired. Please sign in again.');
    if (!(info.email_verified === true || info.email_verified === 'true')) throw new AppError('UNAUTHORIZED', 'Your Google email is not verified.');

    const email = String(info.email || '').toLowerCase();
    if (allowlist.indexOf(email) === -1) throw new AppError('FORBIDDEN', 'This Google account is not allowed to use this app.');

    const identity = { email: email };
    const ttl = Math.min(LIMITS.AUTH_CACHE_SECONDS, exp - nowSec);
    if (ttl > 0) cache.put(cacheKey, JSON.stringify(identity), ttl);
    return identity;
  }

  return { authenticate: authenticate, allowedEmails: allowedEmails };
})();
