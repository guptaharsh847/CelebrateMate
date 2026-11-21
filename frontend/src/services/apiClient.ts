import { API_BASE_URL } from './config';
import { clearSession, getSession } from './session';
import { ServiceError, type ServiceErrorCode } from './types';

const KNOWN_CODES = new Set<ServiceErrorCode>([
  'NOT_CONFIGURED',
  'NOT_FOUND',
  'VALIDATION',
  'CONFLICT',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'BAD_REQUEST',
  'BUSY',
  'UPSTREAM_ERROR',
  'INTERNAL',
]);

const TIMEOUT_MS = 30_000;

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: Record<string, string> };
}

export interface CallOptions {
  /** Let the request finish even if the page is backgrounded (e.g. switching to WhatsApp). */
  keepalive?: boolean;
  /** system.ping is the only unauthenticated action. */
  auth?: boolean;
}

function requestId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calls the Apps Script API. The body is sent as text/plain so the browser
 * makes a CORS "simple request" (no preflight); the response is readable
 * because Apps Script serves it with Access-Control-Allow-Origin: *.
 * The ID token travels in the body because Apps Script cannot read headers.
 */
export async function callApi<T>(action: string, payload: Record<string, unknown> = {}, options: CallOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new ServiceError('NOT_CONFIGURED', 'The backend URL is not configured (VITE_API_BASE_URL).');
  }
  const session = options.auth === false ? null : getSession();
  if (options.auth !== false && !session) {
    throw new ServiceError('UNAUTHORIZED', 'Please sign in to continue.');
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload, idToken: session?.idToken, requestId: requestId() }),
      redirect: 'follow',
      credentials: 'omit',
      cache: 'no-store',
      keepalive: options.keepalive,
      signal: controller.signal,
    });
  } catch {
    throw new ServiceError(
      'NETWORK',
      navigator.onLine ? 'Could not reach the server. Please try again.' : "You're offline. Connect to the internet and try again.",
    );
  } finally {
    window.clearTimeout(timer);
  }

  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new ServiceError('UNKNOWN', `Unexpected response from the server (HTTP ${response.status}).`);
  }
  if (!body || typeof body.ok !== 'boolean') {
    throw new ServiceError('UNKNOWN', 'Unexpected response from the server.');
  }
  if (!body.ok) {
    const raw = body.error?.code as ServiceErrorCode | undefined;
    const code: ServiceErrorCode = raw && KNOWN_CODES.has(raw) ? raw : 'UNKNOWN';
    const message = body.error?.message || 'The server could not complete the request.';
    if (code === 'UNAUTHORIZED') clearSession(message);
    throw new ServiceError(code, message, body.error?.details ?? null);
  }
  return body.data as T;
}
