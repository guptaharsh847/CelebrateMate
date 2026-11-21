// Local test harness: runs the real Apps Script sources (backend/src/*.gs) in a
// Node VM with in-memory fakes of the Google services they use.
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

export const CLIENT_ID = 'test-client.apps.googleusercontent.com';
export const OWNER = 'owner@example.com';
export const VALID_TOKEN = 'header.validpayload.signature';
export const STRANGER_TOKEN = 'header.strangerpayload.signature';

// ── Spreadsheet fakes ────────────────────────────────────────────────────
class FakeRange {
  constructor(sheet, row, col, numRows, numCols) {
    Object.assign(this, { sheet, row, col, numRows, numCols });
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const line = [];
      for (let c = 0; c < this.numCols; c++) line.push(this.sheet.cell(this.row + r, this.col + c));
      out.push(line);
    }
    return out;
  }
  setValues(values) {
    if (values.length !== this.numRows || values.some((l) => l.length !== this.numCols)) throw new Error('setValues: dimension mismatch');
    values.forEach((line, r) =>
      line.forEach((v, c) => {
        let stored = v;
        if (typeof v === 'string' && v.startsWith("'")) stored = v.slice(1); // literal text
        else if (typeof v === 'string' && v.startsWith('=')) stored = '#FORMULA_EVALUATED'; // what Sheets would do
        this.sheet.setCell(this.row + r, this.col + c, stored);
      }),
    );
    return this;
  }
  setNumberFormat() {
    return this;
  }
  setFontWeight() {
    return this;
  }
}

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.rows = [];
    this.maxRows = 1000;
    this.frozen = 0;
  }
  cell(r, c) {
    const v = this.rows[r - 1]?.[c - 1];
    return v === undefined || v === null ? '' : v;
  }
  setCell(r, c, v) {
    if (!this.rows[r - 1]) this.rows[r - 1] = [];
    this.rows[r - 1][c - 1] = v;
  }
  getName() {
    return this.name;
  }
  getLastRow() {
    for (let r = this.rows.length; r >= 1; r--) if ((this.rows[r - 1] || []).some((v) => v !== '' && v !== undefined)) return r;
    return 0;
  }
  getLastColumn() {
    let max = 0;
    this.rows.forEach((row) => row && row.forEach((v, i) => { if (v !== '' && v !== undefined) max = Math.max(max, i + 1); }));
    return max;
  }
  getMaxRows() {
    return this.maxRows;
  }
  insertRowsAfter(_after, n) {
    this.maxRows += n;
  }
  getRange(row, col, numRows = 1, numCols = 1) {
    if (row < 1 || col < 1 || row + numRows - 1 > this.maxRows) throw new Error(`Range out of bounds: row ${row}+${numRows} > ${this.maxRows}`);
    return new FakeRange(this, row, col, numRows, numCols);
  }
  setFrozenRows(n) {
    this.frozen = n;
  }
  /** Test helper: rows as objects keyed by header. */
  objects() {
    const [header = [], ...rest] = this.rows;
    return rest.filter(Boolean).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
  }
  headers() {
    return (this.rows[0] || []).filter((h) => h !== '');
  }
}

class FakeSpreadsheet {
  constructor() {
    this.sheets = new Map();
  }
  getSheetByName(name) {
    return this.sheets.get(name) || null;
  }
  insertSheet(name) {
    const s = new FakeSheet(name);
    this.sheets.set(name, s);
    return s;
  }
}

// ── Utilities.formatDate with Java-style tokens we use ──────────────────
function formatDate(date, timeZone, pattern) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return pattern.replace('yyyy', parts.year).replace('MM', parts.month).replace('dd', parts.day).replace('HH', parts.hour).replace('mm', parts.minute);
}

