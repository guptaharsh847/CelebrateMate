import type { AppSettings, Contact, ContactInput, ContactQuery, Device, MessageTemplate, TemplateInput, WishHistoryEntry } from '@/types';
import { DEFAULT_TEMPLATES } from '@/data/defaultTemplates';
import { DEFAULT_SETTINGS } from '@/utils/constants';
import type { DataService } from '../types';
import { ServiceError } from '../types';
import { buildSeedContacts } from './seed';

/**
 * DEVELOPMENT-ONLY data service. Persists to localStorage so edits survive a
 * reload during development. Never bundled into production builds
 * (see services/config.ts and services/index.ts).
 */

const STORAGE_KEY = 'celebratemate:mock-db:v2';

interface MockDb {
  contacts: Contact[];
  templates: MessageTemplate[];
  settings: AppSettings;
  history: WishHistoryEntry[];
  devices: Device[];
}

function seedDb(): MockDb {
  const now = new Date().toISOString();
  return {
    contacts: buildSeedContacts(),
    templates: DEFAULT_TEMPLATES.map((t) => ({ ...t, isActive: true, isDefault: true, createdAt: now, updatedAt: now })),
    settings: { ...DEFAULT_SETTINGS },
    history: [],
    devices: [],
  };
}

function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MockDb>;
      if (parsed.contacts && parsed.templates && parsed.settings) return { history: [], devices: [], ...parsed } as MockDb;
    }
  } catch {
    // Corrupt or unavailable storage: fall through to a fresh seed.
  }
  const db = seedDb();
  saveDb(db);
  return db;
}

function saveDb(db: MockDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage may be unavailable (private mode); keep working in memory.
  }
}

export function resetMockData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

const delay = <T,>(value: T, ms = 180 + Math.random() * 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));

