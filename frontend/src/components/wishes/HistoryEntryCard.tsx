import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown, Copy, ExternalLink, MessageCircleDashed } from 'lucide-react';
import { dataService, errorMessage } from '@/services';
import type { WishHistoryEntry } from '@/types';
import { invalidateQueries } from '@/hooks/useQuery';
import { Badge, OccasionBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime } from '@/utils/date';
import { buildWhatsAppUrl } from '@/utils/message';
import { normalizePhone } from '@/utils/phone';
import { cn } from '@/utils/cn';

export function WishStatusBadge({ status }: { status: WishHistoryEntry['status'] }) {
  return status === 'MARKED_SENT' ? (
    <Badge tone="success">
      <CheckCircle2 className="h-3 w-3" aria-hidden /> Marked as sent
    </Badge>
  ) : (
    <Badge tone="warning">
      <MessageCircleDashed className="h-3 w-3" aria-hidden /> Chat opened
    </Badge>
  );
}

export function HistoryEntryCard({ entry, showContact = true }: { entry: WishHistoryEntry; showContact?: boolean }) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [marking, setMarking] = useState(false);
  const phone = normalizePhone(entry.whatsappNumber);

  const markSent = async () => {
    setMarking(true);
    try {
      await dataService.markWishSent(entry.historyId);
      invalidateQueries('history:');
      toast.success('Marked as sent');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setMarking(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(entry.finalMessage);
      toast.success('Message copied');
    } catch {
      toast.error('Copy is not available in this browser.');
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {showContact && (
            <Link to={`/contacts/${entry.contactId}`} className="font-semibold text-ink hover:text-brand-700">
              {entry.contactName}
            </Link>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <OccasionBadge occasion={entry.occasion} />
            <span>{formatDate(entry.eventDate, 'd MMM yyyy')}</span>
            {entry.templateName && <span>· {entry.templateName}</span>}
          </div>
        </div>
        <WishStatusBadge status={entry.status} />
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-3 block w-full rounded-xl bg-gray-50 px-3 py-2.5 text-left text-sm text-ink-muted hover:bg-gray-100"
      >
        <span className={cn('whitespace-pre-line', !expanded && 'line-clamp-2')}>{entry.finalMessage}</span>
        <ChevronDown className={cn('ml-auto mt-1 h-4 w-4 text-ink-subtle transition-transform', expanded && 'rotate-180')} aria-hidden />
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
        <span>Opened {formatDateTime(entry.openedAt)}</span>
        {entry.markedSentAt && <span>Sent (marked) {formatDateTime(entry.markedSentAt)}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-gray-100 pt-3">
        {entry.status === 'OPENED' && (
          <Button size="sm" variant="soft" loading={marking} onClick={markSent} icon={<CheckCircle2 className="h-4 w-4" />}>
            Mark as sent
          </Button>
        )}
        {phone && (
          <a
            href={buildWhatsAppUrl(phone, entry.finalMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-muted hover:bg-gray-100 hover:text-ink"
          >
            <ExternalLink className="h-4 w-4" aria-hidden /> Open again
          </a>
        )}
        <Button size="sm" variant="ghost" onClick={copy} icon={<Copy className="h-4 w-4" />}>
          Copy
        </Button>
      </div>
    </Card>
  );
}
