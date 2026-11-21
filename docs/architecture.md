# Architecture

> Living document. Sections marked _(planned)_ describe later phases and will be finalised when they are built.

## Overview

```
┌────────────────────────┐   HTTPS (JSON)   ┌──────────────────────┐        ┌────────────────┐
│ React PWA              │ ───────────────▶ │ API gateway (planned)│ ─────▶ │ Apps Script    │
│ GitHub Pages (static)  │ ◀─────────────── │ e.g. Cloudflare      │ ◀───── │ Web App + jobs │
└──────────┬─────────────┘                  │ Worker, if required  │        └───────┬────────┘
           │ OneSignal SDK v16 (planned)    └──────────────────────┘                │
           ▼                                                                         ▼
     OneSignal ◀──────────────── REST API (key in Script Properties) ──────── Google Sheets
```

- The **frontend** is a static SPA. It contains no secrets: only public configuration (`VITE_*`).
- The **backend** (Phase 2) is a Google Apps Script web app that reads and writes the spreadsheet, validates every request and runs time-driven triggers for reminders.
- **Secrets** (spreadsheet ID, OneSignal REST key, allowlist) live only in Apps Script Script Properties.

## Frontend layers

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Pages | `src/pages` | Route screens; compose components, own page state. |
| Components | `src/components` | `ui/` primitives (Button, Field, Modal, Toast…), `layout/` (AppShell, nav), feature components. |
| Hooks | `src/hooks` | `useQuery` in-memory cache with prefix invalidation; data hooks (`useContacts`, `useTemplates`, `useSettings`); `useToday` (IST). |
| Services | `src/services` | `DataService` interface. `apiDataService` (real backend) and `mock/` (development only). |
| Utils | `src/utils` | Pure logic: dates, celebrations, phone, messages, Zod schemas. Fully unit-tested. |
| Types | `src/types` | Domain model shared across layers. |

### Data source selection

`services/index.ts` lazily resolves the implementation:

- `import.meta.env.DEV && VITE_DATA_MODE === 'mock'` → mock service (dynamic import).
- Otherwise → API service.

In production, Vite substitutes `import.meta.env.DEV` with `false`, so Rollup drops the mock module and its seed data from the bundle. This has been verified against `dist/`.

### Caching and privacy

The query cache is **memory only**: contact data is never written to `localStorage`, IndexedDB or the service worker cache in API mode. The mock service's use of `localStorage` applies only on the dev server.

### Routing

`HashRouter` is used because GitHub Pages cannot rewrite unknown paths to `index.html`. Hash routes keep deep links, refreshes and installed-PWA launches working under the project base path (`/CelebrateMate/`), with no `404.html` workaround.

## Date model

- Stored: `YYYY-MM-DD` strings with the original year (`1990-11-21`).
- "Today" = `todayInTimeZone('Asia/Kolkata')` via `Intl.DateTimeFormat`, independent of device timezone.
- Arithmetic uses UTC epoch days, so it is free of DST and local-midnight bugs.
- Annual occurrence compares month and day. `nextOccurrence` is inclusive of today and rolls to next year once the date has passed.
- 29 February: `Feb29Policy` = `FEB_28` | `MAR_1`, a user setting applied in non-leap years.
- Inactive contacts and missing dates are skipped. Celebrations are de-duplicated by `eventDate|contactId|occasion`.
- Notification de-duplication key _(used by the scheduler in Phase 6)_: `eventDate|contactId|occasion|reminderType`.

The backend will implement the same rules in Apps Script, with matching tests and fixtures.

## Backend (Phase 2)

`backend/src/` is plain Apps Script (V8). All files share one global scope, and no file touches another file's globals at load time. The tests enforce this by loading the files in reverse order.

| File | Responsibility |
|------|----------------|
| `Code.gs` | `doPost` / `doGet`, plus editor functions: `setup`, `checkConfiguration`, `runSmokeTest`, `installTriggers`, `dispatchReminders` |
| `Router.gs` | Action → handler map, auth gate, write lock |
| `Auth.gs` | Google ID token verification and email allowlist |
| `Response.gs` | `AppError`, JSON envelope |
| `Config.gs` | Constants, sheet schema, Script Property access, injectable clock |
| `Database.gs` | Typed Sheets table access (header-mapped, text-formatted, formula-safe) |
| `Validation.gs` | Input validation and phone normalisation |
| `DateUtils.gs` | IST date maths (mirror of the frontend) |
| `ContactService.gs`, `TemplateService.gs`, `CategoryService.gs`, `SettingsService.gs`, `HistoryService.gs`, `DeviceService.gs` | Domain CRUD |
| `CelebrationService.gs` | Today / tomorrow / upcoming / month / dashboard |
| `NotificationService.gs` | Aggregation, dedupe, retry window, test push |
| `OneSignalService.gs` | REST client (key stays server-side) |
| `Scheduler.gs` | Single 15-minute dispatcher trigger |
| `DefaultData.gs` | Generated from the frontend templates (`npm run sync:templates`) |

