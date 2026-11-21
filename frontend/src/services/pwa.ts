/**
 * Service worker registration and install-prompt handling.
 *
 * The worker lives at <base>/sw.js with scope <base> (e.g. /CelebrateMate/ on
 * GitHub Pages). OneSignal is configured to use this same file, so there is
 * exactly one worker per scope. If a worker for that path is already active
 * (possibly registered by OneSignal with extra query parameters), we only ask
 * it to update instead of registering a second URL.
 */
export const SW_FILE = 'sw.js';
export const BASE_PATH = import.meta.env.BASE_URL; // always ends with '/'

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = async () => {
    try {
      const scope = new URL(BASE_PATH, window.location.href).href;
      const swUrl = new URL(BASE_PATH + SW_FILE, window.location.href);
      const existing = await navigator.serviceWorker.getRegistration(scope);
      const active = existing?.active ?? existing?.waiting ?? existing?.installing;
      if (active && new URL(active.scriptURL).pathname === swUrl.pathname) {
        await existing?.update();
        return;
      }
      await navigator.serviceWorker.register(swUrl.pathname, { scope: BASE_PATH });
    } catch (error) {
      console.warn('Service worker registration failed', error);
    }
  };
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
}

// ── Install prompt (Android/desktop Chromium) ────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const notifyInstall = () => installListeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyInstall();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyInstall();
  });
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export function subscribeInstall(listener: () => void): () => void {
  installListeners.add(listener);
  return () => installListeners.delete(listener);
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const event = deferredPrompt;
  deferredPrompt = null;
  notifyInstall();
  await event.prompt();
  return (await event.userChoice).outcome;
}

// ── Platform detection ───────────────────────────────────────────────────
export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}
