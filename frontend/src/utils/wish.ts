import type { MessageTemplate, Occasion, Category } from '@/types';

export const MAX_MESSAGE_LENGTH = 2000;

/** Active templates for a category + occasion, in display order. */
export function templatesFor(templates: MessageTemplate[], category: Category, occasion: Occasion): MessageTemplate[] {
  return templates
    .filter((t) => t.isActive && t.category === category && t.occasion === occasion)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export type MessageProblem = 'EMPTY' | 'TOO_LONG' | null;

export function messageProblem(message: string): MessageProblem {
  const trimmed = message.trim();
  if (!trimmed) return 'EMPTY';
  if (trimmed.length > MAX_MESSAGE_LENGTH) return 'TOO_LONG';
  return null;
}
