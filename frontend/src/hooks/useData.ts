import { dataService } from '@/services';
import type { ContactQuery, HistoryQuery } from '@/types';
import { DEFAULT_SETTINGS } from '@/utils/constants';
import { useQuery } from './useQuery';

export const queryKeys = {
  contacts: (query: ContactQuery = {}) => `contacts:list:${JSON.stringify(query)}`,
  contact: (id: string) => `contacts:detail:${id}`,
  templates: () => 'templates:list',
  settings: () => 'settings',
  history: (query: HistoryQuery = {}) => `history:list:${JSON.stringify(query)}`,
  devices: () => 'devices:list',
  notificationStatus: () => 'notifications:status',
  notificationLogs: () => 'notifications:logs',
};

export function useHistory(query: HistoryQuery = {}) {
  return useQuery(queryKeys.history(query), () => dataService.listHistory(query));
}

export function useDevices(enabled = true) {
  return useQuery(enabled ? queryKeys.devices() : null, () => dataService.listDevices());
}

export function useNotificationStatus(enabled = true) {
  return useQuery(enabled ? queryKeys.notificationStatus() : null, () => dataService.getNotificationStatus());
}

export function useNotificationLogs(enabled = true) {
  return useQuery(enabled ? queryKeys.notificationLogs() : null, () => dataService.listNotificationLogs(10));
}

export function useContacts(query: ContactQuery = {}) {
  return useQuery(queryKeys.contacts(query), () => dataService.listContacts(query));
}

export function useContact(contactId: string | undefined) {
  return useQuery(contactId ? queryKeys.contact(contactId) : null, () => dataService.getContact(contactId ?? ''));
}

export function useTemplates() {
  return useQuery(queryKeys.templates(), () => dataService.listTemplates());
}

export function useSettings() {
  return useQuery(queryKeys.settings(), () => dataService.getSettings());
}

/** Settings with defaults filled in while loading or on error, for date maths. */
export function useEffectiveSettings() {
  const { data } = useSettings();
  return data ?? DEFAULT_SETTINGS;
}
