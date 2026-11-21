import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Contact, ContactInput } from '@/types';
import { CATEGORIES } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { CATEGORY_META } from '@/utils/constants';
import { todayInTimeZone } from '@/utils/date';
import { formatPhone, toStoredPhone } from '@/utils/phone';
import { createContactSchema, type ContactFormValues } from '@/utils/schemas';

interface ContactFormProps {
  initial?: Contact;
  defaultCountryCode: string;
  submitLabel: string;
  onSubmit: (input: ContactInput) => Promise<unknown>;
  onCancel: () => void;
}

function toFormValues(contact?: Contact): ContactFormValues {
  return {
    fullName: contact?.fullName ?? '',
    mobileNumber: contact?.mobileNumber ?? '',
    whatsappSameAsMobile: contact ? contact.whatsappNumber === contact.mobileNumber : true,
    whatsappNumber: contact && contact.whatsappNumber !== contact.mobileNumber ? contact.whatsappNumber : '',
    birthday: contact?.birthday ?? '',
    anniversary: contact?.anniversary ?? '',
    category: contact?.category ?? 'GENERAL',
    notes: contact?.notes ?? '',
  };
}

export function ContactForm({ initial, defaultCountryCode, submitLabel, onSubmit, onCancel }: ContactFormProps) {
  const schema = useMemo(() => createContactSchema(defaultCountryCode), [defaultCountryCode]);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(initial),
    mode: 'onTouched',
  });

  const sameAsMobile = useWatch({ control, name: 'whatsappSameAsMobile' });
  const mobile = useWatch({ control, name: 'mobileNumber' });
  const normalizedMobile = toStoredPhone(mobile, defaultCountryCode);
  const maxDate = todayInTimeZone();

  const submit = handleSubmit(async (values) => {
    const mobileNumber = toStoredPhone(values.mobileNumber, defaultCountryCode);
    const whatsappNumber = values.whatsappSameAsMobile ? mobileNumber : toStoredPhone(values.whatsappNumber, defaultCountryCode);
    if (!mobileNumber || !whatsappNumber) return; // unreachable: schema validated both
    await onSubmit({
      fullName: values.fullName.replace(/\s+/g, ' '),
      mobileNumber,
      whatsappNumber,
      birthday: values.birthday || null,
      anniversary: values.anniversary || null,
      category: values.category,
      notes: values.notes,
    });
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-subtle">Details</h2>
        <TextField label="Full name" required autoComplete="name" placeholder="e.g. Priya Sharma" error={errors.fullName?.message} {...register('fullName')} />
        <SelectField label="Category" required error={errors.category?.message} {...register('category')}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].label} — {CATEGORY_META[c].description}
            </option>
          ))}
        </SelectField>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-subtle">Phone</h2>
        <TextField
          label="Mobile number"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98765 43210 or +44 7700 900123"
          error={errors.mobileNumber?.message}
          hint={
            normalizedMobile
              ? `Saved as ${formatPhone(normalizedMobile)}`
              : `Numbers without a country code use +${defaultCountryCode}.`
          }
          {...register('mobileNumber')}
        />
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-ink">
          <input type="checkbox" className="h-5 w-5 rounded-md border-gray-300 text-brand-500 accent-brand-500" {...register('whatsappSameAsMobile')} />
          WhatsApp uses the same number
        </label>
        {!sameAsMobile && (
          <TextField
            label="WhatsApp number"
            required
            type="tel"
            inputMode="tel"
            placeholder="WhatsApp number"
            error={errors.whatsappNumber?.message}
            {...register('whatsappNumber')}
          />
        )}
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-subtle">Occasions</h2>
          <p className="mt-1 text-xs text-ink-muted">Both are optional. Include the original year so ages and anniversary numbers are correct.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Birthday" type="date" max={maxDate} error={errors.birthday?.message} {...register('birthday')} />
          <TextField label="Wedding anniversary" type="date" max={maxDate} error={errors.anniversary?.message} {...register('anniversary')} />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <TextAreaField label="Notes" rows={3} placeholder="Anything worth remembering" error={errors.notes?.message} {...register('notes')} />
      </Card>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex gap-3 border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting} className="flex-1 sm:flex-none">
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting} disabled={!!initial && !isDirty} className="flex-1 sm:flex-none">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
