import { useEffect, useState } from 'react';
import { todayInTimeZone } from '@/utils/date';
import { APP_TIMEZONE } from '@/utils/constants';

/** Today's date in Asia/Kolkata, refreshed every minute so it rolls over at IST midnight. */
export function useToday(): string {
  const [today, setToday] = useState(() => todayInTimeZone(APP_TIMEZONE));
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = todayInTimeZone(APP_TIMEZONE);
      setToday((prev) => (prev === next ? prev : next));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return today;
}
