import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Cake, CalendarDays, CalendarRange, FileText, Heart, History, PartyPopper, Sunrise, UserPlus, Users } from 'lucide-react';
import type { Celebration } from '@/types';
import { CATEGORIES } from '@/types';
import { useContacts, useEffectiveSettings } from '@/hooks/useData';
import { useToday } from '@/hooks/useToday';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { CelebrationItem } from '@/components/celebrations/CelebrationItem';
import { getCategoryStats, getUpcomingCelebrations } from '@/utils/celebrations';
import { APP_TIMEZONE, CATEGORY_META } from '@/utils/constants';
import { formatDate } from '@/utils/date';
import { cn } from '@/utils/cn';

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, hour: 'numeric', hour12: false }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface StatCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  iconClass: string;
  to: string;
}

function StatCard({ label, value, icon, iconClass, to }: StatCardProps) {
  return (
    <Link to={to} className="group focus:outline-none">
      <Card className="h-full p-4 transition-shadow group-hover:shadow-lift group-focus-visible:ring-2 group-focus-visible:ring-brand-500">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', iconClass)}>{icon}</span>
        <p className="mt-3 text-2xl font-extrabold tracking-tight text-ink">{value}</p>
        <p className="mt-0.5 text-xs font-semibold text-ink-muted">{label}</p>
      </Card>
    </Link>
  );
}

function CelebrationList({ items, emptyTitle, emptyDescription }: { items: Celebration[]; emptyTitle: string; emptyDescription?: string }) {
  if (items.length === 0) {
    return <EmptyState compact icon={<PartyPopper className="h-5 w-5" />} title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div className="divide-y divide-gray-50">
      {items.map((c) => (
        <CelebrationItem key={c.key} celebration={c} />
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <Skeleton className="h-36 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export function DashboardPage() {
  const today = useToday();
  const settings = useEffectiveSettings();
  const { data: contacts, error, isLoading, isFetching, refetch } = useContacts({ status: 'ACTIVE' });
  const [range, setRange] = useState<'7' | '30'>('7');

  const upcoming = useMemo(
    () => (contacts ? getUpcomingCelebrations(contacts, { today, days: 30, policy: settings.feb29Policy }) : []),
    [contacts, today, settings.feb29Policy],
  );
  const categoryStats = useMemo(() => (contacts ? getCategoryStats(contacts) : []), [contacts]);

  if (isLoading) return <DashboardSkeleton />;
  if (error || !contacts) return <ErrorState error={error} onRetry={refetch} retrying={isFetching} />;

  const todayItems = upcoming.filter((c) => c.daysUntil === 0);
  const tomorrowItems = upcoming.filter((c) => c.daysUntil === 1);
  const laterItems = upcoming.filter((c) => c.daysUntil >= 2 && c.daysUntil <= Number(range));
  const todayBirthdays = todayItems.filter((c) => c.occasion === 'BIRTHDAY').length;
  const todayAnniversaries = todayItems.length - todayBirthdays;
  const maxCategory = Math.max(1, ...categoryStats.map((s) => s.total));

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white shadow-lift sm:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-16 right-16 h-40 w-40 rounded-full bg-white/5" aria-hidden />
        <p className="flex items-center gap-1.5 text-sm font-medium text-white/80">
          <Sunrise className="h-4 w-4" aria-hidden />
          {formatDate(today, 'EEEE, d MMMM yyyy')}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{greeting()}!</h1>
        <p className="mt-1.5 max-w-md text-sm text-white/85">
          {todayItems.length === 0
            ? tomorrowItems.length > 0
              ? `No celebrations today. ${tomorrowItems.length} coming up tomorrow.`
              : 'No celebrations today. Enjoy your day!'
            : `You have ${todayItems.length} celebration${todayItems.length === 1 ? '' : 's'} to wish today.`}
        </p>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active contacts" value={contacts.length} to="/contacts" icon={<Users className="h-5 w-5" />} iconClass="bg-brand-50 text-brand-600" />
        <StatCard label="Birthdays today" value={todayBirthdays} to="/calendar" icon={<Cake className="h-5 w-5" />} iconClass="bg-pink-50 text-pink-600" />
        <StatCard label="Anniversaries today" value={todayAnniversaries} to="/calendar" icon={<Heart className="h-5 w-5" />} iconClass="bg-amber-50 text-amber-600" />
        <StatCard label="Tomorrow" value={tomorrowItems.length} to="/calendar" icon={<CalendarDays className="h-5 w-5" />} iconClass="bg-sky-50 text-sky-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="p-4 sm:p-5">
            <SectionHeader title="Today" description={formatDate(today, 'EEEE, d MMM')} />
            <CelebrationList items={todayItems} emptyTitle="Nothing to celebrate today" emptyDescription="Today's birthdays and anniversaries will appear here." />
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionHeader title="Tomorrow" />
            <CelebrationList items={tomorrowItems} emptyTitle="Nothing tomorrow" />
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionHeader
              title="Coming up"
              description={`Next ${range} days, after tomorrow`}
              action={
                <Segmented
                  label="Upcoming range"
                  size="sm"
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: '7', label: '7 days' },
                    { value: '30', label: '30 days' },
                  ]}
                />
              }
            />
            <CelebrationList items={laterItems} emptyTitle={`No celebrations in the next ${range} days`} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-4 sm:p-5">
            <SectionHeader title="Quick actions" />
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: '/contacts/new', label: 'Add contact', icon: UserPlus },
                { to: '/calendar', label: 'Calendar', icon: CalendarRange },
                { to: '/templates', label: 'Templates', icon: FileText },
                { to: '/history', label: 'Wish history', icon: History },
              ].map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex flex-col items-start gap-2 rounded-2xl bg-gray-50 p-3.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <Icon className="h-5 w-5 text-brand-500" aria-hidden />
                  {label}
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionHeader title="Categories" description="Active contacts by category" />
            <ul className="space-y-4">
              {CATEGORIES.map((category) => {
                const stat = categoryStats.find((s) => s.category === category);
                const total = stat?.total ?? 0;
                return (
                  <li key={category}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-ink">{CATEGORY_META[category].label}</span>
                      <span className="font-bold text-ink">{total}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn('h-full rounded-full transition-all', CATEGORY_META[category].bar)}
                        style={{ width: `${(total / maxCategory) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-ink-subtle">
                      {stat?.withBirthday ?? 0} birthdays · {stat?.withAnniversary ?? 0} anniversaries
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
