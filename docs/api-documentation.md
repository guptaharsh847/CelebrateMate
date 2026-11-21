# API Documentation

The backend is a Google Apps Script web app with a single endpoint (the deployment's `/exec` URL).

## Transport

```http
POST https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
Content-Type: text/plain;charset=utf-8

{"action":"contacts.list","payload":{"search":"priya"},"idToken":"<Google ID token>","requestId":"optional-id"}
```

- Send the JSON body as **`text/plain`**. That makes it a CORS "simple request" with no preflight, which Apps Script can't answer. Apps Script replies with `Access-Control-Allow-Origin: *` after its redirect, so `fetch` can read the response normally. Never use `mode: 'no-cors'`.
- Apps Script cannot read request headers, so the ID token travels in the body.
- `GET /exec` returns a health check only. No data is ever served over GET.
- The HTTP status is always 200. Check `ok` in the body.

### Response envelope

```json
{ "ok": true, "data": { }, "meta": { "requestId": "…", "serverTime": "2026-11-20T04:30:00.000Z", "version": "1.0.0" } }
{ "ok": false, "error": { "code": "VALIDATION", "message": "Some fields are invalid.", "details": { "mobileNumber": "Enter a valid phone number" } }, "meta": { } }
```

| Error code | Meaning |
|-----------|---------|
| BAD_REQUEST | Malformed JSON or payload shape |
| VALIDATION | Field errors in `details` |
| UNAUTHORIZED | Missing, invalid or expired token, wrong audience or issuer, unverified email |
| FORBIDDEN | Email not in `ALLOWED_EMAILS` |
| NOT_FOUND | Unknown action or record |
| CONFLICT | Duplicate (e.g. same name and mobile) |
| BUSY | Could not obtain the write lock; retry |
| NOT_CONFIGURED | Missing Script Property or sheet; run `setup()` |
| UPSTREAM_ERROR | Google tokeninfo or OneSignal failed |
| INTERNAL | Unexpected error; the message contains the requestId only |

## Authentication

Every action except `system.ping` requires `idToken`: a Google Identity Services ID token. The server verifies it via `https://oauth2.googleapis.com/tokeninfo` and requires:

- `aud` == `GOOGLE_CLIENT_ID`
- `iss` ∈ {`accounts.google.com`, `https://accounts.google.com`}
- `exp` in the future
- `email_verified` true
- `email` ∈ `ALLOWED_EMAILS`

Verified identities are cached for up to 5 minutes, keyed by the token's SHA-256 hash. The allowlist is re-checked on every request. If `GOOGLE_CLIENT_ID` or `ALLOWED_EMAILS` is not set, every request fails with `NOT_CONFIGURED`.

## Actions

✏️ marks write actions, which run under the script lock.

### System

| Action | Payload | Returns |
|--------|---------|---------|
| `system.ping` (no auth) | — | `{ status, name, version }` |
| `auth.me` | — | `{ email }` |

### Dashboard and celebrations

A `Celebration` is `{ key, contact: Contact, occasion, originalDate, eventDate, daysUntil, years }`. `key` = `eventDate|contactId|occasion`; `years` may be null.

| Action | Payload | Returns |
|--------|---------|---------|
| `dashboard.get` | — | `{ today, timezone, totals: { activeContacts, todayBirthdays, todayAnniversaries, tomorrow, next7Days, next30Days }, todayCelebrations[], tomorrowCelebrations[], upcoming30[] (days 2–30), categoryStats[] }` |
| `celebrations.today` | — | `{ date, celebrations[] }` |
| `celebrations.tomorrow` | — | `{ date, celebrations[] }` |
| `celebrations.upcoming` | `{ days?: 0–366 (default 30), categories?: Category[], occasions?: Occasion[] }` | `{ from, to, celebrations[] }` |
| `celebrations.month` | `{ year?: 1900–2200, month?: 1–12, categories?, occasions? }` | `{ year, month, celebrations[] }` |

"Today" is always computed in Asia/Kolkata. Inactive contacts and missing dates are excluded. The 29 February rule follows the `feb29Policy` setting.

### Contacts

`Contact` = `{ contactId, fullName, mobileNumber, whatsappNumber, birthday|null, anniversary|null, category, notes, isActive, createdAt, updatedAt }`

`ContactInput` = `{ fullName, mobileNumber, whatsappNumber?, birthday?, anniversary?, category, notes? }`. Phones are normalised using `defaultCountryCode`. Empty strings mean "no date".

| Action | Payload | Returns |
|--------|---------|---------|
| `contacts.list` / `contacts.search` | `{ search?, category?: Category\|'ALL', status?: 'ACTIVE'\|'INACTIVE'\|'ALL' }` | `Contact[]` sorted by name. Search matches name, notes or phone digits (3+). |
| `contacts.get` | `{ contactId }` | `Contact` |
| ✏️ `contacts.create` | `{ contact: ContactInput }` | `Contact` |
| ✏️ `contacts.update` | `{ contactId, contact: ContactInput }` | `Contact` |
| ✏️ `contacts.deactivate` | `{ contactId }` | `Contact` (soft delete) |
| ✏️ `contacts.reactivate` | `{ contactId }` | `Contact` |

### Categories and templates

| Action | Payload | Returns |
|--------|---------|---------|
| `categories.list` | — | `{ categoryId, label, description, sortOrder, isActive }[]` |
| `templates.list` | — | `Template[]` (active and inactive) |
| ✏️ `templates.create` | `{ template: { name, body, category, occasion } }` | `Template` |
| ✏️ `templates.update` | `{ templateId, template: { … } }` | `Template` |
| ✏️ `templates.setActive` | `{ templateId, isActive: boolean }` | `Template`. `VALIDATION` if it would leave a category and occasion with no active template. |

### Settings

| Action | Payload | Returns |
|--------|---------|---------|
| `settings.get` | — | `{ timezone, sameDayReminderTime, nextDayReminderTime, birthdayRemindersEnabled, anniversaryRemindersEnabled, feb29Policy, defaultCountryCode }` |
| ✏️ `settings.update` | `{ settings: Partial<…> }` | Updated settings. Unknown keys are rejected; timezone is fixed. |

### History (WhatsApp)

| Action | Payload | Returns |
|--------|---------|---------|
| `history.list` | `{ contactId?, limit?: 1–500 }` | Newest first |
| ✏️ `history.logOpened` | `{ entry: { contactId, occasion, eventDate, templateId?, finalMessage } }` | Entry with `status: 'OPENED'` |
| ✏️ `history.markSent` | `{ historyId }` | Entry with `status: 'MARKED_SENT'`, `markedSentAt`. Idempotent. |

`OPENED` only means a wa.me chat was opened. The app never verifies WhatsApp delivery.

### Devices and notifications

| Action | Payload | Returns |
|--------|---------|---------|
| `devices.list` | — | `Device[]` |
| ✏️ `devices.register` | `{ device: { subscriptionId, platform?, label?, userAgent? } }` | `Device` (upsert by subscriptionId) |
| ✏️ `devices.deactivate` | `{ deviceId }` | `Device` |
| ✏️ `notifications.test` | `{ deviceId? }` | `{ oneSignalId, recipients, note }`. Means accepted by OneSignal, not delivered. |
| `notifications.logs` | `{ limit? }` | Latest NotificationLogs rows |
| `notifications.status` | — | `{ oneSignalConfigured, scheduler: { installed, everyMinutes, … } }` |

## Scheduled reminders (not HTTP)

A time-driven trigger runs `dispatchReminders()` every 15 minutes. In Asia/Kolkata:

- **SAME_DAY:** between `sameDayReminderTime` and +180 minutes, it sends today's pending celebrations.
- **NEXT_DAY:** between `nextDayReminderTime` and +180 minutes (capped at 23:59), it sends tomorrow's.

Each run sends at most one aggregated notification per type. Per-key logs prevent duplicates. Failures retry on later runs inside the window, up to 3 attempts. Apps Script trigger timing is approximate, so expect delivery within about 15 minutes of the configured time. Push delivery is never guaranteed.

## Example (curl)

```bash
curl -L -H "Content-Type: text/plain" \
  -d '{"action":"system.ping"}' \
  "https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec"
```
