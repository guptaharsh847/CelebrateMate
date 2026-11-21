import type { DeviceInput, DevicePlatform } from '@/types';
import { ONESIGNAL_APP_ID, IS_PUSH_CONFIGURED } from './config';
import { BASE_PATH, SW_FILE, isAndroid, isIOS, isStandalone } from './pwa';
import { ServiceError } from './types';

/**
 * OneSignal Web SDK v16 integration.
 *
 * - The SDK is loaded lazily (only when push is configured and needed).
 * - Permission is requested ONLY from a user click (enablePush), never on load.
 * - OneSignal uses our combined service worker (<base>/sw.js, scope <base>),
 *   which imports OneSignalSDK.sw.js, so offline caching and push share one worker.
 */
interface PushSubscriptionApi {
  id?: string | null;
  optedIn?: boolean;
  optIn(): Promise<void>;
  optOut(): Promise<void>;
  addEventListener(event: 'change', listener: (e: { current: { id?: string | null; optedIn?: boolean } }) => void): void;
}

interface OneSignalApi {
  init(options: Record<string, unknown>): Promise<void>;
  Notifications: {
    permission: boolean;
    isPushSupported(): boolean;
    requestPermission(): Promise<void>;
  };
  User: { PushSubscription: PushSubscriptionApi };
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalApi) => void | Promise<void>>;
  }
}

const SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
let ready: Promise<OneSignalApi> | null = null;

/** OneSignal expects the worker path relative to the site root, e.g. "CelebrateMate/sw.js". */
export const ONESIGNAL_SW_PATH = `${BASE_PATH.replace(/^\//, '')}${SW_FILE}`;
export const ONESIGNAL_SW_SCOPE = BASE_PATH;

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: 'not-configured' | 'insecure' | 'unsupported' | 'ios-needs-install' };

export function getPushSupport(): PushSupport {
  if (!IS_PUSH_CONFIGURED) return { supported: false, reason: 'not-configured' };
  if (!window.isSecureContext) return { supported: false, reason: 'insecure' };
  // iOS/iPadOS 16.4+ only supports Web Push for apps added to the Home Screen.
  if (isIOS() && !isStandalone()) return { supported: false, reason: 'ios-needs-install' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { supported: false, reason: 'unsupported' };
  }
  return { supported: true };
}

export function browserPermission(): NotificationPermission | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export function initPush(): Promise<OneSignalApi> {
  if (!IS_PUSH_CONFIGURED) {
    return Promise.reject(new ServiceError('NOT_CONFIGURED', 'Push notifications are not configured for this build (VITE_ONESIGNAL_APP_ID).'));
  }
  if (ready) return ready;
  ready = new Promise<OneSignalApi>((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: ONESIGNAL_SW_PATH,
          serviceWorkerParam: { scope: ONESIGNAL_SW_SCOPE },
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
          notifyButton: { enable: false },
        });
        resolve(OneSignal);
      } catch (error) {
        ready = null;
        reject(error instanceof Error ? error : new Error('OneSignal failed to initialise.'));
      }
    });
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.defer = true;
    script.onerror = () => {
      ready = null;
      reject(new ServiceError('NETWORK', 'Could not load the OneSignal SDK. Check your connection or content blockers.'));
    };
    document.head.appendChild(script);
  });
  return ready;
}

function waitForSubscriptionId(oneSignal: OneSignalApi, timeoutMs: number): Promise<string> {
  const sub = oneSignal.User.PushSubscription;
  if (sub.id) return Promise.resolve(sub.id);
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new ServiceError('UPSTREAM_ERROR', 'OneSignal did not return a subscription. Please try again.')), timeoutMs);
    sub.addEventListener('change', (event) => {
      if (event.current.id) {
        window.clearTimeout(timer);
        resolve(event.current.id);
      }
    });
  });
}

/**
 * Must be called directly from a click handler (browsers require a user gesture).
 * Call initPush() earlier (e.g. when Settings opens) so no network wait happens here.
 */
export async function enablePush(): Promise<string> {
  const support = getPushSupport();
  if (!support.supported) throw new ServiceError('NOT_CONFIGURED', pushSupportMessage(support.reason));
  const oneSignal = await initPush();
  await oneSignal.Notifications.requestPermission();
  if (browserPermission() !== 'granted') {
    throw new ServiceError('FORBIDDEN', 'Notifications are blocked for this site. Allow them in your browser or system settings, then try again.');
  }
  await oneSignal.User.PushSubscription.optIn();
  return waitForSubscriptionId(oneSignal, 20_000);
}

export async function disablePush(): Promise<void> {
  if (!IS_PUSH_CONFIGURED) return;
  const oneSignal = await initPush();
  await oneSignal.User.PushSubscription.optOut();
}

/** This browser's OneSignal subscription ID, if subscribed. Loads the SDK only when permission is granted. */
export async function currentSubscriptionId(): Promise<string | null> {
  if (!getPushSupport().supported || browserPermission() !== 'granted') return null;
  const oneSignal = await initPush();
  const sub = oneSignal.User.PushSubscription;
  return sub.id && sub.optedIn !== false ? sub.id : null;
}

export function onSubscriptionChange(listener: (id: string | null) => void): void {
  void initPush().then((oneSignal) =>
    oneSignal.User.PushSubscription.addEventListener('change', (e) => listener(e.current.optedIn === false ? null : e.current.id ?? null)),
  );
}

export function devicePlatform(): DevicePlatform {
  if (isIOS()) return 'IOS';
  if (isAndroid()) return 'ANDROID';
  if (/Windows|Macintosh|Linux|CrOS/.test(navigator.userAgent)) return 'DESKTOP';
  return 'OTHER';
}

export function deviceInput(subscriptionId: string): DeviceInput {
  const platform = devicePlatform();
  const browser = /Edg\//.test(navigator.userAgent)
    ? 'Edge'
    : /Chrome\//.test(navigator.userAgent)
      ? 'Chrome'
      : /Firefox\//.test(navigator.userAgent)
        ? 'Firefox'
        : /Safari\//.test(navigator.userAgent)
          ? 'Safari'
          : 'Browser';
  const names: Record<DevicePlatform, string> = { IOS: 'iPhone/iPad', ANDROID: 'Android', DESKTOP: 'Desktop', OTHER: 'Device' };
  return {
    subscriptionId,
    platform,
    label: `${names[platform]} · ${browser}`,
    userAgent: navigator.userAgent.slice(0, 300),
  };
}

export function pushSupportMessage(reason: Exclude<PushSupport, { supported: true }>['reason']): string {
  switch (reason) {
    case 'not-configured':
      return 'Push notifications are not configured for this build.';
    case 'insecure':
      return 'Notifications need HTTPS.';
    case 'ios-needs-install':
      return 'On iPhone/iPad, add CelebrateMate to your Home Screen first (Share → Add to Home Screen), then open it from there.';
    case 'unsupported':
      return 'This browser does not support web push notifications.';
  }
}
