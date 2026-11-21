import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import type { Category, MessageTemplate, Occasion, TemplateInput } from '@/types';
import { CATEGORIES, OCCASIONS } from '@/types';
import { Button } from '@/components/ui/Button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { CATEGORY_META, OCCASION_META } from '@/utils/constants';
import { findUnknownVariables, TEMPLATE_VARIABLES } from '@/utils/message';
import { templateSchema, type TemplateFormValues } from '@/utils/schemas';
import { MessagePreview } from './MessagePreview';

interface TemplateFormModalProps {
  open: boolean;
  template?: MessageTemplate;
  defaults: { category: Category; occasion: Occasion };
  onClose: () => void;
  onSubmit: (input: TemplateInput) => Promise<boolean>;
}

const FORM_ID = 'template-form';

export function TemplateFormModal({ open, template, defaults, onClose, onSubmit }: TemplateFormModalProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormValues>({ resolver: zodResolver(templateSchema), mode: 'onTouched' });
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      reset({
        name: template?.name ?? '',
        body: template?.body ?? '',
        category: template?.category ?? defaults.category,
        occasion: template?.occasion ?? defaults.occasion,
      });
    }
  }, [open, template, defaults.category, defaults.occasion, reset]);

  const body = useWatch({ control, name: 'body' }) ?? '';
  const occasion = useWatch({ control, name: 'occasion' }) ?? defaults.occasion;
  const unknown = findUnknownVariables(body);
  const { ref: bodyRegisterRef, ...bodyRegister } = register('body');

  const insertVariable = (key: string) => {
    const el = bodyRef.current;
    const current = getValues('body') ?? '';
    const token = `{${key}}`;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    setValue('body', current.slice(0, start) + token + current.slice(end), { shouldDirty: true, shouldValidate: true });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const submit = handleSubmit(async (values) => {
    const ok = await onSubmit(values);
    if (ok) onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={isSubmitting}
      size="lg"
      title={template ? 'Edit template' : 'New template'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            {template ? 'Save template' : 'Create template'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="space-y-4">
        <TextField label="Template name" required placeholder="e.g. Warm wishes" error={errors.name?.message} {...register('name')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Category" required error={errors.category?.message} {...register('category')}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Occasion" required error={errors.occasion?.message} {...register('occasion')}>
            {OCCASIONS.map((o) => (
              <option key={o} value={o}>
                {OCCASION_META[o].label}
              </option>
            ))}
          </SelectField>
        </div>
        <div>
          <TextAreaField
            label="Message"
            required
            rows={6}
            placeholder="Happy {occasion}, {first_name}!"
            error={errors.body?.message}
            hint={`${body.length}/1000 characters`}
            ref={(el) => {
              bodyRegisterRef(el);
              bodyRef.current = el;
            }}
            {...bodyRegister}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key)}
                title={v.description}
                className="rounded-lg bg-brand-50 px-2 py-1 font-mono text-xs font-semibold text-brand-700 hover:bg-brand-100"
              >
                {`{${v.key}}`}
              </button>
            ))}
          </div>
          {unknown.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              Unknown variable{unknown.length > 1 ? 's' : ''} {unknown.map((u) => `{${u}}`).join(', ')} will be sent as typed.
            </p>
          )}
        </div>
        {body.trim().length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Preview</p>
            <MessagePreview body={body} occasion={occasion} />
          </div>
        )}
      </form>
    </Modal>
  );
}
