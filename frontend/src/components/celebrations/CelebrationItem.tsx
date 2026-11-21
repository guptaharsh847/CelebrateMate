import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import type { Celebration } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { OccasionBadge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import { useWishComposer } from '@/components/wishes/WishComposerProvider';
import { formatDate, ordinal, relativeDayLabel } from '@/utils/date';
import { cn } from '@/utils/cn';

export function celebrationSubtitle(c: Celebration): string | null {
  if (!c.years) return null;
  return c.occasion === 'BIRTHDAY' ? `Turns ${c.years}` : `${ordinal(c.years)} anniversary`;
}

interface CelebrationItemProps {
  celebration: Celebration;
  showRelative?: boolean;
  /** Show the WhatsApp wish button (default: for today and future). */
  showWish?: boolean;
  className?: string;
}

export function CelebrationItem({ celebration, showRelative = true, showWish, className }: CelebrationItemProps) {
  const { contact, occasion, eventDate, daysUntil } = celebration;
  const { openForCelebration } = useWishComposer();
  const subtitle = celebrationSubtitle(celebration);
  const canWish = (showWish ?? daysUntil >= 0) && contact.isActive;

  return (
    <div className={cn('flex items-center gap-1 rounded-2xl transition-colors hover:bg-gray-50', className)}>
      <Link
        to={`/contacts/${contact.contactId}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Avatar name={contact.fullName} category={contact.category} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{contact.fullName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <OccasionBadge occasion={occasion} />
            {subtitle && <span>{subtitle}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {showRelative && (
            <p className={cn('text-sm font-bold', daysUntil === 0 ? 'text-brand-600' : 'text-ink')}>{relativeDayLabel(daysUntil)}</p>
          )}
          <p className="text-xs text-ink-subtle">{formatDate(eventDate, 'EEE, d MMM')}</p>
        </div>
      </Link>
      {canWish && (
        <IconButton
          label={`Send WhatsApp wish to ${contact.fullName}`}
          variant="ghost"
          className="mr-2 shrink-0 text-[#1fa855] hover:bg-emerald-50 hover:text-[#178a45]"
          onClick={() => openForCelebration(celebration)}
        >
          <MessageCircle className="h-5 w-5" />
        </IconButton>
      )}
    </div>
  );
}
