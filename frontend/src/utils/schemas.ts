import { z } from 'zod';
import { CATEGORIES, FEB29_POLICIES, OCCASIONS } from '@/types';
import { isValidISODate, todayInTimeZone } from './date';
import { normalizePhone } from './phone';

const optionalPastDate = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || isValidISODate(v), `Enter a valid ${label} date`)
    .refine((v) => v === '' || v <= todayInTimeZone(), `${label} date cannot be in the future`);

export function createContactSchema(defaultCountryCode: string) {
  return z
    .object({
      fullName: z
        .string()
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be at most 100 characters'),
      mobileNumber: z
        .string()
        .trim()
        .min(1, 'Mobile number is required')
        .refine((v) => normalizePhone(v, defaultCountryCode) !== null, 'Enter a valid phone number'),
      whatsappSameAsMobile: z.boolean(),
      whatsappNumber: z.string().trim(),
      birthday: optionalPastDate('Birthday'),
      anniversary: optionalPastDate('Anniversary'),
      category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Choose a category' }) }),
      notes: z.string().trim().max(1000, 'Notes must be at most 1000 characters'),
    })
    .superRefine((value, ctx) => {
      if (!value.whatsappSameAsMobile && normalizePhone(value.whatsappNumber, defaultCountryCode) === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['whatsappNumber'],
          message: 'Enter a valid WhatsApp number',
        });
      }
    });
}

export type ContactFormValues = z.infer<ReturnType<typeof createContactSchema>>;

export const templateSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name must be at most 60 characters'),
  category: z.enum(CATEGORIES),
  occasion: z.enum(OCCASIONS),
  body: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(1000, 'Message must be at most 1000 characters'),
});

export type TemplateFormValues = z.infer<typeof templateSchema>;

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm (24-hour)');

export const settingsSchema = z.object({
  sameDayReminderTime: timeOfDay,
  nextDayReminderTime: timeOfDay,
  birthdayRemindersEnabled: z.boolean(),
  anniversaryRemindersEnabled: z.boolean(),
  feb29Policy: z.enum(FEB29_POLICIES),
  defaultCountryCode: z.string().trim().regex(/^\d{1,3}$/, 'Use 1–3 digits, e.g. 91'),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
