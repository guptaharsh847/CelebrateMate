import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, CalendarX2, MessageCircle, Pencil, Phone, StickyNote } from 'lucide-react';
import { dataService, errorMessage } from '@/services';
import { OCCASIONS } from '@/types';
import { useContact, useEffectiveSettings, useHistory } from '@/hooks/useData';
import { HistoryEntryCard } from '@/components/wishes/HistoryEntryCard';
import { useWishComposer } from '@/components/wishes/WishComposerProvider';
import { useMutation } from '@/hooks/useMutation';
import { invalidateQueries, setQueryData } from '@/hooks/useQuery';
import { queryKeys } from '@/hooks/useData';
import { useToday } from '@/hooks/useToday';
import { PageHeader } from '@/components/layout/PageHeader';
import { celebrationSubtitle } from '@/components/celebrations/CelebrationItem';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, CategoryBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ErrorState, LoadingState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { getContactDate, getNextCelebrations } from '@/utils/celebrations';
import { FEB29_POLICY_LABELS, OCCASION_META } from '@/utils/constants';
import { formatDate, formatDateTime, parseISODate, relativeDayLabel } from '@/utils/date';
import { cn } from '@/utils/cn';
import { formatPhone } from '@/utils/phone';

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-ink-subtle">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-subtle">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-ink">{children}</div>
      </div>
    </div>
  );
}