function newId(prefix: string): string {
  const random = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}_${Date.now().toString(36).toUpperCase()}${Array.from(random, (n) => n.toString(36).toUpperCase()).join('')}`;
}

function matchesSearch(contact: Contact, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  return (
    contact.fullName.toLowerCase().includes(q) ||
    contact.notes.toLowerCase().includes(q) ||
    (digits.length >= 3 && (contact.mobileNumber.includes(digits) || contact.whatsappNumber.includes(digits)))
  );
}

function assertNotDuplicate(db: MockDb, input: ContactInput, ignoreId?: string): void {
  const clash = db.contacts.find(
    (c) => c.contactId !== ignoreId && c.isActive && c.fullName.toLowerCase() === input.fullName.toLowerCase() && c.mobileNumber === input.mobileNumber,
  );
  if (clash) {
    throw new ServiceError('CONFLICT', `${clash.fullName} with this mobile number already exists.`);
  }
}

export function createMockDataService(): DataService {
  let db = loadDb();
  const commit = () => saveDb(db);

  const findContact = (id: string): Contact => {
    const contact = db.contacts.find((c) => c.contactId === id);
    if (!contact) throw new ServiceError('NOT_FOUND', 'Contact not found.');
    return contact;
  };

  const findTemplate = (id: string): MessageTemplate => {
    const template = db.templates.find((t) => t.templateId === id);
    if (!template) throw new ServiceError('NOT_FOUND', 'Template not found.');
    return template;
  };

  const run = async <T,>(fn: () => T): Promise<T> => {
    db = loadDb();
    return delay(fn());
  };

  const setContactActive = (id: string, isActive: boolean) =>
    run(() => {
      const contact = findContact(id);
      contact.isActive = isActive;
      contact.updatedAt = new Date().toISOString();
      commit();
      return contact;
    });

  return {
    listContacts: (query: ContactQuery = {}) =>
      run(() => {
        const status = query.status ?? 'ACTIVE';
        return db.contacts
          .filter((c) => (status === 'ALL' ? true : status === 'ACTIVE' ? c.isActive : !c.isActive))
          .filter((c) => !query.category || query.category === 'ALL' || c.category === query.category)
          .filter((c) => matchesSearch(c, query.search ?? ''))
          .sort((a, b) => a.fullName.localeCompare(b.fullName));
      }),

    getContact: (id) => run(() => findContact(id)),

    createContact: (input) =>
      run(() => {
        assertNotDuplicate(db, input);
        const now = new Date().toISOString();
        const contact: Contact = { ...input, contactId: newId('CON'), isActive: true, createdAt: now, updatedAt: now };
        db.contacts.push(contact);
        commit();
        return contact;
      }),

    updateContact: (id, input) =>
      run(() => {
        const contact = findContact(id);
        assertNotDuplicate(db, input, id);
        Object.assign(contact, input, { updatedAt: new Date().toISOString() });
        commit();
        return contact;
      }),

    deactivateContact: (id) => setContactActive(id, false),
    reactivateContact: (id) => setContactActive(id, true),

    listTemplates: () =>
      run(() =>
        [...db.templates].sort(
          (a, b) => a.category.localeCompare(b.category) || a.occasion.localeCompare(b.occasion) || a.sortOrder - b.sortOrder,
        ),
      ),

    createTemplate: (input: TemplateInput) =>
      run(() => {
        const now = new Date().toISOString();
        const siblings = db.templates.filter((t) => t.category === input.category && t.occasion === input.occasion);
        const template: MessageTemplate = {
          ...input,
          templateId: newId('TPL'),
          isActive: true,
          isDefault: false,
          sortOrder: Math.max(0, ...siblings.map((t) => t.sortOrder)) + 1,
          createdAt: now,
          updatedAt: now,
        };
        db.templates.push(template);
        commit();
        return template;
      }),

    updateTemplate: (id, input) =>
      run(() => {
        const template = findTemplate(id);
        Object.assign(template, input, { updatedAt: new Date().toISOString() });
        commit();
        return template;
      }),

    setTemplateActive: (id, isActive) =>
      run(() => {
        const template = findTemplate(id);
        if (!isActive) {
          const activeSiblings = db.templates.filter(
            (t) => t.isActive && t.category === template.category && t.occasion === template.occasion,
          );
          if (activeSiblings.length <= 1) {
            throw new ServiceError('VALIDATION', 'Keep at least one active template for each category and occasion.');
          }
        }
        template.isActive = isActive;
        template.updatedAt = new Date().toISOString();
        commit();
        return template;
      }),

    getSettings: () => run(() => db.settings),

    updateSettings: (patch) =>
      run(() => {
        // Timezone is fixed for this app.
        db.settings = { ...db.settings, ...patch, timezone: DEFAULT_SETTINGS.timezone };
        commit();
        return db.settings;
      }),

    listHistory: (query = {}) =>
      run(() =>
        db.history
          .filter((h) => !query.contactId || h.contactId === query.contactId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, query.limit ?? 100),
      ),

    logWishOpened: (input) =>
      run(() => {
        const contact = findContact(input.contactId);
        const template = input.templateId ? db.templates.find((t) => t.templateId === input.templateId) : undefined;
        const now = new Date().toISOString();
        const entry: WishHistoryEntry = {
          historyId: newId('HIS'),
          contactId: contact.contactId,
          contactName: contact.fullName,
          category: contact.category,
          occasion: input.occasion,
          eventDate: input.eventDate,
          templateId: input.templateId ?? '',
          templateName: template?.name ?? '',
          finalMessage: input.finalMessage,
          whatsappNumber: contact.whatsappNumber,
          status: 'OPENED',
          openedAt: now,
          markedSentAt: '',
          createdAt: now,
          updatedAt: now,
        };
        db.history.push(entry);
        commit();
        return entry;
      }),

    markWishSent: (historyId) =>
      run(() => {
        const entry = db.history.find((h) => h.historyId === historyId);
        if (!entry) throw new ServiceError('NOT_FOUND', 'History entry not found.');
        if (entry.status !== 'MARKED_SENT') {
          const now = new Date().toISOString();
          Object.assign(entry, { status: 'MARKED_SENT', markedSentAt: now, updatedAt: now });
          commit();
        }
        return entry;
      }),

    listDevices: () => run(() => db.devices),

    registerDevice: (input) =>
      run(() => {
        const now = new Date().toISOString();
        const existing = db.devices.find((d) => d.subscriptionId === input.subscriptionId);
        if (existing) {
          Object.assign(existing, { ...input, isActive: true, updatedAt: now, lastSeenAt: now });
          commit();
          return existing;
        }
        const device: Device = { ...input, deviceId: newId('DEV'), isActive: true, createdAt: now, updatedAt: now, lastSeenAt: now };
        db.devices.push(device);
        commit();
        return device;
      }),

    deactivateDevice: (deviceId) =>
      run(() => {
        const device = db.devices.find((d) => d.deviceId === deviceId);
        if (!device) throw new ServiceError('NOT_FOUND', 'Device not found.');
        Object.assign(device, { isActive: false, updatedAt: new Date().toISOString() });
        commit();
        return device;
      }),

    // Push needs the real backend + OneSignal; the mock never pretends to send.
    sendTestNotification: () =>
      Promise.reject(new ServiceError('NOT_CONFIGURED', 'Test notifications need the real backend and OneSignal. They are not available with demo data.')),
    getNotificationStatus: () =>
      run(() => ({ oneSignalConfigured: false, scheduler: { handler: 'dispatchReminders', installed: false, count: 0, everyMinutes: 15, timezone: 'Asia/Kolkata' } })),
    listNotificationLogs: () => run(() => []),
  };
}
