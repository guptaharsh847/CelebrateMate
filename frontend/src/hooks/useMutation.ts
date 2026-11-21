import { useCallback, useRef, useState } from 'react';

export interface MutationState<TArgs extends unknown[], TResult> {
  mutate: (...args: TArgs) => Promise<TResult | undefined>;
  isPending: boolean;
  error: unknown;
  reset: () => void;
}

/**
 * Wraps an async action with pending/error state. Resolves to undefined on
 * failure (the error is exposed and passed to onError) so callers don't need try/catch.
 */
export function useMutation<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: { onSuccess?: (result: TResult) => void; onError?: (error: unknown) => void } = {},
): MutationState<TArgs, TResult> {
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const actionRef = useRef(action);
  actionRef.current = action;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mutate = useCallback(async (...args: TArgs) => {
    setPending(true);
    setError(undefined);
    try {
      const result = await actionRef.current(...args);
      optionsRef.current.onSuccess?.(result);
      return result;
    } catch (err) {
      setError(err);
      optionsRef.current.onError?.(err);
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => setError(undefined), []);

  return { mutate, isPending, error, reset };
}
