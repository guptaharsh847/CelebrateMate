import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PartyPopper, PlugZap, ShieldCheck } from 'lucide-react';
import { IS_API_CONFIGURED, IS_MOCK } from '@/services';
import { onSignInError, promptSignIn, renderGoogleButton } from '@/services/googleAuth';
import { getSignOutReason } from '@/services/session';
import { useSession } from '@/hooks/useSession';
import { clearQueries } from '@/hooks/useQuery';
import { APP_NAME } from '@/utils/constants';

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-white px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-500 text-white shadow-lift">
          <PartyPopper className="h-8 w-8" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">{APP_NAME}</h1>
        {children}
      </div>
    </div>
  );
}

function SetupRequired() {
  return (
    <Shell>
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left text-sm text-amber-900">
        <p className="flex items-center gap-2 font-bold">
          <PlugZap className="h-4 w-4" aria-hidden /> Setup required
        </p>
        <p className="mt-2">
          This build has no backend configured. Set <code className="font-mono">VITE_API_BASE_URL</code> and{' '}
          <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> and rebuild. See the deployment guide.
        </p>
      </div>
    </Shell>
  );
}

function SignIn() {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(getSignOutReason());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onSignInError(setError);
    const el = buttonRef.current;
    if (!el) return;
    renderGoogleButton(el)
      .then(() => promptSignIn())
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Google Sign-In is unavailable.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <p className="mt-2 text-sm text-ink-muted">Birthdays and anniversaries, never forgotten.</p>
      <div className="mt-8 rounded-3xl border border-gray-100 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold text-ink">Sign in to continue</p>
        <div className="mt-4 flex min-h-[44px] justify-center" ref={buttonRef} aria-busy={loading} />
        {loading && <p className="mt-2 text-xs text-ink-subtle">Loading Google Sign-In…</p>}
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-subtle">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Private app — only approved Google accounts can open it.
        </p>
      </div>
    </Shell>
  );
}

/** Renders children only when the user is signed in (or in dev mock mode). */
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const previousEmail = useRef<string | null>(null);

  useEffect(() => {
    const email = session?.email ?? null;
    // Never show one account's cached data to another.
    if (previousEmail.current !== email) clearQueries();
    previousEmail.current = email;
  }, [session?.email]);

  if (IS_MOCK) return <>{children}</>;
  if (!IS_API_CONFIGURED) return <SetupRequired />;
  if (!session) return <SignIn />;
  return <>{children}</>;
}
