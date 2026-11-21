import type {
  AppSettings,
  Contact,
  ContactInput,
  ContactQuery,
  Device,
  DeviceInput,
  HistoryQuery,
  MessageTemplate,
  NotificationLog,
  NotificationStatus,
  TemplateInput,
  TestNotificationResult,
  WishHistoryEntry,
  WishOpenedInput,
} from '@/types';

/** The contract every data source (mock or real API) implements. */
export interface DataService {
  listContacts(query?: ContactQuery): Promise<Contact[]>;
  getContact(contactId: string): Promise<Contact>;
  createContact(input: ContactInput): Promise<Contact>;
  updateContact(contactId: string, input: ContactInput): Promise<Contact>;
  /** Soft delete: sets isActive = false. */
  deactivateContact(contactId: string): Promise<Contact>;
  reactivateContact(contactId: string): Promise<Contact>;

  listTemplates(): Promise<MessageTemplate[]>;
  createTemplate(input: TemplateInput): Promise<MessageTemplate>;
  updateTemplate(templateId: string, input: TemplateInput): Promise<MessageTemplate>;
  setTemplateActive(templateId: string, isActive: boolean): Promise<MessageTemplate>;

  getSettings(): Promise<AppSettings>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;

  listHistory(query?: HistoryQuery): Promise<WishHistoryEntry[]>;
  /** Records that a WhatsApp chat was opened. Uses keepalive so it survives switching to WhatsApp. */
  logWishOpened(input: WishOpenedInput): Promise<WishHistoryEntry>;
  markWishSent(historyId: string): Promise<WishHistoryEntry>;

  listDevices(): Promise<Device[]>;
  registerDevice(input: DeviceInput): Promise<Device>;
  deactivateDevice(deviceId: string): Promise<Device>;
  sendTestNotification(deviceId?: string): Promise<TestNotificationResult>;
  getNotificationStatus(): Promise<NotificationStatus>;
  listNotificationLogs(limit?: number): Promise<NotificationLog[]>;
}

export type ServiceErrorCode =
  | 'NOT_CONFIGURED'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'BUSY'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL'
  | 'NETWORK'
  | 'UNKNOWN';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly details: Record<string, string> | null;

  constructor(code: ServiceErrorCode, message: string, details: Record<string, string> | null = null) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.details = details;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ServiceError && error.details) {
    const first = Object.entries(error.details)[0];
    if (first) return `${error.message} ${first[0]}: ${first[1]}`;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
