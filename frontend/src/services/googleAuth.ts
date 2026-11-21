import { GOOGLE_CLIENT_ID } from './config';
import { clearSession, setSessionFromCredential } from './session';

/** Minimal typings for Google Identity Services (accounts.google.com/gsi/client). */
interface CredentialResponse {
  credential: string;
}

interface GoogleId {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
    itp_support?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  prompt(): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let loader: Promise<GoogleId> | null = null;
let errorHandler: ((message: string) => void) | null = null;

export function onSignInError(handler: (message: string) => void): void {
  errorHandler = handler;
}

function loadScript(): Promise<GoogleId> {
  if (loader) return loader;
  loader = new Promise<GoogleId>((resolve, reject) => {
    const done = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('Google Sign-In failed to load.')));
    if (window.google?.accounts?.id) return done();
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = done;
    script.onerror = () => {
      loader = null;
      reject(new Error('Could not load Google Sign-In. Check your connection.'));
    };
    document.head.appendChild(script);
  }).then((id) => {
    id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        try {
          setSessionFromCredential(response.credential);
        } catch (err) {
          errorHandler?.(err instanceof Error ? err.message : 'Sign-in failed.');
        }
      },
      auto_select: true,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: true,
      itp_support: true,
    });
    return id;
  });
  return loader;
}

export async function renderGoogleButton(parent: HTMLElement): Promise<void> {
  const id = await loadScript();
  id.renderButton(parent, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', logo_alignment: 'left', width: 280 });
}

/** Silent/One Tap sign-in for returning users (no-op if the browser declines). */
export async function promptSignIn(): Promise<void> {
  const id = await loadScript();
  id.prompt();
}

export function signOut(): void {
  clearSession(null);
  window.google?.accounts?.id?.disableAutoSelect();
}
