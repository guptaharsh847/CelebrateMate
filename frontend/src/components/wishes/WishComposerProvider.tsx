import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Celebration } from '@/types';
import { WishComposer, type WishTarget } from './WishComposer';

const WishContext = createContext<((target: WishTarget) => void) | null>(null);

/** Hosts a single WhatsApp composer for the whole app. */
export function WishComposerProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<WishTarget | null>(null);
  const open = useCallback((t: WishTarget) => setTarget(t), []);
  return (
    <WishContext.Provider value={open}>
      {children}
      {target && (
        <WishComposer
          key={`${target.contact.contactId}|${target.occasion}|${target.eventDate}`}
          target={target}
          onClose={() => setTarget(null)}
        />
      )}
    </WishContext.Provider>
  );
}

export function useWishComposer() {
  const open = useContext(WishContext);
  if (!open) throw new Error('useWishComposer must be used inside WishComposerProvider');
  return {
    open,
    openForCelebration: (c: Celebration) => open({ contact: c.contact, occasion: c.occasion, eventDate: c.eventDate, years: c.years }),
  };
}
