import { Cake, Heart, type LucideIcon } from 'lucide-react';
import type { AppSettings, Category, Feb29Policy, Occasion } from '@/types';

export const APP_NAME = 'CelebrateMate';
export const APP_TIMEZONE = 'Asia/Kolkata';

interface CategoryMeta {
  label: string;
  description: string;
  badge: string;
  dot: string;
  avatar: string;
  bar: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  DEVOTEE: {
    label: 'Devotee',
    description: 'Members of the spiritual community',
    badge: 'bg-indigo-50 text-indigo-700 ring-indigo-600/15',
    dot: 'bg-indigo-500',
    avatar: 'bg-indigo-100 text-indigo-700',
    bar: 'bg-indigo-500',
  },
  GENERAL: {
    label: 'General',
    description: 'Friends, family and colleagues',
    badge: 'bg-sky-50 text-sky-700 ring-sky-600/15',
    dot: 'bg-sky-500',
    avatar: 'bg-sky-100 text-sky-700',
    bar: 'bg-sky-500',
  },
  HELP_DONOR: {
    label: 'Help Donor',
    description: 'Supporters and donors',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    dot: 'bg-emerald-500',
    avatar: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-500',
  },
};

interface OccasionMeta {
  label: string;
  /** Used in template variable {occasion}. */
  messageLabel: string;
  badge: string;
  dot: string;
  iconBg: string;
  icon: LucideIcon;
}

export const OCCASION_META: Record<Occasion, OccasionMeta> = {
  BIRTHDAY: {
    label: 'Birthday',
    messageLabel: 'birthday',
    badge: 'bg-pink-50 text-pink-700 ring-pink-600/15',
    dot: 'bg-pink-500',
    iconBg: 'bg-pink-50 text-pink-600',
    icon: Cake,
  },
  ANNIVERSARY: {
    label: 'Anniversary',
    messageLabel: 'wedding anniversary',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    dot: 'bg-amber-500',
    iconBg: 'bg-amber-50 text-amber-600',
    icon: Heart,
  },
};

export const FEB29_POLICY_LABELS: Record<Feb29Policy, string> = {
  FEB_28: 'Celebrate on 28 February',
  MAR_1: 'Celebrate on 1 March',
};

export const DEFAULT_SETTINGS: AppSettings = {
  timezone: APP_TIMEZONE,
  sameDayReminderTime: '10:00',
  nextDayReminderTime: '22:00',
  birthdayRemindersEnabled: true,
  anniversaryRemindersEnabled: true,
  feb29Policy: 'FEB_28',
  defaultCountryCode: '91',
};
