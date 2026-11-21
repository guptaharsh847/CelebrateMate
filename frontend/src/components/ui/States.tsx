import type { ReactNode } from 'react';
import { AlertTriangle, Loader2, PlugZap, RotateCw } from 'lucide-react';
import { errorMessage, ServiceError } from '@/services';
import { cn } from '@/utils/cn';
import { Button } from './Button';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-6' : 'px-6 py-12', className)}>
      <div className={cn('flex items-center justify-center rounded-2xl bg-brand-50 text-brand-500', compact ? 'h-11 w-11' : 'h-14 w-14')}>
        {icon}
      </div>
      <h3 className={cn('font-bold text-ink', compact ? 'mt-3 text-sm' : 'mt-4 text-base')}>{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function ErrorState({ error, onRetry, retrying, className }: ErrorStateProps) {
  const notConfigured = error instanceof ServiceError && error.code === 'NOT_CONFIGURED';
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)} role="alert">
      <div
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-2xl',
          notConfigured ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500',
        )}
      >
        {notConfigured ? <PlugZap className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
      </div>
      <h3 className="mt-4 text-base font-bold text-ink">{notConfigured ? 'Backend not connected' : "Couldn't load data"}</h3>
      <p className="mt-1 max-w-md text-sm text-ink-muted">{errorMessage(error)}</p>
      {onRetry && !notConfigured && (
        <Button variant="secondary" className="mt-5" onClick={onRetry} loading={retrying} icon={<RotateCw className="h-4 w-4" />}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-12 text-sm text-ink-muted', className)} role="status">
      <Loader2 className="h-5 w-5 animate-spin text-brand-500" aria-hidden />
      {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-gray-100', className)} aria-hidden />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
