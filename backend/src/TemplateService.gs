/**
 * TemplateService.gs — WhatsApp message templates (3 categories × 2 occasions).
 * Rule: each category + occasion must keep at least one active template.
 */
const TemplateService = (function () {
  function table_() {
    return SHEET_NAMES.TEMPLATES;
  }

  function sort_(a, b) {
    return a.category.localeCompare(b.category) || a.occasion.localeCompare(b.occasion) || a.sortOrder - b.sortOrder;
  }

  function list() {
    return Database.list(table_()).sort(sort_);
  }

  function find_(templateId) {
    const t = Database.get(table_(), templateId);
    if (!t) throw new AppError('NOT_FOUND', 'Template not found.');
    return t;
  }

  function create(payload) {
    const input = Validation.templateInput(payload);
    const siblings = list().filter(function (t) { return t.category === input.category && t.occasion === input.occasion; });
    const now = Clock.now().toISOString();
    return Database.insert(table_(), Object.assign({}, input, {
      templateId: Database.newId('TPL'),
      isActive: true,
      isDefault: false,
      sortOrder: siblings.reduce(function (max, t) { return Math.max(max, t.sortOrder); }, 0) + 1,
      createdAt: now,
      updatedAt: now,
    }));
  }

  function assertKeepsOneActive_(template, next) {
    const remaining = list().filter(function (t) {
      if (t.templateId === template.templateId) return false;
      return t.isActive && t.category === template.category && t.occasion === template.occasion;
    });
    if (remaining.length === 0) {
      throw new AppError('VALIDATION', 'Keep at least one active template for each category and occasion.');
    }
    return next;
  }

  function update(payload) {
    const templateId = Validation.requireId(payload, 'templateId');
    const existing = find_(templateId);
    const input = Validation.templateInput(payload);
    const movesGroup = input.category !== existing.category || input.occasion !== existing.occasion;
    if (movesGroup && existing.isActive) assertKeepsOneActive_(existing);
    return Database.update(table_(), templateId, Object.assign({}, input, { updatedAt: Clock.now().toISOString() }));
  }

  function setActive(payload) {
    const templateId = Validation.requireId(payload, 'templateId');
    const isActive = Validation.booleanField(payload, 'isActive');
    const existing = find_(templateId);
    if (existing.isActive === isActive) return existing;
    if (!isActive) assertKeepsOneActive_(existing);
    return Database.update(table_(), templateId, { isActive: isActive, updatedAt: Clock.now().toISOString() });
  }

  /** Inserts any of the 18 default templates that are missing (by ID). Never overwrites edits. */
  function seedDefaults() {
    const now = Clock.now().toISOString();
    let added = 0;
    DEFAULT_TEMPLATES.forEach(function (t) {
      if (!Database.get(table_(), t.templateId)) {
        Database.insert(table_(), Object.assign({}, t, { isActive: true, isDefault: true, createdAt: now, updatedAt: now }));
        added++;
      }
    });
    return added;
  }

  return { list: list, create: create, update: update, setActive: setActive, seedDefaults: seedDefaults, get: function (id) { return Database.get(table_(), id); } };
})();
