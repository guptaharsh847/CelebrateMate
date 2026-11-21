# CelebrateMate

A personal, mobile-first Progressive Web App for remembering birthdays and wedding anniversaries, sending WhatsApp wishes from editable templates, and receiving push reminders at 10 AM and 10 PM IST.

- **Frontend:** React 18 + TypeScript + Vite, Tailwind CSS, React Router, React Hook Form + Zod, date-fns, Lucide icons. Installable PWA on GitHub Pages.
- **Backend:** Google Apps Script (JSON API + scheduler) with Google Sheets as the database.
- **Auth:** Google Sign-In (Identity Services); the backend verifies the ID token and an email allowlist on every request.
- **Push:** OneSignal Web SDK v16. Android installed PWA and iOS/iPadOS 16.4+ Home Screen apps.

> **Status: all phases are implemented and tested locally.** Going live needs your accounts (Google Cloud, Apps Script, OneSignal, GitHub). Follow **[docs/deployment-guide.md](docs/deployment-guide.md)**, which lists every manual step and value in order. The audit results are in [docs/audit-report.md](docs/audit-report.md).

## Features

- **Dashboard:** today, tomorrow, next 7/30 days, category stats, quick actions.
- **Contacts:** create, edit, view, search, filter, deactivate/reactivate (soft delete). A contact can have both a birthday and an anniversary.
- **Calendar:** month view with birthday and anniversary indicators, category and occasion filters, day details.
- **WhatsApp wishes:**
  - Choose one of three templates for the contact's category and occasion, preview, and edit.
  - Variables are filled in automatically.
  - The app opens `wa.me` and never sends anything itself.
  - "Chat opened" and "Marked as sent" are recorded separately.
- **Templates:** the 18 defaults (3 categories × 2 occasions × 3), plus add, edit, deactivate and preview.
- **History:** every opened wish, with its status, timestamps, template and final message.
- **Settings:**
  - Reminder times, birthday and anniversary toggles, the 29 Feb rule, default country code.
  - Notification permission, registered devices, test notification, install app.
- **PWA:** manifest, icons (192/512/maskable/Apple), offline app shell. Contact data is never cached on the device.

## Repository layout

```
CelebrateMate/
├── .github/workflows/deploy.yml   Test → build → verify → deploy to GitHub Pages
├── frontend/                      React PWA
│   ├── src/
│   │   ├── components/            ui/, layout/, auth/, contacts/, templates/, celebrations/, wishes/, settings/
│   │   ├── pages/                 Route screens
│   │   ├── services/              DataService (API + dev mock), apiClient, session, googleAuth, push, pwa
│   │   ├── hooks/                 Query cache, data hooks, session, push sync
│   │   ├── types/                 Domain types
│   │   ├── utils/                 Date maths, celebrations, phone, messages, schemas
│   │   └── data/                  Default message templates (source of truth)
│   ├── pwa/service-worker.js      Combined OneSignal + offline-shell worker (built to dist/sw.js)
│   ├── scripts/                   generate-icons.mjs, verify-sw.mjs
│   └── public/                    manifest, icons, favicon
├── backend/
│   ├── src/                       Apps Script sources (*.gs + appsscript.json)
│   ├── tests/                     Node tests running the real .gs files against simulated Google services
│   └── scripts/                   sync-default-templates.mjs
└── docs/                          architecture, database-schema, api-documentation, deployment-guide, audit-report
```

## Local development

```bash
cd frontend
npm install
npm run dev:mock        # full app with demo data (dev server only), http://localhost:5173
```

To run against your real backend locally: `cp .env.example .env.local`, fill in the three public IDs, then `npm run dev`.

### Commands

```bash
# frontend/
npm test                # Vitest: dates, Feb 29, celebrations, dedupe keys, phone, messages, all 18 templates, JWT decode
npm run typecheck
npm run build           # → dist/ (+ dist/sw.js with the precache manifest)
npm run verify:sw       # simulate the built service worker (scope, offline, no API caching)
npm run icons           # regenerate PWA icons

# backend/
npm test                # 58 tests: setup, auth, CRUD, validation, celebrations, history, devices, reminders
npm run sync:templates  # regenerate DefaultData.gs from the frontend templates
```

## Security model (summary)

- The frontend bundle contains only public identifiers: the API URL, the OAuth client ID and the OneSignal App ID.
- Secrets live only in Apps Script **Script Properties**: the OneSignal REST key, the email allowlist, and the spreadsheet ID if the script is standalone.
- Every API call except the health ping must carry a Google ID token with the right `aud`, a Google issuer, a future expiry and a verified, allowlisted email. The API fails closed if this isn't configured.
- Requests are `text/plain` POSTs (CORS simple requests). `no-cors` is never used.
- The service worker caches only the app's own static files, never API responses or contact data.

See [docs/architecture.md](docs/architecture.md) for details.
