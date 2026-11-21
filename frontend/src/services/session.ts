/**
 * Signed-in session holding the Google ID token.
 *
 * The token is decoded here ONLY to read display fields and the expiry; it is
 * never trusted client-side. The backend verifies it on every request.
 * It is kept in localStorage (≤ 1 hour lifetime) so an installed PWA doesn't
 * ask for sign-in on every launch; it is removed as soon as it expires.
 */
export interface Session {
  idToken: string;
  email: string;
  name: string;
  picture: string;
  /** Expiry, seconds since epoch. */
  exp: number;
}

const STORAGE_KEY = 'celebratemate:session:v1';
const EXPIRY_MARGIN_MS = 60_000;
const listeners = new Set<() => void>();
let session: Session | null = restore();
let signOutReason: string | null = null;

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isExpired(s: Session): boolean {
  return s.exp * 1000 - EXPIRY_MARGIN_MS <= Date.now();
}

function restore(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.idToken || isExpired(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function notify() {
  listeners.forEach((l) => l());
}

let expiryTimer: ReturnType<typeof setTimeout> | null = null;

/** Clears the session automatically when the token expires (so the UI shows sign-in). */
function scheduleExpiry(): void {
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = null;
  if (!session || typeof window === 'undefined') return;
  const ms = Math.min(session.exp * 1000 - EXPIRY_MARGIN_MS - Date.now(), 2 ** 31 - 1);
  expiryTimer = setTimeout(() => clearSession('Your session expired. Please sign in again.'), Math.max(0, ms));
}
scheduleExpiry();

/** Pure read for rendering (no side effects): null once expired. */
export function peekSession(): Session | null {
  return session && !isExpired(session) ? session : null;
}

/** For API calls: also clears an expired session. */
export function getSession(): Session | null {
  if (session && isExpired(session)) clearSession('Your session expired. Please sign in again.');
  return session;
}

export function setSessionFromCredential(credential: string): Session {
  const payload = decodeJwtPayload(credential);
  const exp = Number(payload?.exp);
  const email = typeof payload?.email === 'string' ? payload.email : '';
  if (!payload || !email || !Number.isFinite(exp)) throw new Error('Google returned an unexpected sign-in response.');
  session = {
    idToken: credential,
    email,
    name: typeof payload.name === 'string' ? payload.name : email,
    picture: typeof payload.picture === 'string' ? payload.picture : '',
    exp,
  };
  signOutReason = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable: session lives in memory only.
  }
  scheduleExpiry();
  notify();
  return session;
}

export function clearSession(reason: string | null = null): void {
  const had = session !== null;
  session = null;
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = null;
  signOutReason = reason;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  if (had || reason) notify();
}

export function getSignOutReason(): string | null {
  return signOutReason;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
