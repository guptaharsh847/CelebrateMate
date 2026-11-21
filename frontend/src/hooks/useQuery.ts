import { useCallback, useEffect, useReducer, useRef } from 'react';

/**
 * Minimal in-memory query cache (no persistence — private data never touches
 * disk caches). Keys are strings; `invalidateQueries(prefix)` marks matching
 * entries stale so mounted consumers refetch while keeping current data visible.
 */
interface Entry {
  data?: unknown;
  error?: unknown;
  promise?: Promise<void>;
  stale: boolean;
}

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function startFetch(key: string, fetcher: () => Promise<unknown>): void {
  const existing = cache.get(key);
  if (existing?.promise) return;
  const promise = fetcher()
    .then(
      (data) => {
        cache.set(key, { data, stale: false });
      },
      (error: unknown) => {
        cache.set(key, { data: existing?.data, error, stale: false });
      },
    )
    .finally(notify);
  cache.set(key, { data: existing?.data, error: existing?.error, stale: existing?.stale ?? false, promise });
  notify();
}

export function invalidateQueries(prefix = ''): void {
  for (const [key, entry] of cache) {
    if (key.startsWith(prefix)) cache.set(key, { ...entry, stale: true });
  }
  notify();
}

/** Drops all cached data (e.g. on sign-out / account switch). */
export function clearQueries(): void {
  cache.clear();
  notify();
}

/** Replace cached data directly (e.g. after a mutation returns the new record). */
export function setQueryData<T>(key: string, data: T): void {
  cache.set(key, { data, stale: false });
  notify();
}

export interface QueryResult<T> {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
}

export function useQuery<T>(key: string | null, fetcher: () => Promise<T>): QueryResult<T> {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  const entry = key ? cache.get(key) : undefined;
  const needsFetch = key !== null && (!entry || (entry.stale && !entry.promise));

  useEffect(() => {
    if (key !== null && needsFetch) startFetch(key, () => fetcherRef.current());
  }, [key, needsFetch]);

  const refetch = useCallback(() => {
    if (!key) return;
    const current = cache.get(key);
    cache.set(key, { ...current, stale: true });
    startFetch(key, () => fetcherRef.current());
  }, [key]);

  const hasData = entry?.data !== undefined;
  return {
    data: entry?.data as T | undefined,
    // Hide errors while a retry is in flight so the error state can show progress.
    error: entry?.promise ? undefined : entry?.error,
    isLoading: key !== null && !hasData && (!entry || !!entry.promise || needsFetch),
    isFetching: !!entry?.promise,
    refetch,
  };
}
