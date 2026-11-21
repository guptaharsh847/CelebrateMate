import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackend } from './harness.js';

const b = createBackend();
const call = (expr) => b.run(expr);

test('parse / isValid reject impossible dates', () => {
  assert.deepEqual(call("DateUtils.parse('1990-11-20')"), { year: 1990, month: 11, day: 20 });
  for (const bad of ['1990-13-01', '1990-02-30', '2023-02-29', '1990-2-3', '', 'abc']) {
    assert.equal(call(`DateUtils.isValid('${bad}')`), false, bad);
  }
  assert.equal(call("DateUtils.isValid('2024-02-29')"), true);
  assert.equal(call('DateUtils.isValid(null)'), false);
});

test('addDays / diffInDays cross month and year boundaries', () => {
  assert.equal(call("DateUtils.addDays('2026-12-31', 1)"), '2027-01-01');
  assert.equal(call("DateUtils.addDays('2024-02-28', 1)"), '2024-02-29');
  assert.equal(call("DateUtils.addDays('2026-03-01', -1)"), '2026-02-28');
  assert.equal(call("DateUtils.diffInDays('2026-12-30', '2027-01-02')"), 3);
});

test('today is computed in Asia/Kolkata regardless of server timezone', () => {
  // 19:00 UTC = 00:30 IST next day
  assert.equal(call("DateUtils.today(new Date('2026-11-20T19:00:00Z'))"), '2026-11-21');
  assert.equal(call("DateUtils.today(new Date('2026-11-20T18:29:00Z'))"), '2026-11-20');
  assert.deepEqual(call("DateUtils.nowParts(new Date('2026-11-20T04:35:00Z'))"), { date: '2026-11-20', minutes: 10 * 60 + 5 });
});

test('February 29 policy', () => {
  assert.equal(call("DateUtils.nextOccurrence('2000-02-29', '2027-01-10', 'FEB_28')"), '2027-02-28');
  assert.equal(call("DateUtils.nextOccurrence('2000-02-29', '2027-01-10', 'MAR_1')"), '2027-03-01');
  assert.equal(call("DateUtils.nextOccurrence('2000-02-29', '2027-03-01', 'MAR_1')"), '2027-03-01');
  assert.equal(call("DateUtils.nextOccurrence('2000-02-29', '2027-03-02', 'FEB_28')"), '2028-02-29');
  assert.equal(call("DateUtils.nextOccurrence('2000-02-29', '2028-01-01', 'MAR_1')"), '2028-02-29');
});

test('nextOccurrence is inclusive and rolls over the year', () => {
  assert.equal(call("DateUtils.nextOccurrence('1990-11-20', '2026-11-20', 'FEB_28')"), '2026-11-20');
  assert.equal(call("DateUtils.nextOccurrence('1990-11-19', '2026-11-20', 'FEB_28')"), '2027-11-19');
  assert.equal(call("DateUtils.nextOccurrence('1985-01-01', '2026-12-31', 'FEB_28')"), '2027-01-01');
  assert.equal(call("DateUtils.nextOccurrence('', '2026-11-20', 'FEB_28')"), null);
});

test('yearsAtOccurrence preserves the original year', () => {
  assert.equal(call("DateUtils.yearsAtOccurrence('1996-11-21', '2026-11-21')"), 30);
  assert.equal(call("DateUtils.yearsAtOccurrence('2026-05-01', '2026-05-01')"), null);
});

test('time helpers and formatting', () => {
  assert.equal(call("DateUtils.timeToMinutes('22:00')"), 1320);
  assert.equal(call("DateUtils.timeToMinutes('24:00')"), null);
  assert.equal(call("DateUtils.isValidTime('9:00')"), false);
  assert.equal(call("DateUtils.formatDayMonth('2026-11-21')"), '21 November');
  assert.deepEqual(call('[1,2,3,4,11,12,13,21,22,111].map(DateUtils.ordinal)'), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '111th']);
});

test('phone normalisation matches the frontend rules', () => {
  const cases = {
    '98765 43210': '919876543210',
    '098765-43210': '919876543210',
    '+44 7700 900123': '447700900123',
    '0044 7700 900123': '447700900123',
    '919876543210': '919876543210',
    '12345': null,
    'call me': null,
    '+1234567890123456': null,
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(call(`Validation.normalizePhone(${JSON.stringify(input)}, '91')`), expected, input);
  }
});
