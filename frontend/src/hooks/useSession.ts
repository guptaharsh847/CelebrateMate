import { useSyncExternalStore } from 'react';
import { peekSession, subscribeSession, type Session } from '@/services/session';

export function useSession(): Session | null {
  return useSyncExternalStore(subscribeSession, peekSession, () => null);
}
