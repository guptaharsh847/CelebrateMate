import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}

/** iOS-style segmented control. */
export function Segmented<T extends string>({ value, options, onChange, label, className, size = 'md' }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-xl bg-gray-100 p-1', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 whitespace-nowrap rounded-lg font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cn('ml-1.5 text-xs', active ? 'text-brand-600' : 'text-ink-subtle')}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  dotClassName?: string;
}

export function Chip({ active, onClick, children, dotClassName }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        active ? 'bg-brand-500 text-white shadow-sm' : 'bg-white text-ink-muted ring-1 ring-inset ring-gray-200 hover:bg-gray-50 hover:text-ink',
      )}
    >
      {dotClassName && <span className={cn('h-2 w-2 rounded-full', active ? 'bg-white' : dotClassName)} aria-hidden />}
      {children}
    </button>
  );
}
