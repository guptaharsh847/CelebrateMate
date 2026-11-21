import { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Info, Send, Smartphone, Trash2, XCircle } from 'lucide-react';
import { dataService, errorMessage, IS_MOCK } from '@/services';
import type { Device } from '@/types';
import { useDevices, useNotificationLogs, useNotificationStatus } from '@/hooks/useData';
import { invalidateQueries } from '@/hooks/useQuery';
import {
  browserPermission,
  currentSubscriptionId,
  deviceInput,
  disablePush,
  enablePush,
  getPushSupport,
  initPush,
  pushSupportMessage,
} from '@/services/push';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/utils/date';

function StatusRow({ ok, label, okText, badText }: { ok: boolean; label: string; okText: string; badText: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-muted">{label}</span>
      {ok ? (
        <Badge tone="success">
          <CheckCircle2 className="h-3 w-3" aria-hidden /> {okText}
        </Badge>
      ) : (
        <Badge tone="warning">
          <XCircle className="h-3 w-3" aria-hidden /> {badText}
        </Badge>
      )}
    </div>
  );
}

export function NotificationsCard() {
  const toast = useToast();
  const support = getPushSupport();
  const [permission, setPermission] = useState(browserPermission());
  const [thisSubscription, setThisSubscription] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Device | null>(null);
  const devices = useDevices();
  const status = useNotificationStatus();
  const logs = useNotificationLogs();

  useEffect(() => {
    if (!support.supported) return;
    // Load the SDK early so the permission request in the click handler is immediate.
    initPush().catch(() => undefined);
    currentSubscriptionId().then(setThisSubscription, () => undefined);
  }, [support.supported]);

  const activeDevices = (devices.data ?? []).filter((d) => d.isActive);
  const thisDevice = activeDevices.find((d) => d.subscriptionId === thisSubscription);

  const enable = async () => {
    setBusy('enable');
    try {
      const id = await enablePush();
      setThisSubscription(id);
      await dataService.registerDevice(deviceInput(id));
      invalidateQueries('devices:');
      toast.success('Notifications enabled on this device');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPermission(browserPermission());
      setBusy(null);
    }
  };

  const remove = async (device: Device) => {
    setBusy(`remove:${device.deviceId}`);
    try {
      await dataService.deactivateDevice(device.deviceId);
      if (device.subscriptionId === thisSubscription) {
        await disablePush().catch(() => undefined);
        setThisSubscription(null);
      }
      invalidateQueries('devices:');
      toast.success('Device removed');
      setRemoving(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const test = async (deviceId?: string) => {
    setBusy(deviceId ? `test:${deviceId}` : 'test:all');
    try {
      const result = await dataService.sendTestNotification(deviceId);
      invalidateQueries('notifications:');
      toast.success(`Test accepted by OneSignal for ${result.recipients} device${result.recipients === 1 ? '' : 's'}. Delivery isn't guaranteed.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <BellRing className="h-5 w-5 text-brand-500" aria-hidden /> Push notifications
      </h2>
      <p className="mt-0.5 text-sm text-ink-muted">
        One summary around your reminder times (IST), even when the app is closed. Timing is approximate (within about 15 minutes) and delivery
        isn&apos;t guaranteed.
      </p>

      {/* Server status */}
      <div className="mt-5 space-y-2 rounded-xl bg-gray-50 p-4">
        {status.isLoading ? (
          <Skeleton className="h-10" />
        ) : status.data ? (
          <>
            <StatusRow ok={status.data.oneSignalConfigured} label="Server push key" okText="Configured" badText="Not configured" />
            <StatusRow ok={status.data.scheduler.installed} label="Reminder schedule" okText={`Every ${status.data.scheduler.everyMinutes} min`} badText="Trigger not installed" />
          </>
        ) : (
          <p className="text-sm text-ink-muted">Server status unavailable.</p>
        )}
      </div>

      {/* This device */}
      <div className="mt-5">
        <p className="text-sm font-semibold text-ink">This device</p>
        {!support.supported ? (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {pushSupportMessage(support.reason)}
          </p>
        ) : permission === 'denied' ? (
          <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            Notifications are blocked. Allow them for this site in your browser settings (Android: site settings → Notifications; iPhone: Settings → Notifications →
            CelebrateMate), then reload.
          </p>
        ) : thisDevice ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm">
            <span className="flex items-center gap-2 font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Enabled on this device
            </span>
            <Button size="sm" variant="secondary" icon={<Send className="h-4 w-4" />} loading={busy === `test:${thisDevice.deviceId}`} onClick={() => test(thisDevice.deviceId)}>
              Send test
            </Button>
          </div>
        ) : (
          <div className="mt-2">
            <Button onClick={enable} loading={busy === 'enable'} icon={<BellRing className="h-4 w-4" />}>
              Enable notifications on this device
            </Button>
            <p className="mt-2 text-xs text-ink-subtle">Your browser will ask for permission.</p>
          </div>
        )}
      </div>

      {/* Registered devices */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Registered devices</p>
          {activeDevices.length > 1 && (
            <Button size="sm" variant="ghost" loading={busy === 'test:all'} onClick={() => test()} icon={<Send className="h-4 w-4" />}>
              Test all
            </Button>
          )}
        </div>
        {devices.isLoading ? (
          <Skeleton className="mt-2 h-14" />
        ) : devices.error ? (
          <ErrorState error={devices.error} onRetry={devices.refetch} retrying={devices.isFetching} className="py-6" />
        ) : activeDevices.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No devices yet{IS_MOCK ? ' (demo data)' : ''}.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100">
            {activeDevices.map((d) => (
              <li key={d.deviceId} className="flex items-center gap-3 px-3 py-2.5">
                <Smartphone className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {d.label || d.platform} {d.subscriptionId === thisSubscription && <span className="text-xs font-medium text-brand-600">· this device</span>}
                  </p>
                  <p className="text-xs text-ink-subtle">Last seen {formatDateTime(d.lastSeenAt)}</p>
                </div>
                <IconButton label="Remove device" onClick={() => setRemoving(d)} disabled={busy === `remove:${d.deviceId}`}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent log */}
      <details className="mt-6 group">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Recent notification log</summary>
        <div className="mt-2">
          {logs.isLoading ? (
            <Skeleton className="h-16" />
          ) : (logs.data ?? []).length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing sent yet.</p>
          ) : (
            <ul className="space-y-2">
              {(logs.data ?? []).map((l) => (
                <li key={l.logId} className="rounded-xl bg-gray-50 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">
                      {l.reminderType === 'TEST' ? 'Test' : `${l.contactName} · ${l.occasion === 'BIRTHDAY' ? 'Birthday' : 'Anniversary'}`}
                    </span>
                    <Badge tone={l.status === 'SENT' ? 'success' : l.status === 'FAILED' ? 'danger' : 'neutral'}>{l.status}</Badge>
                  </div>
                  <p className="mt-1 text-ink-subtle">
                    {formatDateTime(l.updatedAt)} · {l.reminderType === 'SAME_DAY' ? 'Same-day' : l.reminderType === 'NEXT_DAY' ? 'Day-before' : 'Manual'}
                    {l.attempts > 1 ? ` · ${l.attempts} attempts` : ''}
                  </p>
                  {l.detail && <p className="mt-0.5 text-ink-muted">{l.detail}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <ConfirmDialog
        open={!!removing}
        title="Remove this device?"
        description="It will stop receiving reminders. You can enable notifications on it again later."
        confirmLabel="Remove"
        tone="danger"
        loading={!!removing && busy === `remove:${removing.deviceId}`}
        onConfirm={() => removing && remove(removing)}
        onClose={() => setRemoving(null)}
      />
    </Card>
  );
}
