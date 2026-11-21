import { useSyncExternalStore } from 'react';
import { CheckCircle2, Download, Share, SquarePlus } from 'lucide-react';
import { canPromptInstall, isAndroid, isIOS, isStandalone, promptInstall, subscribeInstall } from '@/services/pwa';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function InstallCard() {
  const canInstall = useSyncExternalStore(subscribeInstall, canPromptInstall, () => false);
  const standalone = isStandalone();

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <Download className="h-5 w-5 text-brand-500" aria-hidden /> Install app
      </h2>
      {standalone ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Running as an installed app.
        </p>
      ) : canInstall ? (
        <>
          <p className="mt-1 text-sm text-ink-muted">Add CelebrateMate to your home screen for a full-screen app and reminders.</p>
          <Button className="mt-4" icon={<Download className="h-4 w-4" />} onClick={() => void promptInstall()}>
            Install CelebrateMate
          </Button>
        </>
      ) : isIOS() ? (
        <ol className="mt-3 space-y-2 text-sm text-ink-muted">
          <li className="flex items-start gap-2">
            <Share className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden /> In Safari, tap <b className="text-ink">Share</b>.
          </li>
          <li className="flex items-start gap-2">
            <SquarePlus className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden /> Choose <b className="text-ink">Add to Home Screen</b>, then open the app from the icon.
          </li>
          <li className="text-xs text-ink-subtle">Notifications on iPhone/iPad need iOS 16.4+ and the Home Screen app.</li>
        </ol>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">
          {isAndroid() ? 'Open the Chrome menu (⋮) and choose “Install app” or “Add to Home screen”.' : 'Use your browser’s install option (address bar icon or menu).'}
        </p>
      )}
    </Card>
  );
}
