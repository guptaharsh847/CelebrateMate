import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATES } from '@/data/defaultTemplates';
import type { MessageTemplate } from '@/types';
import { CATEGORIES, OCCASIONS } from '@/types';
import { buildWhatsAppUrl, findUnknownVariables, renderTemplate } from './message';
import { normalizePhone } from './phone';
import { messageProblem, templatesFor } from './wish';

const now = '2026-01-01T00:00:00.000Z';
const templates: MessageTemplate[] = DEFAULT_TEMPLATES.map((t) => ({ ...t, isActive: true, isDefault: true, createdAt: now, updatedAt: now }));

describe('templatesFor', () => {
  it('returns the three active templates for every category × occasion in order', () => {
    for (const category of CATEGORIES) {
      for (const occasion of OCCASIONS) {
        const list = templatesFor(templates, category, occasion);
        expect(list.map((t) => t.sortOrder)).toEqual([1, 2, 3]);
        expect(list.every((t) => t.category === category && t.occasion === occasion)).toBe(true);
      }
    }
  });

  it('excludes inactive templates', () => {
    const modified = templates.map((t) => (t.templateId === 'TPL_GENERAL_BIRTHDAY_2' ? { ...t, isActive: false } : t));
    expect(templatesFor(modified, 'GENERAL', 'BIRTHDAY').map((t) => t.templateId)).toEqual(['TPL_GENERAL_BIRTHDAY_1', 'TPL_GENERAL_BIRTHDAY_3']);
  });
});

describe('all 18 default templates produce valid WhatsApp links', () => {
  const contexts = [
    { name: 'Priya Sharma', years: 30 },
    { name: 'Ramesh & Sunita Iyer', years: 25 },
    { name: 'Zoë O’Brien-Nair', years: null },
  ];
  for (const t of DEFAULT_TEMPLATES) {
    it(t.templateId, () => {
      for (const c of contexts) {
        const message = renderTemplate(t.body, { name: c.name, occasion: t.occasion, eventDate: '2026-11-21', years: c.years });
        expect(message).not.toMatch(/\{[a-z_]+\}/i);
        expect(message).toContain(c.name.split(' ')[0]);
        expect(messageProblem(message)).toBeNull();
        const url = buildWhatsAppUrl('919876543210', message);
        expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
        // Round-trips exactly, including emoji, &, apostrophes and newlines.
        expect(decodeURIComponent(url.split('?text=')[1] ?? '')).toBe(message);
        expect(url.split('?text=')[1]).not.toMatch(/[ \n#&?]/);
      }
      expect(findUnknownVariables(t.body)).toEqual([]);
    });
  }
});

describe('messageProblem', () => {
  it('flags empty and over-long messages', () => {
    expect(messageProblem('   ')).toBe('EMPTY');
    expect(messageProblem('a'.repeat(2001))).toBe('TOO_LONG');
    expect(messageProblem('Happy birthday!')).toBeNull();
  });
});

describe('international numbers for wa.me', () => {
  it('produces digits-only numbers with country code', () => {
    expect(buildWhatsAppUrl(normalizePhone('+44 7700 900123')!, 'Hi')).toBe('https://wa.me/447700900123?text=Hi');
    expect(buildWhatsAppUrl(normalizePhone('098765 43210')!, 'Hi')).toBe('https://wa.me/919876543210?text=Hi');
  });
});
