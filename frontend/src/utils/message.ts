import type { ISODate, Occasion } from '@/types';
import { OCCASION_META } from './constants';
import { formatDate, ordinal } from './date';

export interface TemplateVariable {
  key: string;
  description: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: 'name', description: 'Full name' },
  { key: 'first_name', description: 'First name' },
  { key: 'occasion', description: 'birthday / wedding anniversary' },
  { key: 'date', description: 'Celebration date, e.g. 21 November' },
  { key: 'years', description: 'Age turning or years married (may be blank)' },
  { key: 'years_ordinal', description: 'e.g. 25th (may be blank)' },
];

const KNOWN_KEYS = new Set(TEMPLATE_VARIABLES.map((v) => v.key));
const VARIABLE_RE = /\{([a-zA-Z_]+)\}/g;

export interface TemplateContext {
  name: string;
  occasion: Occasion;
  eventDate: ISODate;
  years: number | null;
}

export function buildVariableValues(ctx: TemplateContext): Record<string, string> {
  const name = ctx.name.trim();
  return {
    name,
    first_name: name.split(/\s+/)[0] ?? name,
    occasion: OCCASION_META[ctx.occasion].messageLabel,
    date: formatDate(ctx.eventDate, 'd MMMM'),
    years: ctx.years ? String(ctx.years) : '',
    years_ordinal: ctx.years ? ordinal(ctx.years) : '',
  };
}

/**
 * Replaces {variable} placeholders. Known variables without a value become
 * empty strings; unknown placeholders are left untouched so the user can spot them.
 */
export function renderTemplate(body: string, ctx: TemplateContext): string {
  const values = buildVariableValues(ctx);
  return body.replace(VARIABLE_RE, (match, key: string) => {
    const normalized = key.toLowerCase();
    return KNOWN_KEYS.has(normalized) ? (values[normalized] ?? '') : match;
  });
}

/** Placeholders in a template that the renderer does not recognise. */
export function findUnknownVariables(body: string): string[] {
  const unknown = new Set<string>();
  for (const match of body.matchAll(VARIABLE_RE)) {
    const key = match[1];
    if (key && !KNOWN_KEYS.has(key.toLowerCase())) unknown.add(key);
  }
  return [...unknown];
}

/** WhatsApp click-to-chat URL. `phoneDigits` must already be normalized. */
export function buildWhatsAppUrl(phoneDigits: string, message: string): string {
  const digits = phoneDigits.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
