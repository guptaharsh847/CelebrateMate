/**
 * ContactService.gs — contact CRUD with soft deletion (isActive = false).
 */
const ContactService = (function () {
  function table_() {
    return SHEET_NAMES.CONTACTS;
  }

  /** Normalises a stored record (tolerates hand-edited sheet values). */
  function toContact(record) {
    const mobileDigits = Validation.normalizePhone(record.mobileNumber, '91');
    const waDigits = Validation.normalizePhone(record.whatsappNumber, '91');
    const mobile = mobileDigits ? '+' + mobileDigits : record.mobileNumber;
    return {
      contactId: record.contactId,
      fullName: record.fullName,
      mobileNumber: mobile,
      whatsappNumber: waDigits ? '+' + waDigits : mobile,
      birthday: DateUtils.isValid(record.birthday) ? record.birthday : null,
      anniversary: DateUtils.isValid(record.anniversary) ? record.anniversary : null,
      category: ENUMS.CATEGORIES.indexOf(record.category) !== -1 ? record.category : 'GENERAL',
      notes: record.notes || '',
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  function all() {
    return Database.list(table_()).map(toContact);
  }

  function activeContacts() {
    return all().filter(function (c) { return c.isActive; });
  }

  function matchesSearch_(contact, search) {
    const q = search.toLowerCase();
    if (!q) return true;
    const digits = q.replace(/\D/g, '');
    return (
      contact.fullName.toLowerCase().indexOf(q) !== -1 ||
      contact.notes.toLowerCase().indexOf(q) !== -1 ||
      (digits.length >= 3 && (contact.mobileNumber.indexOf(digits) !== -1 || contact.whatsappNumber.indexOf(digits) !== -1))
    );
  }

  function list(payload) {
    const q = Validation.contactQuery(payload);
    return all()
      .filter(function (c) { return q.status === 'ALL' || (q.status === 'ACTIVE' ? c.isActive : !c.isActive); })
      .filter(function (c) { return q.category === 'ALL' || c.category === q.category; })
      .filter(function (c) { return matchesSearch_(c, q.search); })
      .sort(function (a, b) { return a.fullName.localeCompare(b.fullName); });
  }

  function find_(contactId) {
    const record = Database.get(table_(), contactId);
    if (!record) throw new AppError('NOT_FOUND', 'Contact not found.');
    return record;
  }

  function get(payload) {
    return toContact(find_(Validation.requireId(payload, 'contactId')));
  }

  function assertNotDuplicate_(input, ignoreId) {
    const clash = all().filter(function (c) {
      return c.contactId !== ignoreId && c.isActive && c.mobileNumber === input.mobileNumber && c.fullName.toLowerCase() === input.fullName.toLowerCase();
    })[0];
    if (clash) throw new AppError('CONFLICT', clash.fullName + ' with this mobile number already exists.', { contactId: clash.contactId });
  }

  function create(payload) {
    const input = Validation.contactInput(payload, SettingsService.get().defaultCountryCode);
    assertNotDuplicate_(input);
    const now = Clock.now().toISOString();
    const record = Object.assign({}, input, {
      contactId: Database.newId('CON'),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return toContact(Database.insert(table_(), record));
  }

  function update(payload) {
    const contactId = Validation.requireId(payload, 'contactId');
    find_(contactId);
    const input = Validation.contactInput(payload, SettingsService.get().defaultCountryCode);
    assertNotDuplicate_(input, contactId);
    return toContact(Database.update(table_(), contactId, Object.assign({}, input, { updatedAt: Clock.now().toISOString() })));
  }

  function setActive(payload, isActive) {
    const contactId = Validation.requireId(payload, 'contactId');
    const existing = find_(contactId);
    if (existing.isActive === isActive) return toContact(existing);
    return toContact(Database.update(table_(), contactId, { isActive: isActive, updatedAt: Clock.now().toISOString() }));
  }

  return {
    toContact: toContact,
    all: all,
    activeContacts: activeContacts,
    list: list,
    get: get,
    create: create,
    update: update,
    deactivate: function (payload) { return setActive(payload, false); },
    reactivate: function (payload) { return setActive(payload, true); },
  };
})();
