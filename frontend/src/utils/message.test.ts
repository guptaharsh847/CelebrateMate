import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATES } from '@/data/defaultTemplates';
import { CATEGORIES, OCCASIONS } from '@/types';
import { buildWhatsAppUrl, findUnknownVariables, renderTemplate } from './message';

const ctx = { name: 'Priya Sharma', occasion: 'BIRTHDAY' as const, eventDate: '2026-11-21', years: 30 };

describe('renderTemplate', () => {
  it('replaces all known variables', () => {
    const body = 'Happy {occasion}, {first_name}! ({name}) on {date}: {years} / {years_ordinal}';
    expect(renderTemplate(body, ctx)).toBe('Happy birthday, Priya! (Priya Sharma) on 21 November: 30 / 30th');
  });

  it('uses the anniversary label', () => {
    expect(renderTemplate('Happy {occasion}!', { ...ctx, occasion: 'ANNIVERSARY' })).toBe('Happy wedding anniversary!');
  });

  it('replaces repeated variables and is case-insensitive', () => {
    expect(renderTemplate('{NAME} {name}', ctx)).toBe('Priya Sharma Priya Sharma');
  });

  it('blanks known variables without a value and keeps unknown ones', () => {
    expect(renderTemplate('Turning {years}! {nickname}', { ...ctx, years: null })).toBe('Turning ! {nickname}');
  });

  it('preserves emoji and newlines', () => {
    expect(renderTemplate('🙏 {first_name}\n\nBlessings', ctx)).toBe('🙏 Priya\n\nBlessings');
  });
});

describe('findUnknownVariables', () => {
  it('lists unrecognised placeholders once', () => {
    expect(findUnknownVariables('{name} {nick} {nick} {date}')).toEqual(['nick']);
  });
});

describe('buildWhatsAppUrl', () => {
  it('encodes the message with encodeURIComponent', () => {
    const url = buildWhatsAppUrl('919876543210', 'Happy birthday Priya! 🎉\nA&B ?=#');
    expect(url).toBe(`https://wa.me/919876543210?text=${encodeURIComponent('Happy birthday Priya! 🎉\nA&B ?=#')}`);
    expect(url).not.toContain(' ');
    expect(url).toContain('%0A');
  });

  it('strips non-digits from the phone', () => {
    expect(buildWhatsAppUrl('+91 98765-43210', 'hi')).toBe('https://wa.me/919876543210?text=hi');
  });
});

describe('default templates', () => {
  it('has exactly three templates per category and occasion (18 total) with unique IDs', () => {
    expect(DEFAULT_TEMPLATES).toHaveLength(18);
    expect(new Set(DEFAULT_TEMPLATES.map((t) => t.templateId)).size).toBe(18);
    for (const category of CATEGORIES) {
      for (const occasion of OCCASIONS) {
        expect(DEFAULT_TEMPLATES.filter((t) => t.category === category && t.occasion === occasion)).toHaveLength(3);
      }
    }
  });

  it('uses only known variables', () => {
    for (const t of DEFAULT_TEMPLATES) expect(findUnknownVariables(t.body)).toEqual([]);
  });
});
