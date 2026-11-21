/**
 * Phone normalization for WhatsApp click-to-chat (wa.me requires the full
 * international number, digits only, no "+", no leading zeros).
 *
 * Rules:
 *  - "+<digits>" or "00<digits>" → already international.
 *  - Otherwise strip trunk zeros; a 10-digit national number gets the default
 *    country code; 11–15 digits are assumed to already include a country code.
 *  - Result must be 8–15 digits (E.164 maximum) and must not start with 0.
 */
export function normalizePhone(raw: string | null | undefined, defaultCountryCode = '91'): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Reject letters and other unexpected characters outright.
  if (/[^\d+\s().-]/.test(trimmed)) return null;

  let international = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  if (!international && digits.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }

  if (!international) {
    digits = digits.replace(/^0+/, '');
    const cc = defaultCountryCode.replace(/\D/g, '');
    if (digits.length === 10) {
      digits = cc + digits;
    } else if (digits.length < 10) {
      return null;
    }
  }

  if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null;
  return digits;
}

/** Normalized value for storage: "+<digits>", or null if invalid. */
export function toStoredPhone(raw: string | null | undefined, defaultCountryCode = '91'): string | null {
  const digits = normalizePhone(raw, defaultCountryCode);
  return digits ? `+${digits}` : null;
}

/** Human-friendly rendering. Indian numbers are grouped as +91 98765 43210. */
export function formatPhone(stored: string | null | undefined): string {
  if (!stored) return '—';
  const digits = stored.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return `+${digits}`;
}
