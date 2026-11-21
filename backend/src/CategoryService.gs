/**
 * CategoryService.gs — the fixed contact categories (DEVOTEE, GENERAL, HELP_DONOR).
 * Labels and descriptions can be edited in the Categories sheet; IDs are fixed.
 */
const CategoryService = {
  list: function () {
    return Database.list(SHEET_NAMES.CATEGORIES)
      .filter(function (c) { return ENUMS.CATEGORIES.indexOf(c.categoryId) !== -1; })
      .sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  },

  seedDefaults: function () {
    let added = 0;
    DEFAULT_CATEGORIES.forEach(function (c) {
      if (!Database.get(SHEET_NAMES.CATEGORIES, c.categoryId)) {
        Database.insert(SHEET_NAMES.CATEGORIES, Object.assign({ isActive: true }, c));
        added++;
      }
    });
    return added;
  },
};
