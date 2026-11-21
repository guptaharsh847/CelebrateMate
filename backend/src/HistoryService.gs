/**
 * HistoryService.gs — WhatsApp wish history.
 *
 * Status meanings (kept deliberately separate):
 *   OPENED      — the user opened a wa.me chat with the prepared message.
 *                 This does NOT mean the message was sent.
 *   MARKED_SENT — the user manually confirmed they sent it.
 * The app never verifies WhatsApp delivery.
 */
const HistoryService = (function () {
  function table_() {
    return SHEET_NAMES.HISTORY;
  }

  function list(payload) {
    const q = Validation.historyQuery(payload);
    return Database.list(table_())
      .filter(function (h) { return !q.contactId || h.contactId === q.contactId; })
      .sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); })
      .slice(0, q.limit);
  }

  function logOpened(payload) {
    const input = Validation.historyOpenedInput(payload);
    const contactRecord = Database.get(SHEET_NAMES.CONTACTS, input.contactId);
    if (!contactRecord) throw new AppError('NOT_FOUND', 'Contact not found.');
    const contact = ContactService.toContact(contactRecord);
    const hasDate = input.occasion === 'BIRTHDAY' ? contact.birthday : contact.anniversary;
    if (!hasDate) throw new AppError('VALIDATION', 'Some fields are invalid.', { occasion: 'This contact has no ' + input.occasion.toLowerCase() + ' date' });

    let templateName = '';
    if (input.templateId) {
      const template = TemplateService.get(input.templateId);
      if (!template) throw new AppError('NOT_FOUND', 'Template not found.');
      templateName = template.name;
    }

    const now = Clock.now().toISOString();
    return Database.insert(table_(), {
      historyId: Database.newId('HIS'),
      contactId: contact.contactId,
      contactName: contact.fullName,
      category: contact.category,
      occasion: input.occasion,
      eventDate: input.eventDate,
      templateId: input.templateId,
      templateName: templateName,
      finalMessage: input.finalMessage,
      whatsappNumber: contact.whatsappNumber,
      status: 'OPENED',
      openedAt: now,
      markedSentAt: '',
      createdAt: now,
      updatedAt: now,
    });
  }

  function markSent(payload) {
    const historyId = Validation.requireId(payload, 'historyId');
    const existing = Database.get(table_(), historyId);
    if (!existing) throw new AppError('NOT_FOUND', 'History entry not found.');
    if (existing.status === 'MARKED_SENT') return existing;
    const now = Clock.now().toISOString();
    return Database.update(table_(), historyId, { status: 'MARKED_SENT', markedSentAt: now, updatedAt: now });
  }

  return { list: list, logOpened: logOpened, markSent: markSent };
})();
