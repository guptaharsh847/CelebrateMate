export type DataMode = 'mock' | 'api';

/**
 * Mock data is only allowed on the Vite dev server (`npm run dev:mock`).
 * Production builds always use the real API, so demo data can never ship.
 */
export const DATA_MODE: DataMode =
  import.meta.env.DEV && import.meta.env.VITE_DATA_MODE === 'mock' ? 'mock' : 'api';

export const IS_MOCK = DATA_MODE === 'mock';

/** All of these are PUBLIC identifiers, safe to embed in the bundle. No secrets here. */
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
export const GOOGLE_CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
export const ONESIGNAL_APP_ID: string = (import.meta.env.VITE_ONESIGNAL_APP_ID ?? '').trim();

export const IS_API_CONFIGURED = API_BASE_URL !== '' && GOOGLE_CLIENT_ID !== '';
export const IS_PUSH_CONFIGURED = ONESIGNAL_APP_ID !== '';