export function ContactDetailPage() {
  const { contactId = '' } = useParams();
  const toast = useToast();
  const today = useToday();
  const { feb29Policy } = useEffectiveSettings();
  const { data: contact, error, isLoading, isFetching, refetch } = useContact(contactId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { openForCelebration } = useWishComposer();
  const history = useHistory({ contactId, limit: 5 });

  const toggleActive = useMutation(
    (active: boolean) => (active ? dataService.reactivateContact(contactId) : dataService.deactivateContact(contactId)),
    {
      onSuccess: (updated) => {
        setQueryData(queryKeys.contact(contactId), updated);
        invalidateQueries('contacts:list');
        setConfirmOpen(false);
        toast.success(updated.isActive ? 'Contact reactivated' : 'Contact deactivated');
      },
      onError: (err) => toast.error(errorMessage(err)),
    },
  );

  const header = <PageHeader title="Contact" backTo="/contacts" backLabel="Contacts" />;
  if (isLoading) return <>{header}<LoadingState /></>;
  if (error || !contact) return <>{header}<ErrorState error={error} onRetry={refetch} retrying={isFetching} /></>;

  const next = getNextCelebrations(contact, today, feb29Policy);
  const sameNumber = contact.whatsappNumber === contact.mobileNumber;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={contact.fullName}
        backTo="/contacts"
        backLabel="Contacts"
        actions={
          <ButtonLink to={`/contacts/${contact.contactId}/edit`} variant="secondary" icon={<Pencil className="h-4 w-4" />}>
            Edit
          </ButtonLink>
        }
      />

      <Card className="flex items-center gap-4 p-5">
        <Avatar name={contact.fullName} category={contact.category} size="lg" muted={!contact.isActive} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={contact.category} />
            {contact.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
          </div>
          {!contact.isActive && (
            <p className="mt-2 text-sm text-ink-muted">Inactive contacts are hidden from the dashboard, calendar and reminders.</p>
          )}
        </div>
      </Card>

      <h2 className="mb-3 mt-6 text-base font-bold text-ink">Occasions</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {OCCASIONS.map((occasion) => {
          const meta = OCCASION_META[occasion];
          const Icon = meta.icon;
          const original = getContactDate(contact, occasion);
          const upcoming = next.find((c) => c.occasion === occasion);
          const parts = parseISODate(original);
          const isLeapDay = parts?.month === 2 && parts.day === 29;
          return (
            <Card key={occasion} className={cn('p-4', !original && 'border-dashed bg-gray-50/50 shadow-none')}>
              <div className="flex items-center gap-3">
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', meta.iconBg)}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{meta.label}</p>
                  <p className="text-xs text-ink-muted">{original ? formatDate(original, 'd MMMM yyyy') : 'Not added'}</p>
                </div>
              </div>
              {upcoming && contact.isActive && (
                <div className="mt-4 flex items-end justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                  <div>
                    <p className="text-xs text-ink-subtle">Next</p>
                    <p className="text-sm font-semibold text-ink">{formatDate(upcoming.eventDate, 'EEE, d MMM yyyy')}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-sm font-bold', upcoming.daysUntil === 0 ? 'text-brand-600' : 'text-ink')}>
                      {relativeDayLabel(upcoming.daysUntil)}
                    </p>
                    {celebrationSubtitle(upcoming) && <p className="text-xs text-ink-subtle">{celebrationSubtitle(upcoming)}</p>}
                  </div>
                </div>
              )}
              {upcoming && contact.isActive && (
                <Button
                  variant="soft"
                  size="sm"
                  fullWidth
                  className="mt-3"
                  icon={<MessageCircle className="h-4 w-4" />}
                  onClick={() => openForCelebration(upcoming)}
                >
                  Send WhatsApp wish
                </Button>
              )}
              {isLeapDay && (
                <p className="mt-2 text-xs text-ink-subtle">29 February · non-leap years: {FEB29_POLICY_LABELS[feb29Policy].toLowerCase()}</p>
              )}
              {!original && (
                <Link to={`/contacts/${contact.contactId}/edit`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
                  <CalendarX2 className="h-4 w-4" aria-hidden /> Add date
                </Link>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 divide-y divide-gray-100 px-5">
        <InfoRow icon={<Phone className="h-4 w-4" />} label="Mobile">
          <a href={`tel:${contact.mobileNumber}`} className="hover:text-brand-600">
            {formatPhone(contact.mobileNumber)}
          </a>
        </InfoRow>
        <InfoRow icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp">
          {formatPhone(contact.whatsappNumber)}
          {sameNumber && <span className="ml-2 text-xs text-ink-subtle">(same as mobile)</span>}
        </InfoRow>
        <InfoRow icon={<StickyNote className="h-4 w-4" />} label="Notes">
          {contact.notes ? <span className="whitespace-pre-line">{contact.notes}</span> : <span className="text-ink-subtle">No notes</span>}
        </InfoRow>
      </Card>

      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Recent wishes</h2>
        <Link to="/history" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          All history
        </Link>
      </div>
      {history.isLoading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : history.error ? (
        <ErrorState error={history.error} onRetry={history.refetch} retrying={history.isFetching} className="py-6" />
      ) : (history.data ?? []).length === 0 ? (
        <Card className="p-4 text-sm text-ink-muted">No wishes recorded for {contact.fullName} yet.</Card>
      ) : (
        <div className="space-y-3">
          {(history.data ?? []).map((entry) => (
            <HistoryEntryCard key={entry.historyId} entry={entry} showContact={false} />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-subtle">
          Added {formatDateTime(contact.createdAt)} · Updated {formatDateTime(contact.updatedAt)}
        </p>
        {contact.isActive ? (
          <Button variant="secondary" icon={<Archive className="h-4 w-4" />} onClick={() => setConfirmOpen(true)} className="text-red-600">
            Deactivate
          </Button>
        ) : (
          <Button
            variant="soft"
            icon={<ArchiveRestore className="h-4 w-4" />}
            loading={toggleActive.isPending}
            onClick={() => toggleActive.mutate(true)}
          >
            Reactivate
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate contact?"
        description={`${contact.fullName} will be hidden from the dashboard, calendar and reminders. Their details are kept and you can reactivate them at any time.`}
        confirmLabel="Deactivate"
        tone="danger"
        loading={toggleActive.isPending}
        onConfirm={() => toggleActive.mutate(false)}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
