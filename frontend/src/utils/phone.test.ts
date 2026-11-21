import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone, toStoredPhone } from './phone';

describe('normalizePhone', () => {
  it('adds the default country code to 10-digit national numbers', () => {
    expect(normalizePhone('98765 43210')).toBe('919876543210');
    expect(normalizePhone('098765-43210')).toBe('919876543210');
  });

  it('keeps international numbers as entered', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210');
    expect(normalizePhone('+44 7700 900123')).toBe('447700900123');
    expect(normalizePhone('0044 7700 900123')).toBe('447700900123');
    expect(normalizePhone('(+1) 415-555-0100')).toBe('14155550100');
  });

  it('accepts numbers that already include a country code without +', () => {
    expect(normalizePhone('919876543210')).toBe('919876543210');
  });

  it('uses a configurable default country code', () => {
    expect(normalizePhone('4155550100', '1')).toBe('14155550100');
  });

  it('rejects invalid input', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('call me')).toBeNull();
    expect(normalizePhone('+1234567890123456')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe('toStoredPhone / formatPhone', () => {
  it('stores with a leading +', () => {
    expect(toStoredPhone('98765 43210')).toBe('+919876543210');
    expect(toStoredPhone('nope')).toBeNull();
  });

  it('formats Indian numbers nicely', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
    expect(formatPhone('+447700900123')).toBe('+447700900123');
    expect(formatPhone('')).toBe('—');
  });
});
