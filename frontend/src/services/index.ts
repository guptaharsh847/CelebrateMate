import type { DataService } from './types';
import { createApiDataService } from './apiDataService';

let implementation: Promise<DataService> | null = null;

// The env condition is written inline (not via IS_MOCK) so Vite replaces it with
// a literal `false` in production builds and Rollup drops the mock chunk entirely.
function load(): Promise<DataService> {
  if (!implementation) {
    implementation =
      import.meta.env.DEV && import.meta.env.VITE_DATA_MODE === 'mock'
        ? import('./mock/mockDataService').then((m) => m.createMockDataService())
        : Promise.resolve(createApiDataService());
  }
  return implementation;
}

/** Only defined in development mock mode. */
export const resetMockData: (() => Promise<void>) | undefined =
  import.meta.env.DEV && import.meta.env.VITE_DATA_MODE === 'mock'
    ? () => import('./mock/mockDataService').then((m) => m.resetMockData())
    : undefined;

const METHODS = [
  'listContacts',
  'getContact',
  'createContact',
  'updateContact',
  'deactivateContact',
  'reactivateContact',
  'listTemplates',
  'createTemplate',
  'updateTemplate',
  'setTemplateActive',
  'getSettings',
  'updateSettings',
  'listHistory',
  'logWishOpened',
  'markWishSent',
  'listDevices',
  'registerDevice',
  'deactivateDevice',
  'sendTestNotification',
  'getNotificationStatus',
  'listNotificationLogs',
] as const satisfies ReadonlyArray<keyof DataService>;

// Compile-time check that METHODS lists every DataService method.
type Missing = Exclude<keyof DataService, (typeof METHODS)[number]>;
const _exhaustive: Missing extends never ? true : never = true;
void _exhaustive;

/** Lazily delegates every call to the active implementation (mock or API). */
export const dataService = Object.fromEntries(
  METHODS.map((name) => [
    name,
    (...args: unknown[]) => load().then((service) => (service[name] as (...a: unknown[]) => Promise<unknown>)(...args)),
  ]),
) as unknown as DataService;

export { ServiceError, errorMessage } from './types';
export type { DataService } from './types';
export { DATA_MODE, IS_MOCK, IS_API_CONFIGURED, IS_PUSH_CONFIGURED } from './config';
