/**
 * DeviceService.gs — OneSignal push subscriptions registered by the PWA.
 * Upserts by subscriptionId so re-registering the same device never duplicates it.
 */
const DeviceService = (function () {
  function table_() {
    return SHEET_NAMES.DEVICES;
  }

  function list() {
    return Database.list(table_()).sort(function (a, b) { return b.lastSeenAt.localeCompare(a.lastSeenAt); });
  }

  function register(payload) {
    const input = Validation.deviceInput(payload);
    const now = Clock.now().toISOString();
    const existing = Database.list(table_()).filter(function (d) { return d.subscriptionId === input.subscriptionId; })[0];
    if (existing) {
      return Database.update(table_(), existing.deviceId, {
        platform: input.platform,
        label: input.label || existing.label,
        userAgent: input.userAgent || existing.userAgent,
        isActive: true,
        updatedAt: now,
        lastSeenAt: now,
      });
    }
    return Database.insert(table_(), {
      deviceId: Database.newId('DEV'),
      subscriptionId: input.subscriptionId,
      platform: input.platform,
      label: input.label,
      userAgent: input.userAgent,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    });
  }

  function deactivate(payload) {
    const deviceId = Validation.requireId(payload, 'deviceId');
    if (!Database.get(table_(), deviceId)) throw new AppError('NOT_FOUND', 'Device not found.');
    return Database.update(table_(), deviceId, { isActive: false, updatedAt: Clock.now().toISOString() });
  }

  function activeDevices() {
    return Database.list(table_()).filter(function (d) { return d.isActive && d.subscriptionId; });
  }

  /** Called when OneSignal reports subscriptions as invalid/unsubscribed. */
  function deactivateBySubscriptionIds(subscriptionIds) {
    if (!subscriptionIds || !subscriptionIds.length) return 0;
    const now = Clock.now().toISOString();
    let count = 0;
    Database.list(table_()).forEach(function (d) {
      if (d.isActive && subscriptionIds.indexOf(d.subscriptionId) !== -1) {
        Database.update(table_(), d.deviceId, { isActive: false, updatedAt: now });
        count++;
      }
    });
    return count;
  }

  return { list: list, register: register, deactivate: deactivate, activeDevices: activeDevices, deactivateBySubscriptionIds: deactivateBySubscriptionIds };
})();
