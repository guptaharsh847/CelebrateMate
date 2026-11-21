import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

const CONTROL =
  'block w-full rounded-xl border-0 bg-white px-3.5 text-[15px] text-ink shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-ink-subtle transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-ink-subtle';
const INVALID = 'ring-red-300 focus:ring-red-500';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldShell({ id, label, error, hint, required, children, className }: FieldShellProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface CommonProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  containerClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, CommonProps & InputHTMLAttributes<HTMLInputElement>>(function TextField(
  { label, error, hint, containerClassName, className, id, required, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required} className={containerClassName}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(CONTROL, 'h-11', error && INVALID, className)}
        {...rest}
      />
    </FieldShell>
  );
});

export const TextAreaField = forwardRef<HTMLTextAreaElement, CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextAreaField({ label, error, hint, containerClassName, className, id, required, rows = 4, ...rest }, ref) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required} className={containerClassName}>
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(CONTROL, 'resize-y py-2.5 leading-relaxed', error && INVALID, className)}
          {...rest}
        />
      </FieldShell>
    );
  },
);

export const SelectField = forwardRef<HTMLSelectElement, CommonProps & SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ label, error, hint, containerClassName, className, id, required, children, ...rest }, ref) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required} className={containerClassName}>
        <div className="relative">
          <select
            ref={ref}
            id={fieldId}
            aria-invalid={!!error}
            className={cn(CONTROL, 'h-11 appearance-none pr-10', error && INVALID, className)}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
        </div>
      </FieldShell>
    );
  },
);
