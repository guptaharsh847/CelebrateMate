/**
 * Database.gs — typed table access over Google Sheets.
 *
 * - Row 1 holds headers; columns are matched by header name.
 * - All schema columns are formatted as plain text ('@') so Sheets never
 *   converts '1990-11-21' into a Date or '+9198…' into a number.
 * - Values starting with = + - @ are written with a leading apostrophe so they
 *   are stored as literal text (prevents formula injection).
 * - Reads are cached per execution; writes update the cache in place.
 * - Callers must hold the script lock for writes (Router does this).
 */
const Database = (function () {
  let spreadsheet_ = null;
  let tables_ = {};

  function spreadsheet() {
    if (spreadsheet_) return spreadsheet_;
    const id = getScriptProperty_(PROPS.SPREADSHEET_ID);
    spreadsheet_ = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet_) {
      throw new AppError(
        'NOT_CONFIGURED',
        'Spreadsheet not found. Set the SPREADSHEET_ID Script Property or create the script from the spreadsheet (Extensions → Apps Script).',
      );
    }
    return spreadsheet_;
  }

  function schema_(table) {
    const s = SCHEMA[table];
    if (!s) throw new Error('Unknown table: ' + table);
    return s;
  }

  function isDate_(value) {
    return Object.prototype.toString.call(value) === '[object Date]';
  }

  function serialize_(type, value) {
    if (value === null || value === undefined) return '';
    if (type === 'bool') return value ? 'TRUE' : 'FALSE';
    if (type === 'int') return String(Math.trunc(Number(value)) || 0);
    const s = String(value);
    return /^[=+\-@]/.test(s) ? "'" + s : s;
  }

  function deserialize_(type, raw) {
    if (isDate_(raw)) {
      if (type === 'datetime') return raw.toISOString();
      raw = Utilities.formatDate(raw, APP.TIMEZONE, 'yyyy-MM-dd');
    }
    if (type === 'bool') return raw === true || String(raw).trim().toUpperCase() === 'TRUE';
    if (type === 'int') {
      const n = Number(raw);
      return isFinite(n) ? Math.trunc(n) : 0;
    }
    const s = raw === null || raw === undefined ? '' : String(raw);
    if (type === 'date') return s.trim() ? s.trim() : null;
    return s;
  }

  /** Creates the sheet if needed and makes sure all schema headers exist. Idempotent. */
  function ensureTable(table) {
    const ss = spreadsheet();
    const columns = Object.keys(schema_(table).columns);
    let sheet = ss.getSheetByName(table);
    const created = !sheet;
    if (!sheet) sheet = ss.insertSheet(table);

    const lastCol = sheet.getLastColumn();
    const existing = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
    const hasHeaders = existing.some(function (h) { return h !== ''; });
    let added;

    if (!hasHeaders) {
      sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
      added = columns.slice();
    } else {
      added = columns.filter(function (c) { return existing.indexOf(c) === -1; });
      if (added.length) sheet.getRange(1, lastCol + 1, 1, added.length).setValues([added]);
    }

    const width = Math.max(sheet.getLastColumn(), columns.length);
    sheet.getRange(1, 1, sheet.getMaxRows(), width).setNumberFormat('@');
    sheet.getRange(1, 1, 1, width).setFontWeight('bold');
    sheet.setFrozenRows(1);
    delete tables_[table];
    return { sheet: table, created: created, addedColumns: hasHeaders ? added : [] };
  }

  function initialize() {
    return Object.keys(SCHEMA).map(ensureTable);
  }

  function load_(table) {
    if (tables_[table]) return tables_[table];
    const s = schema_(table);
    const sheet = spreadsheet().getSheetByName(table);
    if (!sheet) throw new AppError('NOT_CONFIGURED', 'Sheet "' + table + '" is missing. Run setup() in the Apps Script editor.');

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 1 || lastCol < 1) throw new AppError('NOT_CONFIGURED', 'Sheet "' + table + '" has no headers. Run setup().');

    const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = values[0].map(function (h) { return String(h).trim(); });
    const colIndex = {};
    Object.keys(s.columns).forEach(function (c) {
      const i = headers.indexOf(c);
      if (i === -1) throw new AppError('NOT_CONFIGURED', 'Column "' + c + '" is missing in sheet "' + table + '". Run setup().');
      colIndex[c] = i;
    });

    const records = [];
    const rowById = {};
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (row.every(function (v) { return v === '' || v === null; })) continue;
      const record = {};
      Object.keys(s.columns).forEach(function (c) {
        record[c] = deserialize_(s.columns[c], row[colIndex[c]]);
      });
      const id = record[s.key];
      if (!id) continue;
      if (rowById[id] !== undefined) {
        console.warn('Duplicate ' + s.key + ' "' + id + '" in ' + table + ' row ' + (r + 1) + ' ignored.');
        continue;
      }
      rowById[id] = r + 1;
      records.push(record);
    }

    tables_[table] = { sheet: sheet, schema: s, colIndex: colIndex, values: values, width: lastCol, records: records, rowById: rowById };
    return tables_[table];
  }

  function writeRow_(t, rowNumber, record) {
    const base = t.values[rowNumber - 1] ? t.values[rowNumber - 1].slice() : [];
    while (base.length < t.width) base.push('');
    Object.keys(t.schema.columns).forEach(function (c) {
      base[t.colIndex[c]] = serialize_(t.schema.columns[c], record[c]);
    });
    const maxRows = t.sheet.getMaxRows();
    if (rowNumber > maxRows) t.sheet.insertRowsAfter(maxRows, Math.max(100, rowNumber - maxRows));
    t.sheet.getRange(rowNumber, 1, 1, t.width).setNumberFormat('@').setValues([base]);
    // Cache the logical (unescaped) values.
    const logical = base.map(function (v) { return typeof v === 'string' && v.charAt(0) === "'" ? v.slice(1) : v; });
    t.values[rowNumber - 1] = logical;
  }

  function copy_(record) {
    return record ? JSON.parse(JSON.stringify(record)) : null;
  }

  function list(table) {
    return load_(table).records.map(copy_);
  }

  function get(table, id) {
    const t = load_(table);
    const row = t.rowById[id];
    if (row === undefined) return null;
    return copy_(t.records.filter(function (r) { return r[t.schema.key] === id; })[0]);
  }

  function insert(table, record) {
    const t = load_(table);
    const id = record[t.schema.key];
    if (!id) throw new Error('Missing key ' + t.schema.key + ' for ' + table);
    if (t.rowById[id] !== undefined) throw new AppError('CONFLICT', 'A record with this ID already exists.');
    const rowNumber = t.values.length + 1;
    writeRow_(t, rowNumber, record);
    t.rowById[id] = rowNumber;
    t.records.push(copy_(record));
    return copy_(record);
  }

  function update(table, id, patch) {
    const t = load_(table);
    const rowNumber = t.rowById[id];
    if (rowNumber === undefined) throw new AppError('NOT_FOUND', 'Record not found.');
    const index = t.records.findIndex(function (r) { return r[t.schema.key] === id; });
    const merged = Object.assign({}, t.records[index], patch);
    merged[t.schema.key] = id;
    writeRow_(t, rowNumber, merged);
    t.records[index] = copy_(merged);
    return copy_(merged);
  }

  function newId(prefix) {
    return prefix + '_' + Utilities.getUuid().replace(/-/g, '').toUpperCase().slice(0, 20);
  }

  function clearCache() {
    tables_ = {};
    spreadsheet_ = null;
  }

  return {
    spreadsheet: spreadsheet,
    ensureTable: ensureTable,
    initialize: initialize,
    list: list,
    get: get,
    insert: insert,
    update: update,
    newId: newId,
    clearCache: clearCache,
  };
})();
