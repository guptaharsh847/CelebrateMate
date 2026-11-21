import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cake, ChevronRight, Heart, Plus, SearchX, UserPlus, Users } from 'lucide-react';
import type { Category, Contact, ContactStatusFilter } from '@/types';
import { CATEGORIES } from '@/types';
import { useContacts, useEffectiveSettings } from '@/hooks/useData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useToday } from '@/hooks/useToday';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, CategoryBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SearchInput } from '@/components/ui/SearchInput';
import { Chip, Segmented } from '@/components/ui/Segmented';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';
import { getNextCelebrations } from '@/utils/celebrations';
import { CATEGORY_META } from '@/utils/constants';
import { formatDate, relativeDayLabel } from '@/utils/date';
import { formatPhone } from '@/utils/phone';

function ContactRow({ contact, today, policy }: { contact: Contact; today: string; policy: 'FEB_28' | 'MAR_1' }) {
  const next = contact.isActive ? getNextCelebrations(contact, today, policy)[0] : undefined;
  return (
    <Link
      to={`/contacts/${contact.contactId}`}
      className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50"
    >
      <Avatar name={contact.fullName} category={contact.category} muted={!contact.isActive} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-ink">{contact.fullName}</p>
          {!contact.isActive && <Badge>Inactive</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <CategoryBadge category={contact.category} />
          <span className="text-xs text-ink-subtle">{formatPhone(contact.mobileNumber)}</span>
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
        {contact.birthday && <Cake className="h-4 w-4 text-pink-500" aria-label="Has birthday" />}
        {contact.anniversary && <Heart className="h-4 w-4 text-amber-500" aria-label="Has anniversary" />}
      </div>
      {next && (
        <div className="hidden w-28 shrink-0 text-right md:block">
          <p className="text-sm font-semibold text-ink">{relativeDayLabel(next.daysUntil)}</p>
          <p className="text-xs text-ink-subtle">{formatDate(next.eventDate, 'd MMM')}</p>
        </div>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-ink-subtle" aria-hidden />
    </Link>
  );
}

export function ContactsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'ALL'>('ALL');
  const [status, setStatus] = useState<ContactStatusFilter>('ACTIVE');
  const debouncedSearch = useDebouncedValue(search.trim());
  const today = useToday();
  const { feb29Policy } = useEffectiveSettings();

  const query = useMemo(() => ({ search: debouncedSearch, category, status }), [debouncedSearch, category, status]);
  const { data: contacts, error, isLoading, isFetching, refetch } = useContacts(query);

  const hasFilters = debouncedSearch !== '' || category !== 'ALL' || status !== 'ACTIVE';

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle={contacts ? `${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'}` : undefined}
        actions={
          <ButtonLink to="/contacts/new" className="hidden sm:inline-flex" icon={<UserPlus className="h-4 w-4" />}>
            Add contact
          </ButtonLink>
        }
      />

      <div className="space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, phone or notes" label="Search contacts" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
            <Chip active={category === 'ALL'} onClick={() => setCategory('ALL')}>
              All
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)} dotClassName={CATEGORY_META[c].dot}>
                {CATEGORY_META[c].label}
              </Chip>
            ))}
          </div>
          <Segmented
            label="Status"
            size="sm"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
              { value: 'ALL', label: 'All' },
            ]}
          />
        </div>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : error || !contacts ? (
          <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
        ) : contacts.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={<SearchX className="h-6 w-6" />}
              title="No matching contacts"
              description="Try a different search or clear the filters."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setCategory('ALL');
                    setStatus('ACTIVE');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No contacts yet"
              description="Add the people whose birthdays and anniversaries you want to remember."
              action={
                <ButtonLink to="/contacts/new" icon={<UserPlus className="h-4 w-4" />}>
                  Add your first contact
                </ButtonLink>
              }
            />
          )
        ) : (
          <Card className="divide-y divide-gray-100 overflow-hidden">
            {contacts.map((contact) => (
              <ContactRow key={contact.contactId} contact={contact} today={today} policy={feb29Policy} />
            ))}
          </Card>
        )}
      </div>

      {/* Mobile floating action button */}
      <Link
        to="/contacts/new"
        aria-label="Add contact"
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lift transition-colors hover:bg-brand-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40 sm:hidden"
      >
        <Plus className="h-6 w-6" aria-hidden />
      </Link>
    </div>
  );
}
