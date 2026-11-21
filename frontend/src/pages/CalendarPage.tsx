import { useMemo, useState } from 'react';
import { CalendarHeart, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Category, Celebration, Occasion } from '@/types';
import { CATEGORIES, OCCASIONS } from '@/types';
import { useContacts, useEffectiveSettings } from '@/hooks/useData';
import { useToday } from '@/hooks/useToday';
import { PageHeader } from '@/components/layout/PageHeader';
import { CelebrationItem } from '@/components/celebrations/CelebrationItem';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { getCelebrationsForMonth } from '@/utils/celebrations';
import { CATEGORY_META, OCCASION_META } from '@/utils/constants';
import { daysInMonth, formatDate, parseISODate, toISODate } from '@/utils/date';
import { cn } from '@/utils/cn';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function CalendarPage() {
  const today = useToday();
  const todayParts = parseISODate(today) ?? { year: 2000, month: 1, day: 1 };
  const { feb29Policy } = useEffectiveSettings();
  const { data: contacts, error, isLoading, isFetching, refetch } = useContacts({ status: 'ACTIVE' });

  const [view, setView] = useState({ year: todayParts.year, month: todayParts.month });
  const [selected, setSelected] = useState<string>(today);
  const [categories, setCategories] = useState<Category[]>([...CATEGORIES]);
  const [occasions, setOccasions] = useState<Occasion[]>([...OCCASIONS]);

  const byDate = useMemo(
    () =>
      contacts
        ? getCelebrationsForMonth(contacts, { ...view, today, policy: feb29Policy, categories, occasions })
        : new Map<string, Celebration[]>(),
    [contacts, view, today, feb29Policy, categories, occasions],
  );

  const firstWeekday = new Date(Date.UTC(view.year, view.month - 1, 1)).getUTCDay();
  const totalDays = daysInMonth(view.year, view.month);
  const cells: Array<string | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => toISODate({ year: view.year, month: view.month, day: i + 1 })),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthCount = [...byDate.values()].reduce((sum, list) => sum + list.length, 0);
  const selectedInView = parseISODate(selected)?.month === view.month && parseISODate(selected)?.year === view.year;
  const selectedItems = selectedInView ? (byDate.get(selected) ?? []) : [];
  const isCurrentMonth = view.year === todayParts.year && view.month === todayParts.month;

  const shiftMonth = (delta: number) => {
    const index = view.year * 12 + (view.month - 1) + delta;
    const next = { year: Math.floor(index / 12), month: (index % 12) + 1 };
    setView(next);
    setSelected(next.year === todayParts.year && next.month === todayParts.month ? today : toISODate({ ...next, day: 1 }));
  };

  const goToday = () => {
    setView({ year: todayParts.year, month: todayParts.month });
    setSelected(today);
  };

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Birthdays and anniversaries by month" />

      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Chip key={c} active={categories.includes(c)} onClick={() => setCategories((l) => toggle(l, c))} dotClassName={CATEGORY_META[c].dot}>
            {CATEGORY_META[c].label}
          </Chip>
        ))}
        <span className="mx-1 hidden w-px self-stretch bg-gray-200 sm:block" aria-hidden />
        {OCCASIONS.map((o) => (
          <Chip key={o} active={occasions.includes(o)} onClick={() => setOccasions((l) => toggle(l, o))} dotClassName={OCCASION_META[o].dot}>
            {OCCASION_META[o].label}
          </Chip>
        ))}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="p-3 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2 px-1">
              <div>
                <h2 className="text-lg font-bold text-ink">{formatDate(toISODate({ ...view, day: 1 }), 'MMMM yyyy')}</h2>
                <p className="text-xs text-ink-muted">
                  {isLoading ? 'Loading…' : `${monthCount} celebration${monthCount === 1 ? '' : 's'}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!isCurrentMonth && (
                  <Button variant="ghost" size="sm" onClick={goToday}>
                    Today
                  </Button>
                )}
                <IconButton label="Previous month" variant="secondary" onClick={() => shiftMonth(-1)}>
                  <ChevronLeft className="h-5 w-5" />
                </IconButton>
                <IconButton label="Next month" variant="secondary" onClick={() => shiftMonth(1)}>
                  <ChevronRight className="h-5 w-5" />
                </IconButton>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Month">
              {WEEKDAYS.map((d) => (
                <div key={d} className="pb-2 text-[11px] font-bold uppercase tracking-wide text-ink-subtle" role="columnheader">
                  {d}
                </div>
              ))}
              {cells.map((iso, i) => {
                if (!iso) return <div key={`blank-${i}`} aria-hidden />;
                const items = byDate.get(iso) ?? [];
                const birthdays = items.filter((c) => c.occasion === 'BIRTHDAY').length;
                const anniversaries = items.length - birthdays;
                const isToday = iso === today;
                const isSelected = iso === selected;
                const day = parseISODate(iso)?.day;
                return (
                  <button
                    key={iso}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`${formatDate(iso, 'd MMMM')}: ${birthdays} birthdays, ${anniversaries} anniversaries`}
                    onClick={() => setSelected(iso)}
                    className={cn(
                      'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:aspect-[1.15]',
                      isSelected ? 'bg-brand-500 text-white shadow-sm' : isToday ? 'bg-brand-50 text-brand-700' : 'text-ink hover:bg-gray-50',
                    )}
                  >
                    <span>{day}</span>
                    {isLoading ? (
                      <Skeleton className="h-1.5 w-4" />
                    ) : (
                      <span className="flex h-1.5 items-center gap-1" aria-hidden>
                        {birthdays > 0 && <span className={cn('h-1.5 w-1.5 rounded-full', isSelected ? 'bg-white' : 'bg-pink-500')} />}
                        {anniversaries > 0 && <span className={cn('h-1.5 w-1.5 rounded-full', isSelected ? 'bg-amber-200' : 'bg-amber-500')} />}
                        {items.length > 2 && (
                          <span className={cn('text-[9px] font-bold leading-none', isSelected ? 'text-white' : 'text-ink-subtle')}>
                            {items.length}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-4 px-1 text-xs text-ink-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-pink-500" aria-hidden /> Birthday
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden /> Anniversary
              </span>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 lg:self-start">
            <h2 className="text-base font-bold text-ink">{selectedInView ? formatDate(selected, 'EEEE, d MMMM') : 'Select a day'}</h2>
            <div className="mt-3">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : selectedItems.length === 0 ? (
                <EmptyState compact icon={<CalendarHeart className="h-5 w-5" />} title="No celebrations" description="Pick a day with a dot to see who's celebrating." />
              ) : (
                <div className="-mx-2 divide-y divide-gray-50">
                  {selectedItems.map((c) => (
                    <CelebrationItem key={c.key} celebration={c} showRelative={c.daysUntil >= 0} />
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
