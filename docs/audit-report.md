# Production Readiness Audit

Date: 2026-11-20 · Scope: frontend (React PWA), backend (Apps Script), CI workflow.

**Evidence legend**

- **Verified:** checked by automated tests or by inspecting build output, on this machine.
- **Needs device test:** depends on real Google, OneSignal or GitHub accounts and real phones, which don't exist yet. Listed in the [final checklist](deployment-guide.md#8-go-live-verification).

## Results

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | All buttons and forms work | Verified (logic) / needs device test (UI) | Every button has a handler (grep audit). Forms use Zod schemas that mirror backend validation. Loading, error, empty and success states are on every page. No placeholder or "coming soon" buttons remain. |
| 2 | Contact CRUD | Verified | Backend tests cover create, get, update, deactivate, reactivate, search and filter, duplicate prevention, field validation, formula injection and hand-edited cells. Frontend uses the same `DataService` contract against mock and API. |
| 3 | Google Sheets integration | Verified against simulated Sheets / needs live test | 58 backend tests run the real `.gs` files through `doPost`. Frontend `apiDataService` maps one-to-one to the Router actions (names and payload shapes checked against `Router.gs`). |
| 4 | WhatsApp encoding | Verified | `encodeURIComponent` round-trip tests for all 18 templates with emoji, `&`, apostrophes and newlines. wa.me numbers are digits only, with country code. Opening happens through a real `<a>` (no popup blocker), and logging uses `keepalive`. |
| 5 | All 18 templates | Verified | Each template is rendered with 3 contexts: no leftover `{vars}`, the length check passes, the URL is valid. Backend seeds identical text (sync test). At least one active template per group is enforced. |
| 6 | Calendar year boundaries and leap years | Verified | Dec→Jan upcoming windows, month navigation index maths, Feb 29 with the `FEB_28` and `MAR_1` policies, no events before the original date, IST midnight boundary. |
| 7 | Duplicate notifications prevented | Verified | Per-key logs (`eventDate|contactId|occasion|reminderType`). Re-runs and manual runs send nothing new. Retries are capped at 3 inside the window. Deterministic OneSignal `idempotency_key`. Lock around the dispatcher. |
| 8 | PWA installs correctly | Verified (build) / needs device test | Manifest (`id`, `scope`, `start_url`, 192/512 and maskable icons), Apple touch icon, service worker with a fetch handler. All URLs served correctly under `/CelebrateMate/` in local production preview. |
| 9 | Push when the app is closed | Needs device test | The service worker imports `OneSignalSDK.sw.js` (v16), so pushes are handled by the browser even with the app closed. Delivery is never guaranteed and is logged as "accepted by OneSignal". |
| 10 | API auth and secrets | Verified | ID token checks: `aud`, `iss`, `exp`, `email_verified`, allowlist. Fails closed when not configured. The REST key is never returned (test). Grep audit: no secrets in the frontend or workflow. The spreadsheet ID is not in the repo. Internal errors return only a requestId. |
| 11 | Base path and SW scope | Verified | `vite.config.ts` normalises and validates `VITE_BASE_PATH`. `scripts/verify-sw.mjs` runs the built worker under `/CelebrateMate/`: precache inside scope, no cross-origin, POST or out-of-scope interception, offline navigation served from cache. CI runs it on every deploy. |

## Issues found and fixed during the audit

| Issue | Impact | Fix |
|-------|--------|-----|
| `index.html` missing from the SW precache (Vite emits HTML after plugin hooks) | Offline launch would show the browser's error page | Always precache `index.html`; asserted by `verify-sw.mjs` |
| `useSession` could clear the session during render (side effect in `useSyncExternalStore` snapshot) | React warning / possible render loop at token expiry | Pure `peekSession()` for rendering, plus a timer that clears at expiry |
| `VITE_BASE_PATH` silently mangled by Git Bash path conversion | Broken asset URLs in local Windows builds | Config rejects filesystem-like base paths with a clear message |
| Notification test depended on random ID ordering | Flaky CI | Order-independent assertion |
| Account switch kept the previous account's cached data | Privacy | Query cache cleared whenever the signed-in email changes |
| Duplicate SW registration risk (OneSignal registers the same file with query params) | Repeated SW updates | Only register when no worker for that path is active; otherwise `update()` |

## Known limitations (by design or platform)

- **Scheduling is approximate.** Apps Script triggers fire within their minute window. The 15-minute dispatcher sends within about 15 minutes after 10:00 and 22:00 IST.
- **Push delivery is not guaranteed** by browsers, OS battery savers or OneSignal. Logs say "accepted", not "delivered".
- **WhatsApp delivery is not verifiable.** "Opened" and "Marked as sent" are separate, user-driven states.
- **iOS:** push requires iOS/iPadOS 16.4+ and the app opened from the Home Screen. Safari tabs can't receive web push. On iOS the Home Screen app has its own storage, so you sign in once inside it.
- **Sign-in lasts about 1 hour** (Google ID token lifetime). Returning users are signed back in automatically (One Tap / FedCM) when the browser allows it, otherwise with one tap on the Google button.
- **Offline:** the app shell opens offline, but contact data is intentionally not stored on the device, so data screens show a "you're offline" message until you reconnect.
- **No Content-Security-Policy header:** GitHub Pages can't set response headers. A `<meta>` CSP is possible future hardening, but it needs testing against the live Google and OneSignal domains first.
