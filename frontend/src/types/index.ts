export const CATEGORIES = ['DEVOTEE', 'GENERAL', 'HELP_DONOR'] as const;
export type Category = (typeof CATEGORIES)[number];

export const OCCASIONS = ['BIRTHDAY', 'ANNIVERSARY'] as const;
export type Occasion = (typeof OCCASIONS)[number];

/**
 * How a February 29 date is observed in non-leap years.
 * FEB_28 → celebrate on 28 February; MAR_1 → celebrate on 1 March.
 */
export const FEB29_POLICIES = ['FEB_28', 'MAR_1'] as const;
export type Feb29Policy = (typeof FEB29_POLICIES)[number];

export type ReminderType = 'SAME_DAY' | 'NEXT_DAY';

/** Calendar date in YYYY-MM-DD form. Never carries a time or timezone. */
export type ISODate = string;
/** Full ISO-8601 timestamp, e.g. 2026-11-20T10:00:00.000Z */
export type ISODateTime = string;

export interface Contact {
  contactId: string;
  fullName: string;
  /** Normalized international form, e.g. +919876543210 */
  mobileNumber: string;
  /** Normalized international form, e.g. +919876543210 */
  whatsappNumber: string;
  birthday: ISODate | null;
  anniversary: ISODate | null;
  category: Category;
  notes: string;
  isActive: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ContactInput {
  fullName: string;
  mobileNumber: string;
  whatsappNumber: string;
  birthday: ISODate | null;
  anniversary: ISODate | null;
  category: Category;
  notes: string;
}

export type ContactStatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

export interface ContactQuery {
  search?: string;
  category?: Category | 'ALL';
  status?: ContactStatusFilter;
}

export interface MessageTemplate {
  templateId: string;
  category: Category;
  occasion: Occasion;
  name: string;
  body: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface TemplateInput {
  category: Category;
  occasion: Occasion;
  name: string;
  body: string;
}

export interface AppSettings {
  /** Always Asia/Kolkata for this app; stored explicitly for the backend scheduler. */
  timezone: string;
  /** HH:mm, same-day reminder (default 10:00 IST). */
  sameDayReminderTime: string;
  /** HH:mm, next-day reminder (default 22:00 IST). */
  nextDayReminderTime: string;
  birthdayRemindersEnabled: boolean;
  anniversaryRemindersEnabled: boolean;
  feb29Policy: Feb29Policy;
  /** Digits only, used when a phone number is entered without a country code. */
  defaultCountryCode: string;
}

/** OPENED = wa.me chat was opened (NOT proof of sending). MARKED_SENT = user confirmed manually. */
export type WishStatus = 'OPENED' | 'MARKED_SENT';

export interface WishHistoryEntry {
  historyId: string;
  contactId: string;
  contactName: string;
  category: Category;
  occasion: Occasion;
  eventDate: ISODate;
  templateId: string;
  templateName: string;
  finalMessage: string;
  whatsappNumber: string;
  status: WishStatus;
  openedAt: ISODateTime;
  markedSentAt: ISODateTime | '';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface WishOpenedInput {
  contactId: string;
  occasion: Occasion;
  eventDate: ISODate;
  templateId?: string;
  finalMessage: string;
}

export interface HistoryQuery {
  contactId?: string;
  limit?: number;
}

export type DevicePlatform = 'ANDROID' | 'IOS' | 'DESKTOP' | 'OTHER';

export interface Device {
  deviceId: string;
  subscriptionId: string;
  platform: DevicePlatform;
  label: string;
  userAgent: string;
  isActive: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastSeenAt: ISODateTime;
}

export interface DeviceInput {
  subscriptionId: string;
  platform: DevicePlatform;
  label: string;
  userAgent: string;
}

export type NotificationLogStatus = 'SENT' | 'FAILED' | 'SKIPPED';

export interface NotificationLog {
  logId: string;
  dedupeKey: string;
  reminderType: ReminderType | 'TEST';
  eventDate: ISODate | null;
  contactId: string;
  contactName: string;
  occasion: Occasion | '';
  status: NotificationLogStatus;
  attempts: number;
  recipients: number;
  oneSignalId: string;
  detail: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface NotificationStatus {
  oneSignalConfigured: boolean;
  scheduler: { handler: string; installed: boolean; count: number; everyMinutes: number; timezone: string };
}

export interface TestNotificationResult {
  oneSignalId: string;
  recipients: number;
  note: string;
}

export interface Celebration {
  /** Stable de-duplication key: eventDate|contactId|occasion */
  key: string;
  contact: Contact;
  occasion: Occasion;
  /** The stored original date, including original year. */
  originalDate: ISODate;
  /** The date this occurrence is celebrated (after Feb-29 policy). */
  eventDate: ISODate;
  /** Days from "today" (in the app timezone) to eventDate. 0 = today. */
  daysUntil: number;
  /** Age turning / anniversary number, or null when not meaningful. */
  years: number | null;
}