**Request path:** `doPost` → parse JSON (≤ 100 KB) → `Router.handle` → `Auth.authenticate` (unless `system.ping`) → `Validation` → service → `Database`. Write actions run under `LockService`, with the cache cleared before reading.

**CORS:** the frontend POSTs `text/plain` JSON (a simple request, no preflight). Apps Script answers through a redirect with `Access-Control-Allow-Origin: *`, so the response is readable. No gateway is needed for this. A Cloudflare Worker remains an option if Google changes this behaviour. `no-cors` is never used.

**Scheduler:** a 15-minute trigger calls `dispatchReminders`. In IST it acts only within [reminder time, +180 minutes]:

- At most one aggregated push per reminder type per run.
- NotificationLogs holds one row per `eventDate|contactId|occasion|reminderType`. `SENT` and `SKIPPED` are final; `FAILED` retries up to 3 times.
- A deterministic OneSignal `idempotency_key` guards against duplicates when a request succeeded but the response was lost.
- Settings changes to reminder times take effect without reinstalling triggers.

**Testing:** `backend/tests/harness.js` runs the real `.gs` sources in a Node VM. It provides fakes for SpreadsheetApp, PropertiesService, CacheService, LockService, Utilities, UrlFetchApp (tokeninfo and OneSignal), ContentService and ScriptApp.

## Authentication (frontend)

- `AuthGate` shows one of: the app (signed in, or dev mock), "Setup required" (no API URL or client ID in the build), or the Google Sign-In screen.
- `googleAuth.ts` loads Google Identity Services and renders the button. `auto_select` and FedCM give silent re-sign-in for returning users.
- `session.ts` stores the ID token, about 1 hour lifetime, in `localStorage` so the installed PWA survives restarts.
  - A timer clears it at expiry.
  - The token is decoded only for display and expiry; the backend verifies it.
- `apiClient.ts` sends `{ action, payload, idToken, requestId }` as `text/plain`, with a 30 s timeout and `credentials: 'omit'`.
  - It maps the error envelope to `ServiceError`.
  - `UNAUTHORIZED` clears the session, which returns you to sign-in.
- The query cache is wiped whenever the signed-in email changes.

## WhatsApp module

- `WishComposerProvider` hosts one `WishComposer` for the whole app. It opens from celebration rows (dashboard, calendar) and from contact details.
- Flow:
  1. Active templates for the contact's category and occasion are shown, as `templatesFor()`.
  2. The chosen template is rendered with `{name}`, `{first_name}`, `{occasion}`, `{date}`, `{years}` and `{years_ordinal}`.
  3. You can edit the message, then open it.
- The open action is a real `<a href="https://wa.me/<digits>?text=<encodeURIComponent(message)>" target="_blank">`, so there are no popup blockers. In parallel, `history.logOpened` is sent with `keepalive`.
- The second step asks you to **Mark as sent** (`history.markSent`). Statuses `OPENED` and `MARKED_SENT` are never conflated.
- The History page and contact detail list entries, with mark-as-sent, re-open and copy.

## PWA and push

- **Service worker:** `pwa/service-worker.js` is built to `dist/sw.js` by a Vite plugin.
  - The plugin injects the exact precache list and a content-hash `BUILD_ID`, so every deploy purges the old cache.
  - The worker does two jobs: `importScripts(OneSignalSDK.sw.js)` for push, and the offline shell.
  - Caching rules: navigations are network-first with the cached `index.html` as offline fallback; hashed assets are cache-first.
  - Only same-origin GET requests inside the scope are handled, so the API, Google, OneSignal and fonts are never touched.
- **Registration:** the worker's scope is the base path (`/CelebrateMate/`).
  - The app registers `sw.js` only if no worker for that path is active. OneSignal is initialised with the same `serviceWorkerPath` and scope, so there is exactly one worker.
- **Push (`push.ts`):**
  - The SDK loads lazily.
  - Permission is requested only from the *Enable notifications* button.
  - The subscription ID is registered via `devices.register`. `usePushSync` re-registers on each sign-in and follows ID changes.
  - Removing a device deactivates it on the server and opts this browser out.
- **iOS:** web push only works in the Home Screen app (iOS 16.4+). The UI detects a Safari tab and shows install instructions instead.
- **Routing:** `HashRouter` keeps deep links working on GitHub Pages without server rewrites.

## CI/CD

`.github/workflows/deploy.yml` runs, in order:

1. Backend tests, frontend tests and the typecheck.
2. The build with `VITE_BASE_PATH=/<repo>/` and the public IDs from repository Variables.
3. Checks of the PWA files and the mock-data leak check.
4. `verify-sw.mjs` against the real Pages scope.
5. Upload and deploy to Pages.