export function createBackend(options = {}) {
  const ss = new FakeSpreadsheet();
  const props = { GOOGLE_CLIENT_ID: CLIENT_ID, ALLOWED_EMAILS: OWNER, ...(options.props || {}) };
  const cache = new Map();
  const triggers = [];
  const fetchCalls = [];
  let nowMs = Date.parse(options.now || '2026-11-20T04:30:00Z'); // 10:00 IST
  let oneSignalHandler = options.oneSignal || (() => ({ status: 200, body: { id: `notif-${fetchCalls.length}` } }));

  const tokenPayloads = {
    [VALID_TOKEN]: () => ({ aud: CLIENT_ID, iss: 'https://accounts.google.com', exp: String(Math.floor(nowMs / 1000) + 3600), email: OWNER, email_verified: 'true' }),
    [STRANGER_TOKEN]: () => ({ aud: CLIENT_ID, iss: 'accounts.google.com', exp: String(Math.floor(nowMs / 1000) + 3600), email: 'stranger@example.com', email_verified: 'true' }),
    ...(options.tokens || {}),
  };

  const response = (status, body) => ({ getResponseCode: () => status, getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)) });

  const context = vm.createContext({
    console: options.verbose ? console : { log() {}, warn() {}, error() {}, info() {} },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      openById: (id) => {
        if (id !== props.SPREADSHEET_ID) throw new Error('Spreadsheet not found');
        return ss;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = v; },
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => cache.set(k, v),
        remove: (k) => cache.delete(k),
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: {
      formatDate,
      getUuid: () => randomUUID(),
      computeDigest: (_alg, value) => Array.from(createHash('sha256').update(String(value), 'utf8').digest(), (b) => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
    },
    UrlFetchApp: {
      fetch: (url, opts = {}) => {
        fetchCalls.push({ url, opts, body: opts.payload ? JSON.parse(opts.payload) : null });
        if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
          const token = decodeURIComponent(url.split('id_token=')[1]);
          const payload = tokenPayloads[token];
          return payload ? response(200, payload()) : response(400, { error: 'invalid_token' });
        }
        if (url.startsWith('https://api.onesignal.com/')) {
          const r = oneSignalHandler(JSON.parse(opts.payload), opts);
          if (r instanceof Error) throw r;
          return response(r.status, r.body);
        }
        throw new Error('Unexpected fetch: ' + url);
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (content) => ({ content, setMimeType() { return this; }, getContent() { return content; } }),
    },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: (t) => triggers.splice(triggers.indexOf(t), 1),
      newTrigger: (handler) => {
        const spec = { handler };
        const builder = {
          timeBased: () => builder,
          everyMinutes: (n) => { spec.everyMinutes = n; return builder; },
          create: () => { const t = { getHandlerFunction: () => handler, spec }; triggers.push(t); return t; },
        };
        return builder;
      },
    },
  });

  // Reverse alphabetical load order proves files don't depend on each other at load time.
  const files = readdirSync(SRC).filter((f) => f.endsWith('.gs')).sort().reverse();
  for (const file of files) vm.runInContext(readFileSync(join(SRC, file), 'utf8'), context, { filename: file });

  const run = (code) => vm.runInContext(code, context);
  const plain = (v) => {
    const json = JSON.stringify(v);
    return json === undefined ? undefined : JSON.parse(json);
  };
  context.__nowMs = nowMs;
  run('Clock.now = function () { return new Date(__nowMs); };');

  return {
    ss,
    props,
    cache,
    triggers,
    fetchCalls,
    context,
    run: (code) => plain(run(code)),
    setNow(iso) {
      nowMs = Date.parse(iso);
      context.__nowMs = nowMs;
    },
    setOneSignal(handler) {
      oneSignalHandler = handler;
    },
    setup() {
      return plain(run('setup()'));
    },
    /** Calls the API exactly as the web app would (through doPost and JSON). */
    api(action, payload, { token = VALID_TOKEN, raw } = {}) {
      context.__body = raw !== undefined ? raw : JSON.stringify({ action, payload, idToken: token });
      return JSON.parse(run('doPost({ postData: { contents: __body } }).getContent()'));
    },
    oneSignalCalls() {
      return fetchCalls.filter((c) => c.url.startsWith('https://api.onesignal.com/'));
    },
  };
}

export function sampleContact(overrides = {}) {
  return {
    fullName: 'Priya Sharma',
    mobileNumber: '98765 43210',
    category: 'GENERAL',
    birthday: '1996-11-20',
    anniversary: '',
    notes: '',
    ...overrides,
  };
}
