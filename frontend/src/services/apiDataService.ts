import type {
  AppSettings,
  Contact,
  Device,
  MessageTemplate,
  NotificationLog,
  NotificationStatus,
  TestNotificationResult,
  WishHistoryEntry,
} from '@/types';
import { callApi } from './apiClient';
import type { DataService } from './types';

/** Real backend client: one method per Apps Script action (see docs/api-documentation.md). */
export function createApiDataService(): DataService {
  return {
    listContacts: (query = {}) => callApi<Contact[]>('contacts.list', { ...query }),
    getContact: (contactId) => callApi<Contact>('contacts.get', { contactId }),
    createContact: (contact) => callApi<Contact>('contacts.create', { contact }),
    updateContact: (contactId, contact) => callApi<Contact>('contacts.update', { contactId, contact }),
    deactivateContact: (contactId) => callApi<Contact>('contacts.deactivate', { contactId }),
    reactivateContact: (contactId) => callApi<Contact>('contacts.reactivate', { contactId }),

    listTemplates: () => callApi<MessageTemplate[]>('templates.list'),
    createTemplate: (template) => callApi<MessageTemplate>('templates.create', { template }),
    updateTemplate: (templateId, template) => callApi<MessageTemplate>('templates.update', { templateId, template }),
    setTemplateActive: (templateId, isActive) => callApi<MessageTemplate>('templates.setActive', { templateId, isActive }),

    getSettings: () => callApi<AppSettings>('settings.get'),
    updateSettings: (patch) => {
      // Timezone is fixed server-side; never send it.
      const settings: Partial<AppSettings> = { ...patch };
      delete settings.timezone;
      return callApi<AppSettings>('settings.update', { settings });
    },

    listHistory: (query = {}) => callApi<WishHistoryEntry[]>('history.list', { ...query }),
    logWishOpened: (entry) => callApi<WishHistoryEntry>('history.logOpened', { entry }, { keepalive: true }),
    markWishSent: (historyId) => callApi<WishHistoryEntry>('history.markSent', { historyId }),

    listDevices: () => callApi<Device[]>('devices.list'),
    registerDevice: (device) => callApi<Device>('devices.register', { device }),
    deactivateDevice: (deviceId) => callApi<Device>('devices.deactivate', { deviceId }),
    sendTestNotification: (deviceId) => callApi<TestNotificationResult>('notifications.test', deviceId ? { deviceId } : {}),
    getNotificationStatus: () => callApi<NotificationStatus>('notifications.status'),
    listNotificationLogs: (limit = 20) => callApi<NotificationLog[]>('notifications.logs', { limit }),
  };
}
