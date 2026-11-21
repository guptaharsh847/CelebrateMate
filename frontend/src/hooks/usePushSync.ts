import { useEffect } from 'react';
import { dataService, IS_MOCK } from '@/services';
import { browserPermission, currentSubscriptionId, deviceInput, getPushSupport, onSubscriptionChange } from '@/services/push';
import { useSession } from './useSession';
import { invalidateQueries } from './useQuery';

/**
 * Once per sign-in: if this browser already granted permission, re-register its
 * subscription (updates lastSeenAt, reactivates it, and follows OneSignal
 * subscription ID changes). Never prompts for permission.
 */
export function usePushSync(): void {
  const session = useSession();
  const email = session?.email;

  useEffect(() => {
    if (IS_MOCK || !email || !getPushSupport().supported || browserPermission() !== 'granted') return;
    let cancelled = false;
    const register = (id: string | null) => {
      if (!id || cancelled) return;
      dataService
        .registerDevice(deviceInput(id))
        .then(() => invalidateQueries('devices:'))
        .catch((err: unknown) => console.warn('Device re-registration failed', err));
    };
    currentSubscriptionId().then(register, (err: unknown) => console.warn('Push init failed', err));
    onSubscriptionChange(register);
    return () => {
      cancelled = true;
    };
  }, [email]);
}
