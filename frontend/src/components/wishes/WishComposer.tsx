import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, ExternalLink, MessageCircle, Pencil, RotateCcw } from 'lucide-react';
import { dataService, errorMessage } from '@/services';
import type { Contact, Occasion, WishHistoryEntry } from '@/types';
import { useTemplates } from '@/hooks/useData';
import { invalidateQueries } from '@/hooks/useQuery';
import { OccasionBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/utils/date';
import { buildWhatsAppUrl, findUnknownVariables, renderTemplate } from '@/utils/message';
import { formatPhone, normalizePhone } from '@/utils/phone';
import { MAX_MESSAGE_LENGTH, messageProblem, templatesFor } from '@/utils/wish';
import { cn } from '@/utils/cn';

export interface WishTarget {
  contact: Contact;
  occasion: Occasion;
  eventDate: string;
  years: number | null;
}

type LogState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; entry: WishHistoryEntry } | { kind: 'error'; message: string };

interface WishComposerProps {
  target: WishTarget;
  onClose: () => void;
}

export function WishComposer({ target, onClose }: WishComposerProps) {
  const { contact, occasion, eventDate, years } = target;
  const toast = useToast();
  const { data: templates, error, isLoading, isFetching, refetch } = useTemplates();
  const options = useMemo(() => (templates ? templatesFor(templates, contact.category, occasion) : []), [templates, contact.category, occasion]);

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [edited, setEdited] = useState(false);
  const [step, setStep] = useState<'compose' | 'opened'>('compose');
  const [log, setLog] = useState<LogState>({ kind: 'idle' });
  const [marking, setMarking] = useState(false);
  const [markedSent, setMarkedSent] = useState(false);
  const logPromise = useRef<Promise<WishHistoryEntry | null> | null>(null);

  const render = (body: string) => renderTemplate(body, { name: contact.fullName, occasion, eventDate, years });
  const selected = options.find((t) => t.templateId === templateId);

  useEffect(() => {
    if (!templateId && options[0]) {
      setTemplateId(options[0].templateId);
      setMessage(renderTemplate(options[0].body, { name: contact.fullName, occasion, eventDate, years }));
    }
  }, [options, templateId, contact.fullName, occasion, eventDate, years]);

  const phoneDigits = normalizePhone(contact.whatsappNumber);
  const problem = messageProblem(message);
  const unknown = findUnknownVariables(message);
  const waUrl = phoneDigits && !problem ? buildWhatsAppUrl(phoneDigits, message.trim()) : null;

  const chooseTemplate = (id: string) => {
    const t = options.find((o) => o.templateId === id);
    if (!t) return;
    setTemplateId(id);
    setMessage(render(t.body));
    setEdited(false);
  };

  const startLog = (): Promise<WishHistoryEntry | null> => {
    setLog({ kind: 'saving' });
    const promise = dataService
      .logWishOpened({ contactId: contact.contactId, occasion, eventDate, templateId: selected?.templateId, finalMessage: message.trim() })
      .then(
        (entry) => {
          setLog({ kind: 'saved', entry });
          invalidateQueries('history:');
          return entry;
        },
        (err: unknown) => {
          setLog({ kind: 'error', message: errorMessage(err) });
          return null;
        },
      );
    logPromise.current = promise;
    return promise;
  };

  // The <a> performs the navigation synchronously (no popup blockers); logging runs in parallel with keepalive.
  const handleOpen = () => {
    if (log.kind === 'idle' || log.kind === 'error') void startLog();
    setStep('opened');
  };

  const handleMarkSent = async () => {
    setMarking(true);
    try {
      let entry = log.kind === 'saved' ? log.entry : await (logPromise.current ?? startLog());
      if (!entry) entry = await startLog();
      if (!entry) return;
      await dataService.markWishSent(entry.historyId);
      invalidateQueries('history:');
      setMarkedSent(true);
      toast.success('Marked as sent');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setMarking(false);
    }
  };

  const backToEdit = () => {
    // A changed message is a new wish: the next open creates a new history entry.
    setStep('compose');
    setLog({ kind: 'idle' });
    logPromise.current = null;
    setMarkedSent(false);
  };

  const header = (
    <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
      <Avatar name={contact.fullName} category={contact.category} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{contact.fullName}</p>
        <p className="text-xs text-ink-muted">{phoneDigits ? formatPhone(`+${phoneDigits}`) : 'No valid WhatsApp number'}</p>
      </div>
      <div className="text-right">
        <OccasionBadge occasion={occasion} />
        <p className="mt-1 text-xs text-ink-subtle">{formatDate(eventDate, 'd MMM yyyy')}</p>
      </div>
    </div>
  );

  const openLink = (label: string, variant: 'primary' | 'secondary' = 'primary') =>
    waUrl ? (
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleOpen}
        className={cn(buttonClasses({ variant }), variant === 'primary' && 'bg-[#1fa855] hover:bg-[#178a45] active:bg-[#127238]')}
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
        {label}
      </a>
    ) : (
      <Button disabled icon={<MessageCircle className="h-4 w-4" />}>
        {label}
      </Button>
    );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={step === 'compose' ? 'Send a WhatsApp wish' : 'Did you send it?'}
      description={step === 'compose' ? 'Pick a template, edit if you like, then open WhatsApp. Nothing is sent automatically.' : undefined}
      footer={
        step === 'compose' ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {openLink('Open WhatsApp')}
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={backToEdit} icon={<Pencil className="h-4 w-4" />} disabled={marking}>
              Edit message
            </Button>
            {markedSent ? (
              <Button onClick={onClose} icon={<Check className="h-4 w-4" />}>
                Done
              </Button>
            ) : (
              <Button onClick={handleMarkSent} loading={marking} icon={<CheckCircle2 className="h-4 w-4" />}>
                Mark as sent
              </Button>
            )}
          </>
        )
      }
    >
      <div className="space-y-4">
        {header}

        {!phoneDigits && (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            This contact&apos;s WhatsApp number is not valid. Edit the contact to fix it.
          </p>
        )}

        {step === 'compose' ? (
          isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-40" />
            </div>
          ) : error || !templates ? (
            <ErrorState error={error} onRetry={refetch} retrying={isFetching} className="py-6" />
          ) : (
            <>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink">Template</legend>
                {options.length === 0 ? (
                  <p className="text-sm text-ink-muted">No active templates for this category and occasion — write your own message below.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {options.map((t, i) => {
                      const active = t.templateId === templateId;
                      return (
                        <button
                          key={t.templateId}
                          type="button"
                          aria-pressed={active}
                          onClick={() => chooseTemplate(t.templateId)}
                          className={cn(
                            'rounded-2xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                            active ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:bg-gray-50',
                          )}
                        >
                          <p className={cn('text-xs font-bold uppercase tracking-wide', active ? 'text-brand-600' : 'text-ink-subtle')}>Option {i + 1}</p>
                          <p className="mt-0.5 truncate text-sm font-semibold text-ink">{t.name}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{render(t.body)}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="wish-message" className="text-sm font-semibold text-ink">
                    Message
                  </label>
                  {edited && selected && (
                    <button type="button" onClick={() => chooseTemplate(selected.templateId)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset to template
                    </button>
                  )}
                </div>
                <textarea
                  id="wish-message"
                  rows={7}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setEdited(true);
                  }}
                  className={cn(
                    'block w-full resize-y rounded-xl border-0 bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-ink shadow-sm ring-1 ring-inset focus:outline-none focus:ring-2',
                    problem === 'TOO_LONG' ? 'ring-red-300 focus:ring-red-500' : 'ring-gray-200 focus:ring-brand-500',
                  )}
                />
                <div className="mt-1.5 flex items-start justify-between gap-3 text-xs">
                  <span className={problem === 'TOO_LONG' ? 'text-red-600' : 'text-ink-subtle'}>
                    {problem === 'EMPTY' ? 'Write a message to continue.' : `${message.trim().length}/${MAX_MESSAGE_LENGTH}`}
                  </span>
                  {unknown.length > 0 && (
                    <span className="text-amber-700">
                      {unknown.map((u) => `{${u}}`).join(', ')} will be sent as typed
                    </span>
                  )}
                </div>
              </div>
            </>
          )
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#efeae2] p-4">
              <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-md bg-[#d9fdd3] px-3.5 py-2.5 text-[14px] leading-relaxed text-[#111b21] shadow-sm">
                <p className="whitespace-pre-wrap break-words">{message.trim()}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 p-4 text-sm">
              {markedSent ? (
                <p className="flex items-center gap-2 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" aria-hidden /> Marked as sent. It's saved in your history.
                </p>
              ) : (
                <>
                  <p className="font-semibold text-ink">WhatsApp was opened with this message.</p>
                  <p className="mt-1 text-ink-muted">
                    Opening a chat doesn&apos;t send anything. After you press send in WhatsApp, come back and mark it as sent.
                  </p>
                </>
              )}
              <p className="mt-3 text-xs">
                {log.kind === 'saving' && <span className="text-ink-subtle">Saving to history…</span>}
                {log.kind === 'saved' && <span className="text-ink-subtle">Saved to history as “opened”.</span>}
                {log.kind === 'error' && (
                  <span className="text-red-600">
                    Couldn&apos;t save to history: {log.message}{' '}
                    <button type="button" className="font-semibold underline" onClick={() => void startLog()}>
                      Retry
                    </button>
                  </span>
                )}
              </p>
            </div>
            {!markedSent && waUrl && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
                <ExternalLink className="h-4 w-4" aria-hidden /> Open WhatsApp again
              </a>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
