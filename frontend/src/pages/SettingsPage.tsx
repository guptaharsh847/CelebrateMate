import { useEffect, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight, Database, FileText, Globe2, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { InstallCard } from '@/components/settings/InstallCard';
import { NotificationsCard } from '@/components/settings/NotificationsCard';
import { dataService, DATA_MODE, errorMessage, IS_MOCK, resetMockData } from '@/services';
import { FEB29_POLICIES } from '@/types';
import { queryKeys, useSettings } from '@/hooks/useData';
import { invalidateQueries, setQueryData } from '@/hooks/useQuery';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { APP_TIMEZONE, FEB29_POLICY_LABELS } from '@/utils/constants';
import { settingsSchema, type SettingsFormValues } from '@/utils/schemas';

function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </Card>
  );
}

function DemoDataCard() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (!IS_MOCK) return null;

  const reset = async () => {
    setBusy(true);
    await resetMockData?.();
    invalidateQueries();
    setBusy(false);
    setOpen(false);
    toast.success('Demo data reset');
  };

  return (
    <SettingsSection title="Demo data" description="You are running in development mock mode. Nothing here is saved to Google Sheets.">
      <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Reset demo data
      </Button>
      <ConfirmDialog
        open={open}
        title="Reset demo data?"
        description="All demo contacts, templates and settings in this browser will be restored to their defaults."
        confirmLabel="Reset"
        tone="danger"
        loading={busy}
        onConfirm={reset}
        onClose={() => setOpen(false)}
      />
    </SettingsSection>
  );
}

export function SettingsPage() {
  const toast = useToast();
  const { data: settings, error, isLoading, isFetching, refetch } = useSettings();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SettingsFormValues>({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      const saved = await dataService.updateSettings(values);
      setQueryData(queryKeys.settings(), saved);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });

  const header = <PageHeader title="Settings" subtitle="Reminders and app preferences" />;
  if (isLoading) return <>{header}<LoadingState /></>;
  if (error || !settings) {
    return (
      <>
        {header}
        <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
        <div className="mx-auto max-w-2xl">
          <DemoDataCard />
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {header}
      <Link
        to="/templates"
        className="mb-5 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-soft transition-colors hover:bg-gray-50 lg:hidden"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <FileText className="h-5 w-5" aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold text-ink">Message templates</span>
          <span className="block text-xs text-ink-muted">Manage your WhatsApp wishes</span>
        </span>
        <ChevronRight className="h-4 w-4 text-ink-subtle" aria-hidden />
      </Link>
      <form onSubmit={submit} noValidate className="space-y-5">
        <SettingsSection title="Reminder schedule" description="Times are in India Standard Time. Scheduled delivery is approximate (within about an hour).">
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3.5 py-3 text-sm">
            <Globe2 className="h-4 w-4 text-ink-subtle" aria-hidden />
            <span className="font-semibold text-ink">Timezone</span>
            <span className="ml-auto text-ink-muted">{APP_TIMEZONE} (IST)</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Same-day reminder"
              type="time"
              hint="For today's celebrations"
              error={errors.sameDayReminderTime?.message}
              {...register('sameDayReminderTime')}
            />
            <TextField
              label="Next-day reminder"
              type="time"
              hint="For tomorrow's celebrations"
              error={errors.nextDayReminderTime?.message}
              {...register('nextDayReminderTime')}
            />
          </div>
          <Controller
            control={control}
            name="birthdayRemindersEnabled"
            render={({ field }) => <Toggle label="Birthday reminders" checked={!!field.value} onChange={field.onChange} />}
          />
          <Controller
            control={control}
            name="anniversaryRemindersEnabled"
            render={({ field }) => <Toggle label="Anniversary reminders" checked={!!field.value} onChange={field.onChange} />}
          />
        </SettingsSection>

        <SettingsSection title="Dates & phone numbers">
          <SelectField
            label="29 February in non-leap years"
            hint="Applies to birthdays and anniversaries on 29 February."
            error={errors.feb29Policy?.message}
            {...register('feb29Policy')}
          >
            {FEB29_POLICIES.map((p) => (
              <option key={p} value={p}>
                {FEB29_POLICY_LABELS[p]}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Default country code"
            inputMode="numeric"
            hint="Used when a number is entered without +country code."
            error={errors.defaultCountryCode?.message}
            {...register('defaultCountryCode')}
          />
        </SettingsSection>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => reset(settings)} disabled={!isDirty || isSubmitting}>
            Discard
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save settings
          </Button>
        </div>
      </form>

      <div className="mt-5 space-y-5">
        <NotificationsCard />
        <InstallCard />

        <SettingsSection title="Data source">
          <div className="flex items-center gap-3 text-sm">
            <Database className="h-4 w-4 text-ink-subtle" aria-hidden />
            <span className="font-semibold text-ink">Mode</span>
            <span className="ml-auto">
              {DATA_MODE === 'mock' ? <Badge tone="warning">Development mock</Badge> : <Badge tone="brand">Backend API</Badge>}
            </span>
          </div>
        </SettingsSection>

        <DemoDataCard />
      </div>
    </div>
  );
}
