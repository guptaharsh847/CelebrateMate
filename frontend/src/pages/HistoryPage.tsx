import { useMemo, useState } from 'react';
import { History as HistoryIcon, Info, SearchX } from 'lucide-react';
import type { WishStatus } from '@/types';
import { useHistory } from '@/hooks/useData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PageHeader } from '@/components/layout/PageHeader';
import { HistoryEntryCard } from '@/components/wishes/HistoryEntryCard';
import { ButtonLink } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';

type Filter = 'ALL' | WishStatus;

export function HistoryPage() {
  const { data, error, isLoading, isFetching, refetch } = useHistory({ limit: 500 });
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim().toLowerCase());

  const counts = useMemo(
    () => ({
      ALL: data?.length ?? 0,
      OPENED: data?.filter((h) => h.status === 'OPENED').length ?? 0,
      MARKED_SENT: data?.filter((h) => h.status === 'MARKED_SENT').length ?? 0,
    }),
    [data],
  );

  const visible = useMemo(
    () =>
      (data ?? []).filter(
        (h) => (filter === 'ALL' || h.status === filter) && (!q || h.contactName.toLowerCase().includes(q) || h.finalMessage.toLowerCase().includes(q)),
      ),
    [data, filter, q],
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Wish history" subtitle="WhatsApp wishes you prepared" />

      <p className="mb-4 flex items-start gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        “Chat opened” means WhatsApp was opened with the message. Only you can confirm it was sent: mark it once you have.
      </p>

      <div className="space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or message" label="Search history" />
        <Segmented
          label="Status"
          className="w-full sm:w-auto"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: 'All', count: data ? counts.ALL : undefined },
            { value: 'OPENED', label: 'Opened', count: data ? counts.OPENED : undefined },
            { value: 'MARKED_SENT', label: 'Sent', count: data ? counts.MARKED_SENT : undefined },
          ]}
        />
      </div>

      <div className="mt-5">
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : error || !data ? (
          <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon className="h-6 w-6" />}
            title="No wishes yet"
            description="Tap the WhatsApp button next to a celebration to prepare your first wish."
            action={<ButtonLink to="/">Go to dashboard</ButtonLink>}
          />
        ) : visible.length === 0 ? (
          <EmptyState icon={<SearchX className="h-6 w-6" />} title="Nothing matches" description="Try another search or filter." />
        ) : (
          <div className="space-y-3">
            {visible.map((entry) => (
              <HistoryEntryCard key={entry.historyId} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
