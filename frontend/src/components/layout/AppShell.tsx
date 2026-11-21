import { NavLink, Outlet } from 'react-router-dom';
import { FlaskConical, LogOut, PartyPopper, WifiOff } from 'lucide-react';
import { IS_MOCK } from '@/services';
import { signOut } from '@/services/googleAuth';
import { useOnline } from '@/hooks/useOnline';
import { usePushSync } from '@/hooks/usePushSync';
import { useSession } from '@/hooks/useSession';
import { IconButton } from '@/components/ui/Button';
import { APP_NAME } from '@/utils/constants';
import { cn, initials } from '@/utils/cn';
import { NAV_ITEMS } from './navigation';

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
        <PartyPopper className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-lg font-extrabold tracking-tight text-ink">{APP_NAME}</span>
    </div>
  );
}

function MockModeBadge({ className }: { className?: string }) {
  if (!IS_MOCK) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20',
        className,
      )}
      title="Development mode: showing local demo data, not your real contacts."
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      Demo data
    </span>
  );
}

function AccountAvatar({ compact }: { compact?: boolean }) {
  const session = useSession();
  if (!session) return null;
  return (
    <div className={cn('flex items-center gap-2', !compact && 'rounded-2xl bg-gray-50 p-2')}>
      {session.picture ? (
        <img src={session.picture} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{initials(session.name)}</span>
      )}
      {!compact && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-ink">{session.name}</p>
          <p className="truncate text-[11px] text-ink-subtle">{session.email}</p>
        </div>
      )}
      <IconButton label="Sign out" onClick={signOut} className="h-8 w-8">
        <LogOut className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white" role="status">
      <WifiOff className="h-4 w-4" aria-hidden />
      You&apos;re offline. Your data is not stored on this device, so it will load when you reconnect.
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-100 bg-white px-4 py-6 lg:flex">
      <div className="px-2">
        <Logo />
        <MockModeBadge className="mt-3" />
      </div>
      <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Main">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-gray-50 hover:text-ink',
              )
            }
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <AccountAvatar />
      <p className="mt-3 px-3 text-xs text-ink-subtle">Reminders in Asia/Kolkata (IST)</p>
    </aside>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-nav backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {NAV_ITEMS.filter((item) => item.mobile).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors', isActive ? 'text-brand-600' : 'text-ink-subtle hover:text-ink')
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-brand-50')}>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.25 : 1.9} aria-hidden />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function MobileTopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-100/80 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <Logo />
        <div className="flex items-center gap-2">
          <MockModeBadge />
          <AccountAvatar compact />
        </div>
      </div>
    </header>
  );
}

export function AppShell() {
  usePushSync();
  return (
    <div className="min-h-dvh bg-white">
      <Sidebar />
      <MobileTopBar />
      <main className="pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-12 lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6 lg:px-10 lg:pt-10">
          <OfflineBanner />
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
