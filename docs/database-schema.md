# Database Schema (Google Sheets)

One spreadsheet, seven tabs. `setup()` creates and repairs them; it is idempotent and never overwrites existing rows.

## Conventions

| Rule | Detail |
|------|--------|
| Header row | Row 1, frozen and bold. Columns are found **by header name**, so you may reorder them or add your own extra columns (they are preserved). |
| Text format | Every schema column is formatted as plain text (`@`), so Sheets never turns `1990-11-21` into a date or `+9198…` into a number. |
| Dates | `YYYY-MM-DD`, keeping the original year. Annual matching uses month and day only. |
| Timestamps | ISO-8601 UTC, e.g. `2026-11-20T04:30:00.000Z`. |
| Booleans | `TRUE` / `FALSE`. |
| IDs | Prefix + 20 hex characters from a UUID: `CON_…`, `TPL_…`, `HIS_…`, `DEV_…`, `LOG_…`. Default templates use fixed IDs such as `TPL_GENERAL_BIRTHDAY_1`. |
| Formula safety | Values starting with `= + - @` are written as literal text. |
| Hand edits | Tolerated: a real Date cell or a numeric phone number is normalised when read. Duplicate ID rows are ignored (the first one wins) and a warning is logged. |
| Soft delete | Contacts are never deleted, only set to `isActive = FALSE`. |

## Contacts

| Column | Type | Notes |
|--------|------|-------|
| contactId | string | `CON_…`, stable |
| fullName | string | 2–100 characters, whitespace collapsed |
| mobileNumber | string | Normalised `+<country><number>` |
| whatsappNumber | string | Normalised; defaults to mobileNumber |
| birthday | date | Optional, not in the future (IST) |
| anniversary | date | Optional, not in the future (IST) |
| category | string | `DEVOTEE` \| `GENERAL` \| `HELP_DONOR` |
| notes | string | ≤ 1000 characters |
| isActive | bool | `FALSE` = soft deleted |
| createdAt, updatedAt | datetime | |

## Templates

| Column | Type | Notes |
|--------|------|-------|
| templateId | string | Defaults: `TPL_<CATEGORY>_<OCCASION>_<n>` |
| category | string | Category enum |
| occasion | string | `BIRTHDAY` \| `ANNIVERSARY` |
| name | string | 2–60 characters |
| body | string | 10–1000 characters. Variables: `{name}` `{first_name}` `{occasion}` `{date}` `{years}` `{years_ordinal}` |
| isActive | bool | At least one active template per category and occasion is enforced |
| isDefault | bool | `TRUE` for the 18 seeded templates |
| sortOrder | int | Order within its category and occasion |
| createdAt, updatedAt | datetime | |

Seeded with 18 templates (3 categories × 2 occasions × 3). The source of truth is `frontend/src/data/defaultTemplates.ts`, and `npm run sync:templates` regenerates `backend/src/DefaultData.gs` from it.

## NotificationLogs

There is one row per reminder key. Rows are updated in place on retries.

| Column | Type | Notes |
|--------|------|-------|
| logId | string | `LOG_…` |
| dedupeKey | string | `eventDate|contactId|occasion|reminderType`, or `TEST|<uuid>` |
| reminderType | string | `SAME_DAY` \| `NEXT_DAY` \| `TEST` |
| eventDate | date | Celebration date |
| contactId, contactName, occasion | string | Empty for TEST rows |
| status | string | `SENT` (accepted by OneSignal; delivery **not** guaranteed) \| `FAILED` \| `SKIPPED` |
| attempts | int | Up to 3 for FAILED |
| recipients | int | Device count targeted |
| oneSignalId | string | OneSignal notification ID |
| detail | string | Reason or error (≤ 500 characters) |
| createdAt, updatedAt | datetime | |

## Devices

| Column | Type | Notes |
|--------|------|-------|
| deviceId | string | `DEV_…` |
| subscriptionId | string | OneSignal subscription ID, unique (registration upserts on it) |
| platform | string | `ANDROID` \| `IOS` \| `DESKTOP` \| `OTHER` |
| label | string | ≤ 60 characters |
| userAgent | string | ≤ 300 characters |
| isActive | bool | Set to `FALSE` automatically when OneSignal reports the subscription invalid |
| createdAt, updatedAt, lastSeenAt | datetime | |

## Settings

Key/value rows (`key`, `value`, `updatedAt`).

| key | Default | Validation |
|-----|---------|-----------|
| timezone | `Asia/Kolkata` | Fixed |
| sameDayReminderTime | `10:00` | `HH:mm` |
| nextDayReminderTime | `22:00` | `HH:mm` |
| birthdayRemindersEnabled | `TRUE` | bool |
| anniversaryRemindersEnabled | `TRUE` | bool |
| feb29Policy | `FEB_28` | `FEB_28` \| `MAR_1` |
| defaultCountryCode | `91` | 1–3 digits |
| schemaVersion | `1` | Informational |

## History

| Column | Type | Notes |
|--------|------|-------|
| historyId | string | `HIS_…` |
| contactId, contactName, category | string | Snapshot at the time of the wish |
| occasion | string | |
| eventDate | date | |
| templateId, templateName | string | Optional |
| finalMessage | string | The edited message that was opened (≤ 2000 characters) |
| whatsappNumber | string | |
| status | string | `OPENED` (chat opened; **not** proof of sending) → `MARKED_SENT` (the user confirmed manually) |
| openedAt, markedSentAt | datetime | Recorded separately |
| createdAt, updatedAt | datetime | |

## Categories

| Column | Type | Notes |
|--------|------|-------|
| categoryId | string | `DEVOTEE`, `GENERAL`, `HELP_DONOR` (fixed) |
| label, description | string | Editable |
| sortOrder | int | |
| isActive | bool | |
